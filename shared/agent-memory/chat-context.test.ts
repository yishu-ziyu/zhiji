import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("buildAgentChatContext + format for model loop", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-ctx-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
    delete process.env.SEED_DEMO;
  });

  afterEach(async () => {
    const d = await import("./dialogue-store");
    const p = await import("./user-preferences");
    d.resetDialogueStoreForTests();
    p.resetUserPreferencesForTests();
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("packs prefs + dialogue for the model prompt", async () => {
    const repo = await import("@/shared/knowledge/repository");
    const dialogue = await import("./dialogue-store");
    const prefs = await import("./user-preferences");
    const {
      buildAgentChatContext,
      formatAgentChatContextForPrompt,
      toAgentChatContextPack,
    } = await import("./chat-context");

    repo.resetKnowledgeStoreForTests();
    dialogue.resetDialogueStoreForTests();
    prefs.resetUserPreferencesForTests();

    const project = repo.addProject({ name: "双记忆", summary: "" });
    prefs.patchUserPreferences({ writingStyle: "detailed" });
    const session = dialogue.openDialogueSession({ projectId: project.id });
    dialogue.appendDialogueMessage({
      sessionId: session.id,
      role: "user",
      content: "README 里目标是什么？",
    });

    const statements = await import("./owner-statements");
    statements.recordOwnerProjectStatement({
      projectId: project.id,
      text: "我们这个项目的目标是先把画布跑通",
      source: "chat",
    });

    const pack = toAgentChatContextPack(
      buildAgentChatContext(project.id),
      "再看一眼 TODO",
    );
    expect(pack.writingStyle).toBe("detailed");
    expect(pack.recentDialogue.some((t) => t.content.includes("README"))).toBe(
      true,
    );
    expect(pack.ownerStatements.some((s) => s.text.includes("画布"))).toBe(
      true,
    );
    expect(pack.ownerUtterance).toBe("再看一眼 TODO");

    const block = formatAgentChatContextForPrompt(pack);
    expect(block).toMatch(/对话记忆与用户偏好/);
    expect(block).toMatch(/Owner 对项目的陈述/);
    expect(block).toMatch(/README/);
    expect(block).toMatch(/画布跑通/);
    expect(block).toMatch(/再看一眼 TODO/);
    expect(block).toMatch(/writingStyle=detailed/);
  });
});
