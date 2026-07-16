import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createLocalObservationAdapter,
  relativePathWithinGrantRoot,
} from "./observer";
import {
  getSharedObservationWriter,
  getSharedProjectMemoryReader,
  getSharedProjectMemoryStore,
  resetSharedProjectMemoryStoreForTests,
} from "./runtime";
import type {
  ChangeEvent,
  Matter,
  MatterWatchSet,
  ObservationAdapter,
  ObservationSignal,
  ObservationWriter,
  OriginalRevision,
  ProjectMemoryReader,
  SourceGrant,
  StopHandle,
} from "./types";

export type GrantPersistence = Pick<
  ProjectMemoryReader,
  "listEvents" | "getMatterState"
> &
  ObservationWriter & {
    getGrant?: (projectId: string, grantId: string) => SourceGrant | null;
    upsertGrant?: (grant: SourceGrant) => void | Promise<void>;
    upsertMatter?: (matter: Matter) => void | Promise<void>;
    upsertWatchSet?: (watchSet: MatterWatchSet) => void | Promise<void>;
  };

export type SourceGrantManagerOptions = {
  store: GrantPersistence;
  adapter: ObservationAdapter;
  clock?: () => string;
};

export class SourceGrantNotFoundError extends Error {
  constructor() {
    super("source grant not found in the current project");
    this.name = "SourceGrantNotFoundError";
  }
}

export class SourceGrantStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceGrantStateError";
  }
}

export type AuthorizeLocalGrantInput = {
  projectId: string;
  rootPath: string;
  kind?: SourceGrant["kind"];
  grantId?: string;
};

export type ReconcileResult = {
  grant: SourceGrant;
  signals: ObservationSignal[];
  ingested: number;
};

export type WatchSetInput = {
  projectId: string;
  matterId: string;
  grantId: string;
  includePathPrefixes?: string[];
  excludePathPrefixes?: string[];
  status?: MatterWatchSet["status"];
};

export type LocalRootConnection = {
  grant: SourceGrant;
  matter: Matter;
  watchSet: MatterWatchSet;
};

export type MatterEventSelection = {
  relevantEvents: MatterEventProjection[];
  compactUnmatchedTraceCount: number;
};

export type MatterEventProjection = {
  event: ChangeEvent;
  relevant: true;
  matchReason: "watch_path" | "accepted_evidence" | "linked_action";
};

export type MatterEventReferenceOptions = {
  acceptedEvidenceRevisionIds?: Iterable<string>;
  linkedActionEventIds?: Iterable<string>;
  linkedActionPaths?: Iterable<string>;
};

function key(projectId: string, id: string): string {
  return `${projectId}\0${id}`;
}

function copyGrant(grant: SourceGrant): SourceGrant {
  return { ...grant };
}

function copyMatter(matter: Matter): Matter {
  return { ...matter };
}

function copyWatchSet(watchSet: MatterWatchSet): MatterWatchSet {
  return {
    ...watchSet,
    includePathPrefixes: [...watchSet.includePathPrefixes],
    excludePathPrefixes: [...watchSet.excludePathPrefixes],
  };
}

function stableId(prefix: string, ...parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("\0")).digest("hex");
  return `${prefix}:${digest}`;
}

function stableGrantId(projectId: string, kind: SourceGrant["kind"], rootPath: string): string {
  return stableId("grant", projectId, kind, rootPath);
}

function defaultMatterId(projectId: string, grantId: string): string {
  return stableId("matter", projectId, grantId);
}

const DEFAULT_WATCH_PREFIXES = ["src"];

function normalizeSignalPath(grant: SourceGrant, relativePath: string): string {
  const candidate = path.resolve(grant.rootPath, relativePath);
  const normalized = relativePathWithinGrantRoot(grant.rootPath, candidate);
  if (normalized !== relativePath.replace(/\\/g, "/")) {
    throw new SourceGrantStateError("observation path is outside its grant");
  }
  return normalized;
}

function latestGrantPaths(events: ChangeEvent[], grantId: string): Set<string> {
  const latest = new Map<string, ChangeEvent>();
  for (const event of events) {
    if (event.grantId !== grantId) continue;
    if (event.kind === "renamed" && event.previousPath) {
      latest.delete(event.previousPath);
    }
    latest.set(event.relativePath, event);
  }
  return new Set(
    [...latest.values()]
      .filter((event) => event.kind !== "deleted")
      .map((event) => event.relativePath),
  );
}

export function normalizeWatchPathPrefix(value: string): string {
  const prefix = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  // D-50 root sentinel: entire authorized folder (with excludes).
  if (prefix === "." || prefix === "") {
    if (value.trim() === "." || value.trim() === "./") {
      return ".";
    }
  }
  const normalized = prefix.replace(/\/+$/, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new SourceGrantStateError(
      "watch set path prefixes must be explicit relative paths",
    );
  }
  return normalized;
}

