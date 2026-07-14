import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("searchKnowledge", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;
  let addCard: typeof import("./repository").addCard;
  let addProject: typeof import("./repository").addProject;
  let resetKnowledgeStoreForTests: typeof import("./repository").resetKnowledgeStoreForTests;
  let searchKnowledge: typeof import("./search").searchKnowledge;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-search-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
    const repo = await import("./repository");
    const search = await import("./search");
    addCard = repo.addCard;
    addProject = repo.addProject;
    resetKnowledgeStoreForTests = repo.resetKnowledgeStoreForTests;
    searchKnowledge = search.searchKnowledge;
    resetKnowledgeStoreForTests();
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.KNOWLEDGE_DATA_DIR;
    } else {
      process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
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

  it("keeps search and fallback inside the selected project", () => {
    const other = addProject({ name: "搜索隔离" });
    addCard({
      content: "另一个项目的唯一词 北斗七号",
      projectId: other.id,
    });

    const matched = searchKnowledge("北斗七号", { projectId: other.id });
    const fallback = searchKnowledge("完全不存在", { projectId: other.id });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((hit) => hit.projectId === other.id)).toBe(true);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback.every((hit) => hit.projectId === other.id)).toBe(true);
  });
});
