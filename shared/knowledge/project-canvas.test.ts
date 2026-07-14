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
    status: "confirmed",
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
    type: "status_change",
    actor: "agent:project-reviewer",
    body: "等待确认",
    meta: { toStatus: "confirmed" },
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
        id: "latest-confirmed",
        workItemId: "confirmed",
        type: "status_change",
        actor: "agent:project-reviewer",
        body: "等待确认",
        meta: { toStatus: "confirmed" },
        createdAt: "2026-07-15T09:00:00.000Z",
      },
    ];
    const timeline = buildCanvasTimeline(confirmedEvents, workItems);
    expect(timeline.now.map((event) => event.id)).toEqual([
      "latest-confirmed",
    ]);
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
        source: { kind: "card", id: "card2" },
        target: { kind: "card", id: "card1" },
      }),
    );
  });

  it("shows card-related events and only explicit event evidence", () => {
    const cardSnapshot = buildProjectCanvasSnapshot({
      ...fixture,
      focus: { kind: "card", id: "card1" },
      now: NOW,
    });
    expect(cardSnapshot.nodes.some((node) => node.ref.kind === "event")).toBe(
      true,
    );

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
});