function normalizeWatchPrefixes(values: string[] | undefined, required: boolean): string[] {
  const prefixes = [...new Set((values ?? []).map(normalizeWatchPathPrefix))];
  if (required && prefixes.length === 0) {
    throw new SourceGrantStateError(
      "MatterWatchSet requires at least one explicit include path prefix",
    );
  }
  return prefixes;
}

function pathMatchesPrefix(relativePath: string, prefix: string): boolean {
  // Root sentinel matches every relative path under the grant root.
  if (prefix === ".") {
    return relativePath.length > 0 && !relativePath.startsWith("/");
  }
  return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
}

function intersects(values: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => values.has(candidate));
}

/**
 * Project-memory events are broad observation truth. Only this projection may
 * expose matter-relevant events to a center surface; unmatched events remain
 * represented by the compact count and never become a silent full-root feed.
 */
export function selectMatterEvents(
  events: ChangeEvent[],
  watchSet: MatterWatchSet | undefined,
  references: MatterEventReferenceOptions = {},
): MatterEventSelection {
  const evidenceIds = new Set(references.acceptedEvidenceRevisionIds ?? []);
  const linkedEventIds = new Set(references.linkedActionEventIds ?? []);
  const linkedPaths = new Set(
    [...(references.linkedActionPaths ?? [])].map((value) =>
      normalizeWatchPathPrefix(value),
    ),
  );
  const relevantEvents: MatterEventProjection[] = [];
  let compactUnmatchedTraceCount = 0;

  for (const event of events) {
    let matchReason: MatterEventProjection["matchReason"] | undefined;
    if (watchSet?.status === "active") {
      const excluded = watchSet.excludePathPrefixes.some((prefix) =>
        pathMatchesPrefix(event.relativePath, prefix),
      );
      const watched =
        !excluded &&
        watchSet.includePathPrefixes.some((prefix) =>
          pathMatchesPrefix(event.relativePath, prefix),
        );
      if (watched) matchReason = "watch_path";
    }

    const referencedRevisionIds = [event.beforeRevisionId, event.afterRevisionId].filter(
      (value): value is string => Boolean(value),
    );
    if (!matchReason && !watchSet?.excludePathPrefixes.some((prefix) =>
      pathMatchesPrefix(event.relativePath, prefix),
    )) {
      if (intersects(evidenceIds, referencedRevisionIds)) {
        matchReason = "accepted_evidence";
      } else if (
        linkedEventIds.has(event.id) ||
        [...linkedPaths].some((prefix) => pathMatchesPrefix(event.relativePath, prefix))
      ) {
        matchReason = "linked_action";
      }
    }

    if (matchReason) {
      relevantEvents.push({ event, relevant: true, matchReason });
    } else {
      compactUnmatchedTraceCount += 1;
    }
  }

  return { relevantEvents, compactUnmatchedTraceCount };
}

export class SourceGrantManager {
  private readonly store: GrantPersistence;
  private readonly adapter: ObservationAdapter;
  private readonly clock: () => string;
  private readonly grants = new Map<string, SourceGrant>();
  private readonly watchSets = new Map<string, MatterWatchSet>();
  private readonly stops = new Map<string, StopHandle>();

