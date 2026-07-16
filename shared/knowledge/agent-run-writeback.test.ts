import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("writeAgentRunToKnowledge", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-writeback-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
    delete process.env.SEED_DEMO;
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.KNOWLEDGE_DATA_DIR;
    } else {
      process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("creates understanding work item + agent result event", async () => {
    const repo = await import("./repository");
    const { writeAgentRunToKnowledge } = await import("./agent-run-writeback");
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "写回测试", summary: "" });

    const result = writeAgentRunToKnowledge({
      projectId: project.id,
      runId: "run-1",
      nowText: "已读 README，目标是验收中心节点",
      nextDecisionText: "确认下一步",
      toolSummaries: ["project_map ok", "read_path NOTES.md"],
      filesRead: 2,
      toolCalls: 4,
    });

    expect(result).toBeTruthy();
    expect(result!.workItemId).toBeTruthy();
    expect(result!.taskCardsCreated).toBeGreaterThanOrEqual(1);
    expect(result!.taskWorkItemIds.length).toBeGreaterThanOrEqual(1);

    // Numbered Canvasight-style task cards on canvas
    const open = repo
      .listActions({ projectId: project.id })
      .filter((a) => a.status !== "done" && a.status !== "cancelled");
    expect(open.some((a) => /^\d{2}\s+/.test(a.title))).toBe(true);
    expect(open.some((a) => /理解|核对/.test(a.title))).toBe(true);

    const item = repo.getAction(result!.workItemId);
    expect(item?.title).toMatch(/理解|Agent|\d{2}/);
    const detail = repo.getWorkItemDetail(result!.workItemId);
    expect(detail?.events.some((e) => e.actor === "agent:folder-reader")).toBe(
      true,
    );
    expect(
      detail?.events.some((e) => e.body.includes("已读 README")),
    ).toBe(true);
  });
});
