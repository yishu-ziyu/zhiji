import type {
  ActionItem,
  AttentionItem,
  CanvasEdge,
  CanvasInspector,
  CanvasNode,
  CanvasNodeRef,
  CanvasTimeline,
  CanvasTimelineEvent,
  KnowledgeCard,
  KnowledgeRelation,
  PlanAssessment,
  Project,
  ProjectCanvasSnapshot,
  ProjectCheckpoint,
  WorkEvent,
} from "@/shared/types/knowledge";
import { RELATION_TYPE_LABELS, STATUS_LABELS } from "@/shared/types/knowledge";

export type ProjectFacts = {
  project: Project;
  cards: KnowledgeCard[];
  workItems: ActionItem[];
  events: WorkEvent[];
  relations: KnowledgeRelation[];
  checkpoint: ProjectCheckpoint | null;
};

export type ProjectCanvasInput = ProjectFacts & {
  focus: CanvasNodeRef;
  now: string;
};

const DAY = 86_400_000;

function refKey(ref: CanvasNodeRef): string {
  return `${ref.kind}:${ref.id}`;
}

function latestEvent(events: WorkEvent[], workItemId: string): WorkEvent | null {
  return (
    events
      .filter((event) => event.workItemId === workItemId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export function rankAttention(
  input: ProjectFacts,
  now: string,
): AttentionItem[] {
  const nowMs = Date.parse(now);
  const candidates: AttentionItem[] = [];

  for (const item of input.workItems) {
    if (item.status === "done" || item.status === "cancelled") continue;
    const itemEvents = input.events.filter(
      (event) => event.workItemId === item.id,
    );
    const latest = latestEvent(input.events, item.id);
    if (!latest) continue;

    let reasonCode: AttentionItem["reasonCode"] | null = null;
    let reason = "";
    let score = 0;
    let trigger: WorkEvent | null = null;

    if (item.status === "blocked") {
      trigger = itemEvents
        .filter(
          (event) =>
            event.type === "block" || event.meta?.toStatus === "blocked",
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      reasonCode = "blocked";
      reason = `“${item.title}”已阻塞：${item.blockedReason || trigger?.body || "原因待确认"}`;
      score = 600;
    } else if (item.status === "confirmed") {
      trigger = itemEvents
        .filter(
          (event) =>
            event.type === "result" || event.meta?.toStatus === "confirmed",
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      reasonCode = "awaiting_confirmation";
      reason = `“${item.title}”已有结果，正在等你确认`;
      score = 500;
    } else if (
      /^\d{4}-\d{2}-\d{2}/.test(item.deadline) &&
      Date.parse(`${item.deadline.slice(0, 10)}T23:59:59.999Z`) < nowMs
    ) {
      trigger = itemEvents
        .filter((event) => event.type === "status_change")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? latest;
      reasonCode = "overdue";
      reason = `“${item.title}”已超过 ${item.deadline.slice(0, 10)}，仍未结束`;
      score = 400;
    } else {
      const recent = itemEvents
        .filter((event) =>
          ["decision", "next_step_change", "result"].includes(event.type),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (recent && nowMs - Date.parse(recent.createdAt) <= 2 * DAY) {
        trigger = recent;
        reasonCode = recent.type === "result" ? "agent_result" : "recent_change";
        reason = `“${item.title}”刚发生变化：${recent.body}`;
        score = recent.type === "result" ? 320 : 350;
      } else if (
        item.status === "doing" &&
        nowMs - Date.parse(item.updatedAt) >= 3 * DAY
      ) {
        trigger = latest;
        reasonCode = "stale";
        reason = `“${item.title}”已连续三天没有更新`;
        score = 200;
      }
    }

    if (reasonCode) {
      candidates.push({
        target: { kind: "work_item", id: item.id },
        reasonCode,
        reason,
        evidenceEventIds: trigger ? [trigger.id] : [],
        score:
          score +
          Math.max(0, Date.parse(trigger?.createdAt ?? latest.createdAt) / 1e13),
      });
    }
  }

  if (candidates.length === 0) {
    const next = input.workItems
      .filter((item) => item.status !== "done" && item.status !== "cancelled")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .find((item) => latestEvent(input.events, item.id));
    const event = next ? latestEvent(input.events, next.id) : null;
    if (next && event) {
      candidates.push({
        target: { kind: "work_item", id: next.id },
        reasonCode: "recent_change",
        reason: `“${next.title}”是最近仍需继续的工作`,
        evidenceEventIds: [event.id],
        score: 100,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function assessPlan(
  checkpoint: ProjectCheckpoint | null,
  events: WorkEvent[],
  cards: KnowledgeCard[],
): PlanAssessment {
  if (!checkpoint) {
    return {
      status: "insufficient",
      reason: "尚未保存你离开项目时确认的目标和下一步",
      evidence: [],
    };
  }

  const changes = events
    .filter((event) => event.createdAt > checkpoint.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const blocking = changes.find(
    (event) =>
      event.type === "block" ||
      (event.type === "result" && Boolean(event.meta?.error)),
  );
  if (blocking) {
    return {
      status: "adjust",
      reason: `原计划受到新变化影响：${blocking.body}`,
      evidence: [{ kind: "event", id: blocking.id }],
    };
  }

  const reaffirmed = changes.find(
    (event) =>
      event.type === "decision" && event.meta?.reaffirmsNextStep === true,
  );
  if (reaffirmed) {
    return {
      status: "continue",
      reason: `你已重新确认下一步：${checkpoint.nextStep}`,
      evidence: [{ kind: "event", id: reaffirmed.id }],
    };
  }

  const decision = changes.find((event) => event.type === "decision");
  if (decision) {
    return {
      status: "adjust",
      reason: `离开后出现新决定：${decision.body}`,
      evidence: [{ kind: "event", id: decision.id }],
    };
  }

  const recentCard = cards
    .filter((card) => card.timestamp > checkpoint.createdAt)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  return {
    status: "insufficient",
    reason: recentCard
      ? "出现了新材料，但现有信息不足以判断原计划是否仍成立"
      : "没有足够的新证据判断原计划是否仍成立",
    evidence: recentCard ? [{ kind: "card", id: recentCard.id }] : [],
  };
}

function reviewFromEvent(
  event: WorkEvent,
): CanvasTimelineEvent["review"] | undefined {
  const review = event.meta?.review;
  if (!review || typeof review !== "object") return undefined;
  const value = review as Record<string, unknown>;
  return {
    judgment: String(value.judgment ?? ""),
    gaps: Array.isArray(value.gaps) ? value.gaps.map(String) : [],
    nextStep: String(value.nextStep ?? ""),
    evidenceIds: Array.isArray(value.evidenceIds)
      ? value.evidenceIds.map(String)
      : [],
    mode: value.mode === "model" ? "model" : "deterministic",
  };
}

export function buildCanvasTimeline(
  events: WorkEvent[],
  workItems: ActionItem[],
): CanvasTimeline {
  const currentEventIds = new Set<string>();
  for (const item of workItems) {
    if (!["doing", "blocked", "confirmed"].includes(item.status)) continue;
    const latestSignal = events
      .filter(
        (event) =>
          event.workItemId === item.id && event.type !== "comment",
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (latestSignal) currentEventIds.add(latestSignal.id);
  }
  const projected = events
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map<CanvasTimelineEvent>((event) => {
      const phase = currentEventIds.has(event.id) ? "now" : "history";
      return {
        id: event.id,
        ref: { kind: "event", id: event.id },
        workItemId: event.workItemId,
        type: event.type,
        actor: event.actor,
        body: event.body,
        createdAt: event.createdAt,
        phase,
        review: reviewFromEvent(event),
      };
    });
  return {
    now: projected.filter((event) => event.phase === "now"),
    history: projected.filter((event) => event.phase === "history"),
  };
}

function itemState(item: ActionItem): CanvasNode["state"] {
  if (item.status === "blocked") return "blocked";
  if (item.status === "done" || item.status === "confirmed") return "confirmed";
  if (item.status === "doing") return "active";
  return "neutral";
}

function makeNode(
  ref: CanvasNodeRef,
  label: string,
  subtitle: string | undefined,
  depth: 0 | 1,
  state: CanvasNode["state"] = "neutral",
  evidence: CanvasNodeRef[] = [],
): CanvasNode {
  return { ref, label, subtitle, depth, state, evidence };
}

function makeEdge(
  source: CanvasNodeRef,
  target: CanvasNodeRef,
  label: string,
  options?: Pick<CanvasEdge, "evidenceSentence" | "status">,
): CanvasEdge {
  return {
    id: `${refKey(source)}>${refKey(target)}`,
    source,
    target,
    label,
    evidenceSentence: options?.evidenceSentence,
    status: options?.status ?? "confirmed",
  };
}

function focusEvents(
  focus: CanvasNodeRef,
  cards: KnowledgeCard[],
  items: ActionItem[],
  events: WorkEvent[],
): WorkEvent[] {
  if (focus.kind === "project") return events;
  if (focus.kind === "work_item") {
    return events.filter((event) => event.workItemId === focus.id);
  }
  if (focus.kind === "event") {
    const selected = events.find((event) => event.id === focus.id);
    return selected
      ? events.filter((event) => event.workItemId === selected.workItemId)
      : [];
  }
  const card = cards.find((entry) => entry.id === focus.id);
  if (!card) return [];
  const workIds = new Set(
    items
      .filter((item) => item.evidenceIds.includes(card.id))
      .map((item) => item.id),
  );
  return events.filter((event) => workIds.has(event.workItemId));
}

function buildGraph(input: ProjectCanvasInput, attention: AttentionItem[]) {
  const nodes = new Map<string, CanvasNode>();
  const edges: CanvasEdge[] = [];
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  const items = new Map(input.workItems.map((item) => [item.id, item]));
  const events = new Map(input.events.map((event) => [event.id, event]));
  const add = (node: CanvasNode) => nodes.set(refKey(node.ref), node);

  if (input.focus.kind === "project") {
    const center = { kind: "project", id: input.project.id } as const;
    add(makeNode(center, input.project.name, "当前项目", 0, "active"));
    const targets = attention.length
      ? attention.map((entry) => entry.target)
      : input.workItems.slice(0, 3).map((item) => ({
          kind: "work_item" as const,
          id: item.id,
        }));
    for (const target of targets) {
      const item = items.get(target.id);
      if (!item) continue;
      add(
        makeNode(
          target,
          item.title,
          STATUS_LABELS[item.status],
          1,
          itemState(item),
          item.evidenceIds.map((id) => ({ kind: "card", id })),
        ),
      );
      edges.push(makeEdge(center, target, "当前重点"));
    }
    for (const card of input.cards.slice(0, Math.max(0, 5 - targets.length))) {
      const target = { kind: "card", id: card.id } as const;
      add(makeNode(target, card.title || card.content.slice(0, 24), card.source, 1));
      edges.push(makeEdge(center, target, "项目材料"));
    }
  }

  if (input.focus.kind === "work_item") {
    const item = items.get(input.focus.id);
    if (!item) throw new Error("工作项不属于当前项目");
    add(
      makeNode(
        input.focus,
        item.title,
        STATUS_LABELS[item.status],
        0,
        itemState(item),
      ),
    );
    for (const cardId of item.evidenceIds.slice(0, 4)) {
      const card = cards.get(cardId);
      if (!card) continue;
      const target = { kind: "card", id: card.id } as const;
      add(makeNode(target, card.title || card.content.slice(0, 24), card.source, 1));
      edges.push(makeEdge(input.focus, target, "依据"));
    }
    for (const event of input.events
      .filter((entry) => entry.workItemId === item.id && entry.type !== "comment")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)) {
      const target = { kind: "event", id: event.id } as const;
      add(
        makeNode(
          target,
          event.body || event.type,
          event.actor,
          1,
          event.type === "block" ? "blocked" : "changed",
        ),
      );
      edges.push(makeEdge(input.focus, target, "执行记录"));
    }
  }

  if (input.focus.kind === "card") {
    const card = cards.get(input.focus.id);
    if (!card) throw new Error("卡片不属于当前项目");
    add(
      makeNode(
        input.focus,
        card.title || card.content.slice(0, 24),
        card.source,
        0,
        "active",
      ),
    );
    for (const relation of input.relations.filter(
      (entry) => entry.fromCardId === card.id || entry.toCardId === card.id,
    )) {
      const otherId =
        relation.fromCardId === card.id
          ? relation.toCardId
          : relation.fromCardId;
      const other = cards.get(otherId);
      if (!other) continue;
      const target = { kind: "card", id: other.id } as const;
      add(
        makeNode(
          target,
          other.title || other.content.slice(0, 24),
          other.source,
          1,
          relation.status === "suggested" ? "changed" : "neutral",
          [{ kind: "card", id: card.id }],
        ),
      );
      const source = relation.directed
        ? ({ kind: "card", id: relation.fromCardId } as const)
        : input.focus;
      const relationTarget = relation.directed
        ? ({ kind: "card", id: relation.toCardId } as const)
        : target;
      edges.push(
        makeEdge(source, relationTarget, RELATION_TYPE_LABELS[relation.relationType], {
          evidenceSentence: relation.evidenceSentence,
          status:
            relation.status === "suggested" ? "suggested" : "confirmed",
        }),
      );
    }
    for (const item of input.workItems
      .filter((entry) => entry.evidenceIds.includes(card.id))
      .slice(0, 3)) {
      const target = { kind: "work_item", id: item.id } as const;
      add(makeNode(target, item.title, STATUS_LABELS[item.status], 1, itemState(item)));
      edges.push(makeEdge(input.focus, target, "被工作项使用"));
    }
    const relatedWorkIds = new Set(
      input.workItems
        .filter((item) => item.evidenceIds.includes(card.id))
        .map((item) => item.id),
    );
    const relatedEvents = input.events
      .filter(
        (event) =>
          relatedWorkIds.has(event.workItemId) && event.type !== "comment",
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 2);
    for (const event of relatedEvents) {
      const target = { kind: "event", id: event.id } as const;
      add(
        makeNode(
          target,
          event.body || event.type,
          event.actor,
          1,
          event.type === "block" ? "blocked" : "changed",
        ),
      );
      edges.push(makeEdge(input.focus, target, "相关记录"));
    }
  }

  if (input.focus.kind === "event") {
    const event = events.get(input.focus.id);
    if (!event) throw new Error("事件不属于当前项目");
    add(
      makeNode(
        input.focus,
        event.body || event.type,
        event.actor,
        0,
        event.type === "block" ? "blocked" : "active",
      ),
    );
    const item = items.get(event.workItemId);
    if (item) {
      const target = { kind: "work_item", id: item.id } as const;
      add(makeNode(target, item.title, STATUS_LABELS[item.status], 1, itemState(item)));
      edges.push(makeEdge(input.focus, target, "属于"));
      const review = event.meta?.review as
        | { evidenceIds?: unknown }
        | undefined;
      const explicitCardIds = [
        ...(typeof event.meta?.cardId === "string" ? [event.meta.cardId] : []),
        ...(Array.isArray(event.meta?.evidenceIds)
          ? event.meta.evidenceIds.map(String)
          : []),
        ...(Array.isArray(review?.evidenceIds)
          ? review.evidenceIds.map(String)
          : []),
      ];
      for (const cardId of [...new Set(explicitCardIds)].slice(0, 3)) {
        const card = cards.get(cardId);
        if (!card) continue;
        const cardRef = { kind: "card", id: card.id } as const;
        add(makeNode(cardRef, card.title || card.content.slice(0, 24), card.source, 1));
        edges.push(makeEdge(input.focus, cardRef, "引用依据"));
      }
      const critical = input.events
        .filter(
          (entry) =>
            entry.workItemId === event.workItemId && entry.type !== "comment",
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const index = critical.findIndex((entry) => entry.id === event.id);
      for (const adjacent of [critical[index - 1], critical[index + 1]]) {
        if (!adjacent) continue;
        const adjacentRef = { kind: "event", id: adjacent.id } as const;
        add(
          makeNode(
            adjacentRef,
            adjacent.body || adjacent.type,
            adjacent.actor,
            1,
            adjacent.type === "block" ? "blocked" : "changed",
          ),
        );
        edges.push(makeEdge(input.focus, adjacentRef, "相邻记录"));
      }
    }
  }

  return { nodes: [...nodes.values()], edges };
}

function buildInspector(
  input: ProjectCanvasInput,
  attention: AttentionItem[],
): CanvasInspector {
  if (input.focus.kind === "project") {
    const checkpoint = input.checkpoint;
    return {
      title: input.project.name,
      summary: checkpoint
        ? `离开时的目标：${checkpoint.goal}`
        : "根据现有材料和事件整理，尚未保存你确认的离开状态。",
      whyImportant: checkpoint
        ? `原下一步：${checkpoint.nextStep}`
        : "先确认当前目标，系统才能在下次准确说明变化。",
      evidence: [],
      impacts: attention.map((item) => item.target),
      availableActions: ["confirm_checkpoint"],
    };
  }
  if (input.focus.kind === "work_item") {
    const item = input.workItems.find((entry) => entry.id === input.focus.id);
    if (!item) throw new Error("工作项不属于当前项目");
    return {
      title: item.title,
      summary: item.description,
      whyImportant:
        item.status === "blocked"
          ? item.blockedReason || "这项工作当前被阻塞"
          : `当前状态：${STATUS_LABELS[item.status]}；下一步：${item.nextStep}`,
      evidence: item.evidenceIds.map((id) => ({ kind: "card", id })),
      impacts: [],
      availableActions: ["open_evidence", "update_next_step", "run_agent"],
    };
  }
  if (input.focus.kind === "card") {
    const card = input.cards.find((entry) => entry.id === input.focus.id);
    if (!card) throw new Error("卡片不属于当前项目");
    return {
      title: card.title || "项目材料",
      summary: card.content,
      whyImportant: "这条材料被当前项目的关系或工作项引用。",
      evidence: [{ kind: "card", id: card.id }],
      impacts: input.workItems
        .filter((item) => item.evidenceIds.includes(card.id))
        .map((item) => ({ kind: "work_item", id: item.id })),
      availableActions: ["open_evidence"],
    };
  }
  const event = input.events.find((entry) => entry.id === input.focus.id);
  if (!event) throw new Error("事件不属于当前项目");
  return {
    title: event.body || event.type,
    summary: `${event.actor} · ${event.createdAt}`,
    whyImportant: "这条记录说明项目状态为什么发生变化。",
    evidence: [{ kind: "event", id: event.id }],
    impacts: [{ kind: "work_item", id: event.workItemId }],
    availableActions: [],
  };
}

export function buildProjectCanvasSnapshot(
  input: ProjectCanvasInput,
): ProjectCanvasSnapshot {
  const attention = rankAttention(input, input.now);
  const graph = buildGraph(input, attention);
  const relevantEvents = focusEvents(
    input.focus,
    input.cards,
    input.workItems,
    input.events,
  );
  const timeline = buildCanvasTimeline(relevantEvents, input.workItems);
  const changesSinceCheckpoint = input.checkpoint
    ? [...timeline.now, ...timeline.history].filter(
        (event) => event.createdAt > input.checkpoint!.createdAt,
      )
    : [...timeline.now, ...timeline.history];

  return {
    project: input.project,
    focus: input.focus,
    checkpoint: input.checkpoint,
    checkpointSource: input.checkpoint ? "confirmed" : "inferred",
    changesSinceCheckpoint,
    planAssessment: assessPlan(input.checkpoint, input.events, input.cards),
    attention,
    nodes: graph.nodes,
    edges: graph.edges,
    inspector: buildInspector(input, attention),
    timeline,
  };
}
