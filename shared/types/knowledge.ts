/** Knowledge workbench: evidence cards + work items + timeline events. */

export type KnowledgeSource = "meeting" | "email" | "chat" | "doc" | "manual";

export type KnowledgeCard = {
  id: string;
  content: string;
  source: KnowledgeSource;
  tags: string[];
  timestamp: string;
  /** Related card IDs */
  links: string[];
  title?: string;
};

/** Global status dictionary (shared language). */
export type ActionStatus =
  | "todo"
  | "doing"
  | "blocked"
  | "confirmed"
  | "done"
  | "cancelled";

/**
 * Work item (primary object for situation visibility).
 * Kept as ActionItem name for existing API/MCP compatibility.
 */
export type ActionItem = {
  id: string;
  /** Short title; defaults from description */
  title: string;
  description: string;
  assignee: string;
  deadline: string;
  status: ActionStatus;
  verificationCriteria: string;
  /** Primary linked card (legacy single link) */
  cardId?: string;
  /** Linked evidence card IDs */
  evidenceIds: string[];
  /** One-sentence next action; required when not done/cancelled */
  nextStep: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated alias — prefer ActionItem as work item */
export type WorkItem = ActionItem;

export type WorkEventType =
  | "comment"
  | "decision"
  | "status_change"
  | "assign"
  | "next_step_change"
  | "block"
  | "unblock"
  | "result"
  | "evidence_link";

export type WorkEvent = {
  id: string;
  workItemId: string;
  type: WorkEventType;
  actor: string;
  body: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type KnowledgeSearchFilters = {
  source?: KnowledgeSource | KnowledgeSource[];
  tags?: string[];
  limit?: number;
};

export type KnowledgeSearchRequest = {
  query: string;
  filters?: KnowledgeSearchFilters;
};

export type KnowledgeSearchHit = KnowledgeCard & {
  score: number;
};

export type MinutesResult = {
  title: string;
  summary: string;
  cards: KnowledgeCard[];
  actionItems: ActionItem[];
  offline?: boolean;
};

export type DissectResult = {
  goal: string;
  actionItems: ActionItem[];
  offline?: boolean;
};

export type ActionSuggestion = {
  id: string;
  title: string;
  reason: string;
  suggestedStatus?: ActionStatus;
  relatedCardIds: string[];
};

export const ACTION_STATUSES: ActionStatus[] = [
  "todo",
  "doing",
  "blocked",
  "confirmed",
  "done",
  "cancelled",
];

export const OPEN_STATUSES: ActionStatus[] = [
  "todo",
  "doing",
  "blocked",
  "confirmed",
];

export const TERMINAL_STATUSES: ActionStatus[] = ["done", "cancelled"];

export const WORK_EVENT_TYPES: WorkEventType[] = [
  "comment",
  "decision",
  "status_change",
  "assign",
  "next_step_change",
  "block",
  "unblock",
  "result",
  "evidence_link",
];

export const STATUS_LABELS: Record<ActionStatus, string> = {
  todo: "待开始",
  doing: "进行中",
  blocked: "阻塞",
  confirmed: "待确认",
  done: "完成",
  cancelled: "取消",
};

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  "meeting",
  "email",
  "chat",
  "doc",
  "manual",
];

export const DEFAULT_ACTOR = "自己";
