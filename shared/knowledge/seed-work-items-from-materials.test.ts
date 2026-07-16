import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("seedWorkItemsFromMaterials (policy A)", () => {
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

  it("creates draft work items from README/TODO/NOTES without Owner confirm", async () => {
    const { materializeGrantSignalsToProject } = await import(
      "./materialize-grant-signals"
    );
    const repo = await import("./repository");
    const { seedWorkItemsFromMaterials, seedWorkItemId } = await import(
      "./seed-work-items-from-materials"
    );
    repo.resetKnowledgeStoreForTests();

    const project = repo.addProject({
      name: "夹具项目",
      summary: "policy A",
    });
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
      {
        relativePath: "DECISIONS.md",
        content: new TextEncoder().encode("chose real nodes"),
        kind: "reconciled",
      },
    ]);

    expect(result.written).toBeGreaterThanOrEqual(3);
    expect(result.workItemsCreated).toBeGreaterThanOrEqual(3);

    const items = repo.listActions({ projectId: project.id });
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((item) => item.status === "todo")).toBe(true);
    expect(items.every((item) => item.evidenceIds.length > 0)).toBe(true);
    expect(items.some((item) => /目标|README|范围/i.test(item.title))).toBe(
      true,
    );
    expect(items.some((item) => /待办|TODO/i.test(item.title))).toBe(true);

    // Idempotent re-seed
    const again = seedWorkItemsFromMaterials(project.id);
    expect(again.created).toBe(0);
    expect(again.skippedExisting).toBeGreaterThanOrEqual(3);

    const readmeId = seedWorkItemId(project.id, "README.md");
    expect(repo.getAction(readmeId)).toBeTruthy();
  });

  it("creates zero work items when there are no seedable materials", async () => {
    const repo = await import("./repository");
    const { seedWorkItemsFromMaterials } = await import(
      "./seed-work-items-from-materials"
    );
    repo.resetKnowledgeStoreForTests();
    const project = repo.addProject({ name: "空", summary: "" });
    const result = seedWorkItemsFromMaterials(project.id);
    expect(result.created).toBe(0);
    expect(result.emptyReason).toMatch(/材料/);
  });
});
