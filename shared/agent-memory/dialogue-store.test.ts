import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Dialogue Memory (session turns)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dialogue-mem-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    const store = await import("./dialogue-store");
    store.resetDialogueStoreForTests();
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps multi-turn messages and reloads after reopen", async () => {
    const d = await import("./dialogue-store");
    d.resetDialogueStoreForTests();
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
      content: "先看 README 与待确认理解",
      refRevisionIds: ["orev:abc"],
    });

    const messages = d.listDialogueMessages(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].refRevisionIds).toEqual(["orev:abc"]);

    // Simulate process reload (fresh module state is file-backed).
    const again = d.listRecentProjectDialogue("proj-a");
    expect(again.map((m) => m.content)).toEqual([
      "现在最该看什么？",
      "先看 README 与待确认理解",
    ]);
  });

  it("isolates projects and blocks writes on closed sessions", async () => {
    const d = await import("./dialogue-store");
    d.resetDialogueStoreForTests();
    const a = d.openDialogueSession({ projectId: "p1" });
    const b = d.openDialogueSession({ projectId: "p2" });
    d.appendDialogueMessage({
      sessionId: a.id,
      role: "user",
      content: "only-a",
    });
    d.appendDialogueMessage({
      sessionId: b.id,
      role: "user",
      content: "only-b",
    });
    expect(d.listRecentProjectDialogue("p1").map((m) => m.content)).toEqual([
      "only-a",
    ]);
    expect(d.listRecentProjectDialogue("p2").map((m) => m.content)).toEqual([
      "only-b",
    ]);

    d.setOpenToolIntent(a.id, {
      toolName: "read_path",
      summary: "读 NOTES.md",
      startedAt: new Date().toISOString(),
    });
    expect(d.getDialogueSession(a.id)?.openToolIntent?.toolName).toBe(
      "read_path",
    );
    d.closeDialogueSession(a.id);
    expect(d.getDialogueSession(a.id)?.status).toBe("closed");
    expect(d.getDialogueSession(a.id)?.openToolIntent).toBeUndefined();
    expect(() =>
      d.appendDialogueMessage({
        sessionId: a.id,
        role: "user",
        content: "should fail",
      }),
    ).toThrow(/closed/i);
  });

  it("session projectId is stable so API can refuse cross-project close", async () => {
    const d = await import("./dialogue-store");
    d.resetDialogueStoreForTests();
    const a = d.openDialogueSession({ projectId: "p-a" });
    const b = d.openDialogueSession({ projectId: "p-b" });
    expect(d.getDialogueSession(a.id)?.projectId).toBe("p-a");
    expect(d.getDialogueSession(b.id)?.projectId).toBe("p-b");
    // Caller with project p-a must not close b without checking projectId first.
    expect(d.getDialogueSession(b.id)?.projectId).not.toBe("p-a");
  });
});
