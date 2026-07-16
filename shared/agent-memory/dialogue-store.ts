/**
 * Thin Dialogue Memory: session turns + open tool intent.
 * Never writes Project Memory understanding heads.
 *
 * Strangler (PR-11): default JSON; set DIALOGUE_STORE=sqlite to write/read
 * shared/agent-memory/dialogue-sqlite-store.ts.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendDialogueMessage as appendDialogueMessageSqlite,
  closeDialogueSession as closeDialogueSessionSqlite,
  getDialogueSession as getDialogueSessionSqlite,
  isDialogueSqliteMode,
  listDialogueMessages as listDialogueMessagesSqlite,
  listDialogueSessions as listDialogueSessionsSqlite,
  listRecentProjectDialogue as listRecentProjectDialogueSqlite,
  openDialogueSession as openDialogueSessionSqlite,
  resetDialogueSqliteStoreForTests,
  setOpenToolIntent as setOpenToolIntentSqlite,
} from "./dialogue-sqlite-store";
import type {
  DialogueMessage,
  DialogueRole,
  DialogueSession,
  OpenToolIntent,
} from "./types";

function dataDir(): string {
  if (process.env.KNOWLEDGE_DATA_DIR) {
    return path.resolve(process.env.KNOWLEDGE_DATA_DIR);
  }
  return path.join(process.cwd(), "data", "knowledge");
}

function sessionsPath(): string {
  return path.join(dataDir(), "dialogue-sessions.json");
}

function messagesPath(): string {
  return path.join(dataDir(), "dialogue-messages.json");
}

function readJsonMap<T>(file: string): Map<string, T> {
  try {
    if (!fs.existsSync(file)) return new Map();
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, T>;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

function writeJsonMap<T>(file: string, map: Map<string, T>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const obj: Record<string, T> = {};
  for (const [k, v] of map) obj[k] = v;
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
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

export function openDialogueSession(input: {
  projectId: string;
  matterId?: string;
  title?: string;
}): DialogueSession {
  if (isDialogueSqliteMode()) {
    return openDialogueSessionSqlite(input);
  }
  const projectId = input.projectId?.trim();
  if (!projectId) throw new Error("projectId required");
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
  const sessions = readJsonMap<DialogueSession>(sessionsPath());
  sessions.set(session.id, session);
  writeJsonMap(sessionsPath(), sessions);
  return copySession(session);
}

export function getDialogueSession(sessionId: string): DialogueSession | null {
  if (isDialogueSqliteMode()) {
    return getDialogueSessionSqlite(sessionId);
  }
  const s = readJsonMap<DialogueSession>(sessionsPath()).get(sessionId);
  return s ? copySession(s) : null;
}

export function listDialogueSessions(projectId: string): DialogueSession[] {
  if (isDialogueSqliteMode()) {
    return listDialogueSessionsSqlite(projectId);
  }
  const id = projectId?.trim();
  if (!id) return [];
  return [...readJsonMap<DialogueSession>(sessionsPath()).values()]
    .filter((s) => s.projectId === id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(copySession);
}

export function closeDialogueSession(sessionId: string): DialogueSession | null {
  if (isDialogueSqliteMode()) {
    return closeDialogueSessionSqlite(sessionId);
  }
  const sessions = readJsonMap<DialogueSession>(sessionsPath());
  const s = sessions.get(sessionId);
  if (!s) return null;
  s.status = "closed";
  s.openToolIntent = undefined;
  s.updatedAt = new Date().toISOString();
  sessions.set(s.id, s);
  writeJsonMap(sessionsPath(), sessions);
  return copySession(s);
}

export function setOpenToolIntent(
  sessionId: string,
  intent: OpenToolIntent | null,
): DialogueSession | null {
  if (isDialogueSqliteMode()) {
    return setOpenToolIntentSqlite(sessionId, intent);
  }
  const sessions = readJsonMap<DialogueSession>(sessionsPath());
  const s = sessions.get(sessionId);
  if (!s || s.status !== "open") return null;
  s.openToolIntent = intent ? { ...intent } : undefined;
  s.updatedAt = new Date().toISOString();
  sessions.set(s.id, s);
  writeJsonMap(sessionsPath(), sessions);
  return copySession(s);
}

export function appendDialogueMessage(input: {
  sessionId: string;
  role: DialogueRole;
  content: string;
  refRevisionIds?: string[];
  analysisRunId?: string;
  milestone?: boolean;
}): DialogueMessage {
  if (isDialogueSqliteMode()) {
    return appendDialogueMessageSqlite(input);
  }
  const sessions = readJsonMap<DialogueSession>(sessionsPath());
  const session = sessions.get(input.sessionId);
  if (!session) throw new Error("dialogue session not found");
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
  const messages = readJsonMap<DialogueMessage>(messagesPath());
  messages.set(message.id, message);
  writeJsonMap(messagesPath(), messages);

  session.updatedAt = now;
  sessions.set(session.id, session);
  writeJsonMap(sessionsPath(), sessions);

  return copyMessage(message);
}

export function listDialogueMessages(
  sessionId: string,
  limit = 100,
): DialogueMessage[] {
  if (isDialogueSqliteMode()) {
    return listDialogueMessagesSqlite(sessionId, limit);
  }
  return [...readJsonMap<DialogueMessage>(messagesPath()).values()]
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-Math.max(1, limit))
    .map(copyMessage);
}

/** Recent messages across open sessions for a project (Agent context pack). */
export function listRecentProjectDialogue(
  projectId: string,
  limit = 40,
): DialogueMessage[] {
  if (isDialogueSqliteMode()) {
    return listRecentProjectDialogueSqlite(projectId, limit);
  }
  const id = projectId?.trim();
  if (!id) return [];
  return [...readJsonMap<DialogueMessage>(messagesPath()).values()]
    .filter((m) => m.projectId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-Math.max(1, limit))
    .map(copyMessage);
}

export function resetDialogueStoreForTests(): void {
  try {
    if (fs.existsSync(sessionsPath())) fs.unlinkSync(sessionsPath());
    if (fs.existsSync(messagesPath())) fs.unlinkSync(messagesPath());
  } catch {
    // ignore
  }
  try {
    resetDialogueSqliteStoreForTests();
  } catch {
    // ignore
  }
}
