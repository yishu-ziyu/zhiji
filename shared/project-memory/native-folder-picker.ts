/**
 * D-50 / F-06: native macOS folder picker + one-use selection tokens.
 * Connect accepts selectionId (or persisted project/grant for Continue), never a
 * caller-supplied rootPath/projectId for a new folder connect.
 */
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  getDefaultSourceGrantManager,
  selectMatterEvents,
  SourceGrantStateError,
  type LocalRootConnection,
  type SourceGrantManager,
} from "./grants";
import {
  getSharedProjectMemoryReader,
  getSharedProjectMemoryStore,
} from "./runtime";
import type {
  ChangeEvent,
  Matter,
  MatterUnderstandingHead,
  MatterWatchSet,
  SourceGrant,
  UnderstandingRevision,
} from "./types";
import { materializeGrantSignalsToProject } from "@/shared/knowledge/materialize-grant-signals";
import { ensureProject } from "@/shared/knowledge/repository";

const execFileAsync = promisify(execFile);

/** Root sentinel: entire authorized folder (subject to safe excludes). */
export const ROOT_SENTINEL_INCLUDE = ".";

/** Safe first-connect excludes (advanced include/exclude later). */
export const SAFE_DEFAULT_EXCLUDE_PREFIXES = [
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".cache",
] as const;

export const DEFAULT_SELECTION_TTL_MS = 5 * 60 * 1000;

export type FolderPickerSelected = {
  status: "selected";
  path: string;
  name: string;
};

export type FolderPickerCancelled = {
  status: "cancelled";
};

export type FolderPickerError = {
  status: "error";
  message: string;
};

export type FolderPickerResult =
  | FolderPickerSelected
  | FolderPickerCancelled
  | FolderPickerError;

export type FolderSelectionReview = {
  selectionId: string;
  folderName: string;
  /** Canonical realpath for Owner permission review only; not accepted on connect. */
  displayPath: string;
  expiresAt: string;
};

export type RecentFolderConnection = {
  projectId: string;
  grantId: string;
  folderName: string;
  rootPath: string;
  updatedAt: string;
  matterId: string | null;
};

export type FolderConnectionBootstrap = {
  projectId: string;
  grant: SourceGrant;
  matter: Matter;
  watchSet: MatterWatchSet;
};

export type FolderConnectionMemory = {
  matter: Matter;
  watchSet: MatterWatchSet;
  head: MatterUnderstandingHead;
  accepted?: UnderstandingRevision;
  candidate?: UnderstandingRevision;
  /** Matter/watch-matched events only (never the full unmatched trace). */
  events: ChangeEvent[];
  compactUnmatchedTraceCount: number;
};

export type FolderConnectReconcileSummary = {
  ran: boolean;
  /** Raw signals from SourceGrantManager.reconcile (may include excluded paths). */
  observed: number;
  ingested: number;
  /** Count of matter/watch-relevant events after selectMatterEvents. */
  matchedEventCount: number;
  /** Unmatched observed-trace count (not analysis-eligible). */
  unmatchedTraceCount: number;
};

export type FolderConnectResult = LocalRootConnection & {
  projectId: string;
  folderName: string;
  /** Persisted/default grant + matter + watch for UI bootstrap (Continue reuses). */
  bootstrap: FolderConnectionBootstrap;
  /** Idempotent reconcile outcome; observed ≠ analysis ids. */
  reconcile: FolderConnectReconcileSummary;
  /**
   * MATCHED/relevant event ids for the default matter/watch only.
   * Produced by selectMatterEvents after reconcile — never all observed events.
   * Fresh UI passes these to existing analysis-runs; no Agent pipeline here.
   */
  eventIds: string[];
  /** Explicit alias of eventIds (same array content) for contract clarity. */
  matchedEventIds: string[];
  memory: FolderConnectionMemory;
};

