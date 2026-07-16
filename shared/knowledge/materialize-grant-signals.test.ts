import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("materializeGrantSignalsToProject (Phase 2 bridge)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;
  let previousSeedDemo: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mat-grant-"));
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

  it("writes ≥3 text materials + cards from grant signals", async () => {
    const { materializeGrantSignalsToProject } = await import(
      "./materialize-grant-signals"
    );
    const { listProjectMaterials } = await import("./materials");
    const repo = await import("./repository");
    repo.resetKnowledgeStoreForTests();

    const project = repo.addProject({
      name: "授权夹画布",
      summary: "phase2",
    });
    const signals = [
      {
        relativePath: "README.md",
        content: new TextEncoder().encode("# Hello\nproject overview"),
        kind: "reconciled",
      },
      {
        relativePath: "TODO.md",
        content: new TextEncoder().encode("- [ ] ship canvas nodes"),
        kind: "reconciled",
      },
      {
        relativePath: "NOTES.md",
        content: new TextEncoder().encode("meeting notes body"),
        kind: "reconciled",
      },
      {
        relativePath: "DECISIONS.md",
        content: new TextEncoder().encode("we chose center real nodes"),
        kind: "reconciled",
      },
      {
        relativePath: "node_modules/pkg/index.js",
        content: new TextEncoder().encode("skip me"),
        kind: "reconciled",
      },
      {
        relativePath: "photo.png",
        content: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        kind: "reconciled",
      },
    ];

    const result = materializeGrantSignalsToProject(project.id, signals);
    expect(result.written).toBeGreaterThanOrEqual(3);
    expect(result.cardIds.length).toBe(result.written);

    const materials = listProjectMaterials(project.id);
    expect(materials.length).toBeGreaterThanOrEqual(3);
    expect(materials.every((m) => !m.id.includes("node_modules"))).toBe(true);

    const cards = repo.listCards({ projectId: project.id });
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards.every((c) => c.sourceFileId)).toBe(true);

    // Idempotent second pass (same sourceFileId cards)
    const again = materializeGrantSignalsToProject(project.id, signals);
    expect(again.written).toBe(result.written);
    expect(repo.listCards({ projectId: project.id }).length).toBe(cards.length);
  });
});
