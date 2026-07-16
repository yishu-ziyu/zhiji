import { expect, it, describe } from "vitest";
import {
  materialCardsForReview,
  reviewProjectNow,
  reviewWorkItem,
} from "./project-review-agent";
import type {
  ActionItem,
  KnowledgeCard,
  KnowledgeRelation,
  WorkEvent,
} from "@/shared/types/knowledge";

const item: ActionItem = {
  id: "item1",
  projectId: "p1",
  title: "复核画布",
  description: "复核画布规格",
  assignee: "自己",
  deadline: "2026-07-16",
  status: "doing",
  verificationCriteria: "结论可回到依据",
  cardId: "card1",
  evidenceIds: ["card1"],
  nextStep: "检查交互",
  createdAt: "2026-07-15T08:00:00.000Z",
  updatedAt: "2026-07-15T09:00:00.000Z",
};
const evidence: KnowledgeCard[] = [
  {
    id: "card1",
    projectId: "p1",
    title: "规格",
    content: "四个状态先确认",
    source: "doc",
    tags: [],
    links: [],
    timestamp: "2026-07-15T08:30:00.000Z",
    sourceFileId: "spec.md",
  },
];
const events: WorkEvent[] = [
  {
    id: "event1",
    workItemId: "item1",
    type: "decision",
    actor: "自己",
    body: "先确认界面",
    createdAt: "2026-07-15T08:40:00.000Z",
  },
];

it("returns an evidence-backed review in deterministic mode", async () => {
  const result = await reviewWorkItem(
    { item, evidence, events },
    { mode: "deterministic" },
  );
  expect(result.judgment).not.toBe("");
  expect(result.gaps).toEqual(expect.any(Array));
  expect(result.nextStep).not.toBe("");
  expect(
    result.evidenceIds.every((id) => evidence.some((card) => card.id === id)),
  ).toBe(true);
});

describe("B-2 reviewProjectNow", () => {
  it("empty materials: honest empty, no fake evidence ids", () => {
    const result = reviewProjectNow({
      projectName: "空项目",
      cards: [],
      workItems: [
        {
          ...item,
          evidenceIds: ["ghost-card"],
        },
      ],
      events: [],
    });
    expect(result.status).toBe("empty");
    expect(result.judgment).toMatch(/还没材料|谈不上理解/);
    expect(result.evidenceIds).toEqual([]);
    expect(result.evidenceIds).not.toContain("ghost-card");
  });

  it("with materials: judgment + only real evidence ids", () => {
    const cards: KnowledgeCard[] = [
      ...evidence,
      {
        id: "card2",
        projectId: "p1",
        title: "会议纪要",
        content: "确认阻塞原因",
        source: "meeting",
        tags: [],
        links: [],
        timestamp: "2026-07-15T09:00:00.000Z",
        sourceFileId: "notes.md",
      },
    ];
    const blocked: ActionItem = {
      ...item,
      id: "blocked1",
      title: "缺图",
      status: "blocked",
      blockedReason: "logo 未定",
      evidenceIds: ["card2", "not-a-real-id"],
    };
    const result = reviewProjectNow({
      projectName: "scion",
      cards,
      workItems: [blocked],
      events,
      relations: [
        {
          id: "rel1",
          fromCardId: "card1",
          toCardId: "card2",
          relationType: "supports",
          evidenceSentence: "规格支撑会议",
          status: "confirmed",
          directed: true,
          source: "manual",
          createdBy: "自己",
          createdAt: "2026-07-15T09:00:00.000Z",
          updatedAt: "2026-07-15T09:00:00.000Z",
        } satisfies KnowledgeRelation,
      ],
    });
    expect(result.status).toBe("ready");
    expect(result.judgment.length).toBeGreaterThan(8);
    expect(result.evidenceIds.length).toBeGreaterThan(0);
    expect(
      result.evidenceIds.every((id) => cards.some((c) => c.id === id)),
    ).toBe(true);
    expect(result.evidenceIds).not.toContain("not-a-real-id");
    expect(result.judgment).toMatch(/卡|材料|缺图/);
  });

  it("does not invent evidence ids outside card list", () => {
    const cards = evidence;
    const result = reviewProjectNow({
      projectName: "p",
      cards,
      workItems: [
        {
          ...item,
          evidenceIds: ["card1", "fabricated"],
        },
      ],
      events: [],
    });
    expect(result.evidenceIds).toEqual(["card1"]);
  });

  it("materialCardsForReview prefers real file-backed cards", () => {
    const cards: KnowledgeCard[] = [
      {
        id: "empty-manual",
        projectId: "p1",
        content: "",
        source: "manual",
        tags: [],
        links: [],
        timestamp: "2026-07-15T08:00:00.000Z",
      },
      evidence[0],
    ];
    expect(materialCardsForReview(cards).map((c) => c.id)).toEqual(["card1"]);
  });
});