/** Stable JSON body for POST /connections (connect + continue). */
export function toConnectionsPostPayload(
  mode: "connect" | "continue",
  connection: FolderConnectResult,
): {
  mode: "connect" | "continue";
  projectId: string;
  folderName: string;
  bootstrap: FolderConnectionBootstrap;
  grant: SourceGrant;
  matter: Matter;
  watchSet: MatterWatchSet;
  reconcile: FolderConnectReconcileSummary;
  /** Analysis-facing matched/relevant ids (default matter/watch). */
  eventIds: string[];
  matchedEventIds: string[];
  memory: FolderConnectionMemory;
} {
  return {
    mode,
    projectId: connection.projectId,
    folderName: connection.folderName,
    bootstrap: connection.bootstrap,
    grant: connection.grant,
    matter: connection.matter,
    watchSet: connection.watchSet,
    reconcile: connection.reconcile,
    eventIds: connection.eventIds,
    matchedEventIds: connection.matchedEventIds,
    memory: connection.memory,
  };
}

type PendingSelection = {
  selectionId: string;
  canonicalRoot: string;
  folderName: string;
  expiresAtMs: number;
  consumed: boolean;
};

export type NativeFolderPickerRunner = () => Promise<FolderPickerResult>;

export type ExecFileLike = (
  file: string,
  args: readonly string[],
  options?: { timeout?: number; maxBuffer?: number; encoding?: BufferEncoding },
) => Promise<{ stdout: string; stderr: string }>;

/**
 * Stable project id from canonical folder realpath (hidden from normal UI).
 * Same folder → same id; new folder → new id.
 */
export function projectIdFromCanonicalFolder(canonicalRoot: string): string {
  const hex = createHash("sha256")
    .update(`local_folder\0${canonicalRoot}`)
    .digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function isUserCancelledOsascript(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    code?: number | string;
    message?: string;
    stderr?: string;
  };
  const text = `${err.message ?? ""}\n${err.stderr ?? ""}`.toLowerCase();
  if (
    text.includes("user canceled") ||
    text.includes("user cancelled") ||
    text.includes("-128")
  ) {
    return true;
  }
  // AppleScript user cancel often exits with code 1 and cancel wording.
  if (String(err.code) === "1" && text.includes("cancel")) {
    return true;
  }
  return false;
}

/**
 * Real macOS folder chooser via argv-safe execFile (no shell string).
 * Injectable execFile for tests; never uses webkitdirectory / byte upload.
 */
export function createMacOsFolderPickerRunner(
  execFileImpl: ExecFileLike = execFileAsync as ExecFileLike,
): NativeFolderPickerRunner {
  return async () => {
    if (process.platform !== "darwin") {
      return {
        status: "error",
        message: "native folder picker requires macOS self-hosted server",
      };
    }
    // argv-only: osascript + -e + script; no shell interpolation of paths.
    const script =
      'try\n' +
      'set theFolder to choose folder with prompt "选择一个本地项目文件夹"\n' +
      'return POSIX path of theFolder\n' +
      'on error number -128\n' +
      'error "User canceled" number -128\n' +
      'end try';
    try {
      const { stdout } = await execFileImpl("osascript", ["-e", script], {
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
      });
      const raw = stdout.trim().replace(/\r?\n$/, "");
      if (!raw) {
        return { status: "cancelled" };
      }
      // POSIX path from AppleScript often ends with /
      const normalized = path.resolve(raw.replace(/\/+$/, "") || raw);
      const name = path.basename(normalized) || normalized;
      return { status: "selected", path: normalized, name };
    } catch (error) {
      if (isUserCancelledOsascript(error)) {
        return { status: "cancelled" };
      }
      return {
        status: "error",
        message: error instanceof Error ? error.message : "folder picker failed",
      };
    }
  };
}

export class FolderSelectionStore {
  private readonly entries = new Map<string, PendingSelection>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly idFactory: () => string;

