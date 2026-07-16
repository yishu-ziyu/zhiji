/**
 * Shared Project Memory runtime contract: one data-dir, one SQLite store process-wide.
 *
 * Production accessors are capability-scoped — routes must not receive the full store:
 * - getSharedObservationWriter()
 * - getSharedAgentMemoryService()  (Reader + CandidateWriter; no resolve)
 * - getSharedOwnerDecisionWriter()
 * - getSharedProjectMemoryReader()
 *
 * getSharedProjectMemoryStore() remains for tests/boot wiring only.
 */
import path from "node:path";
import {
  openProjectMemoryStore,
  type SqliteProjectMemoryStore,
} from "./sqlite-store";
import type {
  AgentMemoryService,
  ObservationWriter,
  OwnerDecisionWriter,
  ProjectMemoryReader,
} from "./types";

/** Env override for the entire Project Memory truth directory (sqlite + cas/). */
export const PROJECT_MEMORY_DATA_DIR_ENV = "PROJECT_MEMORY_DATA_DIR";

/**
 * Prefer PROJECT_MEMORY_DATA_DIR.
 * Else: <KNOWLEDGE_DATA_DIR|/cwd/data/knowledge>/project-memory
 */
export function resolveProjectMemoryDataDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const explicit = env[PROJECT_MEMORY_DATA_DIR_ENV]?.trim();
  if (explicit) return path.resolve(explicit);

  const knowledgeRoot =
    env.KNOWLEDGE_DATA_DIR?.trim() || path.join(cwd, "data", "knowledge");
  return path.resolve(path.join(knowledgeRoot, "project-memory"));
}

export function projectMemorySqlitePath(dataDir: string): string {
  return path.join(dataDir, "project-memory.sqlite");
}

export function projectMemoryCasDir(dataDir: string): string {
  return path.join(dataDir, "cas");
}

type RuntimeState = {
  dataDir: string;
  store: SqliteProjectMemoryStore;
};

let runtime: RuntimeState | null = null;

/**
 * Process-wide singleton (tests/boot). Prefer capability accessors in production routes.
 */
export function getSharedProjectMemoryStore(options?: {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): SqliteProjectMemoryStore {
  if (runtime) {
    if (options?.dataDir !== undefined) {
      const wanted = path.resolve(options.dataDir);
      if (runtime.dataDir !== wanted) {
        throw new Error(
          `Project Memory store already open at ${runtime.dataDir}; refusing second dataDir ${wanted}`,
        );
      }
    }
    return runtime.store;
  }

  const dataDir = path.resolve(
    options?.dataDir ??
      resolveProjectMemoryDataDir(options?.env ?? process.env, options?.cwd),
  );
  const store = openProjectMemoryStore(dataDir);
  runtime = { dataDir, store };
  return store;
}

export function getSharedProjectMemoryDataDir(): string | null {
  return runtime?.dataDir ?? null;
}

/** Observer path: ObservationWriter only. */
export function getSharedObservationWriter(options?: {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): ObservationWriter {
  const store = getSharedProjectMemoryStore(options);
  return {
    ingest: (signal) => store.ingest(signal),
  };
}

/** Agent path: Reader + CandidateWriter; never resolveCandidate. */
export function getSharedAgentMemoryService(options?: {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): AgentMemoryService {
  return getSharedProjectMemoryStore(options).asAgentMemoryService();
}

/** Owner resolve path: OwnerDecisionWriter only. */
export function getSharedOwnerDecisionWriter(options?: {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): OwnerDecisionWriter {
  const store = getSharedProjectMemoryStore(options);
  return {
    resolveCandidate: (input) => store.resolveCandidate(input),
  };
}

/** Read-only surface (memory GET, revision open). */
export function getSharedProjectMemoryReader(options?: {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): ProjectMemoryReader {
  const store = getSharedProjectMemoryStore(options);
  return {
    readRevision: (id) => store.readRevision(id),
    listEvents: (projectId, after) => store.listEvents(projectId, after),
    getMatterState: (projectId, matterId) =>
      store.getMatterState(projectId, matterId),
  };
}

/** Test helper: close singleton and optionally open a fresh one on dataDir. */
export function resetSharedProjectMemoryStoreForTests(dataDir?: string): void {
  if (runtime) {
    try {
      runtime.store.close();
    } catch {
      /* ignore */
    }
    runtime = null;
  }
  if (dataDir) {
    getSharedProjectMemoryStore({ dataDir });
  }
}
