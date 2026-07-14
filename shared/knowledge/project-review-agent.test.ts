import { expect, it } from "vitest";
import { reviewWorkItem } from "./project-review-agent";
import type {
  ActionItem,
  KnowledgeCard,
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
