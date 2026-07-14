import { beforeEach, describe, expect, it } from "vitest";
import { resetKnowledgeStoreForTests, addCard } from "./repository";
import { searchKnowledge } from "./search";

describe("searchKnowledge", () => {
  beforeEach(() => {
    resetKnowledgeStoreForTests();
  });

  it("finds seeded card by keyword", () => {
    const hits = searchKnowledge("检索 来源");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.content.includes("来源") || h.tags.includes("检索"))).toBe(
      true,
    );
  });

  it("filters by source", () => {
    addCard({
      content: "一封客户邮件里的报价边界",
      source: "email",
      tags: ["报价"],
    });
    const hits = searchKnowledge("报价", { source: "email" });
    expect(hits.every((h) => h.source === "email")).toBe(true);
  });

  it("returns soft fallback when no token match", () => {
    const hits = searchKnowledge("完全不存在的火星词汇xyz123");
    expect(hits.length).toBeGreaterThan(0);
  });
});
