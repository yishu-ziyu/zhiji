import { describe, expect, it } from "vitest";
import {
  assessPlan,
  buildCanvasTimeline,
  buildProjectCanvasSnapshot,
  rankAttention,
} from "./project-canvas";
import type {
  ActionItem,
  KnowledgeCard,
  Project,
  ProjectCheckpoint,
  WorkEvent,
} from "@/shared/types/knowledge";

const NOW = "2026-07-15T10:00:00.000Z";
const project: Project = {
  id: "p1",
  name: "项目画布",
  summary: "测试",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
};
const checkpoint: ProjectCheckpoint = {
  id: "cp1",
  projectId: "p1",
  goal: "完成项目画布",
  completed: [],
  unresolved: ["交互"],
  nextStep: "确认交互",
  confirmedBy: "自己",
  createdAt: "2026-07-15T08:00:00.000Z",
};
const cards: KnowledgeCard[] = [
  {
    id: "card1",
    projectId: "p1",
    title: "交互依据",
    content: "先确认四个状态",
    source: "doc",
    tags: [],
    links: [],
    timestamp: "2026-07-15T08:10:00.000Z",
  },
];
const baseItem = {
  projectId: "p1",
  description: "测试",
  assignee: "自己",
  verificationCriteria: "可检查",
  evidenceIds: ["card1"],
  nextStep: "继续",
  blockedReason: undefined,
  createdAt: "2026-07-15T08:00:00.000Z",
  updatedAt: "2026-07-15T09:00:00.000Z",
  cardId: "card1",
};
const workItems: ActionItem[] = [
  {
    ...baseItem,
    id: "blocked",
    title: "阻塞项",
    deadline: "2026-07-16",
    status: "blocked",
    blockedReason: "缺少图片",
  },
  {
    ...baseItem,
    id: "confirmed",
    title: "待确认项",
    deadline: "2026-07-16",
    // After Agent result: stay doing; awaiting-human comes from unacked result.
    status: "doing",
  },
  {
    ...baseItem,
    id: "overdue",
    title: "逾期项",
    deadline: "2026-07-14",
    status: "todo",
  },
];
const events: WorkEvent[] = [
  {
    id: "event-block",
    workItemId: "blocked",
    type: "block",
    actor: "自己",
    body: "缺少图片",
    createdAt: "2026-07-15T09:00:00.000Z",
  },
  {
    id: "event-confirmed",
    workItemId: "confirmed",
    type: "result",
    actor: "agent:project-reviewer",
    body: "Agent 已写回复核结果",
    meta: {
      review: {
        judgment: "需要人确认",
        gaps: [],
        nextStep: "核对结果",
        evidenceIds: ["card1"],
        mode: "deterministic",
      },
    },
    createdAt: "2026-07-15T09:10:00.000Z",
  },

  {
    id: "event-overdue",
    workItemId: "overdue",
    type: "status_change",
    actor: "system",
    body: "创建工作项",
    meta: { toStatus: "todo" },
    createdAt: "2026-07-14T09:00:00.000Z",
  },
  {
    id: "event-result-old",
    workItemId: "overdue",
    type: "result",
    actor: "agent:project-reviewer",
    body: "旧结果",
    createdAt: "2026-07-14T09:30:00.000Z",
  },
  {
    id: "event-comment",
    workItemId: "overdue",
    type: "comment",
    actor: "自己",
    body: "普通评论",
    createdAt: "2026-07-15T09:20:00.000Z",
  },
];
const fixture = {
  project,
  cards,
  workItems,
  events,
  relations: [],
  checkpoint,
};

