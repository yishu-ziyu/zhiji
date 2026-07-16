/**
 * Shared Project Memory runtime contract: one data-dir, one SQLite store process-wide.
 *
 * G3B observer/grants and G5 agent/routes must call getSharedProjectMemoryStore()
 * (or resolveProjectMemoryDataDir()) so they never silently open different DBs.
 * Do not hardcode "data/knowledge" vs ".data/project-memory" in those lanes.
 */
import path from "node:path";
import {
  openProjectMemoryStore,
  type SqliteProjectMemoryStore,
} from "./sqlite-store";
import type { AgentMemoryService } from "./types";

/** Env override for the entire Project Memory truth directory (sqlite + cas/). */
export const PROJECT_MEMORY_DATA_DIR_ENV = "PROJECT_MEMORY_DATA_DIR";

/**
 * Prefer PROJECT_MEMORY_DATA_DIR.
 * Else: <KNOWLEDGE_DATA_DIR|/cwd/data/knowledge>/project-memory
 * (single canonical layout under the knowledge data root — not .data/project-memory).
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
 * Process-wide singleton. First call wins the dataDir identity for this process.
 * Subsequent calls with a different resolved dir throw (fail loud, do not fork DB).
 */
export function getSharedProjectMemoryStore(options?: {
  /** Force dataDir (tests / explicit boot). Must match if store already open. */
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): SqliteProjectMemoryStore {
  const dataDir = path.resolve(
    options?.dataDir ??
      resolveProjectMemoryDataDir(options?.env ?? process.env, options?.cwd),
  );

  if (runtime) {
    if (runtime.dataDir !== dataDir) {
      throw new Error(
        `Project Memory store already open at ${runtime.dataDir}; refusing second dataDir ${dataDir}`,
      );
    }
    return runtime.store;
  }

  const store = openProjectMemoryStore(dataDir);
  runtime = { dataDir, store };
  return store;
}

/** Absolute dataDir currently bound to the singleton, if any. */
export function getSharedProjectMemoryDataDir(): string | null {
  return runtime?.dataDir ?? null;
}

/**
 * Agent-facing ports only (Reader + CandidateWriter). Same underlying SQLite.
 */
export function getSharedAgentMemoryService(options?: {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): AgentMemoryService {
  return getSharedProjectMemoryStore(options).asAgentMemoryService();
}

/**
 * Test helper: close singleton and optionally open a fresh one on dataDir.
 * Production code must not call this.
 */
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
