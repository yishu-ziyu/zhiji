/**
 * Dialogue Memory SQLite backend (PR-11).
 * Uses node:sqlite DatabaseSync (same as project-memory/sqlite-store).
 *
 * Strangler: production entry stays dialogue-store.ts;
 * set DIALOGUE_STORE=sqlite to write/read this backend.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  DialogueMessage,
  DialogueRole,
  DialogueSession,
  OpenToolIntent,
} from "./types";

export const DIALOGUE_STORE_ENV = "DIALOGUE_STORE";

export function isDialogueSqliteMode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (env[DIALOGUE_STORE_ENV] ?? "").trim().toLowerCase() === "sqlite";
}

export class DialogueJsonCorruptError extends Error {
  readonly path: string;
  readonly causeError: unknown;

  constructor(filePath: string, cause: unknown) {
    const detail =
      cause instanceof Error ? cause.message : String(cause ?? "unknown");
    super(
      `Dialogue JSON corrupt at ${filePath}: ${detail}. Refusing silent empty import.`,
    );
    this.name = "DialogueJsonCorruptError";
    this.path = filePath;
    this.causeError = cause;
  }
}

export type MigrateJsonDialogueReport = {
  sessions: number;
  messages: number;
  insertedSessions: number;
  insertedMessages: number;
  skippedSessions: number;
  skippedMessages: number;
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

export function dialogueSqlitePath(dataDir: string): string {
  return path.join(dataDir, "dialogue.sqlite");
}

function sessionsJsonPath(dataDir: string): string {
  return path.join(dataDir, "dialogue-sessions.json");
}

function messagesJsonPath(dataDir: string): string {
  return path.join(dataDir, "dialogue-messages.json");
}

function ensureDb(dataDir?: string): RuntimeState {
  const resolved = resolveDataDir(dataDir);
  if (runtime) {
    if (runtime.dataDir !== resolved) {
      throw new Error(
        `Dialogue sqlite already open at ${runtime.dataDir}; refusing ${resolved}`,
      );
    }
    return runtime;
  }
  fs.mkdirSync(resolved, { recursive: true });
  const dbPath = dialogueSqlitePath(resolved);
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

    CREATE TABLE IF NOT EXISTS dialogue_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      matter_id TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      open_tool_intent_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dialogue_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ref_revision_ids_json TEXT,
      analysis_run_id TEXT,
      milestone INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(session_id) REFERENCES dialogue_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_dlg_sessions_project
      ON dialogue_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_dlg_messages_session
      ON dialogue_messages(session_id, created_at);
  `);

  const applied = db
    .prepare(`SELECT id FROM schema_migrations WHERE id = ?`)
    .get("002_dialogue") as { id: string } | undefined;
  if (!applied) {
    db.prepare(
      `INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`,
    ).run("002_dialogue", new Date().toISOString());
  }
}

function copySession(s: DialogueSession): DialogueSession {
  return {
    ...s,
    openToolIntent: s.openToolIntent ? { ...s.openToolIntent } : undefined,
  };
}

function copyMessage(m: DialogueMessage): DialogueMessage {
  return {
    ...m,
    refRevisionIds: m.refRevisionIds ? [...m.refRevisionIds] : undefined,
  };
}

function rowToSession(row: Record<string, unknown>): DialogueSession {
  let openToolIntent: OpenToolIntent | undefined;
  const raw = row.open_tool_intent_json;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      openToolIntent = JSON.parse(raw) as OpenToolIntent;
    } catch {
      openToolIntent = undefined;
    }
  }
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    matterId: row.matter_id ? String(row.matter_id) : undefined,
    title: String(row.title),
    status: row.status === "closed" ? "closed" : "open",
    openToolIntent,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToMessage(row: Record<string, unknown>): DialogueMessage {
  let refRevisionIds: string[] | undefined;
  const raw = row.ref_revision_ids_json;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        refRevisionIds = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      refRevisionIds = undefined;
    }
  }
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    projectId: String(row.project_id),
    role: row.role as DialogueRole,
    content: String(row.content),
    createdAt: String(row.created_at),
    refRevisionIds,
    analysisRunId: row.analysis_run_id
      ? String(row.analysis_run_id)
      : undefined,
    milestone: row.milestone === 1 ? true : undefined,
  };
}

export function openDialogueSession(input: {
  projectId: string;
  matterId?: string;
  title?: string;
}): DialogueSession {
  const projectId = input.projectId?.trim();
  if (!projectId) throw new Error("projectId required");
  const { db } = ensureDb();
  const now = new Date().toISOString();
  const session: DialogueSession = {
    id: randomUUID(),
    projectId,
    matterId: input.matterId?.trim() || undefined,
    title: input.title?.trim() || "与 Agent 对话",
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    `INSERT INTO dialogue_sessions
      (id, project_id, matter_id, title, status, open_tool_intent_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    session.id,
    session.projectId,
    session.matterId ?? null,
    session.title,
    session.status,
    session.createdAt,
    session.updatedAt,
  );
  return copySession(session);
}

export function getDialogueSession(sessionId: string): DialogueSession | null {
  const { db } = ensureDb();
  const row = db
    .prepare(`SELECT * FROM dialogue_sessions WHERE id = ?`)
    .get(sessionId) as Record<string, unknown> | undefined;
  return row ? copySession(rowToSession(row)) : null;
}

export function appendDialogueMessage(input: {
  sessionId: string;
  role: DialogueRole;
  content: string;
  refRevisionIds?: string[];
  analysisRunId?: string;
  milestone?: boolean;
}): DialogueMessage {
  const { db } = ensureDb();
  const sessionRow = db
    .prepare(`SELECT * FROM dialogue_sessions WHERE id = ?`)
    .get(input.sessionId) as Record<string, unknown> | undefined;
  if (!sessionRow) throw new Error("dialogue session not found");
  const session = rowToSession(sessionRow);
  if (session.status !== "open") throw new Error("dialogue session is closed");
  const content = input.content?.trim();
  if (!content) throw new Error("message content required");

  const now = new Date().toISOString();
  const message: DialogueMessage = {
    id: randomUUID(),
    sessionId: session.id,
    projectId: session.projectId,
    role: input.role,
    content,
    createdAt: now,
    refRevisionIds: input.refRevisionIds?.filter(Boolean),
    analysisRunId: input.analysisRunId,
    milestone: input.milestone === true ? true : undefined,
  };

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO dialogue_messages
        (id, session_id, project_id, role, content, created_at,
         ref_revision_ids_json, analysis_run_id, milestone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      message.id,
      message.sessionId,
      message.projectId,
      message.role,
      message.content,
      message.createdAt,
      message.refRevisionIds ? JSON.stringify(message.refRevisionIds) : null,
      message.analysisRunId ?? null,
      message.milestone ? 1 : 0,
    );
    db.prepare(
      `UPDATE dialogue_sessions SET updated_at = ? WHERE id = ?`,
    ).run(now, session.id);
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  }

  return copyMessage(message);
}

export function listDialogueMessages(
  sessionId: string,
  limit = 100,
): DialogueMessage[] {
  const { db } = ensureDb();
  const lim = Math.max(1, limit);
  const rows = db
    .prepare(
      `SELECT * FROM dialogue_messages
       WHERE session_id = ?
       ORDER BY created_at ASC`,
    )
    .all(sessionId) as Record<string, unknown>[];
  const mapped = rows.map((r) => copyMessage(rowToMessage(r)));
  return mapped.slice(-lim);
}

export function listDialogueSessions(projectId: string): DialogueSession[] {
  const id = projectId?.trim();
  if (!id) return [];
  const { db } = ensureDb();
  const rows = db
    .prepare(
      `SELECT * FROM dialogue_sessions
       WHERE project_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(id) as Record<string, unknown>[];
  return rows.map((r) => copySession(rowToSession(r)));
}

export function closeDialogueSession(
  sessionId: string,
): DialogueSession | null {
  const { db } = ensureDb();
  const row = db
    .prepare(`SELECT * FROM dialogue_sessions WHERE id = ?`)
    .get(sessionId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE dialogue_sessions
     SET status = 'closed', open_tool_intent_json = NULL, updated_at = ?
     WHERE id = ?`,
  ).run(now, sessionId);
  const updated = db
    .prepare(`SELECT * FROM dialogue_sessions WHERE id = ?`)
    .get(sessionId) as Record<string, unknown>;
  return copySession(rowToSession(updated));
}

export function setOpenToolIntent(
  sessionId: string,
  intent: OpenToolIntent | null,
): DialogueSession | null {
  const { db } = ensureDb();
  const row = db
    .prepare(`SELECT * FROM dialogue_sessions WHERE id = ?`)
    .get(sessionId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const session = rowToSession(row);
  if (session.status !== "open") return null;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE dialogue_sessions
     SET open_tool_intent_json = ?, updated_at = ?
     WHERE id = ?`,
  ).run(intent ? JSON.stringify(intent) : null, now, sessionId);
  const updated = db
    .prepare(`SELECT * FROM dialogue_sessions WHERE id = ?`)
    .get(sessionId) as Record<string, unknown>;
  return copySession(rowToSession(updated));
}

/** Recent messages for a project (Agent context pack). Same semantics as JSON path. */
export function listRecentProjectDialogue(
  projectId: string,
  limit = 40,
): DialogueMessage[] {
  const id = projectId?.trim();
  if (!id) return [];
  const { db } = ensureDb();
  const lim = Math.max(1, limit);
  const rows = db
    .prepare(
      `SELECT * FROM dialogue_messages
       WHERE project_id = ?
       ORDER BY created_at ASC`,
    )
    .all(id) as Record<string, unknown>[];
  return rows.map((r) => copyMessage(rowToMessage(r))).slice(-lim);
}

