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
    expect(fs.existsSync(path.join(tmpDir, "projects.json"))).toBe(true);
  });

  it("migrates legacy cards and work items into the default project", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "cards.json"),
      JSON.stringify({
        legacy: {
          id: "legacy",
          content: "旧卡片",
          source: "manual",
          tags: [],
          timestamp: "2026-07-14T00:00:00.000Z",
          links: [],
        },
      }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "actions.json"),
      JSON.stringify({
        legacyAction: {
          id: "legacyAction",
          title: "旧工作项",
          description: "旧工作项",
          status: "todo",
        },
      }),
    );

    const repo = await loadRepo();
    expect(repo.DEFAULT_PROJECT_ID).toBe("project-fc-opc-ibot");
    expect(repo.listCards({ projectId: repo.DEFAULT_PROJECT_ID })[0].projectId)
      .toBe(repo.DEFAULT_PROJECT_ID);
    expect(repo.listActions({ projectId: repo.DEFAULT_PROJECT_ID })[0].projectId)
      .toBe(repo.DEFAULT_PROJECT_ID);
  });

  it("isolates cards and work items by project", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const other = repo.addProject({ name: "另一个项目", summary: "隔离检查" });
    const foreignCard = repo.addCard({
      content: "只属于另一个项目",
      projectId: other.id,
    });
    repo.addAction({ description: "另一个项目的工作", projectId: other.id });
    const defaultItem = repo.listActions({
      projectId: repo.DEFAULT_PROJECT_ID,
    })[0];
    const defaultCard = repo.listCards({
      projectId: repo.DEFAULT_PROJECT_ID,
    })[0];

    expect(repo.listCards({ projectId: other.id })).toHaveLength(1);
    expect(repo.listActions({ projectId: other.id })).toHaveLength(1);
    expect(
      repo
        .listCards({ projectId: repo.DEFAULT_PROJECT_ID })
        .some((card) => card.content === "只属于另一个项目"),
    ).toBe(false);
    expect(() => repo.linkEvidence(defaultItem.id, foreignCard.id)).toThrow(
      /同一项目/,
    );
    expect(() =>
      repo.createRelation({
        fromCardId: defaultCard.id,
        toCardId: foreignCard.id,
        relationType: "supports",
        evidenceSentence: "跨项目关系不应成立",
      }),
    ).toThrow(/同一项目/);
  });

  it("persists the latest confirmed project checkpoint", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const saved = repo.addProjectCheckpoint(repo.DEFAULT_PROJECT_ID, {
      goal: "完成项目画布规格",
      completed: ["源码调查"],
      unresolved: ["界面实现"],
      nextStep: "实现确认图",
      confirmedBy: "自己",
    });

    expect(
      repo.getLatestProjectCheckpoint(repo.DEFAULT_PROJECT_ID)?.id,
    ).toBe(saved.id);
    expect(
      fs.existsSync(path.join(tmpDir, "project-checkpoints.json")),
    ).toBe(true);

    repo.resetKnowledgeStoreForTests();
    expect(repo.getLatestProjectCheckpoint(repo.DEFAULT_PROJECT_ID)).toBeNull();
  });

  it("returns one-hop evidence and events for a work-item focus", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const snapshot = repo.getProjectCanvasSnapshot(
      repo.DEFAULT_PROJECT_ID,
      { kind: "work_item", id: "ka-seed-1" },
      "2026-07-15T10:00:00.000Z",
    );

    expect(snapshot.focus).toEqual({
      kind: "work_item",
      id: "ka-seed-1",
    });
    expect(snapshot.nodes.every((node) => node.depth <= 1)).toBe(true);
    expect(snapshot.nodes.some((node) => node.ref.kind === "card")).toBe(true);
    expect(snapshot.nodes.some((node) => node.ref.kind === "event")).toBe(true);
  });

  it("rejects foreign references and foreign focus in project snapshots", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const other = repo.addProject({ name: "边界项目" });
    const foreignCard = repo.addCard({
      projectId: other.id,
      content: "其他项目材料",
    });

    expect(() =>
      repo.addAction({
        projectId: repo.DEFAULT_PROJECT_ID,
        description: "错误引用",
        evidenceIds: [foreignCard.id],
      }),
    ).toThrow(/同一项目/);
    expect(() =>
      repo.addWorkEvent("ka-seed-1", {
        type: "result",
        body: "错误结果",
        meta: { review: { evidenceIds: [foreignCard.id] } },
      }),
    ).toThrow(/同一项目/);
    expect(() =>
      repo.getProjectCanvasSnapshot(repo.DEFAULT_PROJECT_ID, {
        kind: "card",
        id: foreignCard.id,
      }),
    ).toThrow(/不属于当前项目/);
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

  it("seeds confirmed relations with evidence sentences", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const rels = repo.listRelations({ status: "confirmed" });
    expect(rels.length).toBeGreaterThanOrEqual(2);
    expect(rels.every((r) => r.evidenceSentence.trim().length > 0)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "relations.json"))).toBe(true);
  });

  it("creates relation and returns neighbors", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    const a = cards[0];
    const b = cards[1];
    const created = repo.createRelation({
      fromCardId: a.id,
      toCardId: b.id,
      relationType: "same_topic",
      evidenceSentence: "单测：两卡同属演示种子。",
      status: "confirmed",
      source: "manual",
    });
    expect(created.evidenceSentence).toContain("单测");
    const neighbors = repo.getNeighbors(a.id);
    expect(neighbors.edges.some((e) => e.otherCard.id === b.id)).toBe(true);
  });

  it("rejects relation without evidence sentence", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    expect(() =>
      repo.createRelation({
        fromCardId: cards[0].id,
        toCardId: cards[1].id,
        relationType: "supports",
        evidenceSentence: "",
      }),
    ).toThrow(/来源句/);
  });

  it("path between seed cards", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    // seed: seed-2 -> seed-1 <- seed-4
    const path = repo.getPathBetween("kc-seed-2", "kc-seed-4", {
      maxDepth: 3,
    });
    expect(path).not.toBeNull();
    expect(path!.nodes[0]).toBe("kc-seed-2");
    expect(path!.nodes[path!.nodes.length - 1]).toBe("kc-seed-4");
    expect(path!.length).toBeGreaterThanOrEqual(1);
  });

  it("reject suggested removes from default neighbors", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    const rel = repo.createRelation({
      fromCardId: cards[0].id,
      toCardId: cards[1].id,
      relationType: "mentions",
      evidenceSentence: "建议边原文。",
      status: "suggested",
      source: "rule",
    });
    expect(
      repo.getNeighbors(cards[0].id).edges.some((e) => e.id === rel.id),
    ).toBe(true);
    repo.patchRelation(rel.id, { status: "rejected" });
    expect(
      repo.getNeighbors(cards[0].id).edges.some((e) => e.id === rel.id),
    ).toBe(false);
  });

  it("evidence island only includes edges inside evidence set", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const island = repo.getEvidenceIsland("ka-seed-1");
    expect(island.cardIds).toContain("kc-seed-2");
    expect(island.cardIds).toContain("kc-seed-1");
    for (const e of island.edges) {
      expect(island.cardIds).toContain(e.fromCardId);
      expect(island.cardIds).toContain(e.toCardId);
    }
    expect(island.edges.length).toBeGreaterThanOrEqual(1);
  });
});
