import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("knowledge mcp tools", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;
  let invokeKnowledgeMcpTool: typeof import("./mcp-tools").invokeKnowledgeMcpTool;
  let listKnowledgeMcpTools: typeof import("./mcp-tools").listKnowledgeMcpTools;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-mcp-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
    process.env.SEED_DEMO = "1";
    const repo = await import("./repository");
    const mcp = await import("./mcp-tools");
    repo.resetKnowledgeStoreForTests();
    invokeKnowledgeMcpTool = mcp.invokeKnowledgeMcpTool;
    listKnowledgeMcpTools = mcp.listKnowledgeMcpTools;
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

  it("lists five tools", () => {
    expect(listKnowledgeMcpTools()).toHaveLength(5);
  });

  it("search_knowledge works", () => {
    const result = invokeKnowledgeMcpTool("search_knowledge", {
      query: "知识",
    });
    expect(result.ok).toBe(true);
    const hits = (result.result as { hits: unknown[] }).hits;
    expect(hits.length).toBeGreaterThan(0);
  });

  it("add_knowledge + update_collaboration_state", () => {
    const added = invokeKnowledgeMcpTool("add_knowledge", {
      content: "测试卡片",
      tags: ["test"],
    });
    expect(added.ok).toBe(true);

    const dissected = invokeKnowledgeMcpTool("dissect_task", {
      goal: "完成 Demo 并写验收清单",
    });
    expect(dissected.ok).toBe(true);
    const items = (
      dissected.result as { actionItems: Array<{ id: string }> }
    ).actionItems;
    expect(items.length).toBeGreaterThan(0);

    const updated = invokeKnowledgeMcpTool("update_collaboration_state", {
      taskId: items[0].id,
      newStatus: "doing",
    });
    expect(updated.ok).toBe(true);
  });

  it("keeps add, search, and dissect inside the selected project", async () => {
    const repo = await import("./repository");
    const project = repo.addProject({ name: "MCP 隔离" });
    invokeKnowledgeMcpTool("add_knowledge", {
      content: "MCP 项目材料",
      projectId: project.id,
    });
    invokeKnowledgeMcpTool("dissect_task", {
      goal: "MCP 项目任务",
      projectId: project.id,
    });

    const searched = invokeKnowledgeMcpTool("search_knowledge", {
      query: "MCP 项目材料",
      filters: { projectId: project.id },
    });
    const hits = (searched.result as { hits: Array<{ projectId: string }> }).hits;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.projectId === project.id)).toBe(true);
    expect(repo.listCards({ projectId: project.id })).toHaveLength(1);
    expect(repo.listActions({ projectId: project.id }).length).toBeGreaterThan(0);
  });
});
