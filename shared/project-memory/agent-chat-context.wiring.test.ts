/**
 * Wiring: AgentLoopContext.chat is loaded when model nextStep runs with dialogue present.
 * Proves dual-memory pack reaches the model loop (not only unit-level format helpers).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatAgentChatContextForPrompt } from "@/shared/agent-memory/chat-context";
import { createProjectAgentRuntime } from "./agent-runtime";
import { resetSharedProjectMemoryStoreForTests } from "./runtime";
import type {
  AgentLoopContext,
  AgentModelCallReceipt,
  Matter,
  ProjectAgentModelLoop,
} from "./types";

describe("AgentLoopContext.chat wiring into model nextStep", () => {
  let knowledgeDir: string;
  let memoryDir: string;
  let fixture: string;
  let previousDataDir: string | undefined;

  const projectId = "p-chat-wire";
  const matterId = "m-chat-wire";
  const grantId = "g-chat-wire";

  beforeEach(async () => {
    knowledgeDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-wire-k-"));
    memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-wire-m-"));
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "chat-wire-fx-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = knowledgeDir;
    delete process.env.SEED_DEMO;

    fs.writeFileSync(
      path.join(fixture, "NOTES.md"),
      "# Notes\nWire chat context into the model loop.\n",
    );

    resetSharedProjectMemoryStoreForTests(memoryDir);
    const { getSharedProjectMemoryStore } = await import("./runtime");
    const store = getSharedProjectMemoryStore({ dataDir: memoryDir });

    store.upsertGrant({
      id: grantId,
      projectId,
      kind: "local_folder",
      rootPath: fixture,
      status: "active",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });
    const matter: Matter = {
      id: matterId,
      projectId,
      title: "对话记忆接线",
      goal: "nextStep 能看到 chat pack",
      status: "active",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    };
    store.upsertMatter(matter);
    store.upsertWatchSet({
      id: "w-chat-wire",
      projectId,
      matterId,
      grantId,
      includePathPrefixes: ["NOTES.md"],
      excludePathPrefixes: [],
      status: "active",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });
    await store.ingest({
      projectId,
      grantId,
      kind: "added",
      relativePath: "NOTES.md",
      content: new TextEncoder().encode(
        "# Notes\nWire chat context into the model loop.\n",
      ),
      observedAt: "2026-07-17T00:01:00.000Z",
    });
  });

  afterEach(async () => {
    const dialogue = await import("@/shared/agent-memory/dialogue-store");
    const prefs = await import("@/shared/agent-memory/user-preferences");
    dialogue.resetDialogueStoreForTests();
    prefs.resetUserPreferencesForTests();
    resetSharedProjectMemoryStoreForTests();
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    for (const dir of [knowledgeDir, memoryDir, fixture]) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* */
      }
    }
  });

  it("passes non-empty chat pack (dialogue present) into modelLoop.nextStep", async () => {
    const dialogue = await import("@/shared/agent-memory/dialogue-store");
    dialogue.resetDialogueStoreForTests();
    const session = dialogue.openDialogueSession({
      projectId,
      matterId,
      title: "接线对话",
    });
    dialogue.appendDialogueMessage({
      sessionId: session.id,
      role: "user",
      content: "README 里写的目标是什么？",
    });

    let captured: AgentLoopContext | undefined;
    const receipt: AgentModelCallReceipt = {
      provider: "stepfun",
      model: "test-mock",
      effort: "high",
      calls: 1,
      fallback: { used: false },
    };
    const mockLoop: ProjectAgentModelLoop = {
      async nextStep(ctx) {
        captured = ctx;
        // Short-circuit: no candidate write needed for this wiring assert.
        return {
          decision: {
            kind: "confirmation_required",
            reason: "expand_scope",
            summary: "wiring test stop",
          },
          receipt,
        };
      },
    };

    const runtime = createProjectAgentRuntime({
      modelMode: "model",
      toolsEnabled: false,
      modelLoop: mockLoop,
    });
    const run = await runtime.start({
      projectId,
      matterId,
      trigger: "owner_question",
      ownerUtterance: "再看一眼 NOTES",
    });

    expect(captured).toBeTruthy();
    expect(captured!.chat).toBeDefined();
    expect(captured!.chat!.recentDialogue.length).toBeGreaterThan(0);
    expect(
      captured!.chat!.recentDialogue.some(
        (t) =>
          t.content.includes("README") || t.content.includes("NOTES"),
      ),
    ).toBe(true);
    expect(captured!.chat!.ownerUtterance).toBe("再看一眼 NOTES");

    const promptBlock = formatAgentChatContextForPrompt(captured!.chat);
    expect(promptBlock.length).toBeGreaterThan(0);
    expect(promptBlock).toMatch(/对话记忆与用户偏好/);
    expect(promptBlock).toMatch(/README|NOTES/);

    expect(run.status).toBe("confirmation_required");
  });
});
