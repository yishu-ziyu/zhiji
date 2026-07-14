import { describe, expect, it } from "vitest";
import type { KnowledgeCard, KnowledgeRelation } from "@/shared/types/knowledge";
import {
  assertRelationShape,
  extractRelationCandidates,
  findPath,
  RelationValidationError,
  relationDedupKey,
} from "./relations";

const cards: KnowledgeCard[] = [
  {
    id: "a",
    title: "卡A标题够长",
    content: "正文A。依据说明可复用。",
    source: "doc",
    tags: ["产品", "检索"],
    timestamp: "2026-01-01",
    links: [],
  },
  {
    id: "b",
    title: "卡B",
    content: "正文B 提到 卡A标题够长。",
    source: "meeting",
    tags: ["产品", "检索"],
    timestamp: "2026-01-02",
    links: [],
  },
  {
    id: "c",
    title: "卡C",
    content: "无关。",
    source: "chat",
    tags: ["其他"],
    timestamp: "2026-01-03",
    links: [],
  },
];

function rel(
  partial: Partial<KnowledgeRelation> &
    Pick<
      KnowledgeRelation,
      "id" | "fromCardId" | "toCardId" | "relationType" | "evidenceSentence"
    >,
): KnowledgeRelation {
  return {
    status: "confirmed",
    directed: true,
    source: "manual",
    createdBy: "t",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...partial,
  };
}

describe("relations domain", () => {
  it("rejects empty evidence sentence", () => {
    expect(() =>
      assertRelationShape(
        {
          fromCardId: "a",
          toCardId: "b",
          relationType: "supports",
          evidenceSentence: "   ",
        },
        new Set(["a", "b"]),
      ),
    ).toThrow(RelationValidationError);
  });

  it("rejects self-loop", () => {
    expect(() =>
      assertRelationShape(
        {
          fromCardId: "a",
          toCardId: "a",
          relationType: "same_topic",
          evidenceSentence: "x",
        },
        new Set(["a"]),
      ),
    ).toThrow(/同一张/);
  });

  it("finds path a-b-c within depth", () => {
    const relations = [
      rel({
        id: "r1",
        fromCardId: "a",
        toCardId: "b",
        relationType: "supports",
        evidenceSentence: "s1",
      }),
      rel({
        id: "r2",
        fromCardId: "b",
        toCardId: "c",
        relationType: "follows",
        evidenceSentence: "s2",
      }),
    ];
    const path = findPath("a", "c", relations, { maxDepth: 3 });
    expect(path).not.toBeNull();
    expect(path!.nodes).toEqual(["a", "b", "c"]);
    expect(path!.length).toBe(2);
  });

  it("returns null when beyond maxDepth", () => {
    const relations = [
      rel({
        id: "r1",
        fromCardId: "a",
        toCardId: "b",
        relationType: "supports",
        evidenceSentence: "s1",
      }),
      rel({
        id: "r2",
        fromCardId: "b",
        toCardId: "c",
        relationType: "follows",
        evidenceSentence: "s2",
      }),
    ];
    expect(findPath("a", "c", relations, { maxDepth: 1 })).toBeNull();
  });

  it("extract is deterministic and suggested", () => {
    const once = extractRelationCandidates(cards, []);
    const twice = extractRelationCandidates(cards, []);
    expect(once.map((c) => relationDedupKey(c)).sort()).toEqual(
      twice.map((c) => relationDedupKey(c)).sort(),
    );
    expect(once.every((c) => c.status === "suggested")).toBe(true);
    expect(once.length).toBeGreaterThan(0);
  });

  it("skips candidates already existing", () => {
    const first = extractRelationCandidates(cards, []);
    expect(first.length).toBeGreaterThan(0);
    const asExisting = first.map((c, i) =>
      rel({
        id: `e${i}`,
        fromCardId: c.fromCardId,
        toCardId: c.toCardId,
        relationType: c.relationType,
        evidenceSentence: c.evidenceSentence,
        status: "suggested",
      }),
    );
    const second = extractRelationCandidates(cards, asExisting);
    expect(second.length).toBe(0);
  });
});
