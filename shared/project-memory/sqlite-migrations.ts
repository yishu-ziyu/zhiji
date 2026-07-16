/**
 * SQLite migration framework skeleton (PR-11).
 * Actual connection wiring lands when sqlite-store adopts applyMigrations().
 */
import fs from "node:fs";
import path from "node:path";

export type Migration = {
  id: string;
  sql: string;
};

export const CORE_MIGRATIONS: Migration[] = [
  {
    id: "001_schema_migrations",
    sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`,
  },
  {
    id: "002_dialogue",
    sql: `
CREATE TABLE IF NOT EXISTS dialogue_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  matter_id TEXT,
  title TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS dialogue_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  milestone INTEGER DEFAULT 0,
  FOREIGN KEY(session_id) REFERENCES dialogue_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_dialogue_sessions_project ON dialogue_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_messages_session ON dialogue_messages(session_id);
`,
  },
  {
    id: "003_claims",
    sql: `
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  matter_id TEXT,
  run_id TEXT,
  text TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  supersedes_claim_id TEXT
);
CREATE TABLE IF NOT EXISTS evidence_anchors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  content_hash TEXT,
  relative_path TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  quote TEXT NOT NULL,
  last_verified_at TEXT
);
CREATE TABLE IF NOT EXISTS claim_evidence_links (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  anchor_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  rationale TEXT
);
CREATE TABLE IF NOT EXISTS owner_resolutions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  edited_text TEXT,
  note TEXT,
  resolved_at TEXT NOT NULL
);
`,
  },
];

export type MigrationRunner = {
  exec(sql: string): void;
  allApplied(): string[];
  markApplied(id: string): void;
};

export function planMigrations(
  applied: string[],
  all: Migration[] = CORE_MIGRATIONS,
): Migration[] {
  const set = new Set(applied);
  return all.filter((m) => !set.has(m.id));
}

export function applyMigrations(runner: MigrationRunner, all: Migration[] = CORE_MIGRATIONS): string[] {
  // Ensure bookkeeping table exists via first migration always planned if missing
  const applied = new Set(runner.allApplied());
  const done: string[] = [];
  for (const m of all) {
    if (applied.has(m.id)) continue;
    runner.exec(m.sql);
    runner.markApplied(m.id);
    done.push(m.id);
  }
  return done;
}

/** Backup a db file before migration. */
export function backupSqliteFile(dbPath: string): string {
  const abs = path.resolve(dbPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`db not found: ${abs}`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${abs}.bak-${stamp}`;
  fs.copyFileSync(abs, dest);
  return dest;
}
