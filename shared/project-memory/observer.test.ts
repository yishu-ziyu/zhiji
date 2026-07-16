import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteProjectMemoryStore } from "./sqlite-store";
import {
  createLocalObservationAdapter,
  GrantBoundaryError,
  relativePathWithinGrantRoot,
  type ParcelWatchEvent,
  type ParcelWatcher,
} from "./observer";
import {
  getDefaultSourceGrantManager,
  resetDefaultSourceGrantManagerForTests,
  selectMatterEvents,
  SourceGrantManager,
} from "./grants";
import {
  getSharedAgentMemoryService,
  resetSharedProjectMemoryStoreForTests,
} from "./runtime";
import type { ChangeEvent, ObservationSignal, SourceGrant } from "./types";

class FakeWatcher implements ParcelWatcher {
  private callback?: (
    events: ParcelWatchEvent[],
    error?: Error,
  ) => Promise<void> | void;
  private stopped = false;

  async subscribe(
    _rootPath: string,
    callback: (
      events: ParcelWatchEvent[],
      error?: Error,
    ) => Promise<void> | void,
  ) {
    this.callback = callback;
    return {
      unsubscribe: async () => {
        this.stopped = true;
      },
    };
  }

  async emit(...events: ParcelWatchEvent[]): Promise<void> {
    if (this.stopped) return;
    await this.callback?.(events);
  }

  async fail(error: Error): Promise<void> {
    if (this.stopped) return;
    await this.callback?.([], error);
  }
}

