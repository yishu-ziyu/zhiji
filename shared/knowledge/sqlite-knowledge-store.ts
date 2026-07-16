/**
 * Knowledge/Work SQLite skeleton (PR-13).
 * Default production path stays JSON (repository.ts).
 * Set KNOWLEDGE_STORE=sqlite to enable this write path for experimental callers.
 *
 * Minimal entity: work_events (+ cards count table for migrate consistency).
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { WorkEvent, WorkEventType } from "@/shared/types/knowledge";
import { withUnitOfWork } from "./unit-of-work";

export const KNOWLEDGE_STORE_ENV = "KNOWLEDGE_STORE";

export function isKnowledgeSqliteMode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (env[KNOWLEDGE_STORE_ENV] ?? "").trim().toLowerCase() === "sqlite";
}

export class KnowledgeJsonCorruptError extends Error {
  readonly path: string;
  readonly causeError: unknown;

  constructor(filePath: string, cause: unknown) {
    const detail =
      cause instanceof Error ? cause.message : String(cause ?? "unknown");
    super(
      `Knowledge JSON corrupt at ${filePath}: ${detail}. Refusing silent empty import.`,
    );
    this.name = "KnowledgeJsonCorruptError";
    this.path = filePath;
    this.causeError = cause;
  }
}

export type MigrateJsonWorkEventsReport = {
  events: number;
  cards: number;
  insertedEvents: number;
  skippedEvents: number;
  insertedCards: number;
  skippedCards: number;
  dbPath: string;
};

type RuntimeState = {
  dataDir: string;
  dbPath: string;
  db: DatabaseSync;
};

let runtime: RuntimeState | null = null;

function resolveDataDir(
  explicit?: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  if (explicit?.trim()) return path.resolve(explicit.trim());
  if (env.KNOWLEDGE_DATA_DIR?.trim()) {
    return path.resolve(env.KNOWLEDGE_DATA_DIR.trim());
  }
  return path.join(cwd, "data", "knowledge");
}

export function knowledgeSqlitePath(dataDir: string): string {
  return path.join(dataDir, "knowledge.sqlite");
}

function eventsJsonPath(dataDir: string): string {
  return path.join(dataDir, "events.json");
}

function cardsJsonPath(dataDir: string): string {
  return path.join(dataDir, "cards.json");
}

function ensureDb(dataDir?: string): RuntimeState {
  const resolved = resolveDataDir(dataDir);
  if (runtime) {
    if (runtime.dataDir !== resolved) {
      throw new Error(
        `Knowledge sqlite already open at ${runtime.dataDir}; refusing ${resolved}`,
      );
    }
    return runtime;
  }
  fs.mkdirSync(resolved, { recursive: true });
  const dbPath = knowledgeSqlitePath(resolved);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
  `);
  migrateSchema(db);
  runtime = { dataDir: resolved, dbPath, db };
  return runtime;
}

function migrateSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_events (
      id TEXT PRIMARY KEY,
      work_item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor TEXT NOT NULL,
      body TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_cards (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT,
      payload_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_work_events_item
      ON work_events(work_item_id, created_at);
  `);

  const applied = db
    .prepare(`SELECT id FROM schema_migrations WHERE id = ?`)
    .get("013_work_events") as { id: string } | undefined;
  if (!applied) {
    db.prepare(
      `INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`,
    ).run("013_work_events", new Date().toISOString());
  }
}

/**
 * Strict JSON object-map reader for migration.
 * Missing → empty. Present but corrupt → KnowledgeJsonCorruptError.
 */
export function readKnowledgeJsonMapStrict<T>(filePath: string): Map<string, T> {
  if (!fs.existsSync(filePath)) return new Map();
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new KnowledgeJsonCorruptError(filePath, err);
  }
  if (text.trim() === "") return new Map();
  try {
    const raw = JSON.parse(text) as unknown;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("expected JSON object map");
    }
    return new Map(Object.entries(raw as Record<string, T>));
  } catch (err) {
    if (err instanceof KnowledgeJsonCorruptError) throw err;
    throw new KnowledgeJsonCorruptError(filePath, err);
  }
}

