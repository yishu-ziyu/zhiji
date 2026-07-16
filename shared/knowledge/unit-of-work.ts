/**
 * Unit of Work seam for Knowledge/Work SQLite writes (PR-13).
 * Wraps node:sqlite DatabaseSync BEGIN/COMMIT/ROLLBACK.
 */
import type { DatabaseSync } from "node:sqlite";

export type UnitOfWorkTx = {
  /** Run a parameterized statement inside the open transaction. */
  run: (sql: string, ...params: Array<string | number | null | bigint | Uint8Array>) => {
    changes: number;
  };
  /** Execute raw SQL (DDL / multi-statement not required). */
  exec: (sql: string) => void;
  /** Access underlying db (same connection; still inside txn). */
  db: DatabaseSync;
};

/**
 * Execute `fn` inside a single SQLite transaction.
 * On throw: ROLLBACK so no partial writes remain.
 */
export function withUnitOfWork<T>(
  db: DatabaseSync,
  fn: (tx: UnitOfWorkTx) => T,
): T {
  db.exec("BEGIN");
  const tx: UnitOfWorkTx = {
    db,
    exec: (sql) => {
      db.exec(sql);
    },
    run: (sql, ...params) => {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes ?? 0) };
    },
  };
  try {
    const value = fn(tx);
    db.exec("COMMIT");
    return value;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Prefer original error; rollback failure is secondary.
    }
    throw err;
  }
}
