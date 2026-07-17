import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Dialogue milestone writeback (no auto todo)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dlg-wb-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
    delete process.env.SEED_DEMO;
  });

  afterEach(() => {
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("does not create work items when none exist", async () => {
    const repo = await import("@/shared/knowledge/repository");
    const { writeDialogueMilestoneToKnowledge } = await import(
      "./dialogue-writeback"
    );
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "对话写回", summary: "" });
    const before = repo.listActions({ projectId: project.id }).length;

    const result = writeDialogueMilestoneToKnowledge({
      id: "m1",
      sessionId: "s1",
      projectId: project.id,
      role: "agent",
      content: "本轮结论：先确认 README 理解",
      createdAt: new Date().toISOString(),
      milestone: true,
    });
    expect(result).toBeNull();
    expect(repo.listActions({ projectId: project.id }).length).toBe(before);
  });

  it("appends event only when an open work item already exists", async () => {
    const repo = await import("@/shared/knowledge/repository");
    const { writeDialogueMilestoneToKnowledge } = await import(
      "./dialogue-writeback"
    );
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "对话写回2", summary: "" });
    const item = repo.addAction({
      projectId: project.id,
      title: "用户任务",
      description: "keep",
      nextStep: "go",
      status: "todo",
      assignee: "自己",
      deadline: "本周",
      verificationCriteria: "ok",
      evidenceIds: [],
    });
    const before = repo.listActions({ projectId: project.id }).length;

    const result = writeDialogueMilestoneToKnowledge({
      id: "m1",
      sessionId: "s1",
      projectId: project.id,
      role: "agent",
      content: "本轮结论：先确认 README 理解",
      createdAt: new Date().toISOString(),
      milestone: true,
    });
    expect(result).toBeTruthy();
    expect(result!.workItemId).toBe(item.id);
    expect(result!.createdWorkItem).toBe(false);
    expect(repo.listActions({ projectId: project.id }).length).toBe(before);
    const detail = repo.getWorkItemDetail(item.id);
    expect(detail?.events.some((e) => e.actor === "agent:dialogue")).toBe(true);
  });
});