export type NewWorkEventRow = {
  id: string;
  workItemId: string;
  type: WorkEventType | string;
  actor: string;
  body: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

/**
 * Experimental write path (only for callers that opt into KNOWLEDGE_STORE=sqlite).
 * Uses unit of work so multi-row helpers can share the same pattern.
 */
export function insertWorkEvent(event: NewWorkEventRow): WorkEvent {
  if (!isKnowledgeSqliteMode()) {
    throw new Error(
      "insertWorkEvent requires KNOWLEDGE_STORE=sqlite (production still uses JSON repository)",
    );
  }
  const { db } = ensureDb();
  withUnitOfWork(db, (tx) => {
    tx.run(
      `INSERT INTO work_events
        (id, work_item_id, type, actor, body, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.workItemId,
      event.type,
      event.actor,
      event.body,
      event.meta ? JSON.stringify(event.meta) : null,
      event.createdAt,
    );
  });
  return {
    id: event.id,
    workItemId: event.workItemId,
    type: event.type as WorkEventType,
    actor: event.actor,
    body: event.body,
    meta: event.meta,
    createdAt: event.createdAt,
  };
}

export function countWorkEvents(): number {
  const { db } = ensureDb();
  const row = db.prepare(`SELECT COUNT(*) AS n FROM work_events`).get() as {
    n: number;
  };
  return Number(row.n);
}

export function countCards(): number {
  const { db } = ensureDb();
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM knowledge_cards`)
    .get() as { n: number };
  return Number(row.n);
}

export function listWorkEventsForWorkItem(workItemId: string): WorkEvent[] {
  const { db } = ensureDb();
  const rows = db
    .prepare(
      `SELECT * FROM work_events
       WHERE work_item_id = ?
       ORDER BY created_at ASC`,
    )
    .all(workItemId) as Array<Record<string, unknown>>;
  return rows.map(rowToEvent);
}

function rowToEvent(row: Record<string, unknown>): WorkEvent {
  let meta: Record<string, unknown> | undefined;
  if (typeof row.meta_json === "string" && row.meta_json.length > 0) {
    try {
      meta = JSON.parse(row.meta_json) as Record<string, unknown>;
    } catch {
      meta = undefined;
    }
  }
  return {
    id: String(row.id),
    workItemId: String(row.work_item_id),
    type: String(row.type) as WorkEventType,
    actor: String(row.actor),
    body: String(row.body),
    meta,
    createdAt: String(row.created_at),
  };
}

/**
 * Import events.json (+ cards.json count) into knowledge.sqlite.
 * Idempotent by primary key. Does not delete JSON. Does not switch production writers.
 */
export function migrateJsonWorkEventsToSqlite(
  dataDir: string,
): MigrateJsonWorkEventsReport {
  const resolved = resolveDataDir(dataDir);
  const eventsFile = eventsJsonPath(resolved);
  const cardsFile = cardsJsonPath(resolved);

  // Strict read first — corrupt never starts a destructive import.
  const eventMap = readKnowledgeJsonMapStrict<WorkEvent>(eventsFile);
  const cardMap = readKnowledgeJsonMapStrict<Record<string, unknown>>(cardsFile);

  const { db, dbPath } = ensureDb(resolved);

  let insertedEvents = 0;
  let skippedEvents = 0;
  let insertedCards = 0;
  let skippedCards = 0;

  withUnitOfWork(db, (tx) => {
    for (const e of eventMap.values()) {
      if (!e?.id || !e.workItemId) continue;
      const result = tx.run(
        `INSERT OR IGNORE INTO work_events
          (id, work_item_id, type, actor, body, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        e.id,
        e.workItemId,
        e.type || "comment",
        e.actor || "",
        e.body || "",
        e.meta ? JSON.stringify(e.meta) : null,
        e.createdAt || new Date().toISOString(),
      );
      if (result.changes > 0) insertedEvents += 1;
      else skippedEvents += 1;
    }

    for (const [id, card] of cardMap) {
      const cardId =
        typeof card?.id === "string" && card.id ? card.id : id;
      const title =
        typeof card?.title === "string" ? card.title : String(cardId);
      const projectId =
        typeof card?.projectId === "string" ? card.projectId : null;
      const result = tx.run(
        `INSERT OR IGNORE INTO knowledge_cards
          (id, project_id, title, payload_json)
         VALUES (?, ?, ?, ?)`,
        cardId,
        projectId,
        title,
        JSON.stringify(card),
      );
      if (result.changes > 0) insertedCards += 1;
      else skippedCards += 1;
    }
  });

  return {
    events: eventMap.size,
    cards: cardMap.size,
    insertedEvents,
    skippedEvents,
    insertedCards,
    skippedCards,
    dbPath,
  };
}

export function resetKnowledgeSqliteStoreForTests(): void {
  if (!runtime) return;
  try {
    runtime.db.close();
  } catch {
    // ignore
  }
  const { dataDir, dbPath } = runtime;
  runtime = null;
  for (const f of [
    dbPath,
    `${dbPath}-wal`,
    `${dbPath}-shm`,
    eventsJsonPath(dataDir),
    cardsJsonPath(dataDir),
  ]) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {
      // ignore
    }
  }
}
