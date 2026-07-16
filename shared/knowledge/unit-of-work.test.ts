/**
 * PR-13 seam: withUnitOfWork — failure rolls back, no half-write.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { withUnitOfWork } from "./unit-of-work";

describe("withUnitOfWork (PR-13)", () => {
  const temps: string[] = [];

  afterEach(() => {
    for (const dir of temps) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    temps.length = 0;
  });

  function openTempDb(): DatabaseSync {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uow-"));
    temps.push(dir);
    const db = new DatabaseSync(path.join(dir, "t.sqlite"));
    db.exec(`
      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    return db;
  }

  it("commits when fn succeeds", () => {
    const db = openTempDb();
    withUnitOfWork(db, (tx) => {
      tx.run(`INSERT INTO items (id, value) VALUES (?, ?)`, "a", "1");
      tx.run(`INSERT INTO items (id, value) VALUES (?, ?)`, "b", "2");
    });
    const rows = db.prepare(`SELECT id FROM items ORDER BY id`).all() as Array<{
      id: string;
    }>;
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    db.close();
  });

  it("rolls back on failure — no half-write", () => {
    const db = openTempDb();
    expect(() =>
      withUnitOfWork(db, (tx) => {
        tx.run(`INSERT INTO items (id, value) VALUES (?, ?)`, "a", "1");
        tx.run(`INSERT INTO items (id, value) VALUES (?, ?)`, "b", "2");
        throw new Error("boom mid-transaction");
      }),
    ).toThrow(/boom mid-transaction/);

    const count = db.prepare(`SELECT COUNT(*) AS n FROM items`).get() as {
      n: number;
    };
    expect(count.n).toBe(0);
    db.close();
  });
});
