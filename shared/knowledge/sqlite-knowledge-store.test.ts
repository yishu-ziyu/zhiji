/**
 * PR-13 seams:
 * - migrateJsonWorkEventsToSqlite count consistency + idempotent
 * - corrupt JSON → diagnostic error (no silent empty)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("sqlite-knowledge-store (PR-13)", () => {
  let dataDir: string;
  let prevKnowledge: string | undefined;
  let prevStore: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kn-sqlite-"));
    prevKnowledge = process.env.KNOWLEDGE_DATA_DIR;
    prevStore = process.env.KNOWLEDGE_STORE;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
    process.env.KNOWLEDGE_STORE = "sqlite";
  });

  afterEach(async () => {
    const s = await import("./sqlite-knowledge-store");
    s.resetKnowledgeSqliteStoreForTests();
    if (prevKnowledge === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = prevKnowledge;
    if (prevStore === undefined) delete process.env.KNOWLEDGE_STORE;
    else process.env.KNOWLEDGE_STORE = prevStore;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("migrateJsonWorkEventsToSqlite matches JSON count and is idempotent", async () => {
    const s = await import("./sqlite-knowledge-store");
    s.resetKnowledgeSqliteStoreForTests();

    const events = {
      "e-1": {
        id: "e-1",
        workItemId: "w-1",
        type: "comment",
        actor: "owner",
        body: "先做入口",
        createdAt: "2026-07-17T01:00:00.000Z",
      },
      "e-2": {
        id: "e-2",
        workItemId: "w-1",
        type: "status_change",
        actor: "owner",
        body: "doing",
        meta: { from: "todo", to: "doing" },
        createdAt: "2026-07-17T01:01:00.000Z",
      },
      "e-3": {
        id: "e-3",
        workItemId: "w-2",
        type: "comment",
        actor: "agent",
        body: "other item",
        createdAt: "2026-07-17T01:02:00.000Z",
      },
    };
    fs.writeFileSync(
      path.join(dataDir, "events.json"),
      JSON.stringify(events, null, 2),
      "utf8",
    );

    // cards.json count consistency (minimal entity side-check)
    const cards = {
      "c-1": { id: "c-1", title: "卡1", projectId: "p1" },
      "c-2": { id: "c-2", title: "卡2", projectId: "p1" },
    };
    fs.writeFileSync(
      path.join(dataDir, "cards.json"),
      JSON.stringify(cards, null, 2),
      "utf8",
    );

    const first = s.migrateJsonWorkEventsToSqlite(dataDir);
    expect(first.events).toBe(3);
    expect(first.insertedEvents).toBe(3);
    expect(first.skippedEvents).toBe(0);
    expect(first.cards).toBe(2);
    expect(s.countWorkEvents()).toBe(3);
    expect(s.countCards()).toBe(2);

    const second = s.migrateJsonWorkEventsToSqlite(dataDir);
    expect(second.events).toBe(3);
    expect(second.insertedEvents).toBe(0);
    expect(second.skippedEvents).toBe(3);
    expect(s.countWorkEvents()).toBe(3);
    expect(s.countCards()).toBe(2);

    const listed = s.listWorkEventsForWorkItem("w-1");
    expect(listed).toHaveLength(2);
    expect(listed.map((e) => e.id).sort()).toEqual(["e-1", "e-2"]);
  });

  it("throws on corrupt events.json and does not wipe prior sqlite rows", async () => {
    const s = await import("./sqlite-knowledge-store");
    s.resetKnowledgeSqliteStoreForTests();

    // Seed via unit-of-work path (sqlite write only when env=sqlite).
    s.insertWorkEvent({
      id: "keep-1",
      workItemId: "w-keep",
      type: "comment",
      actor: "owner",
      body: "must survive",
      createdAt: "2026-07-17T00:00:00.000Z",
    });
    expect(s.countWorkEvents()).toBe(1);

    fs.writeFileSync(
      path.join(dataDir, "events.json"),
      "{not-valid-json",
      "utf8",
    );
    fs.writeFileSync(
      path.join(dataDir, "cards.json"),
      JSON.stringify({}),
      "utf8",
    );

    expect(() => s.migrateJsonWorkEventsToSqlite(dataDir)).toThrow(
      /events\.json|corrupt|JSON/i,
    );
    expect(s.countWorkEvents()).toBe(1);
    expect(s.listWorkEventsForWorkItem("w-keep")[0]?.body).toBe("must survive");
  });

  it("isKnowledgeSqliteMode is false by default (no production switch)", async () => {
    delete process.env.KNOWLEDGE_STORE;
    const s = await import("./sqlite-knowledge-store");
    // re-read mode without re-importing module state of other flags
    expect(s.isKnowledgeSqliteMode({ ...process.env, KNOWLEDGE_STORE: undefined })).toBe(
      false,
    );
    expect(
      s.isKnowledgeSqliteMode({
        ...process.env,
        KNOWLEDGE_STORE: "sqlite",
      }),
    ).toBe(true);
  });
});
