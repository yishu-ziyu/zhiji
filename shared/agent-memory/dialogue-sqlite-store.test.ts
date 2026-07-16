/**
 * PR-11 seams (public only):
 * - openDialogueSession / appendDialogueMessage / listDialogueMessages
 * - migrateJsonDialogueToSqlite(dataDir)
 * - corrupt JSON must throw (never silent empty overwrite)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("dialogue-sqlite-store (PR-11)", () => {
  let dataDir: string;
  let prevKnowledge: string | undefined;
  let prevDialogueStore: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dlg-sqlite-"));
    prevKnowledge = process.env.KNOWLEDGE_DATA_DIR;
    prevDialogueStore = process.env.DIALOGUE_STORE;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
    process.env.DIALOGUE_STORE = "sqlite";
  });

  afterEach(async () => {
    const store = await import("./dialogue-sqlite-store");
    store.resetDialogueSqliteStoreForTests();
    if (prevKnowledge === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = prevKnowledge;
    if (prevDialogueStore === undefined) delete process.env.DIALOGUE_STORE;
    else process.env.DIALOGUE_STORE = prevDialogueStore;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("list/close/setOpenToolIntent/listRecent stay on sqlite (no JSON fork)", async () => {
    const d = await import("./dialogue-sqlite-store");
    d.resetDialogueSqliteStoreForTests();

    const s1 = d.openDialogueSession({ projectId: "p1", title: "A" });
    const s2 = d.openDialogueSession({ projectId: "p1", title: "B" });
    d.openDialogueSession({ projectId: "p2", title: "other" });

    d.appendDialogueMessage({
      sessionId: s1.id,
      role: "user",
      content: "from-s1",
    });
    d.appendDialogueMessage({
      sessionId: s2.id,
      role: "user",
      content: "from-s2",
    });

    const sessions = d.listDialogueSessions("p1");
    expect(sessions.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
    expect(sessions.every((s) => s.projectId === "p1")).toBe(true);

    const withIntent = d.setOpenToolIntent(s1.id, {
      toolName: "read_path",
      summary: "读 README",
      startedAt: "2026-07-17T00:00:00.000Z",
    });
    expect(withIntent?.openToolIntent?.toolName).toBe("read_path");
    expect(d.getDialogueSession(s1.id)?.openToolIntent?.summary).toBe(
      "读 README",
    );

    const closed = d.closeDialogueSession(s1.id);
    expect(closed?.status).toBe("closed");
    expect(closed?.openToolIntent).toBeUndefined();
    expect(d.getDialogueSession(s1.id)?.status).toBe("closed");
    expect(() =>
      d.appendDialogueMessage({
        sessionId: s1.id,
        role: "user",
        content: "should fail",
      }),
    ).toThrow(/closed/i);

    const recent = d.listRecentProjectDialogue("p1");
    expect(recent.map((m) => m.content).sort()).toEqual(
      ["from-s1", "from-s2"].sort(),
    );
    expect(recent.every((m) => m.projectId === "p1")).toBe(true);

    // Ensure no JSON fork files were created by these APIs.
    expect(fs.existsSync(path.join(dataDir, "dialogue-sessions.json"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(dataDir, "dialogue-messages.json"))).toBe(
      false,
    );
  });

  it("open → append → list keeps turns after reopen", async () => {
    const d = await import("./dialogue-sqlite-store");
    d.resetDialogueSqliteStoreForTests();

    const session = d.openDialogueSession({
      projectId: "proj-a",
      title: "本周重点",
    });
    d.appendDialogueMessage({
      sessionId: session.id,
      role: "user",
      content: "现在最该看什么？",
    });
    d.appendDialogueMessage({
      sessionId: session.id,
      role: "agent",
      content: "先看 README",
      refRevisionIds: ["orev:abc"],
    });

    const messages = d.listDialogueMessages(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].refRevisionIds).toEqual(["orev:abc"]);

    // Simulate process reopen (close singleton, reopen same dataDir).
    d.resetDialogueSqliteStoreForTests({ keepFiles: true });
    const again = d.listDialogueMessages(session.id);
    expect(again.map((m) => m.content)).toEqual([
      "现在最该看什么？",
      "先看 README",
    ]);
  });

  it("migrateJsonDialogueToSqlite copies counts and is idempotent", async () => {
    const d = await import("./dialogue-sqlite-store");
    d.resetDialogueSqliteStoreForTests();

    // Seed legacy JSON (same shape as dialogue-store).
    const sessions = {
      "s-1": {
        id: "s-1",
        projectId: "p1",
        title: "会话1",
        status: "open",
        createdAt: "2026-07-17T00:00:00.000Z",
        updatedAt: "2026-07-17T00:01:00.000Z",
      },
      "s-2": {
        id: "s-2",
        projectId: "p1",
        title: "会话2",
        status: "closed",
        createdAt: "2026-07-17T00:02:00.000Z",
        updatedAt: "2026-07-17T00:03:00.000Z",
      },
    };
    const messages = {
      "m-1": {
        id: "m-1",
        sessionId: "s-1",
        projectId: "p1",
        role: "user",
        content: "hello",
        createdAt: "2026-07-17T00:00:10.000Z",
      },
      "m-2": {
        id: "m-2",
        sessionId: "s-1",
        projectId: "p1",
        role: "agent",
        content: "hi",
        createdAt: "2026-07-17T00:00:20.000Z",
        refRevisionIds: ["orev:1"],
      },
      "m-3": {
        id: "m-3",
        sessionId: "s-2",
        projectId: "p1",
        role: "user",
        content: "later",
        createdAt: "2026-07-17T00:02:10.000Z",
      },
    };
    fs.writeFileSync(
      path.join(dataDir, "dialogue-sessions.json"),
      JSON.stringify(sessions, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(dataDir, "dialogue-messages.json"),
      JSON.stringify(messages, null, 2),
      "utf8",
    );

    const first = d.migrateJsonDialogueToSqlite(dataDir);
    expect(first.sessions).toBe(2);
    expect(first.messages).toBe(3);
    expect(first.skippedSessions).toBe(0);
    expect(first.skippedMessages).toBe(0);

    const listed = d.listDialogueMessages("s-1");
    expect(listed).toHaveLength(2);
    expect(listed[1].refRevisionIds).toEqual(["orev:1"]);

    // Idempotent: same ids, no duplicate rows.
    const second = d.migrateJsonDialogueToSqlite(dataDir);
    expect(second.sessions).toBe(2);
    expect(second.messages).toBe(3);
    expect(second.skippedSessions).toBe(2);
    expect(second.skippedMessages).toBe(3);
    expect(d.listDialogueMessages("s-1")).toHaveLength(2);
    expect(d.listDialogueMessages("s-2")).toHaveLength(1);
  });

  it("throws diagnostic error on corrupt JSON and does not wipe sqlite", async () => {
    const d = await import("./dialogue-sqlite-store");
    d.resetDialogueSqliteStoreForTests();

    // Healthy sqlite row first.
    const session = d.openDialogueSession({ projectId: "keep-me" });
    d.appendDialogueMessage({
      sessionId: session.id,
      role: "user",
      content: "must survive",
    });

    fs.writeFileSync(
      path.join(dataDir, "dialogue-sessions.json"),
      "{not-valid-json",
      "utf8",
    );
    fs.writeFileSync(
      path.join(dataDir, "dialogue-messages.json"),
      JSON.stringify({}),
      "utf8",
    );

    expect(() => d.migrateJsonDialogueToSqlite(dataDir)).toThrow(
      /dialogue-sessions\.json|corrupt|JSON/i,
    );

    // Existing sqlite data must remain.
    expect(d.listDialogueMessages(session.id).map((m) => m.content)).toEqual([
      "must survive",
    ]);
  });
});
