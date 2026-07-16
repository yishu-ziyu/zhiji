import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLocalObservationAdapter,
  GrantBoundaryError,
  relativePathWithinGrantRoot,
  type ParcelWatchEvent,
  type ParcelWatcher,
} from "@/shared/project-memory/observer";
import {
  getDefaultSourceGrantManager,
  normalizeWatchPathPrefix,
  resetDefaultSourceGrantManagerForTests,
  selectMatterEvents,
  SourceGrantStateError,
} from "@/shared/project-memory/grants";
import {
  connectFromSelectionId,
  continuePersistedConnection,
  createMacOsFolderPickerRunner,
  FolderSelectionStore,
  listRecentFolderConnections,
  openFolderPickerForReview,
  projectIdFromCanonicalFolder,
  resetFolderSelectionStoreForTests,
  ROOT_SENTINEL_INCLUDE,
  SAFE_DEFAULT_EXCLUDE_PREFIXES,
  setNativeFolderPickerRunnerForTests,
  toConnectionsPostPayload,
} from "@/shared/project-memory/native-folder-picker";
import {
  DEFAULT_GRANT_POLICY,
} from "@/shared/project-memory/grant-policy";
import {
  getSharedProjectMemoryStore,
  resetSharedProjectMemoryStoreForTests,
} from "@/shared/project-memory/runtime";
import type { ChangeEvent, MatterWatchSet } from "@/shared/project-memory/types";
import type { SourceGrantManager } from "@/shared/project-memory/grants";

/** PR-03: preflight confirm then connect. */
async function connectAfterPreflight(
  selectionId: string,
  opts: { store: FolderSelectionStore; manager: SourceGrantManager },
) {
  opts.store.markPreflight(selectionId, {
    policyVersion: DEFAULT_GRANT_POLICY.version,
    fingerprint: "test-report",
  });
  const { confirmToken } = opts.store.confirmPreflight(
    selectionId,
    DEFAULT_GRANT_POLICY.version,
    "test-report",
  );
  return connectFromSelectionId(selectionId, {
    store: opts.store,
    manager: opts.manager,
    confirmToken,
  });
}

class FakeWatcher implements ParcelWatcher {
  private callback?: (
    events: ParcelWatchEvent[],
    error?: Error,
  ) => Promise<void> | void;

  async subscribe(
    _rootPath: string,
    callback: (
      events: ParcelWatchEvent[],
      error?: Error,
    ) => Promise<void> | void,
  ) {
    this.callback = callback;
    return { unsubscribe: async () => undefined };
  }
}

