/**
 * T-19 / D-27: project-hard default isolation + Owner-approved revision-pinned
 * cross-project reference (G3 production tests; G5 owns RED-only API file).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { materialContentHash, writeProjectMaterial } from "./materials";
import { ProjectScopeError } from "./project-scope";
import { searchKnowledge } from "./search";

describe("T-19 project-hard isolation", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;
  let previousSeedDemo: string | undefined;
  let repo: typeof import("./repository");

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-t19-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    previousSeedDemo = process.env.SEED_DEMO;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
    delete process.env.SEED_DEMO;
    repo = await import("./repository");
    repo.resetKnowledgeStoreForTests();
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

  it("addCard / addAction throw without projectId (no silent DEFAULT)", () => {
    const project = repo.addProject({ name: "A" });
    expect(() =>
      repo.addCard({ content: "无项目卡片" }),
    ).toThrow(ProjectScopeError);
    expect(() =>
      repo.addAction({ description: "无项目任务", nextStep: "x" }),
    ).toThrow(ProjectScopeError);

    const card = repo.addCard({
      projectId: project.id,
      content: "只在 A",
      title: "A-card",
    });
    expect(card.projectId).toBe(project.id);
    expect(card.projectId).not.toBe(repo.DEFAULT_PROJECT_ID);
  });

  it("project A never lists/searches/gets project B objects", () => {
    const a = repo.addProject({ name: "项目A" });
    const b = repo.addProject({ name: "项目B" });
    const cardB = repo.addCard({
      projectId: b.id,
      content: "B 秘密内容 token-B-only",
      title: "B-title",
    });
    const actionB = repo.addAction({
      projectId: b.id,
      description: "B 任务",
      nextStep: "推进 B",
    });
    repo.addCard({
      projectId: a.id,
      content: "A 可见内容",
      title: "A-title",
    });

    expect(repo.listCards({ projectId: a.id }).map((c) => c.id)).not.toContain(
      cardB.id,
    );
    expect(
      repo.listActions({ projectId: a.id }).map((x) => x.id),
    ).not.toContain(actionB.id);
    expect(repo.getCardInProject(a.id, cardB.id)).toBeNull();
    expect(repo.getActionInProject(a.id, actionB.id)).toBeNull();
    expect(repo.getCardInProject(b.id, cardB.id)?.id).toBe(cardB.id);

    const hitsA = searchKnowledge("token-B-only", { projectId: a.id });
    expect(hitsA).toEqual([]);
    const hitsB = searchKnowledge("token-B-only", { projectId: b.id });
    expect(hitsB).toHaveLength(1);
    expect(hitsB[0].id).toBe(cardB.id);

    const mapA = repo.getLibraryMapData(a.id);
    expect(mapA.nodes.some((n) => n.cardId === cardB.id)).toBe(false);

    expect(() => searchKnowledge("anything")).toThrow(ProjectScopeError);
    expect(() => repo.getLibraryMapData("")).toThrow(ProjectScopeError);
    expect(() =>
      repo.getFootprintData({ mode: "window", projectId: "" as string }),
    ).toThrow(ProjectScopeError);
  });

  it("Owner-approved revision-pinned cross-project ref; drift marks review", () => {
    const host = repo.addProject({ name: "宿主" });
    const source = repo.addProject({ name: "源项目" });
    const card = repo.addCard({
      projectId: source.id,
      content: "跨项目源正文 v1",
      title: "源标题-可见",
      sourceContentHash: materialContentHash("跨项目源正文 v1"),
    });

    expect(() =>
      repo.createCrossProjectReference({
        hostProjectId: host.id,
        sourceProjectId: source.id,
        sourceKind: "card",
        sourceObjectId: card.id,
        approvedBy: "agent:project-reviewer",
      }),
    ).toThrow(/Owner|Agent/);

    const ref = repo.createCrossProjectReference({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      sourceKind: "card",
      sourceObjectId: card.id,
      approvedBy: "自己",
    });
    expect(ref.hostProjectId).toBe(host.id);
    expect(ref.sourceProjectId).toBe(source.id);
    expect(ref.sourceObjectId).toBe(card.id);
    expect(ref.sourceContentHash).toBe(materialContentHash("跨项目源正文 v1"));
    expect(ref.reviewRequired).toBe(false);
    expect(ref.sourceTitle).toContain("源标题");
    expect(ref.approvedBy).toBe("自己");

    // Host list only
    expect(repo.listCrossProjectReferences(host.id)).toHaveLength(1);
    expect(repo.listCrossProjectReferences(source.id)).toHaveLength(0);

    // Mutate source content hash on card
    const cardsPath = path.join(tmpDir, "cards.json");
    const cards = JSON.parse(fs.readFileSync(cardsPath, "utf-8")) as Record<
      string,
      { content: string; sourceContentHash?: string }
    >;
    cards[card.id].content = "跨项目源正文 v2 changed";
    cards[card.id].sourceContentHash = materialContentHash(
      "跨项目源正文 v2 changed",
    );
    fs.writeFileSync(cardsPath, JSON.stringify(cards), "utf-8");

    const verified = repo.verifyCrossProjectReference(ref.id);
    expect(verified.reviewRequired).toBe(true);
    expect(verified.sourceContentHash).toBe(
      materialContentHash("跨项目源正文 v1"),
    );
  });

  it("sensitive source project never stores title on host ref", () => {
    const host = repo.addProject({ name: "宿主公开" });
    const source = repo.addProject({ name: "敏感源" });
    repo.setProjectSensitive(source.id, true);
    expect(repo.getProject(source.id)?.sensitive).toBe(true);

    const material = writeProjectMaterial(
      source.id,
      "secret.md",
      "敏感材料正文 title-leak-test",
    );
    const ref = repo.createCrossProjectReference({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      sourceKind: "material",
      sourceObjectId: material.id,
      approvedBy: "owner-ma",
    });
    expect(ref.sourceTitle).toBeUndefined();
    expect(ref.sourceContentHash.length).toBeGreaterThan(10);
    // Host must not learn sensitive title via list either
    const listed = repo.listCrossProjectReferences(host.id);
    expect(listed[0].sourceTitle).toBeUndefined();
  });

  it("same-project cross-ref is rejected", () => {
    const p = repo.addProject({ name: "单项目" });
    const card = repo.addCard({ projectId: p.id, content: "本地" });
    expect(() =>
      repo.createCrossProjectReference({
        hostProjectId: p.id,
        sourceProjectId: p.id,
        sourceKind: "card",
        sourceObjectId: card.id,
        approvedBy: "自己",
      }),
    ).toThrow(ProjectScopeError);
  });
});
