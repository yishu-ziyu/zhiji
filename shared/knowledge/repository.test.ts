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
      nextStep: "勾完成",
    });
    const updated = repo.updateActionStatus(item.id, "done");
    expect(updated.status).toBe("done");

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "actions.json"), "utf-8"),
    ) as Record<string, { status: string }>;
    expect(raw[item.id]?.status).toBe("done");
    expect(repo.getAction(item.id)?.status).toBe("done");
  });

  it("writes timeline events on status change and comment", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const item = repo.addAction({
      description: "时间线验收",
      assignee: "自己",
      nextStep: "写评论",
      status: "todo",
    });
    repo.patchWorkItem(item.id, { status: "doing" });
    repo.addWorkEvent(item.id, {
      type: "comment",
      body: "对齐验收口径",
      actor: "自己",
    });
    const events = repo.listEventsForWorkItem(item.id);
    expect(events.some((e) => e.type === "status_change")).toBe(true);
    expect(events.some((e) => e.type === "comment" && e.body.includes("对齐"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(tmpDir, "events.json"))).toBe(true);
  });

  it("rejects doing without assignee", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const item = repo.addAction({
      description: "无负责人",
      assignee: "待定",
      nextStep: "开始",
      status: "todo",
    });
    expect(() => repo.updateActionStatus(item.id, "doing")).toThrow(/负责人/);
  });

  it("links evidence and records event", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    const card = cards[0];
    const item = repo.addAction({
      description: "挂依据",
      assignee: "自己",
      nextStep: "关联卡",
    });
    const linked = repo.linkEvidence(item.id, card.id);
    expect(linked.evidenceIds).toContain(card.id);
    const events = repo.listEventsForWorkItem(item.id);
    expect(events.some((e) => e.type === "evidence_link")).toBe(true);
  });

  it("records search footprint and conserves lit set", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const { searchKnowledge } = await import("./search");
    const hits = searchKnowledge("检索 来源");
    expect(hits.length).toBeGreaterThan(0);
    const { querySessionId } = repo.recordSearchFootprint("检索 来源", hits);
    const fp = repo.getFootprintData({
      mode: "current_query",
      querySessionId,
    });
    const litIds = fp.lit.map((e) => e.cardId).sort();
    const hitIds = hits.map((h) => h.id).sort();
    expect(litIds).toEqual(hitIds);
    expect(fs.existsSync(path.join(tmpDir, "footprint-events.json"))).toBe(
      true,
    );
  });

  it("link evidence deepens footprint for work_item mode", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const card = repo.listCards()[0];
    const item = repo.addAction({
      description: "足迹工作项",
      assignee: "自己",
      nextStep: "挂卡",
    });
    repo.linkEvidence(item.id, card.id);
    const fp = repo.getFootprintData({
      mode: "work_item",
      workItemId: item.id,
    });
    expect(fp.lit.some((e) => e.cardId === card.id && e.depth >= 3)).toBe(
      true,
    );
  });
});


