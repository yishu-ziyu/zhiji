import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Workbench bundle (dual-truth entry)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-bundle-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
    delete process.env.SEED_DEMO;
  });

  afterEach(async () => {
    const d = await import("./dialogue-store");
    d.resetDialogueStoreForTests();
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("uses one projectId for knowledge materials and dialogue readiness", async () => {
    const repo = await import("@/shared/knowledge/repository");
    const { materializeGrantSignalsToProject } = await import(
      "@/shared/knowledge/materialize-grant-signals"
    );
    const dialogue = await import("./dialogue-store");
    const { loadWorkbenchBundle } = await import("./workbench-bundle");

    repo.resetKnowledgeStoreForTests();
    dialogue.resetDialogueStoreForTests();

    const projectId = "folder-proj-stable-id";
    repo.ensureProject({
      id: projectId,
      name: "真实夹",
      summary: "from connect",
      syncNameFromFolder: true,
    });
    materializeGrantSignalsToProject(projectId, [
      {
        relativePath: "README.md",
        content: new TextEncoder().encode("# Real\noverview"),
      },
      {
        relativePath: "TODO.md",
        content: new TextEncoder().encode("- [ ] ship"),
      },
      {
        relativePath: "NOTES.md",
        content: new TextEncoder().encode("notes"),
      },
    ]);
    dialogue.openDialogueSession({ projectId, title: "开聊" });

    const bundle = loadWorkbenchBundle(projectId);
    expect(bundle.projectId).toBe(projectId);
    expect(bundle.projectExists).toBe(true);
    expect(bundle.projectName).toBe("真实夹");
    expect(bundle.materialCount).toBeGreaterThanOrEqual(3);
    expect(bundle.knowledgeReady).toBe(true);
    expect(bundle.canvasReady).toBe(true);
    expect(bundle.openDialogueSessions).toBe(1);

    const missing = loadWorkbenchBundle("no-such-project");
    expect(missing.projectExists).toBe(false);
    expect(missing.canvasReady).toBe(false);
  });
});
