/**
 * What the chat Agent should load: prefs + recent dialogue + workbench readiness
 * + Owner-stated project understanding (elevated durable facts).
 */
import { listRecentProjectDialogue } from "./dialogue-store";
import {
  listOwnerProjectStatements,
  type OwnerProjectStatement,
} from "./owner-statements";
import { getUserPreferences } from "./user-preferences";
import { loadWorkbenchBundle } from "./workbench-bundle";
import type { DialogueMessage, UserPreferences, WorkbenchBundle } from "./types";

export type AgentChatContext = {
  projectId: string;
  preferences: UserPreferences;
  recentDialogue: DialogueMessage[];
  /** Durable Owner speech about the project (elevated from chat). */
  ownerStatements: OwnerProjectStatement[];
  workbench: WorkbenchBundle;
};

/** Compact pack injected into AgentLoopContext / model prompts. */
export type AgentChatContextPack = {
  writingStyle: UserPreferences["writingStyle"];
  confirmStyle: UserPreferences["confirmStyle"];
  favoritePathPrefixes: string[];
  recentDialogue: Array<{ role: string; content: string }>;
  /** Owner-stated project facts — part of project understanding, not small talk. */
  ownerStatements: Array<{ id: string; text: string; createdAt: string }>;
  openDialogueSessions: number;
  canvasReady: boolean;
  ownerUtterance?: string;
};

export function buildAgentChatContext(
  projectId: string,
  options?: { dialogueLimit?: number },
): AgentChatContext {
  const id = projectId?.trim() ?? "";
  return {
    projectId: id,
    preferences: getUserPreferences(),
    recentDialogue: id
      ? listRecentProjectDialogue(id, options?.dialogueLimit ?? 24)
      : [],
    ownerStatements: id
      ? listOwnerProjectStatements(id, { limit: 24 })
      : [],
    workbench: loadWorkbenchBundle(id),
  };
}

export function toAgentChatContextPack(
  ctx: AgentChatContext,
  ownerUtterance?: string,
): AgentChatContextPack {
  return {
    writingStyle: ctx.preferences.writingStyle,
    confirmStyle: ctx.preferences.confirmStyle,
    favoritePathPrefixes: ctx.preferences.favoritePathPrefixes.slice(0, 12),
    recentDialogue: ctx.recentDialogue.slice(-16).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 600),
    })),
    ownerStatements: ctx.ownerStatements.slice(-16).map((s) => ({
      id: s.id,
      text: s.text.slice(0, 800),
      createdAt: s.createdAt,
    })),
    openDialogueSessions: ctx.workbench.openDialogueSessions,
    canvasReady: ctx.workbench.canvasReady,
    ownerUtterance: ownerUtterance?.trim() || undefined,
  };
}

/** Prompt block for model loop — dual memory without leaking full CAS. */
export function formatAgentChatContextForPrompt(
  pack: AgentChatContextPack | null | undefined,
): string {
  if (!pack) return "";
  const lines: string[] = [
    "## 对话记忆与用户偏好（会话层；不能单独当作文件原文）",
    `writingStyle=${pack.writingStyle}`,
    `confirmStyle=${pack.confirmStyle}`,
    `favoritePathPrefixes=${JSON.stringify(pack.favoritePathPrefixes)}`,
    `canvasReady=${pack.canvasReady}`,
    `openDialogueSessions=${pack.openDialogueSessions}`,
  ];
  if (pack.ownerUtterance) {
    lines.push(`ownerUtterance=${JSON.stringify(pack.ownerUtterance)}`);
  }
  if (pack.recentDialogue.length === 0) {
    lines.push("recentDialogue=[]");
  } else {
    lines.push("recentDialogue=");
    for (const turn of pack.recentDialogue) {
      lines.push(`- ${turn.role}: ${turn.content}`);
    }
  }

  lines.push(
    "## Owner 对项目的陈述（项目理解的一部分：人的说法，必须写入 now/depends；与文件冲突时写入 conflicts）",
  );
  if (pack.ownerStatements.length === 0) {
    lines.push("ownerStatements=[]");
  } else {
    for (const s of pack.ownerStatements) {
      lines.push(`- [${s.id}] ${s.text}`);
    }
  }

  lines.push(
    "规则：1) Owner 陈述是项目真源的一部分，不是可丢弃闲聊；2) 文件证据仍须 toolReceipts；3) writingStyle 管语气；4) confirmStyle=always 时不要自称已确认；5) 有 ownerUtterance 时 now/nextDecision 必须直接服务该问题。",
  );
  return lines.join("\n");
}
