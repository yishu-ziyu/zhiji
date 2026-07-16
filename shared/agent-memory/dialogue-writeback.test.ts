import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Dialogue milestone writeback", () => {
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

  it("writes agent milestone into knowledge feed; ignores non-milestone", async () => {
    const repo = await import("@/shared/knowledge/repository");
    const { writeDialogueMilestoneToKnowledge } = await import(
      "./dialogue-writeback"
    );
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "对话写回", summary: "" });

    const skipped = writeDialogueMilestoneToKnowledge({
      id: "m0",
      sessionId: "s1",
      projectId: project.id,
      role: "agent",
      content: "普通闲聊不进 feed",
      createdAt: new Date().toISOString(),
    });
    expect(skipped).toBeNull();

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
    const detail = repo.getWorkItemDetail(result!.workItemId);
    expect(detail?.events.some((e) => e.actor === "agent:dialogue")).toBe(true);
    expect(
      detail?.events.some((e) => e.body.includes("先确认 README")),
    ).toBe(true);
  });
});
