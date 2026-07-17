import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("seedWorkItemsFromMaterials (no auto formal todos)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;
  let previousSeedDemo: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-work-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    previousSeedDemo = process.env.SEED_DEMO;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
    delete process.env.SEED_DEMO;
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
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("authorize/materialize does not auto-create formal todos", async () => {
    const { materializeGrantSignalsToProject } = await import(
      "./materialize-grant-signals"
    );
    const repo = await import("./repository");
    repo.resetKnowledgeStoreForTests();

    const project = repo.addProject({
      name: "夹具项目",
      summary: "no auto todo",
    });
    const before = repo.listActions({ projectId: project.id }).length;
    const result = materializeGrantSignalsToProject(project.id, [
      {
        relativePath: "README.md",
        content: new TextEncoder().encode("# Owner project\ngoal: center nodes"),
        kind: "reconciled",
      },
      {
        relativePath: "TODO.md",
        content: new TextEncoder().encode("- [ ] ship canvas"),
        kind: "reconciled",
      },
      {
        relativePath: "NOTES.md",
        content: new TextEncoder().encode("meeting open questions"),
        kind: "reconciled",
      },
    ]);

    expect(result.written).toBeGreaterThanOrEqual(2);
    expect(result.workItemsCreated).toBe(0);
    expect(repo.listActions({ projectId: project.id }).length).toBe(before);
  });

  it("seedWorkItemsFromMaterials never increases todo count", async () => {
    const repo = await import("./repository");
    const { seedWorkItemsFromMaterials } = await import(
      "./seed-work-items-from-materials"
    );
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "空", summary: "" });
    const before = repo.listActions({ projectId: project.id }).length;
    const result = seedWorkItemsFromMaterials(project.id);
    expect(result.created).toBe(0);
    expect(repo.listActions({ projectId: project.id }).length).toBe(before);
    expect(result.emptyReason).toMatch(/不会自动|建议|采用/);
  });

  it("does not delete existing user tasks", async () => {
    const repo = await import("./repository");
    const { seedWorkItemsFromMaterials } = await import(
      "./seed-work-items-from-materials"
    );
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "有任务", summary: "" });
    const user = repo.addAction({
      projectId: project.id,
      title: "人手任务",
      description: "keep",
      nextStep: "go",
      status: "todo",
      assignee: "自己",
      deadline: "本周",
      verificationCriteria: "ok",
      evidenceIds: [],
    });
    seedWorkItemsFromMaterials(project.id);
    expect(repo.getAction(user.id)?.title).toBe("人手任务");
  });
});