describe("project canvas domain", () => {
  it("ranks blocked, awaiting confirmation, then overdue with evidence", () => {
    const result = rankAttention(fixture, NOW);
    expect(result.map((item) => item.reasonCode)).toEqual([
      "blocked",
      "awaiting_confirmation",
      "overdue",
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].evidenceEventIds).toEqual(["event-block"]);
    expect(result[1].evidenceEventIds).toEqual(["event-confirmed"]);
    expect(result[1].reason).toMatch(/等你确认/);
    expect(result[1].reason).not.toMatch(/知识已确认|已确认知识/);
    expect(result[2].evidenceEventIds).toEqual(["event-overdue"]);
  });

  it("treats human work status confirmed as awaiting human, not knowledge confirm", () => {
    const humanWaiting: typeof fixture = {
      ...fixture,
      workItems: [
        {
          ...baseItem,
          id: "human-confirm",
          title: "人标待确认",
          status: "confirmed",
          deadline: "2026-07-20",
        },
      ],
      events: [
        {
          id: "event-human-confirm",
          workItemId: "human-confirm",
          type: "status_change",
          actor: "自己",
          body: "状态 doing → confirmed",
          meta: { fromStatus: "doing", toStatus: "confirmed" },
          createdAt: "2026-07-15T09:15:00.000Z",
        },
      ],
    };
    const result = rankAttention(humanWaiting, NOW);
    expect(result[0]?.reasonCode).toBe("awaiting_confirmation");
    expect(result[0]?.reason).toMatch(/等你确认/);
  });

  it("marks the plan for adjustment when a blocking event exists", () => {
    const assessment = assessPlan(checkpoint, events, cards);
    expect(assessment.status).toBe("adjust");
    expect(assessment.evidence).toContainEqual({
      kind: "event",
      id: "event-block",
    });
  });

  it("returns insufficient without a confirmed checkpoint or evidence", () => {
    expect(assessPlan(null, [], []).status).toBe("insufficient");
  });

  it("marks a changed next step as an adjustment with its event", () => {
    const changed: WorkEvent = {
      id: "event-next-step",
      workItemId: "blocked",
      type: "next_step_change",
      actor: "自己",
      body: "改做可用性检查",
      createdAt: "2026-07-15T09:30:00.000Z",
    };
    expect(assessPlan(checkpoint, [changed], cards)).toEqual(
      expect.objectContaining({
        status: "adjust",
        evidence: [{ kind: "event", id: "event-next-step" }],
      }),
    );
  });

  it("uses the newest plan-changing event regardless of its type", () => {
    const olderDecision: WorkEvent = {
      id: "older-decision",
      workItemId: "blocked",
      type: "decision",
      actor: "自己",
      body: "旧决定",
      createdAt: "2026-07-15T09:10:00.000Z",
    };
    const newerNextStep: WorkEvent = {
      id: "newer-next-step",
      workItemId: "blocked",
      type: "next_step_change",
      actor: "自己",
      body: "新的下一步",
      createdAt: "2026-07-15T09:20:00.000Z",
    };
    expect(assessPlan(checkpoint, [olderDecision, newerNextStep], [])).toEqual(
      expect.objectContaining({
        status: "adjust",
        evidence: [{ kind: "event", id: "newer-next-step" }],
      }),
    );
  });

  it("does not keep an already-unblocked item as a plan blocker", () => {
    const blocked: WorkEvent = {
      id: "temporary-block",
      workItemId: "blocked",
      type: "block",
      actor: "自己",
      body: "临时缺少输入",
      createdAt: "2026-07-15T09:10:00.000Z",
    };
    const unblocked: WorkEvent = {
      id: "temporary-unblock",
      workItemId: "blocked",
      type: "unblock",
      actor: "自己",
      body: "输入已补齐",
      createdAt: "2026-07-15T09:20:00.000Z",
    };
    const assessment = assessPlan(checkpoint, [blocked, unblocked], []);
    expect(assessment.status).toBe("insufficient");
    expect(assessment.evidence).toEqual([{ kind: "event", id: "temporary-unblock" }]);
  });

  it("keeps a new Agent result as insufficient until the user confirms it", () => {
    const result: WorkEvent = {
      id: "event-new-result",
      workItemId: "confirmed",
      type: "result",
      actor: "agent:project-reviewer",
      body: "Agent 发现新的核对结果",
      createdAt: "2026-07-15T09:30:00.000Z",
    };
    expect(assessPlan(checkpoint, [result], cards)).toEqual(
      expect.objectContaining({
        status: "insufficient",
        evidence: [{ kind: "event", id: "event-new-result" }],
      }),
    );
  });

  it("continues a confirmed plan when no later record changes it", () => {
    const beforeCheckpoint = { ...events[0], createdAt: "2026-07-15T07:30:00.000Z" };
    expect(assessPlan(checkpoint, [beforeCheckpoint], [])).toEqual(
      expect.objectContaining({
        status: "continue",
        evidence: [{ kind: "event", id: beforeCheckpoint.id }],
      }),
    );
  });

  it("keeps critical events visible apart from ordinary comments", () => {
    const timeline = buildCanvasTimeline(events, workItems);
    expect(timeline.now.map((event) => event.id)).toContain("event-block");
    expect(timeline.history.map((event) => event.id)).toContain(
      "event-result-old",
    );
  });

  it("keeps only the latest active signal in now and moves older results to history", () => {
    const confirmedEvents: WorkEvent[] = [
      {
        id: "old-result",
        workItemId: "confirmed",
        type: "result",
        actor: "agent:project-reviewer",
        body: "较早结果",
        createdAt: "2026-07-15T08:00:00.000Z",
      },
      {
        id: "latest-result",
        workItemId: "confirmed",
        type: "result",
        actor: "agent:project-reviewer",
        body: "较新结果，等人确认",
        createdAt: "2026-07-15T09:00:00.000Z",
      },
    ];
    const timeline = buildCanvasTimeline(confirmedEvents, workItems);
    expect(timeline.now.map((event) => event.id)).toEqual(["latest-result"]);
    expect(timeline.history.map((event) => event.id)).toContain("old-result");
  });

  it("preserves directed card relation meaning when focusing its target", () => {
    const otherCard: KnowledgeCard = {
      ...cards[0],
      id: "card2",
      title: "上游依据",
    };
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      cards: [...cards, otherCard],
      relations: [
        {
          id: "relation-directed",
          fromCardId: "card2",
          toCardId: "card1",
          relationType: "depends_on",
          evidenceSentence: "上游依据依赖交互依据",
          status: "confirmed",
          directed: true,
          source: "manual",
          createdBy: "自己",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      focus: { kind: "card", id: "card1" },
      now: NOW,
    });
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        relationId: "relation-directed",
        source: { kind: "card", id: "card2" },
        target: { kind: "card", id: "card1" },
        direction: "in",
      }),
    );
  });

  it("keeps card-related events in the timeline without treating them as direct neighbors", () => {
    const cardSnapshot = buildProjectCanvasSnapshot({
      ...fixture,
      focus: { kind: "card", id: "card1" },
      now: NOW,
    });
    expect(cardSnapshot.nodes.some((node) => node.ref.kind === "event")).toBe(false);
    expect(
      [...cardSnapshot.timeline.now, ...cardSnapshot.timeline.history].some(
        (event) => event.ref.kind === "event",
      ),
    ).toBe(true);

    const eventSnapshot = buildProjectCanvasSnapshot({
      ...fixture,
      events: [
        {
          id: "event-before",
          workItemId: "blocked",
          type: "decision",
          actor: "自己",
          body: "先检查图片",
          createdAt: "2026-07-15T08:30:00.000Z",
        },
        events[0],
      ],
      focus: { kind: "event", id: "event-block" },
      now: NOW,
    });
    expect(eventSnapshot.nodes.some((node) => node.ref.id === "event-before"))
      .toBe(true);
    expect(eventSnapshot.nodes.some((node) => node.ref.kind === "card"))
      .toBe(false);
  });

  it("keeps the project inspector impacts aligned with ranked attention", () => {
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      focus: { kind: "project", id: "p1" },
      now: NOW,
    });
    expect(snapshot.inspector.impacts).toEqual(
      snapshot.attention.map((item) => item.target),
    );
  });

  it("B-2: projectNow is ready with clickable real card evidence when materials exist", () => {
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      focus: { kind: "project", id: "p1" },
      now: NOW,
    });
    expect(snapshot.projectNow.status).toBe("ready");
    expect(snapshot.projectNow.judgment.length).toBeGreaterThan(0);
    expect(snapshot.projectNow.evidence.length).toBeGreaterThan(0);
    expect(
      snapshot.projectNow.evidence.every((e) =>
        cards.some((card) => card.id === e.id),
      ),
    ).toBe(true);
  });

  it("B-2: projectNow is honest empty without materials", () => {
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      cards: [],
      focus: { kind: "project", id: "p1" },
      now: NOW,
    });
    expect(snapshot.projectNow.status).toBe("empty");
    expect(snapshot.projectNow.judgment).toMatch(/还没材料|谈不上理解/);
    expect(snapshot.projectNow.evidence).toEqual([]);
  });

  it("keeps recent active work reachable when another item owns the attention signal", () => {
    const recentWithoutSignal: ActionItem = {
      ...baseItem,
      id: "recent-without-signal",
      title: "最近仍在推进",
      deadline: "2026-07-16",
      status: "todo",
      updatedAt: "2026-07-15T09:30:00.000Z",
    };
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      workItems: [workItems[0], recentWithoutSignal],
      events: [events[0]],
      focus: { kind: "project", id: "p1" },
      now: NOW,
    });

    expect(snapshot.attention.map((item) => item.target.id)).toEqual([
      "blocked",
    ]);
    expect(snapshot.nodes.map((node) => node.ref.id)).toContain(
      "recent-without-signal",
    );
  });

  it("orders project materials by their real timestamp", () => {
    const older = { ...cards[0], id: "older", timestamp: "2026-07-14T08:00:00.000Z" };
    const newer = { ...cards[0], id: "newer", timestamp: "2026-07-15T09:00:00.000Z" };
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      cards: [older, newer],
      workItems: [],
      events: [],
      focus: { kind: "project", id: "p1" },
      now: NOW,
    });
    expect(snapshot.nodes.filter((node) => node.depth === 1)[0]?.ref.id).toBe("newer");
  });

  it("puts recently used project materials before newer unused materials", () => {
    const usedOlder = { ...cards[0], id: "used-older", timestamp: "2026-07-14T08:00:00.000Z" };
    const unusedNewer = { ...cards[0], id: "unused-newer", timestamp: "2026-07-15T09:00:00.000Z" };
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      cards: [usedOlder, unusedNewer],
      workItems: [],
      events: [],
      focus: { kind: "project", id: "p1" },
      now: NOW,
      recentCardIds: ["used-older"],
    });
    expect(snapshot.nodes.filter((node) => node.ref.kind === "card")[0]?.ref.id)
      .toBe("used-older");
  });

  it("keeps recent materials after higher-priority project work", () => {
    const recent = { ...cards[0], id: "recent", title: "最近材料" };
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      cards: [recent],
      workItems: [workItems[0], workItems[1]],
      focus: { kind: "project", id: "p1" },
      now: NOW,
    });
    expect(snapshot.nodes.map((node) => node.ref.id)).toEqual(
      expect.arrayContaining(["blocked", "confirmed", "recent"]),
    );
  });

  it("keeps every card relation and reports its direction from the focused card", () => {
    const second = { ...cards[0], id: "card2", title: "第二份材料" };
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      cards: [...cards, second],
      relations: [
        {
          id: "relation-out",
          fromCardId: "card1",
          toCardId: "card2",
          relationType: "supports",
          evidenceSentence: "甲支持乙",
          status: "confirmed",
          directed: true,
          source: "manual",
          createdBy: "自己",
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: "relation-both",
          fromCardId: "card1",
          toCardId: "card2",
          relationType: "same_topic",
          evidenceSentence: "甲与乙同题",
          status: "suggested",
          directed: false,
          source: "manual",
          createdBy: "自己",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      focus: { kind: "card", id: "card1" },
      now: NOW,
    });
    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relationId: "relation-out", direction: "out" }),
        expect.objectContaining({ relationId: "relation-both", direction: "both" }),
      ]),
    );
  });

  it("does not emit card references absent from the project facts", () => {
    const foreignRef = "foreign-card";
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      workItems: [
        {
          ...workItems[0],
          evidenceIds: ["card1", foreignRef],
        },
      ],
      events: [
        {
          ...events[0],
          meta: { review: { evidenceIds: ["card1", foreignRef] } },
        },
      ],
      focus: { kind: "work_item", id: "blocked" },
      now: NOW,
    });
    expect(
      snapshot.nodes.some((node) => node.ref.id === foreignRef),
    ).toBe(false);
    expect(snapshot.inspector.evidence.map((ref) => ref.id)).toEqual([
      "card1",
    ]);
    expect(
      [...snapshot.timeline.now, ...snapshot.timeline.history].flatMap(
        (event) => event.review?.evidenceIds ?? [],
      ),
    ).not.toContain(foreignRef);
  });

  it("caps visible neighbors and reports how many remain folded", () => {
    const manyCards = Array.from({ length: 8 }, (_, index) => ({
      ...cards[0],
      id: `many-card-${index}`,
      title: `材料 ${index}`,
    }));
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      cards: manyCards,
      workItems: [{ ...workItems[0], evidenceIds: manyCards.map((card) => card.id) }],
      events: events.slice(0, 4).map((event) => ({ ...event, workItemId: "blocked" })),
      focus: { kind: "work_item", id: "blocked" },
      now: NOW,
    });
    expect(snapshot.nodes.filter((node) => node.depth === 1)).toHaveLength(6);
    expect(snapshot.hiddenNeighborCount).toBe(6);
    expect(snapshot.foldedNodes).toHaveLength(6);
  });

  it.each([
    { kind: "project", id: "p1" },
    { kind: "card", id: "card1" },
    { kind: "work_item", id: "blocked" },
    { kind: "event", id: "event-block" },
  ] as const)("expands one hop from $kind", (focus) => {
    const snapshot = buildProjectCanvasSnapshot({
      ...fixture,
      focus,
      now: NOW,
    });
    expect(snapshot.focus).toEqual(focus);
    expect(snapshot.nodes.every((node) => node.depth <= 1)).toBe(true);
    expect(snapshot.nodes.filter((node) => node.depth === 0)).toHaveLength(1);
  });

  it.each([
    { kind: "project", id: "p1" },
    { kind: "card", id: "card1" },
  ] as const)("connects every visible neighbor directly to $kind", (focus) => {
    const snapshot = buildProjectCanvasSnapshot({ ...fixture, focus, now: NOW });
    const centerKey = `${focus.kind}:${focus.id}`;
    for (const node of snapshot.nodes.filter((entry) => entry.depth === 1)) {
      const nodeKey = `${node.ref.kind}:${node.ref.id}`;
      expect(
        snapshot.edges.some((edge) => {
          const sourceKey = `${edge.source.kind}:${edge.source.id}`;
          const targetKey = `${edge.target.kind}:${edge.target.id}`;
          return (
            (sourceKey === centerKey && targetKey === nodeKey) ||
            (targetKey === centerKey && sourceKey === nodeKey)
          );
        }),
      ).toBe(true);
    }
  });
});
