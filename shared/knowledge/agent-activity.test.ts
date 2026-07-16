import { describe, expect, it } from "vitest";
import {
  buildAgentActivityView,
  listAgentActors,
} from "./agent-activity";
import type { ActionItem, KnowledgeCard, WorkEvent } from "@/shared/types/knowledge";

const cards: KnowledgeCard[] = [
  {
    id: "c1",
    projectId: "p1",
    title: "CONTEXT.md",
    content: "product north star text ".repeat(8),
    source: "doc",
    tags: [],
    links: [],
    timestamp: "2026-07-15T08:00:00.000Z",
    sourceFileId: "CONTEXT.md",
  },
];

const workItems: ActionItem[] = [
  {
    id: "w1",
    projectId: "p1",
    title: "复核交互",
    description: "test",
    assignee: "自己",
    deadline: "2026-07-16",
    status: "doing",
    verificationCriteria: "可核对",
    evidenceIds: ["c1"],
    nextStep: "确认结果",
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T09:00:00.000Z",
    cardId: "c1",
  },
];

const events: WorkEvent[] = [
  {
    id: "e-result",
    workItemId: "w1",
    type: "result",
    actor: "agent:project-reviewer",
    body: "Agent 已写回复核结果",
    meta: {
      review: {
        judgment: "需要人确认",
        gaps: [],
        nextStep: "核对",
        evidenceIds: ["c1"],
        mode: "deterministic",
      },
    },
    createdAt: "2026-07-15T09:10:00.000Z",
  },
  {
    id: "e-other",
    workItemId: "w1",
    type: "result",
    actor: "agent:external",
    body: "外部补充",
    createdAt: "2026-07-15T09:20:00.000Z",
  },
];

describe("agent-activity (E7)", () => {
  it("lists distinct agent actors", () => {
    expect(listAgentActors(events)).toEqual([
      "agent:external",
      "agent:project-reviewer",
    ]);
  });

  it("builds eight process steps and a non-empty feed when agent results exist", () => {
    const view = buildAgentActivityView({
      cards,
      workItems,
      events,
      hasCheckpoint: false,
    });
    expect(view.hasAgentEvents).toBe(true);
    expect(view.steps).toHaveLength(8);
    expect(view.steps.every((s) => ["pending", "active", "done"].includes(s.status))).toBe(
      true,
    );
    expect(view.feed.length).toBeGreaterThanOrEqual(2);
    expect(view.feed[0].actorLabel).toMatch(/Agent/);
    expect(view.caption).toMatch(/确认|结果/);
    // Awaiting human because doing + agent result
    expect(view.steps.find((s) => s.id === "owner")?.status).toBe("active");
  });

  it("is honest when no agent events", () => {
    const view = buildAgentActivityView({
      cards,
      workItems: [],
      events: [],
      hasCheckpoint: false,
    });
    expect(view.hasAgentEvents).toBe(false);
    expect(view.feed).toEqual([]);
    expect(view.steps).toHaveLength(8);
    expect(view.caption).toMatch(/没有 Agent|尚未/);
  });
});