/**
 * Strict JSON map reader for migration.
 * Missing file → empty. Present but corrupt → throw DialogueJsonCorruptError.
 * Never silent-empty on parse failure.
 */
export function readDialogueJsonMapStrict<T>(filePath: string): Map<string, T> {
  if (!fs.existsSync(filePath)) return new Map();
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new DialogueJsonCorruptError(filePath, err);
  }
  if (text.trim() === "") return new Map();
  try {
    const raw = JSON.parse(text) as unknown;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("expected JSON object map");
    }
    return new Map(Object.entries(raw as Record<string, T>));
  } catch (err) {
    throw new DialogueJsonCorruptError(filePath, err);
  }
}

/**
 * Import legacy dialogue-*.json into dialogue.sqlite under dataDir.
 * Idempotent by primary key (INSERT OR IGNORE). Does not delete JSON.
 */
export function migrateJsonDialogueToSqlite(
  dataDir: string,
): MigrateJsonDialogueReport {
  const resolved = resolveDataDir(dataDir);
  const sessionsFile = sessionsJsonPath(resolved);
  const messagesFile = messagesJsonPath(resolved);

  // Read first (may throw) before mutating sqlite rows from corrupt sources.
  const sessionMap = readDialogueJsonMapStrict<DialogueSession>(sessionsFile);
  const messageMap = readDialogueJsonMapStrict<DialogueMessage>(messagesFile);

  const { db, dbPath } = ensureDb(resolved);

  let insertedSessions = 0;
  let skippedSessions = 0;
  let insertedMessages = 0;
  let skippedMessages = 0;

  db.exec("BEGIN");
  try {
    const insertSession = db.prepare(
      `INSERT OR IGNORE INTO dialogue_sessions
        (id, project_id, matter_id, title, status, open_tool_intent_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of sessionMap.values()) {
      if (!s?.id || !s.projectId) continue;
      const result = insertSession.run(
        s.id,
        s.projectId,
        s.matterId ?? null,
        s.title || "与 Agent 对话",
        s.status === "closed" ? "closed" : "open",
        s.openToolIntent ? JSON.stringify(s.openToolIntent) : null,
        s.createdAt || new Date().toISOString(),
        s.updatedAt || s.createdAt || new Date().toISOString(),
      );
      if (result.changes > 0) insertedSessions += 1;
      else skippedSessions += 1;
    }

    const insertMessage = db.prepare(
      `INSERT OR IGNORE INTO dialogue_messages
        (id, session_id, project_id, role, content, created_at,
         ref_revision_ids_json, analysis_run_id, milestone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const m of messageMap.values()) {
      if (!m?.id || !m.sessionId || !m.projectId) continue;
      const result = insertMessage.run(
        m.id,
        m.sessionId,
        m.projectId,
        m.role || "user",
        m.content || "",
        m.createdAt || new Date().toISOString(),
        m.refRevisionIds ? JSON.stringify(m.refRevisionIds) : null,
        m.analysisRunId ?? null,
        m.milestone ? 1 : 0,
      );
      if (result.changes > 0) insertedMessages += 1;
      else skippedMessages += 1;
    }
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  }

  return {
    sessions: sessionMap.size,
    messages: messageMap.size,
    insertedSessions,
    insertedMessages,
    skippedSessions,
    skippedMessages,
    dbPath,
  };
}

export function resetDialogueSqliteStoreForTests(options?: {
  /** Keep sqlite file (simulate process reopen). Default: delete files. */
  keepFiles?: boolean;
}): void {
  if (runtime) {
    try {
      runtime.db.close();
    } catch {
      // ignore
    }
    const dataDir = runtime.dataDir;
    const dbPath = runtime.dbPath;
    runtime = null;
    if (!options?.keepFiles) {
      for (const f of [
        dbPath,
        `${dbPath}-wal`,
        `${dbPath}-shm`,
        sessionsJsonPath(dataDir),
        messagesJsonPath(dataDir),
      ]) {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch {
          // ignore
        }
      }
    }
  }
}
