/**
 * PR-03: selection must preflight-confirm before connect.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLocalObservationAdapter,
  type ParcelWatchEvent,
  type ParcelWatcher,
} from "./observer";
import {
  getDefaultSourceGrantManager,
  resetDefaultSourceGrantManagerForTests,
  SourceGrantStateError,
} from "./grants";
import { DEFAULT_GRANT_POLICY } from "./grant-policy";
import {
  connectFromSelectionId,
  FolderSelectionStore,
  openFolderPickerForReview,
  resetFolderSelectionStoreForTests,
} from "./native-folder-picker";
import {
  resetSharedProjectMemoryStoreForTests,
} from "./runtime";

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
    return {
      unsubscribe: async () => {
        this.callback = undefined;
      },
    };
  }
}

describe("preflight required before connect (PR-03)", () => {
  let root: string;
  let storeDir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "pfc-root-"));
    storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pfc-pm-"));
    process.env.PROJECT_MEMORY_DATA_DIR = storeDir;
    resetSharedProjectMemoryStoreForTests();
    resetDefaultSourceGrantManagerForTests(storeDir);
    resetFolderSelectionStoreForTests();
    fs.writeFileSync(path.join(root, "a.md"), "hi");
  });

  afterEach(async () => {
    resetFolderSelectionStoreForTests();
    resetDefaultSourceGrantManagerForTests();
    resetSharedProjectMemoryStoreForTests();
    delete process.env.PROJECT_MEMORY_DATA_DIR;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(storeDir, { recursive: true, force: true });
  });

  it("skips preflight → connect fails with diagnostic", async () => {
    const manager = getDefaultSourceGrantManager({
      adapter: createLocalObservationAdapter({ watcher: new FakeWatcher() }),
    });
    const store = new FolderSelectionStore({ idFactory: () => "sel_skip" });
    const pick = await openFolderPickerForReview({
      runner: async () => ({ status: "selected", path: root, name: "proj" }),
      store,
    });
    expect(pick.status).toBe("selected");
    if (pick.status !== "selected") return;

    await expect(
      connectFromSelectionId(pick.selectionId, { store, manager }),
    ).rejects.toBeInstanceOf(SourceGrantStateError);

    await expect(
      connectFromSelectionId(pick.selectionId, {
        store,
        manager,
        confirmToken: "forged",
      }),
    ).rejects.toThrow(/preflight|confirm/i);

    await manager.stopAll();
  });

  it("preflight then connect succeeds and stores policyVersion", async () => {
    const manager = getDefaultSourceGrantManager({
      adapter: createLocalObservationAdapter({ watcher: new FakeWatcher() }),
    });
    const store = new FolderSelectionStore({ idFactory: () => "sel_ok" });
    const pick = await openFolderPickerForReview({
      runner: async () => ({ status: "selected", path: root, name: "proj" }),
      store,
    });
    expect(pick.status).toBe("selected");
    if (pick.status !== "selected") return;

    store.markPreflight(pick.selectionId, {
      policyVersion: DEFAULT_GRANT_POLICY.version,
      fingerprint: "report-v1",
    });
    const confirmed = store.confirmPreflight(
      pick.selectionId,
      DEFAULT_GRANT_POLICY.version,
      "report-v1",
    );
    expect(confirmed.confirmToken).toMatch(/^pfc_/);
    expect(confirmed.policyVersion).toBe(DEFAULT_GRANT_POLICY.version);

    const connected = await connectFromSelectionId(pick.selectionId, {
      store,
      manager,
      confirmToken: confirmed.confirmToken,
    });
    expect(connected.grant.policyVersion).toBe(DEFAULT_GRANT_POLICY.version);
    expect(connected.grant.rootPath).toBe(pick.displayPath);
    await manager.stopAll();
  });

  it("cannot mint a connect token before the Owner has seen a preflight report", async () => {
    const store = new FolderSelectionStore({ idFactory: () => "sel_review" });
    store.issue({ canonicalRoot: root, folderName: "proj" });

    expect(() =>
      store.confirmPreflight(
        "sel_review",
        DEFAULT_GRANT_POLICY.version,
        "report-v1",
      ),
    ).toThrow(/review|preflight report/i);
  });
});