describe("D-50 native folder picker + connection seam", () => {
  let tmp: string;
  let root: string;
  let storeDir: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "d50-picker-"));
    root = path.join(tmp, "my-project");
    fs.mkdirSync(root);
    storeDir = path.join(tmp, "pm-store");
    resetFolderSelectionStoreForTests();
    setNativeFolderPickerRunnerForTests(undefined);
    resetDefaultSourceGrantManagerForTests(storeDir);
  });

  afterEach(async () => {
    try {
      await getDefaultSourceGrantManager({
        adapter: createLocalObservationAdapter({ watcher: new FakeWatcher() }),
      }).stopAll();
    } catch {
      /* ignore */
    }
    resetDefaultSourceGrantManagerForTests();
    resetSharedProjectMemoryStoreForTests();
    resetFolderSelectionStoreForTests();
    setNativeFolderPickerRunnerForTests(undefined);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("cancel leaves no selection residue and no grant", async () => {
    const store = new FolderSelectionStore();
    const result = await openFolderPickerForReview({
      runner: async () => ({ status: "cancelled" }),
      store,
    });
    expect(result).toEqual({ status: "cancelled" });
    expect(store.size()).toBe(0);
    expect(getSharedProjectMemoryStore().listActiveLocalFolderGrants()).toEqual([]);
  });

  it("selection issues one-use token; reuse and expiry fail; no grant until connect", async () => {
    let now = 1_000;
    const store = new FolderSelectionStore({
      now: () => now,
      ttlMs: 100,
      idFactory: () => "sel_test_1",
    });
    const selected = await openFolderPickerForReview({
      runner: async () => ({
        status: "selected",
        path: root,
        name: "my-project",
      }),
      store,
    });
    expect(selected.status).toBe("selected");
    if (selected.status !== "selected") return;
    expect(selected.selectionId).toBe("sel_test_1");
    expect(selected.folderName).toBe("my-project");
    expect(selected.displayPath).toBe(await fs.promises.realpath(root));
    expect(store.size()).toBe(1);
    expect(getSharedProjectMemoryStore().listActiveLocalFolderGrants()).toEqual([]);

    // Without preflight confirm, consume fails.
    expect(() => store.consume(selected.selectionId)).toThrow(
      /preflight|confirm/i,
    );
    store.markPreflight(selected.selectionId, {
      policyVersion: DEFAULT_GRANT_POLICY.version,
      fingerprint: "test-report",
    });
    const { confirmToken } = store.confirmPreflight(
      selected.selectionId,
      DEFAULT_GRANT_POLICY.version,
      "test-report",
    );
    const first = store.consume(selected.selectionId, { confirmToken });
    expect(first.folderName).toBe("my-project");
    expect(() =>
      store.consume(selected.selectionId, { confirmToken }),
    ).toThrow(SourceGrantStateError);

    const selected2 = await openFolderPickerForReview({
      runner: async () => ({
        status: "selected",
        path: root,
        name: "my-project",
      }),
      store: new FolderSelectionStore({
        now: () => now,
        ttlMs: 50,
        idFactory: () => "sel_expired",
      }),
    });
    expect(selected2.status).toBe("selected");
    if (selected2.status !== "selected") return;
    const expiredStore = new FolderSelectionStore({
      now: () => now,
      ttlMs: 50,
      idFactory: () => "sel_expired_b",
    });
    const review = expiredStore.issue({
      canonicalRoot: selected2.displayPath,
      folderName: "my-project",
    });
    expiredStore.markPreflight(review.selectionId, {
      policyVersion: DEFAULT_GRANT_POLICY.version,
      fingerprint: "test-report",
    });
    expiredStore.confirmPreflight(
      review.selectionId,
      DEFAULT_GRANT_POLICY.version,
      "test-report",
    );
    now += 200;
    expect(() =>
      expiredStore.consume(review.selectionId, {
        confirmToken: "stale",
      }),
    ).toThrow(/missing or expired/i);
  });

  it("same canonical folder reuses project id and grant; root sentinel + safe excludes", async () => {
    const manager = getDefaultSourceGrantManager({
      adapter: createLocalObservationAdapter({ watcher: new FakeWatcher() }),
      clock: () => "2026-07-16T12:00:00.000Z",
    });
    const store = new FolderSelectionStore({
      idFactory: () => `sel_${Math.random().toString(16).slice(2)}`,
    });
    fs.writeFileSync(path.join(root, "notes.md"), "hello");

    const pick1 = await openFolderPickerForReview({
      runner: async () => ({ status: "selected", path: root, name: "my-project" }),
      store,
    });
    expect(pick1.status).toBe("selected");
    if (pick1.status !== "selected") return;

    const first = await connectAfterPreflight(pick1.selectionId, {
      store,
      manager,
    });
    const expectedProjectId = projectIdFromCanonicalFolder(pick1.displayPath);
    expect(first.projectId).toBe(expectedProjectId);
    expect(first.grant.projectId).toBe(expectedProjectId);
    expect(first.grant.rootPath).toBe(pick1.displayPath);
    expect(first.grant.policyVersion).toBe(DEFAULT_GRANT_POLICY.version);
    expect(first.watchSet.includePathPrefixes).toEqual([ROOT_SENTINEL_INCLUDE]);
    expect(first.watchSet.excludePathPrefixes).toEqual([
      ...SAFE_DEFAULT_EXCLUDE_PREFIXES,
    ]);
    expect(first.reconcile.ran).toBe(true);
    expect(first.eventIds.length).toBeGreaterThan(0);
    expect(first.bootstrap.matter.id).toBe(first.matter.id);

    const pick2 = await openFolderPickerForReview({
      runner: async () => ({ status: "selected", path: root, name: "my-project" }),
      store,
    });
    expect(pick2.status).toBe("selected");
    if (pick2.status !== "selected") return;

    const second = await connectAfterPreflight(pick2.selectionId, {
      store,
      manager,
    });
    expect(second.projectId).toBe(first.projectId);
    expect(second.grant.id).toBe(first.grant.id);
    expect(second.matter.id).toBe(first.matter.id);
    await manager.stopAll();
  });

  it("connect POST contract: matched/relevant eventIds only (not all observed) + bootstrap", async () => {
    const manager = getDefaultSourceGrantManager({
      adapter: createLocalObservationAdapter({ watcher: new FakeWatcher() }),
      clock: () => "2026-07-16T12:30:00.000Z",
    });
    const store = new FolderSelectionStore({ idFactory: () => "sel_recon" });
    fs.mkdirSync(path.join(root, "app"));
    fs.writeFileSync(path.join(root, "app", "page.tsx"), "export default 1");
    fs.mkdirSync(path.join(root, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "x", "index.js"), "noise");

    const pick = await openFolderPickerForReview({
      runner: async () => ({ status: "selected", path: root, name: "my-project" }),
      store,
    });
    expect(pick.status).toBe("selected");
    if (pick.status !== "selected") return;

    const connected = await connectAfterPreflight(pick.selectionId, {
      store,
      manager,
    });
    expect(connected.reconcile.ran).toBe(true);
    expect(connected.reconcile.observed).toBeGreaterThan(0);
    // P0-1 / PR-03: policy filters BEFORE body read. node_modules never enters
    // reconcile observed, so observed counts only eligible sources (not noise).
    expect(connected.reconcile.observed).toBe(connected.eventIds.length);
    expect(connected.reconcile.matchedEventCount).toBe(connected.eventIds.length);
    expect(connected.eventIds.length).toBeGreaterThan(0);
    expect(connected.matchedEventIds).toEqual(connected.eventIds);
    expect(connected.memory.events.every((e) => e.id)).toBe(true);
    expect(
      connected.memory.events.some((e) => e.relativePath === "app/page.tsx"),
    ).toBe(true);
    expect(
      connected.memory.events.some((e) =>
        e.relativePath.startsWith("node_modules/"),
      ),
    ).toBe(false);
    // eventIds are exactly the matched/relevant set for analysis-runs.
    expect(connected.eventIds).toEqual(
      connected.memory.events.map((e) => e.id),
    );
    // Bootstrap is grant/matter/watch for fresh UI — not a raw event dump.
    expect(connected.bootstrap).toEqual({
      projectId: connected.projectId,
      grant: connected.grant,
      matter: connected.matter,
      watchSet: connected.watchSet,
    });
    const payload = toConnectionsPostPayload("connect", connected);
    expect(payload.eventIds).toEqual(connected.eventIds);
    expect(payload.matchedEventIds).toEqual(connected.eventIds);
    expect(payload.bootstrap.watchSet.includePathPrefixes).toEqual(["."]);
    await manager.stopAll();
  });

  it("rejects paths outside the authorized root", async () => {
    const outside = path.join(tmp, "outside.txt");
    fs.writeFileSync(outside, "nope");
    expect(() => relativePathWithinGrantRoot(root, outside)).toThrow(
      GrantBoundaryError,
    );
  });

  it("root sentinel matches app paths and excludes node_modules", () => {
    expect(normalizeWatchPathPrefix(".")).toBe(".");
    const watchSet: MatterWatchSet = {
      id: "ws-1",
      projectId: "p",
      matterId: "m",
      grantId: "g",
      includePathPrefixes: ["."],
      excludePathPrefixes: [...SAFE_DEFAULT_EXCLUDE_PREFIXES],
      status: "active",
      createdAt: "t",
      updatedAt: "t",
    };
    const events: ChangeEvent[] = [
      {
        id: "e1",
        projectId: "p",
        grantId: "g",
        kind: "added",
        relativePath: "app/page.tsx",
        observedAt: "t",
        dedupeKey: "d1",
      },
      {
        id: "e2",
        projectId: "p",
        grantId: "g",
        kind: "added",
        relativePath: "node_modules/x/index.js",
        observedAt: "t",
        dedupeKey: "d2",
      },
    ];
    const selection = selectMatterEvents(events, watchSet);
    expect(selection.relevantEvents.map((r) => r.event.relativePath)).toEqual([
      "app/page.tsx",
    ]);
    expect(selection.compactUnmatchedTraceCount).toBe(1);
  });

  it("Continue returns persisted bootstrap + reconciled matched/relevant eventIds", async () => {
    const manager = getDefaultSourceGrantManager({
      adapter: createLocalObservationAdapter({ watcher: new FakeWatcher() }),
      clock: () => "2026-07-16T12:00:00.000Z",
    });
    const store = new FolderSelectionStore({ idFactory: () => "sel_continue" });
    fs.writeFileSync(path.join(root, "plan.md"), "v1");
    fs.mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "pkg", "index.js"), "noise");
    const pick = await openFolderPickerForReview({
      runner: async () => ({ status: "selected", path: root, name: "my-project" }),
      store,
    });
    expect(pick.status).toBe("selected");
    if (pick.status !== "selected") return;

    const first = await connectAfterPreflight(pick.selectionId, {
      store,
      manager,
    });
    expect(first.eventIds.length).toBeGreaterThan(0);
    // node_modules excluded pre-read; observed equals eligible matched events
    expect(first.reconcile.observed).toBe(first.eventIds.length);
    await manager.stopAll();

    // Disk changed while stopped — continue must reconcile into matched eventIds.
    fs.writeFileSync(path.join(root, "plan.md"), "v2 after stop");
    fs.writeFileSync(path.join(root, "extra.md"), "new");

    const recent = listRecentFolderConnections(1);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.projectId).toBe(first.projectId);
    expect(recent[0]?.grantId).toBe(first.grant.id);
    expect(recent[0]?.rootPath).toBe(first.grant.rootPath);

    const resumed = await continuePersistedConnection(
      { projectId: recent[0]!.projectId, grantId: recent[0]!.grantId },
      { manager },
    );
    expect(resumed.projectId).toBe(first.projectId);
    expect(resumed.grant.id).toBe(first.grant.id);
    expect(resumed.matter.id).toBe(first.matter.id);
    expect(resumed.watchSet.id).toBe(first.watchSet.id);
    // Persisted bootstrap identities for UI Continue.
    expect(resumed.bootstrap.grant.id).toBe(first.grant.id);
    expect(resumed.bootstrap.matter.id).toBe(first.matter.id);
    expect(resumed.bootstrap.watchSet.id).toBe(first.watchSet.id);
    expect(resumed.memory.matter.id).toBe(first.matter.id);
    expect(resumed.reconcile.ran).toBe(true);
    expect(resumed.eventIds.length).toBeGreaterThan(0);
    expect(resumed.matchedEventIds).toEqual(resumed.eventIds);
    expect(resumed.reconcile.matchedEventCount).toBe(resumed.eventIds.length);
    // Still not dumping excluded noise into analysis ids.
    expect(
      resumed.memory.events.some((e) => e.relativePath.startsWith("node_modules/")),
    ).toBe(false);
    expect(
      resumed.memory.events.some((e) => e.relativePath === "extra.md"),
    ).toBe(true);
    const payload = toConnectionsPostPayload("continue", resumed);
    expect(payload.mode).toBe("continue");
    expect(payload.eventIds).toEqual(resumed.eventIds);
    expect(payload.bootstrap.projectId).toBe(first.projectId);
    await manager.stopAll();
  });

  it("osascript runner treats user cancel as cancelled (argv-safe, no shell)", async () => {
    const runner = createMacOsFolderPickerRunner(async (file, args) => {
      expect(file).toBe("osascript");
      expect(args[0]).toBe("-e");
      expect(typeof args[1]).toBe("string");
      // No shell metacharacters path injection surface: only fixed script argv.
      const err = new Error("User canceled. (-128)") as Error & {
        code: number;
        stderr: string;
      };
      err.code = 1;
      err.stderr = "";
      throw err;
    });
    // Force darwin path in detection via platform check — if not darwin, runner returns error.
    if (process.platform === "darwin") {
      await expect(runner()).resolves.toEqual({ status: "cancelled" });
    } else {
      await expect(runner()).resolves.toMatchObject({ status: "error" });
    }
  });
});
