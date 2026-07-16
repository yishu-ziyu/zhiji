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
  let DEFAULT_PROJECT_ID: typeof import("./repository").DEFAULT_PROJECT_ID;
  let searchKnowledge: typeof import("./search").searchKnowledge;
  let ProjectScopeError: typeof import("./project-scope").ProjectScopeError;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-search-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
    process.env.SEED_DEMO = "1";
    const repo = await import("./repository");
    const search = await import("./search");
    const scope = await import("./project-scope");
    addCard = repo.addCard;
    addProject = repo.addProject;
    resetKnowledgeStoreForTests = repo.resetKnowledgeStoreForTests;
    DEFAULT_PROJECT_ID = repo.DEFAULT_PROJECT_ID;
    searchKnowledge = search.searchKnowledge;
    ProjectScopeError = scope.ProjectScopeError;
    resetKnowledgeStoreForTests();
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.KNOWLEDGE_DATA_DIR;
    } else {
      process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    }
    delete process.env.SEED_DEMO;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires projectId (T-19)", () => {
    expect(() => searchKnowledge("检索 来源")).toThrow(ProjectScopeError);
  });

  it("finds seeded card by keyword within demo project", () => {
    const hits = searchKnowledge("检索 来源", {
      projectId: DEFAULT_PROJECT_ID,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(
      hits.some((h) => h.content.includes("来源") || h.tags.includes("检索")),
    ).toBe(true);
    expect(hits.every((h) => h.projectId === DEFAULT_PROJECT_ID)).toBe(true);
  });

  it("filters by source", () => {
    addCard({
      content: "一封客户邮件里的报价边界",
      source: "email",
      tags: ["报价"],
      projectId: DEFAULT_PROJECT_ID,
    });
    const hits = searchKnowledge("报价", {
      projectId: DEFAULT_PROJECT_ID,
      source: "email",
    });
    expect(hits.every((h) => h.source === "email")).toBe(true);
  });

  it("returns no hits when no token matches", () => {
    const hits = searchKnowledge("完全不存在的火星词汇xyz123", {
      projectId: DEFAULT_PROJECT_ID,
    });
    expect(hits).toEqual([]);
  });

  it("keeps search inside the selected project", () => {
    const other = addProject({ name: "搜索隔离" });
    addCard({
      content: "另一个项目的唯一词 北斗七号",
      projectId: other.id,
    });

    const matched = searchKnowledge("北斗七号", { projectId: other.id });
    const missing = searchKnowledge("完全不存在", { projectId: other.id });
    const demo = searchKnowledge("北斗七号", {
      projectId: DEFAULT_PROJECT_ID,
    });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((hit) => hit.projectId === other.id)).toBe(true);
    expect(missing).toEqual([]);
    expect(demo.every((hit) => hit.projectId === DEFAULT_PROJECT_ID)).toBe(
      true,
    );
    expect(demo.some((hit) => hit.content.includes("北斗七号"))).toBe(false);
  });
});
