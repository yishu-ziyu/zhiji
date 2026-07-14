import { beforeEach, describe, expect, it } from "vitest";
import { resetKnowledgeStoreForTests } from "./repository";
import { invokeKnowledgeMcpTool, listKnowledgeMcpTools } from "./mcp-tools";

describe("knowledge mcp tools", () => {
  beforeEach(() => {
    resetKnowledgeStoreForTests();
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
});
