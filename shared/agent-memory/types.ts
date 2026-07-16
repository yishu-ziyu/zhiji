/**
 * Agent dual memory types.
 * Project Memory (SQLite+CAS) remains the durable project truth.
 * Dialogue Memory is session-scoped chat + open tool intent.
 */

export type DialogueRole = "user" | "agent" | "system";

export type DialogueSessionStatus = "open" | "closed";

export type OpenToolIntent = {
  toolName: string;
  summary: string;
  startedAt: string;
};

export type DialogueSession = {
  id: string;
  projectId: string;
  matterId?: string;
  title: string;
  status: DialogueSessionStatus;
  openToolIntent?: OpenToolIntent;
  createdAt: string;
  updatedAt: string;
};

export type DialogueMessage = {
  id: string;
  sessionId: string;
  projectId: string;
  role: DialogueRole;
  content: string;
  createdAt: string;
  /** Optional pins into Project Memory revisions. */
  refRevisionIds?: string[];
  analysisRunId?: string;
  /** When true, writeback may mirror into knowledge feed. */
  milestone?: boolean;
};

export type WritingStyle = "concise" | "detailed";
export type ConfirmStyle = "always" | "auto_low_risk";

export type UserPreferences = {
  writingStyle: WritingStyle;
  confirmStyle: ConfirmStyle;
  favoritePathPrefixes: string[];
  updatedAt: string;
};

export type WorkbenchBundle = {
  projectId: string;
  projectName: string | null;
  projectExists: boolean;
  materialCount: number;
  workItemCount: number;
  openWorkItemCount: number;
  agentEventCount: number;
  /** True when knowledge project row exists (same id as folder-connect). */
  knowledgeReady: boolean;
  /** True when materials or work items can light the canvas. */
  canvasReady: boolean;
  /** Dialogue open session count for this project. */
  openDialogueSessions: number;
};

export type EventArchivePlan = {
  retain: Array<{ id: string; observedAt: string }>;
  archive: Array<{ id: string; observedAt: string; relativePath: string }>;
  summary: {
    archivedEventIds: string[];
    relativePaths: string[];
    fromObservedAt: string | null;
    toObservedAt: string | null;
    text: string;
  };
};

export type EventArchiveRecord = {
  id: string;
  projectId: string;
  matterId?: string;
  archivedAt: string;
  eventIds: string[];
  /** Full event payloads preserved for evidence chain. */
  eventsJson: string;
  summaryText: string;
  fromObservedAt: string | null;
  toObservedAt: string | null;
};