  constructor(options: SourceGrantManagerOptions) {
    this.store = options.store;
    this.adapter = options.adapter;
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  async authorizeLocalRoot(input: AuthorizeLocalGrantInput): Promise<SourceGrant> {
    const rootPath = await fs.promises.realpath(input.rootPath);
    const rootStat = await fs.promises.stat(rootPath);
    if (!rootStat.isDirectory()) {
      throw new SourceGrantStateError("grant root must be a directory");
    }
    const now = this.clock();
    const grant: SourceGrant = {
      id: input.grantId ?? randomUUID(),
      projectId: input.projectId,
      kind: input.kind ?? "local_folder",
      rootPath,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.grants.set(key(grant.projectId, grant.id), grant);
    await this.persistGrant(grant);
    try {
      await this.start(grant);
    } catch (error) {
      this.grants.delete(key(grant.projectId, grant.id));
      throw error;
    }
    return copyGrant(grant);
  }

  /**
   * Connect a local root and return the default Owner-visible matter/watch set.
   * A stable grant/matter identity lets a fresh manager reopen persisted state
   * before restarting the observer, without widening the authorized root.
   */
  async connectLocalRoot(input: {
    projectId: string;
    rootPath: string;
    kind?: SourceGrant["kind"];
    includePathPrefixes?: string[];
    excludePathPrefixes?: string[];
  }): Promise<LocalRootConnection> {
    const rootPath = await fs.promises.realpath(input.rootPath);
    const kind = input.kind ?? "local_folder";
    const grantId = stableGrantId(input.projectId, kind, rootPath);
    const persisted = this.store.getGrant?.(input.projectId, grantId);
    let grant: SourceGrant;
    if (persisted) {
      if (persisted.rootPath !== rootPath || persisted.kind !== kind) {
        throw new SourceGrantStateError("persisted grant identity does not match root");
      }
      if (persisted.status !== "active") {
        throw new SourceGrantStateError(`grant is ${persisted.status}`);
      }
      this.register(persisted);
      await this.start(persisted);
      grant = persisted;
    } else {
      grant = await this.authorizeLocalRoot({
        projectId: input.projectId,
        rootPath,
        kind,
        grantId,
      });
    }

    return {
      grant: copyGrant(grant),
      ...(await this.bootstrapDefaultMatterWatchSet({
        projectId: grant.projectId,
        grantId: grant.id,
        includePathPrefixes: input.includePathPrefixes,
        excludePathPrefixes: input.excludePathPrefixes,
      })),
    };
  }

  async stopAll(): Promise<void> {
    const stops = [...this.stops.values()];
    this.stops.clear();
    await Promise.all(stops.map((stop) => stop.stop()));
  }

  register(grant: SourceGrant): SourceGrant {
    this.grants.set(key(grant.projectId, grant.id), copyGrant(grant));
    return copyGrant(grant);
  }

  get(projectId: string, grantId: string): SourceGrant | null {
    const grant = this.grants.get(key(projectId, grantId));
    return grant ? copyGrant(grant) : null;
  }

  list(projectId: string): SourceGrant[] {
    return [...this.grants.values()]
      .filter((grant) => grant.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(copyGrant);
  }

  async start(grantInput: SourceGrant): Promise<void> {
    const grant = this.requireGrant(grantInput.projectId, grantInput.id);
    if (grant.status !== "active") {
      throw new SourceGrantStateError(`grant is ${grant.status}`);
    }
    if (this.stops.has(key(grant.projectId, grant.id))) return;
    const stop = await this.adapter.start(grant, async (signal) => {
      await this.ingestIfActive(grant.id, signal);
    });
    this.stops.set(key(grant.projectId, grant.id), stop);
  }

  async reconcile(projectId: string, grantId: string): Promise<ReconcileResult> {
    const grant = this.requireGrant(projectId, grantId);
    if (grant.status !== "active") {
      throw new SourceGrantStateError(`grant is ${grant.status}`);
    }
    const signals = await this.adapter.reconcile(grant);
    const currentPaths = new Set(signals.map((signal) => signal.relativePath));
    const historicalPaths = latestGrantPaths(
      await this.store.listEvents(projectId),
      grant.id,
    );
    for (const relativePath of historicalPaths) {
      if (!currentPaths.has(relativePath)) {
        signals.push({
          projectId,
          grantId,
          kind: "deleted",
          relativePath,
          observedAt: this.clock(),
        });
      }
    }
    let ingested = 0;
    for (const signal of signals) {
      if (await this.ingestIfActive(grant.id, signal)) ingested += 1;
    }
    return { grant: copyGrant(grant), signals, ingested };
  }

  async revoke(projectId: string, grantId: string): Promise<SourceGrant> {
    const grant = this.requireGrant(projectId, grantId);
    if (grant.status === "revoked") return copyGrant(grant);
    grant.status = "revoked";
    grant.updatedAt = this.clock();
    const stop = this.stops.get(key(projectId, grantId));
    this.stops.delete(key(projectId, grantId));
    await stop?.stop();
    await this.persistGrant(grant);
    return copyGrant(grant);
  }

  async upsertWatchSet(input: WatchSetInput): Promise<MatterWatchSet> {
    const grant = this.requireGrant(input.projectId, input.grantId);
    if (grant.status !== "active") {
      throw new SourceGrantStateError(`grant is ${grant.status}`);
    }
    const watchKey = key(input.projectId, `${input.matterId}\0${input.grantId}`);
    const existing = this.watchSets.get(watchKey);
    const includePathPrefixes = normalizeWatchPrefixes(
      input.includePathPrefixes ?? existing?.includePathPrefixes,
      true,
    );
    const excludePathPrefixes = normalizeWatchPrefixes(
      input.excludePathPrefixes ?? existing?.excludePathPrefixes,
      false,
    );
    const now = this.clock();
    const watchSet: MatterWatchSet = {
      id: existing?.id ?? randomUUID(),
      projectId: input.projectId,
      matterId: input.matterId,
      grantId: grant.id,
      includePathPrefixes,
      excludePathPrefixes,
      status: input.status ?? "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.watchSets.set(watchKey, watchSet);
    await this.store.upsertWatchSet?.(copyWatchSet(watchSet));
    return copyWatchSet(watchSet);
  }

  private async bootstrapDefaultMatterWatchSet(input: {
    projectId: string;
    grantId: string;
    includePathPrefixes?: string[];
    excludePathPrefixes?: string[];
  }): Promise<{ matter: Matter; watchSet: MatterWatchSet }> {
    const matterId = defaultMatterId(input.projectId, input.grantId);
    let matter: Matter;
    try {
      matter = (await this.store.getMatterState(input.projectId, matterId)).matter;
    } catch {
      const now = this.clock();
      matter = {
        id: matterId,
        projectId: input.projectId,
        title: "本地项目默认事项",
        goal: "跟踪已授权项目根目录中的可见变化",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      if (!this.store.upsertMatter) {
        throw new SourceGrantStateError("shared project-memory matter writer is unavailable");
      }
      await this.store.upsertMatter(matter);
    }

    const existing = await this.getWatchSet(input.projectId, matterId);
    const watchSet =
      existing && existing.grantId === input.grantId
        ? existing
        : await this.upsertWatchSet({
            projectId: input.projectId,
            matterId,
            grantId: input.grantId,
            includePathPrefixes:
              input.includePathPrefixes ?? DEFAULT_WATCH_PREFIXES,
            excludePathPrefixes: input.excludePathPrefixes,
          });
    this.watchSets.set(key(input.projectId, `${matterId}\0${input.grantId}`), watchSet);
    return { matter: copyMatter(matter), watchSet: copyWatchSet(watchSet) };
  }

  async getWatchSet(projectId: string, matterId: string): Promise<MatterWatchSet | null> {
    const candidates = [...this.watchSets.values()].filter(
      (watchSet) => watchSet.projectId === projectId && watchSet.matterId === matterId,
    );
    const cached = candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (cached) return copyWatchSet(cached);
    try {
      const state = await this.store.getMatterState(projectId, matterId);
      return state.watchSet ? copyWatchSet(state.watchSet) : null;
    } catch {
      return null;
    }
  }

  private requireGrant(projectId: string, grantId: string): SourceGrant {
    const grant = this.grants.get(key(projectId, grantId));
    if (!grant) throw new SourceGrantNotFoundError();
    return grant;
  }

  private async persistGrant(grant: SourceGrant): Promise<void> {
    await this.store.upsertGrant?.(copyGrant(grant));
  }

  private async ingestIfActive(
    grantId: string,
    signal: ObservationSignal,
  ): Promise<{ event?: ChangeEvent; revision?: OriginalRevision } | null> {
    const grant = this.grants.get(key(signal.projectId, grantId));
    if (!grant || grant.status !== "active") return null;
    if (signal.grantId !== grant.id || signal.projectId !== grant.projectId) {
      throw new SourceGrantStateError("observation identity does not match grant");
    }
    const relativePath = normalizeSignalPath(grant, signal.relativePath);
    return this.store.ingest({ ...signal, relativePath });
  }
}

let defaultManager: SourceGrantManager | undefined;

/**
 * Default manager shares the process-wide Project Memory SQLite via runtime.ts.
 * Observation writes go through ObservationWriter capability; grant rows still
 * need store.upsertGrant (same singleton instance, not a second dataDir).
 */
export function getDefaultSourceGrantManager(options: {
  adapter?: ObservationAdapter;
  clock?: () => string;
} = {}): SourceGrantManager {
  if (!defaultManager) {
    const metadata = getSharedProjectMemoryStore();
    const reader = getSharedProjectMemoryReader();
    const observationWriter = getSharedObservationWriter();
    defaultManager = new SourceGrantManager({
      store: {
        listEvents: reader.listEvents,
        getMatterState: reader.getMatterState,
        ingest: observationWriter.ingest,
        getGrant: (projectId, grantId) => metadata.getGrant(projectId, grantId),
        upsertGrant: (grant) => metadata.upsertGrant(grant),
        upsertMatter: (matter) => metadata.upsertMatter(matter),
        upsertWatchSet: (watchSet) => metadata.upsertWatchSet(watchSet),
      },
      adapter: options.adapter ?? createLocalObservationAdapter(),
      clock: options.clock,
    });
  }
  return defaultManager;
}

export function resetDefaultSourceGrantManagerForTests(dataDir?: string): void {
  defaultManager = undefined;
  if (dataDir !== undefined) {
    resetSharedProjectMemoryStoreForTests(dataDir || undefined);
  }
}