  constructor(options?: {
    ttlMs?: number;
    now?: () => number;
    idFactory?: () => string;
  }) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_SELECTION_TTL_MS;
    this.now = options?.now ?? (() => Date.now());
    this.idFactory =
      options?.idFactory ?? (() => `sel_${randomBytes(18).toString("hex")}`);
  }

  /** Register a selected canonical folder for short-lived one-use connect. */
  issue(input: {
    canonicalRoot: string;
    folderName: string;
  }): FolderSelectionReview {
    this.gc();
    const selectionId = this.idFactory();
    const expiresAtMs = this.now() + this.ttlMs;
    this.entries.set(selectionId, {
      selectionId,
      canonicalRoot: input.canonicalRoot,
      folderName: input.folderName,
      expiresAtMs,
      consumed: false,
    });
    return {
      selectionId,
      folderName: input.folderName,
      displayPath: input.canonicalRoot,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  /**
   * Consume a one-use token. Expired/reused/missing → throws SourceGrantStateError.
   * Cancelled pickers never call this (no residue).
   */
  consume(selectionId: string): { canonicalRoot: string; folderName: string } {
    this.gc();
    const entry = this.entries.get(selectionId);
    if (!entry) {
      throw new SourceGrantStateError("selection token missing or expired");
    }
    if (entry.consumed) {
      throw new SourceGrantStateError("selection token already used");
    }
    if (entry.expiresAtMs <= this.now()) {
      this.entries.delete(selectionId);
      throw new SourceGrantStateError("selection token missing or expired");
    }
    entry.consumed = true;
    this.entries.delete(selectionId);
    return {
      canonicalRoot: entry.canonicalRoot,
      folderName: entry.folderName,
    };
  }

  /** Test/inspect: no durable side effects beyond memory map. */
  size(): number {
    this.gc();
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private gc(): void {
    const now = this.now();
    for (const [id, entry] of this.entries) {
      if (entry.consumed || entry.expiresAtMs <= now) {
        this.entries.delete(id);
      }
    }
  }
}

let defaultSelectionStore: FolderSelectionStore | undefined;
let defaultPickerRunner: NativeFolderPickerRunner | undefined;

export function getFolderSelectionStore(): FolderSelectionStore {
  if (!defaultSelectionStore) {
    defaultSelectionStore = new FolderSelectionStore();
  }
  return defaultSelectionStore;
}

export function resetFolderSelectionStoreForTests(
  store?: FolderSelectionStore,
): void {
  defaultSelectionStore = store ?? new FolderSelectionStore();
}

export function getNativeFolderPickerRunner(): NativeFolderPickerRunner {
  if (!defaultPickerRunner) {
    defaultPickerRunner = createMacOsFolderPickerRunner();
  }
  return defaultPickerRunner;
}

export function setNativeFolderPickerRunnerForTests(
  runner: NativeFolderPickerRunner | undefined,
): void {
  defaultPickerRunner = runner;
}

/**
 * Canonical realpath is the only authorized root. Rejects non-directories.
 */
export async function resolveCanonicalFolderRoot(
  candidatePath: string,
): Promise<{ canonicalRoot: string; folderName: string }> {
  const resolved = path.resolve(candidatePath);
  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.promises.realpath(resolved);
  } catch (error) {
    throw new SourceGrantStateError(
      error instanceof Error
        ? `folder root is not reachable: ${error.message}`
        : "folder root is not reachable",
    );
  }
  const stat = await fs.promises.stat(canonicalRoot);
  if (!stat.isDirectory()) {
    throw new SourceGrantStateError("grant root must be a directory");
  }
  const folderName = path.basename(canonicalRoot) || canonicalRoot;
  return { canonicalRoot, folderName };
}

/**
 * Open native picker. Cancel → typed cancelled, zero selection residue.
 * Selected → review payload with one-use selectionId (no grant yet).
 */
export async function openFolderPickerForReview(options?: {
  runner?: NativeFolderPickerRunner;
  store?: FolderSelectionStore;
}): Promise<
  | ({ status: "selected" } & FolderSelectionReview)
  | FolderPickerCancelled
  | FolderPickerError
> {
  const runner = options?.runner ?? getNativeFolderPickerRunner();
  const store = options?.store ?? getFolderSelectionStore();
  const result = await runner();
  if (result.status === "cancelled") {
    return { status: "cancelled" };
  }
  if (result.status === "error") {
    return result;
  }
  const { canonicalRoot, folderName } = await resolveCanonicalFolderRoot(
    result.path,
  );
  const review = store.issue({
    canonicalRoot,
    folderName: result.name || folderName,
  });
  return { status: "selected", ...review };
}

/**
 * After grant+matter/watch bootstrap: load persisted memory, run existing
 * SourceGrantManager.reconcile, then project MATCHED/relevant eventIds via
 * selectMatterEvents for the default matter/watch. No Agent pipeline.
 */
async function finalizeConnectionForAnalysis(
  connection: LocalRootConnection,
  meta: { projectId: string; folderName: string },
  options: {
    manager: SourceGrantManager;
    /** New connect always reconciles; continue reconciles after resume. */
    mode: "connect" | "continue";
  },
): Promise<FolderConnectResult> {
  const { manager, mode } = options;
  const reader = getSharedProjectMemoryReader();
  const projectId = meta.projectId;
  const grantId = connection.grant.id;
  const matterId = connection.matter.id;
  // Default matter/watch from connectLocalRoot bootstrap (persisted on Continue).
  const defaultWatchSet = connection.watchSet;

  // Single product surface: folder-connect id must appear in knowledge workbench list.
  // Always sync display name from authorized folder basename (stale names after re-auth).
  ensureProject({
    id: projectId,
    name: meta.folderName || "本地项目",
    summary: "已授权本地文件夹（只读边界内）",
    syncNameFromFolder: true,
  });

  // Load persisted matter/head/understanding before reconcile projects new disk state.
  let matterState = await reader.getMatterState(projectId, matterId);

  // Connect: always reconcile so analysis receives real matched ids immediately.
  // Continue: after resume observer may have been stopped — reconcile catches disk
  // drift (idempotent via existing dedupe). Manager.reconcile only; no new pipeline.
  if (mode !== "connect" && mode !== "continue") {
    throw new SourceGrantStateError(`unsupported connection mode: ${String(mode)}`);
  }
  const result = await manager.reconcile(projectId, grantId);
  matterState = await reader.getMatterState(projectId, matterId);

  // Phase 2: surface readable grant files on the knowledge canvas (materials + cards).
  // Drag-upload already writes materials; authorize-folder must do the same bridge.
  // Connect always; continue refreshes from signals (idempotent by sourceFileId).
  materializeGrantSignalsToProject(projectId, result.signals);

  // Project only this grant's events through the default matter/watch set.
  // Never hand raw reconcile signal list to analysis.
  const grantEvents = (await reader.listEvents(projectId)).filter(
    (event) => event.grantId === grantId,
  );
  const projected = selectMatterEvents(grantEvents, defaultWatchSet, {
    acceptedEvidenceRevisionIds:
      matterState.accepted?.body.evidenceRevisionIds ?? [],
  });
  const matchedEvents = projected.relevantEvents.map((row) => row.event);
  const eventIds = matchedEvents.map((event) => event.id);

  const reconcile: FolderConnectReconcileSummary = {
    ran: true,
    observed: result.signals.length,
    ingested: result.ingested,
    matchedEventCount: eventIds.length,
    unmatchedTraceCount: projected.compactUnmatchedTraceCount,
  };

  const bootstrap: FolderConnectionBootstrap = {
    projectId,
    grant: connection.grant,
    matter: connection.matter,
    watchSet: defaultWatchSet,
  };

  return {
    projectId,
    folderName: meta.folderName,
    grant: connection.grant,
    matter: connection.matter,
    watchSet: defaultWatchSet,
    bootstrap,
    reconcile,
    eventIds,
    matchedEventIds: eventIds,
    memory: {
      matter: matterState.matter,
      watchSet: matterState.watchSet ?? defaultWatchSet,
      head: matterState.head,
      accepted: matterState.accepted,
      candidate: matterState.candidate,
      events: matchedEvents,
      compactUnmatchedTraceCount: projected.compactUnmatchedTraceCount,
    },
  };
}

/** First connect / reconnect from opaque selection token only. */
export async function connectFromSelectionId(
  selectionId: string,
  options?: {
    store?: FolderSelectionStore;
    manager?: SourceGrantManager;
  },
): Promise<FolderConnectResult> {
  const store = options?.store ?? getFolderSelectionStore();
  const manager = options?.manager ?? getDefaultSourceGrantManager();
  const { canonicalRoot, folderName } = store.consume(selectionId);
  // Re-resolve to reject vanished / symlink-escape after pick.
  const resolved = await resolveCanonicalFolderRoot(canonicalRoot);
  if (resolved.canonicalRoot !== canonicalRoot) {
    throw new SourceGrantStateError(
      "folder root changed after selection; pick again",
    );
  }
  const projectId = projectIdFromCanonicalFolder(resolved.canonicalRoot);
  const connection = await manager.connectLocalRoot({
    projectId,
    rootPath: resolved.canonicalRoot,
    kind: "local_folder",
    includePathPrefixes: [ROOT_SENTINEL_INCLUDE],
    excludePathPrefixes: [...SAFE_DEFAULT_EXCLUDE_PREFIXES],
  });
  return finalizeConnectionForAnalysis(
    connection,
    { projectId, folderName: folderName || resolved.folderName },
    { manager, mode: "connect" },
  );
}

/**
 * Continue: only persisted projectId + grantId. Reuses canonical root from store;
 * never trusts a client rootPath. Loads persisted memory and reconciles when needed.
 */
export async function continuePersistedConnection(
  input: { projectId: string; grantId: string },
  options?: { manager?: SourceGrantManager },
): Promise<FolderConnectResult> {
  const projectId = input.projectId?.trim();
  const grantId = input.grantId?.trim();
  if (!projectId || !grantId) {
    throw new SourceGrantStateError("continue requires projectId and grantId");
  }
  const metadata = getSharedProjectMemoryStore();
  const grant = metadata.getGrant(projectId, grantId);
  if (!grant) {
    throw new SourceGrantStateError("persisted grant not found");
  }
  if (grant.status !== "active") {
    throw new SourceGrantStateError(`grant is ${grant.status}`);
  }
  if (grant.kind !== "local_folder" && grant.kind !== "local_git") {
    throw new SourceGrantStateError("continue supports local folder grants only");
  }
  const resolved = await resolveCanonicalFolderRoot(grant.rootPath);
  // Identity must still match stored canonical root after realpath.
  if (resolved.canonicalRoot !== grant.rootPath) {
    // Allow if grant was stored pre-normalize equal under realpath of both.
    const grantReal = await fs.promises.realpath(grant.rootPath);
    if (grantReal !== resolved.canonicalRoot) {
      throw new SourceGrantStateError(
        "persisted grant root no longer matches canonical folder",
      );
    }
  }
  const manager = options?.manager ?? getDefaultSourceGrantManager();
  const connection = await manager.connectLocalRoot({
    projectId,
    rootPath: resolved.canonicalRoot,
    kind: grant.kind,
    includePathPrefixes: [ROOT_SENTINEL_INCLUDE],
    excludePathPrefixes: [...SAFE_DEFAULT_EXCLUDE_PREFIXES],
  });
  if (connection.grant.id !== grantId) {
    throw new SourceGrantStateError("grant identity mismatch on continue");
  }
  return finalizeConnectionForAnalysis(
    connection,
    {
      projectId,
      folderName: path.basename(resolved.canonicalRoot) || resolved.folderName,
    },
    { manager, mode: "continue" },
  );
}

/** Minimal recent: latest active local_folder grant by updatedAt. */
export function listRecentFolderConnections(limit = 1): RecentFolderConnection[] {
  const metadata = getSharedProjectMemoryStore();
  const grants = metadata.listActiveLocalFolderGrants();
  return grants.slice(0, Math.max(1, limit)).map((grant) => ({
    projectId: grant.projectId,
    grantId: grant.id,
    folderName: path.basename(grant.rootPath) || grant.rootPath,
    rootPath: grant.rootPath,
    updatedAt: grant.updatedAt,
    matterId: null,
  }));
}
