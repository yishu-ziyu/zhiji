import { describe, expect, it } from "vitest";
import type { KnowledgeCard, KnowledgeRelation } from "@/shared/types/knowledge";
import {
  assertRelationShape,
  extractMaterialRelationCandidates,
  extractRelationCandidates,
  filterRelationsForQuery,
  findPath,
  RelationValidationError,
  relationDedupKey,
} from "./relations";

const cards: KnowledgeCard[] = [
  {
    id: "a",
    projectId: "project-fc-opc-ibot",
    title: "卡A标题够长",
    content: "正文A。依据说明可复用。",
    source: "doc",
    tags: ["产品", "检索"],
    timestamp: "2026-01-01",
    links: [],
  },
  {
    id: "b",
    projectId: "project-fc-opc-ibot",
    title: "卡B",
    content: "正文B 提到 卡A标题够长。",
    source: "meeting",
    tags: ["产品", "检索"],
    timestamp: "2026-01-02",
    links: [],
  },
  {
    id: "c",
    projectId: "project-fc-opc-ibot",
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

  it("B-3: ≥3 material cards with shared evidence → ≥1 suggested relation", () => {
    const materials: KnowledgeCard[] = [
      {
        id: "m1",
        projectId: "p-b3",
        title: "kickoff.md",
        content: "启动纪要：验收标准写在 acceptance.md。",
        source: "doc",
        tags: [],
        timestamp: "2026-01-01",
        links: [],
        sourceFileId: "kickoff.md",
      },
      {
        id: "m2",
        projectId: "p-b3",
        title: "acceptance.md",
        content: "验收标准：必须可点回材料，且验收标准写清。",
        source: "doc",
        tags: [],
        timestamp: "2026-01-02",
        links: [],
        sourceFileId: "acceptance.md",
      },
      {
        id: "m3",
        projectId: "p-b3",
        title: "notes.md",
        content: "旁注：稍后核对验收标准。",
        source: "doc",
        tags: [],
        timestamp: "2026-01-03",
        links: [],
        sourceFileId: "notes.md",
      },
    ];
    const proposed = extractMaterialRelationCandidates(materials, []);
    expect(proposed.length).toBeGreaterThanOrEqual(1);
    expect(proposed.every((c) => c.status === "suggested")).toBe(true);
    expect(proposed.every((c) => c.evidenceSentence.trim().length > 0)).toBe(
      true,
    );
    expect(
      proposed.every(
        (c) =>
          Boolean(c.meta?.fromMaterialId) && Boolean(c.meta?.toMaterialId),
      ),
    ).toBe(true);
  });

  it("B-3: fewer than 3 materials → no material proposals (no random links)", () => {
    const two: KnowledgeCard[] = [
      {
        id: "x1",
        projectId: "p-b3",
        title: "a.md",
        content: "共享关键词验收标准出现。",
        source: "doc",
        tags: [],
        timestamp: "2026-01-01",
        links: [],
        sourceFileId: "a.md",
      },
      {
        id: "x2",
        projectId: "p-b3",
        title: "b.md",
        content: "也有验收标准。",
        source: "doc",
        tags: [],
        timestamp: "2026-01-02",
        links: [],
        sourceFileId: "b.md",
      },
    ];
    expect(extractMaterialRelationCandidates(two, [])).toEqual([]);
  });

  it("B-3: rejected relations are not shown as truth", () => {
    const relations = [
      rel({
        id: "r-ok",
        fromCardId: "a",
        toCardId: "b",
        relationType: "supports",
        evidenceSentence: "可见",
        status: "suggested",
      }),
      rel({
        id: "r-no",
        fromCardId: "a",
        toCardId: "c",
        relationType: "mentions",
        evidenceSentence: "已否",
        status: "rejected",
      }),
    ];
    const visible = filterRelationsForQuery(relations, { cardId: "a" });
    expect(visible.map((r) => r.id)).toEqual(["r-ok"]);
    expect(visible.every((r) => r.status !== "rejected")).toBe(true);
  });
});
