import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProjectAgentRuntime } from "./agent-runtime";
import { resetSharedProjectMemoryStoreForTests } from "./runtime";
import { SqliteProjectMemoryStore } from "./sqlite-store";
import type { Matter } from "./types";

describe("ProjectAgentRuntime multi-step tools", () => {
  let tmp: string;
  let fixture: string;
  let store: SqliteProjectMemoryStore;
  const projectId = "p-agent";
  const matterId = "m-agent";
  const grantId = "g-agent";

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-agent-rt-"));
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fx-agent-"));
    fs.writeFileSync(
      path.join(fixture, "NOTES.md"),
      "# Notes\nCurrent focus is shipping a source-backed agent.\nTODO: verify quotes.\n",
    );
    fs.writeFileSync(
      path.join(fixture, "DECISIONS.md"),
      "# Decisions\n- Use local folder grant only.\n",
    );

    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    // bind process singleton used by runtime
    resetSharedProjectMemoryStoreForTests(tmp);
    // re-open same path via singleton (reset already opened)
    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    // Actually reset opens singleton - use that store
    const { getSharedProjectMemoryStore } = await import("./runtime");
    store = getSharedProjectMemoryStore({ dataDir: tmp });

    store.upsertGrant({
      id: grantId,
      projectId,
      kind: "local_folder",
      rootPath: fixture,
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    const matter: Matter = {
      id: matterId,
      projectId,
      title: "读懂授权夹",
      goal: "有来源理解",
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    };
    store.upsertMatter(matter);
    store.upsertWatchSet({
      id: "w-agent",
      projectId,
      matterId,
      grantId,
      includePathPrefixes: ["NOTES.md", "DECISIONS.md"],
      excludePathPrefixes: [],
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });

    await store.ingest({
      projectId,
      grantId,
      kind: "added",
      relativePath: "NOTES.md",
      content: new TextEncoder().encode(
        "# Notes\nCurrent focus is shipping a source-backed agent.\nTODO: verify quotes.\n",
      ),
      observedAt: "2026-07-16T10:01:00.000Z",
    });
    await store.ingest({
      projectId,
      grantId,
      kind: "added",
      relativePath: "DECISIONS.md",
      content: new TextEncoder().encode(
        "# Decisions\n- Use local folder grant only.\n",
      ),
      observedAt: "2026-07-16T10:01:01.000Z",
    });
  });

  afterEach(() => {
    resetSharedProjectMemoryStoreForTests();
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(fixture, { recursive: true, force: true });
    } catch {
      /* */
    }
  });

  it("runs map → search → read_revision and persists tool receipts", async () => {
    const runtime = createProjectAgentRuntime({
      modelMode: "deterministic",
      toolsEnabled: true,
    });
    const run = await runtime.start({
      projectId,
      matterId,
      trigger: "source_change",
    });

    expect(run.status).toBe("awaiting_owner");
    expect(run.progressSummary || "").toMatch(/工具|候选|地图|搜索|已读/);

    const view = await runtime.get(projectId, run.id);
    expect(view).toBeTruthy();
    const tools = view!.toolReceipts.map((r) => r.tool);
    expect(tools).toContain("project_map");
    expect(tools).toContain("search_text");
    expect(tools).toContain("read_revision");
    expect(view!.toolReceipts.length).toBeGreaterThanOrEqual(3);

    // candidate should exist with file-backed evidence path possible
    const state = await store.getMatterState(projectId, matterId);
    expect(state.candidate).toBeTruthy();
  });
});
