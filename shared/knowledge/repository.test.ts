import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("knowledge repository persistence", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;
  let previousSeedDemo: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-knowledge-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    previousSeedDemo = process.env.SEED_DEMO;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
    // Existing suite exercises the demo-seed path; empty-path cases unset this.
    process.env.SEED_DEMO = "1";
    // Fresh module state is not required; files are authoritative.
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.KNOWLEDGE_DATA_DIR;
    } else {
      process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    }
    if (previousSeedDemo === undefined) {
      delete process.env.SEED_DEMO;
    } else {
      process.env.SEED_DEMO = previousSeedDemo;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function loadRepo() {
    // Dynamic import after env is set so path resolution sees the temp dir.
    return import("./repository");
  }

  it("does not seed by default on empty store (contract 015)", async () => {
    delete process.env.SEED_DEMO;
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    expect(repo.isDemoSeedEnabled()).toBe(false);
    expect(repo.listProjects()).toEqual([]);
    expect(repo.listCards()).toEqual([]);
    expect(repo.listActions()).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, "cards.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "projects.json"))).toBe(false);
  });

  it("seeds only when SEED_DEMO=1", async () => {
    process.env.SEED_DEMO = "1";
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(fs.existsSync(path.join(tmpDir, "cards.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "actions.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "projects.json"))).toBe(true);
    const demo = repo.listProjects().find((p) => p.id === repo.DEFAULT_PROJECT_ID);
    expect(demo?.name).toContain("示例");
  });

  it("first-user empty path: create project, add file, persist across reload", async () => {
    delete process.env.SEED_DEMO;
    const repo = await loadRepo();
    const {
      writeProjectMaterial,
      listProjectMaterials,
      readProjectMaterial,
    } = await import("./materials");
    repo.resetKnowledgeStoreForTests();

    expect(repo.listProjects()).toEqual([]);
    expect(() =>
      repo.addProject({ name: "   " }),
    ).toThrow(/项目名称不能为空/);

    const project = repo.addProject({
      name: "我的首个项目",
      summary: "空环境真实接入",
    });
    expect(project.id).not.toBe(repo.DEFAULT_PROJECT_ID);
    expect(repo.listProjects().map((p) => p.id)).toEqual([project.id]);

    const material = writeProjectMaterial(
      project.id,
      "kickoff-notes.md",
      "# 开工\n\n这是用户真实文件内容 token-alpha-915",
    );
    expect(material.projectId).toBe(project.id);
    const card = repo.addCard({
      projectId: project.id,
      title: material.name,
      content: "# 开工\n\n这是用户真实文件内容 token-alpha-915",
      source: "doc",
      sourceFileId: material.id,
    });
    expect(card.projectId).toBe(project.id);
    expect(card.sourceFileId).toBe(material.id);

    // Simulate process restart: same data dir, fresh in-memory read from disk.
    expect(repo.listProjects().some((p) => p.id === project.id)).toBe(true);
    expect(listProjectMaterials(project.id).map((f) => f.id)).toContain(
      "kickoff-notes.md",
    );
    const reopened = readProjectMaterial(project.id, "kickoff-notes.md");
    expect(reopened?.content).toContain("token-alpha-915");
    expect(
      repo
        .listCards({ projectId: project.id })
        .some((c) => c.sourceFileId === "kickoff-notes.md"),
    ).toBe(true);
    const hits = repo.searchProjectRecords(project.id, "token-alpha-915", 8);
    expect(hits.some((h) => h.ref.kind === "card" && h.ref.id === card.id)).toBe(
      true,
    );
  });

  it("T-16: material citation stamps content hash and detects stale overwrite", async () => {
    delete process.env.SEED_DEMO;
    const repo = await loadRepo();
    const {
      writeProjectMaterial,
      materialContentHash,
      readProjectMaterial,
    } = await import("./materials");
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "hash cite project" });
    const bodyA = "# A\n\ncite-me-token";
    const materialA = writeProjectMaterial(project.id, "spec.md", bodyA);
    expect(materialA.id).toBe("spec.md");
    expect(materialA.contentHash).toBe(materialContentHash(bodyA));

    const card = repo.ensureMaterialCitationCard({
      projectId: project.id,
      materialId: materialA.id,
      title: materialA.name,
      contentSummary: bodyA,
      contentHash: materialA.contentHash,
    });
    expect(card.sourceFileId).toBe("spec.md");
    expect(card.sourceContentHash).toBe(materialA.contentHash);
    expect(card.sourceCitedAt).toBeTruthy();
    expect(
      repo.assertMaterialCitationFresh({
        sourceContentHash: card.sourceContentHash,
        currentContentHash: materialA.contentHash,
        materialExists: true,
      }),
    ).toBe("fresh");

    const bodyB = "# B\n\noverwritten";
    const materialB = writeProjectMaterial(project.id, "spec.md", bodyB);
    expect(materialB.id).toBe("spec.md");
    expect(materialB.contentHash).not.toBe(card.sourceContentHash);
    expect(
      repo.assertMaterialCitationFresh({
        sourceContentHash: card.sourceContentHash,
        currentContentHash: materialB.contentHash,
        materialExists: true,
      }),
    ).toBe("stale");

    // ensure reuse must not rewrite the original stamp
    const again = repo.ensureMaterialCitationCard({
      projectId: project.id,
      materialId: "spec.md",
      title: "spec.md",
      contentSummary: bodyB,
      contentHash: materialB.contentHash,
    });
    expect(again.id).toBe(card.id);
    expect(again.sourceContentHash).toBe(card.sourceContentHash);

    // one-time backfill for legacy path-only card
    const legacy = repo.addCard({
      projectId: project.id,
      title: "legacy.md",
      content: "old",
      source: "doc",
      sourceFileId: "legacy.md",
    });
    expect(legacy.sourceContentHash).toBeUndefined();
    writeProjectMaterial(project.id, "legacy.md", "legacy-body");
    const hash = materialContentHash("legacy-body");
    const backfilled = repo.ensureMaterialCitationCard({
      projectId: project.id,
      materialId: "legacy.md",
      title: "legacy.md",
      contentSummary: "legacy-body",
      contentHash: hash,
    });
    expect(backfilled.id).toBe(legacy.id);
    expect(backfilled.sourceContentHash).toBe(hash);
    expect(
      repo.assertMaterialCitationFresh({
        sourceContentHash: undefined,
        currentContentHash: hash,
        materialExists: true,
      }),
    ).toBe("unstamped");
    expect(
      repo.assertMaterialCitationFresh({
        sourceContentHash: hash,
        currentContentHash: hash,
        materialExists: false,
      }),
    ).toBe("missing");
    expect(readProjectMaterial(project.id, "spec.md")?.meta.contentHash).toBe(
      materialB.contentHash,
    );
  });

  it("T-16: persists one project-scoped candidate per result event", async () => {
    delete process.env.SEED_DEMO;
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "result candidate project" });
    const otherProject = repo.addProject({ name: "foreign project" });
    const evidence = repo.addCard({
      projectId: project.id,
      content: "项目依据",
      source: "doc",
    });
    const foreignEvidence = repo.addCard({
      projectId: otherProject.id,
      content: "其他项目依据",
      source: "doc",
    });
    const item = repo.addAction({
      projectId: project.id,
      description: "复核项目",
      nextStep: "等待 Owner",
      evidenceIds: [evidence.id],
    });
    const resultEvent = repo.addWorkEvent(item.id, {
      type: "result",
      actor: "agent:project-reviewer",
      body: "当前判断：项目可以继续推进。",
      meta: { review: { evidenceIds: [evidence.id] } },
    });

    const first = repo.ensureResultCandidateCard({
      projectId: project.id,
      resultEvent,
      evidence: [evidence, foreignEvidence],
    });
    const second = repo.ensureResultCandidateCard({
      projectId: project.id,
      resultEvent,
      evidence: [evidence, foreignEvidence],
    });

    expect(second.id).toBe(first.id);
    expect(
      repo.listCards({ projectId: project.id }).filter(
        (card) => card.identity === "candidate",
      ),
    ).toHaveLength(1);
    expect(first).toEqual(
      expect.objectContaining({
        projectId: project.id,
        identity: "candidate",
        resultEventLocator: `event:${resultEvent.id}`,
        links: [evidence.id],
      }),
    );
    expect(repo.listCards({ projectId: otherProject.id })).toHaveLength(1);
  });

  it("fails closed when persisted JSON is corrupt instead of reseeding over it", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const file = path.join(tmpDir, "cards.json");
    fs.writeFileSync(file, "{not-json", "utf-8");

    expect(() => repo.listCards()).toThrow(/无法读取数据文件/);
    expect(fs.readFileSync(file, "utf-8")).toBe("{not-json");
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

  it("rejects an unknown card source at the persistence boundary", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    expect(() =>
      repo.addCard({ content: "非法来源", source: "bogus" as never }),
    ).toThrow(/来源无效/);
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

  it("recovers a pending work-state transaction before serving reads", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const actionsFile = path.join(tmpDir, "actions.json");
    const eventsFile = path.join(tmpDir, "events.json");
    const actions = JSON.parse(fs.readFileSync(actionsFile, "utf-8")) as Record<string, Record<string, unknown>>;
    const events = JSON.parse(fs.readFileSync(eventsFile, "utf-8")) as Record<string, Record<string, unknown>>;
    actions["ka-seed-1"] = { ...actions["ka-seed-1"], nextStep: "从事务日志恢复" };
    events["recovered-event"] = {
      id: "recovered-event",
      workItemId: "ka-seed-1",
      type: "next_step_change",
      actor: "自己",
      body: "从事务日志恢复",
      createdAt: "2026-07-15T10:00:00.000Z",
    };
    fs.writeFileSync(
      path.join(tmpDir, "work-state-transaction.json"),
      JSON.stringify({ pending: { actions, events } }),
      "utf-8",
    );

    expect(repo.getAction("ka-seed-1")?.nextStep).toBe("从事务日志恢复");
    expect(repo.listEventsForWorkItem("ka-seed-1").map((event) => event.id))
      .toContain("recovered-event");
    expect(fs.existsSync(path.join(tmpDir, "work-state-transaction.json"))).toBe(false);
  });

  it("searches project materials, work items, and records without cross-project hits", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const item = repo.addAction({
      projectId: repo.DEFAULT_PROJECT_ID,
      title: "火箭验收任务",
      description: "检查发射清单",
      nextStep: "核对燃料",
    });
    repo.addCard({
      projectId: repo.DEFAULT_PROJECT_ID,
      title: "火箭会议材料",
      content: "发射窗口已经确认",
    });
    repo.addWorkEvent(item.id, { type: "comment", body: "火箭风险已经复核" });
    const other = repo.addProject({ name: "其他项目" });
    repo.addCard({ projectId: other.id, content: "火箭不应跨项目出现" });

    const hits = repo.searchProjectRecords(repo.DEFAULT_PROJECT_ID, "火箭", 12);
    expect(new Set(hits.map((hit) => hit.ref.kind))).toEqual(
      new Set(["card", "work_item", "event"]),
    );
    expect(hits.some((hit) => hit.summary.includes("不应跨项目"))).toBe(false);
    expect(hits.find((hit) => hit.ref.kind === "card")?.source).toBe("manual");
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

  it("records opened materials and orders the project canvas by recent use", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const usedOlder = repo.addCard({
      title: "刚查看的旧材料",
      content: "这条材料创建得早，但刚刚被查看",
      timestamp: "2026-07-10T08:00:00.000Z",
    });
    repo.addCard({
      title: "未查看的新材料",
      content: "这条材料更新，但没有被使用",
      timestamp: "2026-07-15T09:00:00.000Z",
    });

    repo.recordOpenedFootprint(usedOlder.id);
    const footprint = repo.getFootprintData({ mode: "window", sinceDays: 7 });
    expect(footprint.lit).toContainEqual(
      expect.objectContaining({ cardId: usedOlder.id, depth: 2 }),
    );

    const snapshot = repo.getProjectCanvasSnapshot(repo.DEFAULT_PROJECT_ID);
    expect(snapshot.nodes.filter((node) => node.ref.kind === "card")[0]?.ref.id)
      .toBe(usedOlder.id);
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

  it("rejects an unknown relation source at the persistence boundary", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    expect(() => repo.createRelation({
      fromCardId: cards[0].id,
      toCardId: cards[1].id,
      relationType: "supports",
      evidenceSentence: "非法来源不能写入",
      source: "bogus" as never,
    })).toThrow(/来源无效/);
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

  it("keeps relation direction consistent when its type changes", async () => {
    const repo = await loadRepo();
    repo.resetKnowledgeStoreForTests();
    const cards = repo.listCards();
    const relation = repo.createRelation({
      fromCardId: cards[0].id,
      toCardId: cards[1].id,
      relationType: "supports",
      evidenceSentence: "方向随关系类型变化。",
    });

    expect(repo.patchRelation(relation.id, { relationType: "same_topic" }).directed)
      .toBe(false);
    expect(repo.patchRelation(relation.id, { relationType: "supports" }).directed)
      .toBe(true);
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
