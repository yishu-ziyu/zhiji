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
    expect(result.every((item) => item.evidenceEventIds.length > 0)).toBe(true);
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