function grant(rootPath: string, status: SourceGrant["status"] = "active"): SourceGrant {
  return {
    id: "grant-1",
    projectId: "project-1",
    kind: "local_folder",
    rootPath,
    status,
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

describe("MVP-V0 local project observer and grant boundary", () => {
  let tmp: string;
  let root: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mvp-v0-observer-"));
    root = path.join(tmp, "project");
    fs.mkdirSync(root);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("rejects a path outside the grant root before reading it", () => {
    expect(() => relativePathWithinGrantRoot(root, path.join(tmp, "outside.txt"))).toThrow(
      GrantBoundaryError,
    );
  });

  it("reconcile scans only the authorized root", async () => {
    fs.writeFileSync(path.join(root, "allowed.txt"), "allowed");
    fs.writeFileSync(path.join(tmp, "outside.txt"), "must not scan");
    const outsideLink = path.join(root, "outside-link");
    fs.symlinkSync(path.join(tmp, "outside.txt"), outsideLink);

    const adapter = createLocalObservationAdapter({
      watcher: new FakeWatcher(),
      clock: () => "2026-07-16T10:00:00.000Z",
    });
    const signals = await adapter.reconcile(grant(root));
    expect(signals.map((signal) => signal.relativePath)).toEqual(["allowed.txt"]);
    expect(signals.some((signal) => signal.relativePath.includes("outside"))).toBe(false);
  });

  it("maps startup, add, modify, delete, and watcher-error recovery", async () => {
    fs.writeFileSync(path.join(root, "a.txt"), "v1");
    const watcher = new FakeWatcher();
    let reconciles = 0;
    const adapter = createLocalObservationAdapter({
      watcher,
      clock: () => "2026-07-16T10:00:00.000Z",
      onReconcile: () => {
        reconciles += 1;
      },
    });
    const observed: string[] = [];
    const stop = await adapter.start(grant(root), async (signal) => {
      observed.push(`${signal.kind}:${signal.relativePath}`);
    });
    expect(reconciles).toBe(1);
    expect(observed).toContain("reconciled:a.txt");

    fs.writeFileSync(path.join(root, "b.txt"), "b");
    await watcher.emit({ type: "create", path: path.join(root, "b.txt") });
    fs.writeFileSync(path.join(root, "b.txt"), "b2");
    await watcher.emit({ type: "update", path: path.join(root, "b.txt") });
    fs.rmSync(path.join(root, "b.txt"));
    await watcher.emit({ type: "delete", path: path.join(root, "b.txt") });
    expect(observed).toEqual(
      expect.arrayContaining(["added:b.txt", "modified:b.txt", "deleted:b.txt"]),
    );

    await expect(
      watcher.emit({ type: "update", path: path.join(tmp, "outside.txt") }),
    ).rejects.toThrow(GrantBoundaryError);
    expect(reconciles).toBe(1);
    await watcher.fail(new Error("provider overflow"));
    expect(reconciles).toBe(2);
    await stop.stop();
  });

  it("correlates a same-batch delete/create into one rename signal", async () => {
    const oldPath = path.join(root, "before.txt");
    const newPath = path.join(root, "after.txt");
    fs.writeFileSync(oldPath, "rename content");
    const watcher = new FakeWatcher();
    const adapter = createLocalObservationAdapter({
      watcher,
      clock: () => "2026-07-16T10:00:00.000Z",
    });
    const observed: ObservationSignal[] = [];
    const stop = await adapter.start(grant(root), async (signal) => {
      observed.push(signal);
    });
    observed.length = 0;

    fs.renameSync(oldPath, newPath);
    await watcher.emit(
      { type: "delete", path: oldPath },
      { type: "create", path: newPath },
    );

    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      kind: "renamed",
      relativePath: "after.txt",
      previousPath: "before.txt",
    });
    expect(observed[0]?.content).toEqual(new TextEncoder().encode("rename content"));
    await stop.stop();
  });

  it("bootstraps a usable matter/watch and shares observed events with Agent", async () => {
    const storeDir = path.join(tmp, "shared-runtime");
    const watcher = new FakeWatcher();
    resetDefaultSourceGrantManagerForTests(storeDir);
    try {
      const manager = getDefaultSourceGrantManager({
        adapter: createLocalObservationAdapter({ watcher }),
        clock: () => "2026-07-16T10:00:00.000Z",
      });
      const connection = await manager.connectLocalRoot({
        projectId: "project-1",
        rootPath: root,
      });
      expect(connection.matter.projectId).toBe("project-1");
      expect(connection.matter.status).toBe("active");
      expect(connection.watchSet).toMatchObject({
        projectId: "project-1",
        matterId: connection.matter.id,
        grantId: connection.grant.id,
        status: "active",
      });
      expect(connection.watchSet.includePathPrefixes.length).toBeGreaterThan(0);

      fs.mkdirSync(path.join(root, "src"));
      fs.writeFileSync(path.join(root, "src", "observed.ts"), "shared");
      await watcher.emit({
        type: "create",
        path: path.join(root, "src", "observed.ts"),
      });

      const agent = getSharedAgentMemoryService({ dataDir: storeDir });
      const events = await agent.listEvents("project-1");
      expect(events.some((event) => event.relativePath === "src/observed.ts")).toBe(true);
      const state = await agent.getMatterState("project-1", connection.matter.id);
      expect(state.watchSet?.id).toBe(connection.watchSet.id);
      await manager.stopAll();
    } finally {
      resetDefaultSourceGrantManagerForTests();
      resetSharedProjectMemoryStoreForTests();
    }
  });

  it("hydrates the persisted connection and resumes its observer after restart", async () => {
    const storeDir = path.join(tmp, "restart-runtime");
    const firstWatcher = new FakeWatcher();
    resetDefaultSourceGrantManagerForTests(storeDir);
    let firstManager: SourceGrantManager | undefined;
    try {
      firstManager = getDefaultSourceGrantManager({
        adapter: createLocalObservationAdapter({ watcher: firstWatcher }),
        clock: () => "2026-07-16T10:00:00.000Z",
      });
      const first = await firstManager.connectLocalRoot({
        projectId: "project-1",
        rootPath: root,
      });
      await firstManager.stopAll();

      resetDefaultSourceGrantManagerForTests();
      resetSharedProjectMemoryStoreForTests();

      const secondWatcher = new FakeWatcher();
      resetDefaultSourceGrantManagerForTests(storeDir);
      const secondManager = getDefaultSourceGrantManager({
        adapter: createLocalObservationAdapter({ watcher: secondWatcher }),
        clock: () => "2026-07-16T10:00:00.000Z",
      });
      const second = await secondManager.connectLocalRoot({
        projectId: "project-1",
        rootPath: root,
      });
      expect(second.grant.id).toBe(first.grant.id);
      expect(second.matter.id).toBe(first.matter.id);
      expect(second.watchSet.id).toBe(first.watchSet.id);
      expect(second.watchSet.includePathPrefixes).toEqual(
        first.watchSet.includePathPrefixes,
      );

      fs.mkdirSync(path.join(root, "src"));
      fs.writeFileSync(path.join(root, "src", "after-restart.ts"), "resumed");
      await secondWatcher.emit({
        type: "create",
        path: path.join(root, "src", "after-restart.ts"),
      });
      const agent = getSharedAgentMemoryService({ dataDir: storeDir });
      const events = await agent.listEvents("project-1");
      expect(events.some((event) => event.relativePath === "src/after-restart.ts")).toBe(true);
      await secondManager.stopAll();
    } finally {
      await firstManager?.stopAll();
      resetDefaultSourceGrantManagerForTests();
      resetSharedProjectMemoryStoreForTests();
    }
  });

  it("revoke stops new signals while retaining prior history", async () => {
    const storeDir = path.join(tmp, "memory");
    const store = new SqliteProjectMemoryStore({ dataDir: storeDir });
    const watcher = new FakeWatcher();
    const manager = new SourceGrantManager({
      store,
      adapter: createLocalObservationAdapter({ watcher }),
      clock: () => "2026-07-16T10:00:00.000Z",
    });
    const authorized = await manager.authorizeLocalRoot({
      projectId: "project-1",
      rootPath: root,
    });
    fs.writeFileSync(path.join(root, "kept.txt"), "history");
    await watcher.emit({ type: "create", path: path.join(root, "kept.txt") });
    const beforeRevoke = await store.listEvents("project-1");
    expect(beforeRevoke.some((event) => event.relativePath === "kept.txt")).toBe(true);

    await manager.revoke("project-1", authorized.id);
    fs.writeFileSync(path.join(root, "ignored.txt"), "no new event");
    await watcher.emit({ type: "create", path: path.join(root, "ignored.txt") });
    const afterRevoke = await store.listEvents("project-1");
    expect(afterRevoke).toEqual(beforeRevoke);
    expect(manager.get("project-1", authorized.id)?.status).toBe("revoked");
    store.close();
  });

  it("keeps unmatched changes in compact trace and exposes only matched reasons", async () => {
    const store = new SqliteProjectMemoryStore({ dataDir: path.join(tmp, "memory") });
    const manager = new SourceGrantManager({
      store,
      adapter: createLocalObservationAdapter({ watcher: new FakeWatcher() }),
      clock: () => "2026-07-16T10:00:00.000Z",
    });
    const authorized = manager.register(grant(root));
    const watchSet = await manager.upsertWatchSet({
      projectId: authorized.projectId,
      matterId: "matter-1",
      grantId: authorized.id,
      includePathPrefixes: ["docs/"],
      excludePathPrefixes: ["docs/private/"],
    });
    const events: ChangeEvent[] = [
      {
        id: "e-doc",
        projectId: "project-1",
        grantId: authorized.id,
        kind: "modified",
        relativePath: "docs/spec.md",
        observedAt: "2026-07-16T10:00:00.000Z",
        dedupeKey: "e-doc",
      },
      {
        id: "e-private",
        projectId: "project-1",
        grantId: authorized.id,
        kind: "modified",
        relativePath: "docs/private/secret.md",
        observedAt: "2026-07-16T10:00:00.000Z",
        dedupeKey: "e-private",
      },
      {
        id: "e-linked",
        projectId: "project-1",
        grantId: authorized.id,
        kind: "modified",
        relativePath: "src/action.ts",
        observedAt: "2026-07-16T10:00:00.000Z",
        dedupeKey: "e-linked",
      },
    ];
    const selected = selectMatterEvents(events, watchSet, {
      linkedActionEventIds: ["e-linked"],
    });
    expect(selected.relevantEvents.map((view) => view.event.id)).toEqual([
      "e-doc",
      "e-linked",
    ]);
    expect(selected.relevantEvents.map((view) => view.matchReason)).toEqual([
      "watch_path",
      "linked_action",
    ]);
    expect(selected.compactUnmatchedTraceCount).toBe(1);
    store.close();
  });
});
