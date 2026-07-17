import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("writeAgentRunToKnowledge (no auto formal todos)", () => {
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

  it("Candidate / nextDecision does not increase Work Item count", async () => {
    const repo = await import("./repository");
    const { writeAgentRunToKnowledge } = await import("./agent-run-writeback");
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "写回测试", summary: "" });

    const before = repo.listActions({ projectId: project.id }).length;

    const result = writeAgentRunToKnowledge({
      projectId: project.id,
      runId: "run-1",
      nowText: "已读 README，目标是验收中心节点",
      nextDecisionText: "确认下一步并开正式任务",
      toolSummaries: ["project_map ok", "search_text q", "read_path NOTES.md"],
      filesRead: 2,
      toolCalls: 4,
    });

    expect(result).toBeTruthy();
    expect(result!.seededWorkItems).toBe(0);
    expect(result!.taskCardsCreated).toBe(0);
    expect(result!.suggestionOnly).toMatch(/确认下一步/);

    const after = repo.listActions({ projectId: project.id });
    expect(after.length).toBe(before);
    expect(after.filter((a) => a.status === "todo").length).toBe(0);
  });

  it("nextDecision remains suggestion-only string (Brief consumer)", async () => {
    const repo = await import("./repository");
    const { writeAgentRunToKnowledge } = await import("./agent-run-writeback");
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "建议测试", summary: "" });

    const result = writeAgentRunToKnowledge({
      projectId: project.id,
      runId: "run-2",
      nowText: "判断正文",
      nextDecisionText: "是否现在走黄金路径点验？",
    });

    expect(result!.suggestionOnly).toBe("是否现在走黄金路径点验？");
    expect(result!.taskWorkItemIds).toEqual([]);
  });

  it("does not create todos when an open user task already exists (timeline only)", async () => {
    const repo = await import("./repository");
    const { writeAgentRunToKnowledge } = await import("./agent-run-writeback");
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "有任务", summary: "" });
    const userTask = repo.addAction({
      projectId: project.id,
      title: "用户自己建的任务",
      description: "人手创建",
      nextStep: "继续",
      status: "todo",
      assignee: "自己",
      deadline: "本周",
      verificationCriteria: "完成",
      evidenceIds: [],
    });

    const before = repo.listActions({ projectId: project.id }).length;
    const result = writeAgentRunToKnowledge({
      projectId: project.id,
      runId: "run-3",
      nowText: "判断",
      nextDecisionText: "建议开新任务",
    });

    expect(repo.listActions({ projectId: project.id }).length).toBe(before);
    expect(result!.workItemId).toBe(userTask.id);
    expect(result!.taskCardsCreated).toBe(0);
    // User task still there
    expect(repo.getAction(userTask.id)?.title).toBe("用户自己建的任务");
  });
});

describe("explicit Owner adopt is the only create path (contract note)", () => {
  it("writeAgentTaskCardsToKnowledge never creates todos without adopt", async () => {
    const repo = await import("./repository");
    const {
      buildAgentTaskDrafts,
      writeAgentTaskCardsToKnowledge,
    } = await import("./agent-task-cards");
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "adopt", summary: "" });
    const drafts = buildAgentTaskDrafts({
      nowText: "判断",
      nextDecisionText: "确认下一步",
    });
    const before = repo.listActions({ projectId: project.id }).length;
    const out = writeAgentTaskCardsToKnowledge({
      projectId: project.id,
      drafts,
    });
    expect(out.created).toBe(0);
    expect(repo.listActions({ projectId: project.id }).length).toBe(before);
  });
});
