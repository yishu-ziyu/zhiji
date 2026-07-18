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
import { edgeDirection } from "@/shared/knowledge/relations";
import {
  agentDisplayName,
  buildAgentActivityView,
  isAgentActor,
  listAgentActors,
} from "@/shared/knowledge/agent-activity";
import {
  isUsefulCanvasCard,
  sortCardsForCanvas,
} from "@/shared/knowledge/canvas-material-rank";
import { materialCardSummary } from "@/shared/knowledge/materials";
import { reviewProjectNow } from "@/shared/knowledge/project-review-agent";
import type { ProjectNowView } from "@/shared/types/knowledge";

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
  recentCardIds?: string[];
  /**
   * Agent / Owner presented business-logic chain: force these cards onto the
   * project hub as neighbors and draw sequential presentation edges.
   * Session presentation only — not durable invented relations.
   */
  pinCardIds?: string[];
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
      // Human-set work status 「待确认」 — still human attention, not knowledge L4.
      trigger = itemEvents
        .filter(
          (event) =>
            event.type === "result" || event.meta?.toStatus === "confirmed",
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      reasonCode = "awaiting_confirmation";
      reason = `“${item.title}”已有结果，正在等你确认`;
      score = 500;
    } else if (item.status === "doing") {
      // Agent (or anyone) left a result while work stays open — await human, do not
      // imply knowledge confirmed. Prefer this over overdue/recent for doing items.
      const unackedResult = itemEvents
        .filter((event) => event.type === "result")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (unackedResult) {
        trigger = unackedResult;
        reasonCode = "awaiting_confirmation";
        reason = `“${item.title}”已有结果，正在等你确认`;
        score = 500;
      }
    }

    if (!reasonCode) {
      if (
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

  // Material-only projects: still surface a focus so attention is never a dead control.
  // Prefer readable materials; never promote lockfiles / media / tooling scripts.
  if (candidates.length === 0 && input.cards.length > 0) {
    const topCards = sortCardsForCanvas(
      input.cards.filter((card) => isUsefulCanvasCard(card)),
    ).slice(0, 2);
    for (const card of topCards) {
      const label =
        card.title?.trim() ||
        card.sourceFileId?.split("/").pop() ||
        card.content.slice(0, 24) ||
        "项目材料";
      candidates.push({
        target: { kind: "card", id: card.id },
        reasonCode: "recent_change",
        reason: `材料「${label}」可作为当前阅读重点`,
        evidenceEventIds: [],
        score: 80 + Math.max(0, Date.parse(card.timestamp) / 1e13),
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
  const currentlyBlocked = new Set<string>();
  for (const event of [...changes].reverse()) {
    if (event.type === "block") currentlyBlocked.add(event.workItemId);
    if (event.type === "unblock") currentlyBlocked.delete(event.workItemId);
  }
  const blocking = changes.find(
    (event) =>
      (event.type === "block" && currentlyBlocked.has(event.workItemId)) ||
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

  const changedPlan = changes.find(
    (event) =>
      event.type === "decision" || event.type === "next_step_change",
  );
  if (changedPlan) {
    return {
      status: "adjust",
      reason:
        changedPlan.type === "decision"
          ? `离开后出现新决定：${changedPlan.body}`
          : `离开后下一步已经改变：${changedPlan.body}`,
      evidence: [{ kind: "event", id: changedPlan.id }],
    };
  }

  const result = changes.find((event) => event.type === "result");
  if (result) {
    return {
      status: "insufficient",
      reason: `Agent 已写回新结果，需要你确认是否改变原计划：${result.body}`,
      evidence: [{ kind: "event", id: result.id }],
    };
  }

  const recentCard = cards
    .filter((card) => card.timestamp > checkpoint.createdAt)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (recentCard) {
    return {
      status: "insufficient",
      reason: "出现了新材料，但现有信息不足以判断原计划是否仍成立",
      evidence: [{ kind: "card", id: recentCard.id }],
    };
  }

  if (changes[0]) {
    return {
      status: "insufficient",
      reason: `离开后有新记录，需要你确认它是否影响原计划：${changes[0].body}`,
      evidence: [{ kind: "event", id: changes[0].id }],
    };
  }

  const latestKnownEvent = events
    .filter((event) => event.createdAt <= checkpoint.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latestKnownEvent) {
    return {
      status: "continue",
      reason: "离开后没有记录到改变原下一步的变化",
      evidence: [{ kind: "event", id: latestKnownEvent.id }],
    };
  }

  const latestKnownCard = cards
    .filter((card) => card.timestamp <= checkpoint.createdAt)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  return latestKnownCard
    ? {
        status: "continue",
        reason: "离开后没有记录到改变原下一步的变化",
        evidence: [{ kind: "card", id: latestKnownCard.id }],
      }
    : {
        status: "insufficient",
        reason: "没有可引用的记录来判断原计划是否仍成立",
        evidence: [],
      };
}

function reviewFromEvent(
  event: WorkEvent,
  allowedEvidenceIds?: Set<string>,
): CanvasTimelineEvent["review"] | undefined {
  const review = event.meta?.review;
  if (!review || typeof review !== "object") return undefined;
  const value = review as Record<string, unknown>;
  return {
    judgment: String(value.judgment ?? ""),
    gaps: Array.isArray(value.gaps) ? value.gaps.map(String) : [],
    nextStep: String(value.nextStep ?? ""),
    evidenceIds: Array.isArray(value.evidenceIds)
      ? value.evidenceIds
          .map(String)
          .filter((id) => !allowedEvidenceIds || allowedEvidenceIds.has(id))
      : [],
    mode: value.mode === "model" ? "model" : "deterministic",
  };
}

export function buildCanvasTimeline(
  events: WorkEvent[],
  workItems: ActionItem[],
  allowedEvidenceIds?: Set<string>,
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
        review: reviewFromEvent(event, allowedEvidenceIds),
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

/** Higher = keep when two edges share the same endpoint pair. */
const EDGE_LABEL_RANK: Record<string, number> = {
  当前重点: 100,
  阻塞: 95,
  在跟工作: 90,
  理解依据: 80,
  工作依据: 75,
  依据: 70,
  所属项目: 65,
  关联材料: 55,
  处理过: 50,
  执行记录: 48,
  项目材料: 40,
  业务逻辑: 88,
  逻辑串联: 86,
  最近打开: 10,
  Agent: 85,
};

export function classifyEdgeLabel(label: string): {
  kind: NonNullable<CanvasEdge["kind"]>;
  strength: NonNullable<CanvasEdge["strength"]>;
  why: string;
  rank: number;
} {
  const rank = EDGE_LABEL_RANK[label] ?? 30;
  switch (label) {
    case "当前重点":
      return {
        kind: "attention",
        strength: "strong",
        why: "系统根据工作状态或材料信号标成当前重点。",
        rank,
      };
    case "在跟工作":
      return {
        kind: "work",
        strength: "strong",
        why: "未结束的工作项，和项目中心直接相关。",
        rank,
      };
    case "阻塞":
      return {
        kind: "blocked",
        strength: "strong",
        why: "工作被阻塞，需要优先处理。",
        rank,
      };
    case "理解依据":
    case "工作依据":
    case "依据":
      return {
        kind: "evidence",
        strength: "strong",
        why: "这条材料被用作理解或工作的依据。",
        rank,
      };
    case "关联材料":
      return {
        kind: "relation",
        strength: "medium",
        why: "材料已进入关系结构（被其它材料或工作引用）。",
        rank,
      };
    case "业务逻辑":
      return {
        kind: "evidence",
        strength: "strong",
        why: "Agent 根据已读项目材料将其纳入业务逻辑呈现。",
        rank,
      };
    case "逻辑串联":
      return {
        kind: "relation",
        strength: "strong",
        why: "Agent 根据已读材料将两处业务节点串联（呈现边，非持久关系库写入）。",
        rank,
      };
    case "所属项目":
      return {
        kind: "project",
        strength: "medium",
        why: "从当前焦点回到项目中心。",
        rank,
      };
    case "执行记录":
    case "处理过":
      return {
        kind: "activity",
        strength: "medium",
        why: "执行或 Agent 活动产生的记录。",
        rank,
      };
    case "最近打开":
      return {
        kind: "recent",
        strength: "weak",
        why: "最近打开过；弱关联，默认不抢主视觉。",
        rank,
      };
    case "Agent":
      return {
        kind: "activity",
        strength: "strong",
        why: "Agent 在本项目留下过执行记录。",
        rank,
      };
    case "项目材料":
      return {
        kind: "material",
        strength: "medium",
        why: "项目内可读材料，用于填充结构。",
        rank,
      };
    default:
      return {
        kind: "other",
        strength: rank >= 70 ? "strong" : rank >= 40 ? "medium" : "weak",
        why: `关系类型：${label}`,
        rank,
      };
  }
}

function makeEdge(
  source: CanvasNodeRef,
  target: CanvasNodeRef,
  label: string,
  options?: Pick<
    CanvasEdge,
    "evidenceSentence" | "status" | "relationId" | "direction" | "why"
  >,
): CanvasEdge {
  const meta = classifyEdgeLabel(label);
  return {
    id: options?.relationId
      ? `relation:${options.relationId}`
      : `${refKey(source)}>${refKey(target)}`,
    relationId: options?.relationId,
    source,
    target,
    label,
    evidenceSentence: options?.evidenceSentence,
    status: options?.status ?? "confirmed",
    direction: options?.direction ?? "out",
    kind: meta.kind,
    strength: meta.strength,
    why: options?.why ?? meta.why,
  };
}

/** Collapse duplicate material cards (same basename / path) to one graph identity. */
export function cardDedupeKey(card: {
  id: string;
  title?: string;
  sourceFileId?: string;
  content?: string;
}): string {
  const raw = (card.sourceFileId || card.title || "").replace(/\\/g, "/").trim();
  const base = (raw.split("/").pop() || raw).toLowerCase();
  if (base) return `file:${base}`;
  const title = (card.title || "").trim().toLowerCase();
  if (title) return `title:${title}`;
  return `id:${card.id}`;
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
  if (focus.kind === "agent") {
    return events.filter((event) => event.actor === focus.id);
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

type GraphTarget = {
  ref: CanvasNodeRef;
  edgeLabel: string;
};

/**
 * Project-center neighbor policy (Canvasight-style):
 * show Agent understanding / work / cited evidence first.
 * Raw files only fill remaining slots — never dump the whole folder.
 */
function projectNeighborTargets(
  input: ProjectCanvasInput,
  attention: AttentionItem[],
  understandingEvidenceIds: string[],
): GraphTarget[] {
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  const items = new Map(input.workItems.map((item) => [item.id, item]));
  const ordered: GraphTarget[] = [];
  const seen = new Set<string>();
  const seenCardIdentity = new Set<string>();
  const cardEdgeLabel = new Map<string, string>();

  const push = (ref: CanvasNodeRef, edgeLabel: string) => {
    if (ref.kind === "project" && ref.id === input.project.id) return;
    if (ref.kind === "event") return;
    if (ref.kind === "agent") {
      if (!isAgentActor(ref.id)) return;
      const key = refKey(ref);
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push({ ref, edgeLabel });
      return;
    }
    if (ref.kind === "work_item") {
      if (!items.has(ref.id)) return;
      const key = refKey(ref);
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push({ ref, edgeLabel });
      return;
    }
    if (ref.kind === "card") {
      const card = cards.get(ref.id);
      if (!card) return;
      const identity = cardDedupeKey(card);
      const existingLabel = cardEdgeLabel.get(identity);
      const nextRank = classifyEdgeLabel(edgeLabel).rank;
      if (existingLabel) {
        if (nextRank > classifyEdgeLabel(existingLabel).rank) {
          cardEdgeLabel.set(identity, edgeLabel);
          const idx = ordered.findIndex(
            (entry) =>
              entry.ref.kind === "card" &&
              cards.has(entry.ref.id) &&
              cardDedupeKey(cards.get(entry.ref.id)!) === identity,
          );
          if (idx >= 0) ordered[idx] = { ref: ordered[idx]!.ref, edgeLabel };
        }
        return;
      }
      if (seenCardIdentity.has(identity)) return;
      seenCardIdentity.add(identity);
      cardEdgeLabel.set(identity, edgeLabel);
      const key = refKey(ref);
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push({ ref, edgeLabel });
    }
  };

  // 0) Agent-presented business-logic chain (must appear on hub).
  for (const id of input.pinCardIds ?? []) {
    const card = cards.get(id);
    if (!card) continue;
    push({ kind: "card", id }, "业务逻辑");
  }

  // 0b) E8: Agent actors that have written into this project.
  for (const actor of listAgentActors(input.events)) {
    push({ kind: "agent", id: actor }, "Agent");
  }

  // 1) Work attention / open work first (task understanding).
  for (const entry of attention) {
    if (entry.target.kind === "work_item") {
      push(entry.target, "当前重点");
    }
  }

  const openWork = input.workItems
    .filter((item) => item.status !== "done" && item.status !== "cancelled")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const item of openWork) {
    push(
      { kind: "work_item", id: item.id },
      item.status === "blocked" ? "阻塞" : "在跟工作",
    );
  }

  const recentOrder = new Map(
    (input.recentCardIds ?? []).map((cardId, index) => [cardId, index]),
  );

  // 2) Understanding evidence first (stronger than recent-open).
  const rankedEvidence = [...understandingEvidenceIds].sort((a, b) => {
    const aIndex = recentOrder.get(a);
    const bIndex = recentOrder.get(b);
    if (aIndex !== undefined || bIndex !== undefined) {
      if (aIndex === undefined) return 1;
      if (bIndex === undefined) return -1;
      return aIndex - bIndex;
    }
    return 0;
  });
  for (const id of rankedEvidence) {
    const card = cards.get(id);
    if (card && !isUsefulCanvasCard(card)) continue;
    push({ kind: "card", id }, "理解依据");
  }

  // 3) Recently opened — weak, max 2, only if not already stronger-linked.
  let recentAdded = 0;
  for (const id of input.recentCardIds ?? []) {
    if (recentAdded >= 2) break;
    const card = cards.get(id);
    if (!card || !isUsefulCanvasCard(card)) continue;
    const identity = cardDedupeKey(card);
    if (seenCardIdentity.has(identity)) continue;
    const before = ordered.length;
    push({ kind: "card", id }, "最近打开");
    if (ordered.length > before) recentAdded += 1;
  }

  // 4) Remaining material attention (after recency / understanding).
  for (const entry of attention) {
    if (entry.target.kind === "card") {
      const card = cards.get(entry.target.id);
      if (card && !isUsefulCanvasCard(card)) continue;
      push(entry.target, "当前重点");
    }
  }

  // Cards that already participate in relations = structure, not raw dump.
  const degree = new Map<string, number>();
  for (const relation of input.relations) {
    degree.set(relation.fromCardId, (degree.get(relation.fromCardId) ?? 0) + 1);
    degree.set(relation.toCardId, (degree.get(relation.toCardId) ?? 0) + 1);
  }
  const hubs = [...degree.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id)
    .filter((id) => {
      const card = cards.get(id);
      return card ? isUsefulCanvasCard(card) : false;
    });
  for (const id of hubs) {
    push({ kind: "card", id }, "关联材料");
  }

  // Work-linked evidence cards (skip noise filenames).
  for (const item of openWork) {
    for (const id of item.evidenceIds ?? []) {
      const card = cards.get(id);
      if (card && !isUsefulCanvasCard(card)) continue;
      push({ kind: "card", id }, "工作依据");
    }
  }

  // Residual: useful materials only, ranked by canvas score then recent use.
  const residual = sortCardsForCanvas(
    input.cards.filter((card) => isUsefulCanvasCard(card)),
  ).sort((a, b) => {
    const aIndex = recentOrder.get(a.id);
    const bIndex = recentOrder.get(b.id);
    if (aIndex !== undefined || bIndex !== undefined) {
      if (aIndex === undefined) return 1;
      if (bIndex === undefined) return -1;
      return aIndex - bIndex;
    }
    // sortCardsForCanvas already by score; keep relative order when no footprint.
    return 0;
  });
  const hasUnderstanding =
    openWork.length > 0 ||
    attention.length > 0 ||
    understandingEvidenceIds.some((id) => {
      const card = cards.get(id);
      return card ? isUsefulCanvasCard(card) : false;
    }) ||
    hubs.length > 0;
  // Prefer structure; fill with readable materials so center stays ≥3 when possible.
  const materialBudget = hasUnderstanding ? 4 : 8;
  let materialAdded = 0;
  for (const card of residual) {
    if (materialAdded >= materialBudget) break;
    const before = ordered.length;
    push({ kind: "card", id: card.id }, "项目材料");
    if (ordered.length > before) materialAdded += 1;
  }

  return ordered;
}

function buildGraph(
  input: ProjectCanvasInput,
  attention: AttentionItem[],
  understandingEvidenceIds: string[] = [],
) {
  const nodes = new Map<string, CanvasNode>();
  const edges: CanvasEdge[] = [];
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  const items = new Map(input.workItems.map((item) => [item.id, item]));
  const events = new Map(input.events.map((event) => [event.id, event]));
  const add = (node: CanvasNode) => nodes.set(refKey(node.ref), node);
  const projectRef = {
    kind: "project" as const,
    id: input.project.id,
  };

  if (input.focus.kind === "project") {
    const center = projectRef;
    add(makeNode(center, input.project.name, "当前项目", 0, "active"));
    const nodeIdentity = new Map<string, string>();
    for (const { ref: target, edgeLabel } of projectNeighborTargets(
      input,
      attention,
      understandingEvidenceIds,
    )) {
      if (target.kind === "work_item") {
        const item = items.get(target.id);
        if (!item) continue;
        add(
          makeNode(
            target,
            item.title,
            STATUS_LABELS[item.status],
            1,
            itemState(item),
            item.evidenceIds
              .filter((id) => cards.has(id))
              .map((id) => ({ kind: "card", id })),
          ),
        );
        edges.push(makeEdge(center, target, edgeLabel));
        continue;
      }
      if (target.kind === "card") {
        const card = cards.get(target.id);
        if (!card) continue;
        const identity = cardDedupeKey(card);
        if (nodeIdentity.has(identity)) continue;
        nodeIdentity.set(identity, refKey(target));
        const strong =
          edgeLabel === "理解依据" ||
          edgeLabel === "当前重点" ||
          edgeLabel === "工作依据" ||
          edgeLabel === "阻塞" ||
          edgeLabel === "业务逻辑";
        add(
          makeNode(
            target,
            card.title || card.content.slice(0, 24),
            edgeLabel === "理解依据"
              ? "理解依据"
              : edgeLabel === "业务逻辑"
                ? "业务逻辑"
                : edgeLabel === "最近打开"
                  ? "最近打开"
                  : card.source,
            1,
            strong ? "active" : "neutral",
          ),
        );
        edges.push(makeEdge(center, target, edgeLabel));
        continue;
      }
      if (target.kind === "agent") {
        const actorEvents = input.events.filter((e) => e.actor === target.id);
        add(
          makeNode(
            target,
            agentDisplayName(target.id),
            `Agent · ${actorEvents.length} 条记录`,
            1,
            "active",
          ),
        );
        edges.push(makeEdge(center, target, edgeLabel));
      }
    }

    // Sequential presentation edges for business-logic chain (not durable relations).
    const pinIds = (input.pinCardIds ?? []).filter((id) => cards.has(id));
    for (let i = 0; i < pinIds.length - 1; i++) {
      const from = { kind: "card" as const, id: pinIds[i]! };
      const to = { kind: "card" as const, id: pinIds[i + 1]! };
      if (!nodes.has(refKey(from)) || !nodes.has(refKey(to))) continue;
      edges.push(
        makeEdge(from, to, "逻辑串联", {
          status: "suggested",
          direction: "out",
          why: "Agent 根据已读材料将业务步骤串联呈现。",
        }),
      );
    }
  }

  if (input.focus.kind === "agent") {
    const actor = input.focus.id;
    if (!isAgentActor(actor)) throw new Error("Agent 不属于当前项目");
    const actorEvents = input.events
      .filter((e) => e.actor === actor)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (actorEvents.length === 0) throw new Error("Agent 不属于当前项目");
    add(
      makeNode(
        input.focus,
        agentDisplayName(actor),
        `Agent · ${actorEvents.length} 条记录`,
        0,
        "active",
      ),
    );
    add(makeNode(projectRef, input.project.name, "项目中心", 1, "active"));
    edges.push(makeEdge(input.focus, projectRef, "所属项目"));
    const workIds = new Set(actorEvents.map((e) => e.workItemId));
    for (const workId of workIds) {
      const item = items.get(workId);
      if (!item) continue;
      const target = { kind: "work_item" as const, id: item.id };
      add(
        makeNode(
          target,
          item.title,
          STATUS_LABELS[item.status],
          1,
          itemState(item),
        ),
      );
      edges.push(makeEdge(input.focus, target, "处理过"));
    }
    for (const event of actorEvents.slice(0, 4)) {
      const target = { kind: "event" as const, id: event.id };
      add(
        makeNode(
          target,
          event.body || event.type,
          event.type,
          1,
          event.type === "result" ? "changed" : "neutral",
        ),
      );
      edges.push(makeEdge(input.focus, target, "执行记录"));
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
    // Focus hub: always allow returning to the project center.
    add(makeNode(projectRef, input.project.name, "项目中心", 1, "active"));
    edges.push(makeEdge(input.focus, projectRef, "所属项目"));
    for (const cardId of item.evidenceIds) {
      const card = cards.get(cardId);
      if (!card) continue;
      const target = { kind: "card", id: card.id } as const;
      add(makeNode(target, card.title || card.content.slice(0, 24), card.source, 1));
      edges.push(makeEdge(input.focus, target, "依据"));
    }
    for (const event of input.events
      .filter((entry) => entry.workItemId === item.id && entry.type !== "comment")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
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
    // Focus hub: project is always one hop away.
    add(makeNode(projectRef, input.project.name, "项目中心", 1, "active"));
    edges.push(makeEdge(input.focus, projectRef, "所属项目"));
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
          relationId: relation.id,
          evidenceSentence: relation.evidenceSentence,
          status:
            relation.status === "suggested" ? "suggested" : "confirmed",
          direction: edgeDirection(relation, card.id),
        }),
      );
    }
    for (const item of input.workItems
      .filter((entry) => entry.evidenceIds.includes(card.id))) {
      const target = { kind: "work_item", id: item.id } as const;
      add(makeNode(target, item.title, STATUS_LABELS[item.status], 1, itemState(item)));
      edges.push(makeEdge(input.focus, target, "被工作项使用"));
    }
    // Other understanding evidence as peer anchors (focus migration surface).
    for (const id of understandingEvidenceIds) {
      if (id === card.id) continue;
      const peer = cards.get(id);
      if (!peer) continue;
      const target = { kind: "card", id: peer.id } as const;
      if (nodes.has(refKey(target))) continue;
      add(
        makeNode(
          target,
          peer.title || peer.content.slice(0, 24),
          "理解依据",
          1,
          "active",
        ),
      );
      edges.push(makeEdge(input.focus, target, "同层依据"));
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
    add(makeNode(projectRef, input.project.name, "项目中心", 1, "active"));
    edges.push(makeEdge(input.focus, projectRef, "所属项目"));
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
      for (const cardId of [...new Set(explicitCardIds)]) {
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

  const allNodes = [...nodes.values()];
  const centerNodes = allNodes.filter((node) => node.depth === 0);
  // Project hub (when focus is not the project) always stays visible for focus migration.
  const hubNeighbors = allNodes.filter(
    (node) =>
      node.depth === 1 &&
      node.ref.kind === "project" &&
      input.focus.kind !== "project",
  );
  const otherNeighbors = allNodes.filter(
    (node) =>
      node.depth === 1 &&
      !(
        node.ref.kind === "project" &&
        input.focus.kind !== "project" &&
        node.ref.id === input.project.id
      ),
  );
  const neighborSlots = Math.max(0, 6 - hubNeighbors.length);
  const visibleOthers = otherNeighbors.slice(0, neighborSlots);
  const foldedNodes = otherNeighbors.slice(neighborSlots);
  const visibleNodes = [...centerNodes, ...hubNeighbors, ...visibleOthers];
  const visibleKeys = new Set(visibleNodes.map((node) => refKey(node.ref)));
  const foldedKeys = new Set(foldedNodes.map((node) => refKey(node.ref)));
  return {
    nodes: visibleNodes,
    edges: edges.filter(
      (edge) =>
        visibleKeys.has(refKey(edge.source)) &&
        visibleKeys.has(refKey(edge.target)),
    ),
    foldedNodes,
    foldedEdges: edges.filter(
      (edge) =>
        (visibleKeys.has(refKey(edge.source)) && foldedKeys.has(refKey(edge.target))) ||
        (foldedKeys.has(refKey(edge.source)) && visibleKeys.has(refKey(edge.target))),
    ),
    hiddenNeighborCount: foldedNodes.length,
  };
}

function buildInspector(
  input: ProjectCanvasInput,
  attention: AttentionItem[],
  understandingEvidenceIds: string[] = [],
): CanvasInspector {
  if (input.focus.kind === "project") {
    const checkpoint = input.checkpoint;
    const evidence = understandingEvidenceIds
      .filter((id) => input.cards.some((card) => card.id === id))
      .map((id) => ({ kind: "card" as const, id }));
    return {
      title: input.project.name,
      summary: checkpoint
        ? `离开时的目标：${checkpoint.goal}`
        : "根据现有材料和事件整理，尚未保存你确认的离开状态。",
      whyImportant: checkpoint
        ? `原下一步：${checkpoint.nextStep}`
        : "先确认当前目标，系统才能在下次准确说明变化。",
      evidence,
      impacts: attention.map((item) => item.target),
      availableActions: ["confirm_checkpoint"],
    };
  }
  if (input.focus.kind === "work_item") {
    const item = input.workItems.find((entry) => entry.id === input.focus.id);
    if (!item) throw new Error("工作项不属于当前项目");
    const isOpen = item.status !== "done" && item.status !== "cancelled";
    return {
      title: item.title,
      summary: item.description,
      whyImportant:
        item.status === "blocked"
          ? item.blockedReason || "这项工作当前被阻塞"
          : `当前状态：${STATUS_LABELS[item.status]}；下一步：${item.nextStep}`,
      evidence: item.evidenceIds
        .filter((id) => input.cards.some((card) => card.id === id))
        .map((id) => ({ kind: "card", id })),
      impacts: [],
      workItem: structuredClone(item),
      availableActions: [
        ...(item.evidenceIds.length > 0 ? (["open_evidence"] as const) : []),
        "link_evidence",
        "comment",
        ...(isOpen ? (["update_work", "update_next_step", "run_agent"] as const) : []),
      ],
    };
  }
  if (input.focus.kind === "card") {
    const card = input.cards.find((entry) => entry.id === input.focus.id);
    if (!card) throw new Error("卡片不属于当前项目");
    // A7/A8: never dump binary/image bytes into 概览 (e.g. logo-horizontal.png).
    const summarySource = card.sourceFileId || card.title || "material";
    return {
      title: card.title || "项目材料",
      summary: materialCardSummary(summarySource, card.content ?? ""),
      whyImportant: "这条材料被当前项目的关系或工作项引用。",
      evidence: [{ kind: "card", id: card.id }],
      impacts: input.workItems
        .filter((item) => item.evidenceIds.includes(card.id))
        .map((item) => ({ kind: "work_item", id: item.id })),
      availableActions: ["open_evidence", "create_relation"],
    };
  }
  if (input.focus.kind === "agent") {
    const actor = input.focus.id;
    const actorEvents = input.events
      .filter((e) => e.actor === actor)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = actorEvents[0];
    const workIds = [...new Set(actorEvents.map((e) => e.workItemId))];
    return {
      title: agentDisplayName(actor),
      summary: latest
        ? `最近：${latest.body || latest.type}`
        : "该 Agent 尚无写入记录。",
      whyImportant: `共 ${actorEvents.length} 条记录，涉及 ${workIds.length} 个工作项。`,
      evidence: actorEvents
        .slice(0, 5)
        .map((e) => ({ kind: "event" as const, id: e.id })),
      impacts: workIds.map((id) => ({ kind: "work_item" as const, id })),
      availableActions: [],
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
  // Understanding first — graph neighbors use the same evidence ranking as「现在怎样」.
  const nowReview = reviewProjectNow({
    projectName: input.project.name,
    cards: input.cards,
    workItems: input.workItems,
    events: input.events,
    relations: input.relations,
  });
  const graph = buildGraph(input, attention, nowReview.evidenceIds);
  const relevantEvents = focusEvents(
    input.focus,
    input.cards,
    input.workItems,
    input.events,
  );
  const timeline = buildCanvasTimeline(
    relevantEvents,
    input.workItems,
    new Set(input.cards.map((card) => card.id)),
  );
  const changesSinceCheckpoint = input.checkpoint
    ? [...timeline.now, ...timeline.history].filter(
        (event) => event.createdAt > input.checkpoint!.createdAt,
      )
    : [...timeline.now, ...timeline.history];

  const cardById = new Map(input.cards.map((card) => [card.id, card]));
  const projectNow: ProjectNowView = {
    status: nowReview.status,
    judgment: nowReview.judgment,
    gaps: nowReview.gaps,
    nextStep: nowReview.nextStep,
    mode: nowReview.mode,
    evidence: nowReview.evidenceIds
      .map((id) => {
        const card = cardById.get(id);
        if (!card) return null;
        return {
          kind: "card" as const,
          id,
          label:
            card.title?.trim() ||
            card.sourceFileId?.split("/").pop() ||
            "项目材料",
        };
      })
      .filter((entry): entry is ProjectNowView["evidence"][number] =>
        Boolean(entry),
      ),
  };

  const agentActivity = buildAgentActivityView({
    cards: input.cards,
    workItems: input.workItems,
    events: input.events,
    hasCheckpoint: Boolean(input.checkpoint),
  });

  return {
    project: input.project,
    focus: input.focus,
    checkpoint: input.checkpoint,
    checkpointSource: input.checkpoint ? "confirmed" : "inferred",
    changesSinceCheckpoint,
    planAssessment: assessPlan(input.checkpoint, input.events, input.cards),
    projectNow,
    agentActivity,
    attention,
    nodes: graph.nodes,
    edges: graph.edges,
    foldedNodes: graph.foldedNodes,
    foldedEdges: graph.foldedEdges,
    hiddenNeighborCount: graph.hiddenNeighborCount,
    inspector: buildInspector(input, attention, nowReview.evidenceIds),
    timeline,
  };
}
