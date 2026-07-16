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

  it("capability accessors share one SQLite; Agent has no resolveCandidate", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-runtime-loop-"));
    try {
      resetSharedProjectMemoryStoreForTests(tmp);
      const {
        getSharedObservationWriter,
        getSharedAgentMemoryService,
        getSharedOwnerDecisionWriter,
        getSharedProjectMemoryReader,
      } = await import("./runtime");

      const writer = getSharedObservationWriter({ dataDir: tmp });
      const agent = getSharedAgentMemoryService({ dataDir: tmp });
      const owner = getSharedOwnerDecisionWriter({ dataDir: tmp });
      const reader = getSharedProjectMemoryReader({ dataDir: tmp });

      expect(getSharedProjectMemoryDataDir()).toBe(path.resolve(tmp));
      expect(typeof writer.ingest).toBe("function");
      expect(Object.keys(writer).sort()).toEqual(["ingest"]);
      expect(Object.keys(owner).sort()).toEqual(["resolveCandidate"]);
      expect("resolveCandidate" in agent).toBe(false);
      expect("ingest" in agent).toBe(false);
      expect(typeof agent.saveCandidate).toBe("function");
      expect(typeof agent.readRevision).toBe("function");
      expect(typeof reader.getMatterState).toBe("function");
      expect("resolveCandidate" in reader).toBe(false);
      expect("saveCandidate" in reader).toBe(false);

      const {
        getAgentMemoryService,
        getOwnerDecisionWriter,
        resetDefaultProjectMemoryStoreForTests,
      } = await import("./reconstruct");
      resetDefaultProjectMemoryStoreForTests(tmp);
      const routeAgent = getAgentMemoryService();
      const routeOwner = getOwnerDecisionWriter();
      expect("resolveCandidate" in routeAgent).toBe(false);
      expect(Object.keys(routeOwner).sort()).toEqual(["resolveCandidate"]);
      // Full store must not be returned as OwnerDecisionWriter
      expect(routeOwner).not.toBe(getSharedProjectMemoryStore({ dataDir: tmp }));
    } finally {
      resetSharedProjectMemoryStoreForTests();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
