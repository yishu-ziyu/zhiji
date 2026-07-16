import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getSharedAgentMemoryService,
  getSharedProjectMemoryDataDir,
  getSharedProjectMemoryStore,
  projectMemorySqlitePath,
  resetSharedProjectMemoryStoreForTests,
  resolveProjectMemoryDataDir,
} from "./runtime";

describe("project-memory shared runtime identity", () => {
  afterEach(() => {
    resetSharedProjectMemoryStoreForTests();
  });

  it("resolveProjectMemoryDataDir is stable under knowledge root (not .data/project-memory)", () => {
    const cwd = "/tmp/fake-cwd";
    const fromDefault = resolveProjectMemoryDataDir({}, cwd);
    expect(fromDefault).toBe(
      path.resolve(cwd, "data", "knowledge", "project-memory"),
    );

    const fromKnowledge = resolveProjectMemoryDataDir(
      { KNOWLEDGE_DATA_DIR: "/var/knowledge" },
      cwd,
    );
    expect(fromKnowledge).toBe(
      path.resolve("/var/knowledge", "project-memory"),
    );

    const explicit = resolveProjectMemoryDataDir(
      { PROJECT_MEMORY_DATA_DIR: "/explicit/pm" },
      cwd,
    );
    expect(explicit).toBe(path.resolve("/explicit/pm"));
  });

  it("singleton returns same store instance and dataDir for repeated gets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-runtime-"));
    try {
      const a = getSharedProjectMemoryStore({ dataDir: tmp });
      const b = getSharedProjectMemoryStore({ dataDir: tmp });
      expect(a).toBe(b);
      expect(getSharedProjectMemoryDataDir()).toBe(path.resolve(tmp));
      expect(a.dbPath).toBe(projectMemorySqlitePath(tmp));

      const agent = getSharedAgentMemoryService({ dataDir: tmp });
      expect("resolveCandidate" in agent).toBe(false);
      expect(typeof agent.saveCandidate).toBe("function");
    } finally {
      resetSharedProjectMemoryStoreForTests();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("refuses a second dataDir so observer and agent cannot fork SQLite", () => {
    const aDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-runtime-a-"));
    const bDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-runtime-b-"));
    try {
      getSharedProjectMemoryStore({ dataDir: aDir });
      expect(() => getSharedProjectMemoryStore({ dataDir: bDir })).toThrow(
        /refusing second dataDir/i,
      );
      // Still bound to first
      expect(getSharedProjectMemoryDataDir()).toBe(path.resolve(aDir));
      expect(getSharedProjectMemoryStore({ dataDir: aDir }).dbPath).toBe(
        projectMemorySqlitePath(aDir),
      );
    } finally {
      resetSharedProjectMemoryStoreForTests();
      fs.rmSync(aDir, { recursive: true, force: true });
      fs.rmSync(bDir, { recursive: true, force: true });
    }
  });

  it("agent route defaults bind to the shared runtime singleton (same SQLite path)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-runtime-loop-"));
    try {
      resetSharedProjectMemoryStoreForTests();
      const {
        getDefaultSqliteStore,
        getAgentMemoryService,
        getOwnerDecisionWriter,
        resetDefaultProjectMemoryStoreForTests,
      } = await import("./reconstruct");

      resetDefaultProjectMemoryStoreForTests(tmp);

      const shared = getSharedProjectMemoryStore({ dataDir: tmp });
      const fromRoutes = getDefaultSqliteStore();
      const agent = getAgentMemoryService();
      const owner = getOwnerDecisionWriter();

      expect(fromRoutes).toBe(shared);
      expect(owner).toBe(shared);
      expect(fromRoutes.dbPath).toBe(projectMemorySqlitePath(tmp));
      expect(getSharedProjectMemoryDataDir()).toBe(path.resolve(tmp));
      expect("resolveCandidate" in agent).toBe(false);
      // grants.ts getDefaultSourceGrantManager() also calls getSharedProjectMemoryStore()
      // (wired in production; not imported here — @parcel/watcher optional in unit env)
    } finally {
      resetSharedProjectMemoryStoreForTests();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
