import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("knowledge repository persistence", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-knowledge-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
    // Fresh module state is not required; files are authoritative.
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.KNOWLEDGE_DATA_DIR;
    } else {
      process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function loadRepo() {
    // Dynamic import after env is set so path resolution sees the temp dir.
    return import("./repository");
  }

  it("seeds when store is empty", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(fs.existsSync(path.join(tmpDir, "cards.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "actions.json"))).toBe(true);
  });

  it("persists cards across reload of maps from disk", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const created = repo.addCard({
      content: "持久化验收：写入后必须能从文件读回",
      source: "manual",
      tags: ["persist"],
      title: "持久化卡片",
    });

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "cards.json"), "utf-8"),
    ) as Record<string, { content: string }>;
    expect(raw[created.id]?.content).toContain("写入后必须能从文件读回");

    // Simulate new process: only disk remains the source of truth.
    const reloaded = repo.listCards();
    expect(reloaded.some((c) => c.id === created.id)).toBe(true);
  });

  it("persists action status updates", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const item = repo.addAction({
      description: "完成状态落盘检查",
      assignee: "tester",
    });
    const updated = repo.updateActionStatus(item.id, "done");
    expect(updated.status).toBe("done");

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "actions.json"), "utf-8"),
    ) as Record<string, { status: string }>;
    expect(raw[item.id]?.status).toBe("done");
    expect(repo.getAction(item.id)?.status).toBe("done");
  });
});
