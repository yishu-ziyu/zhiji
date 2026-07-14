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

/** Knowledge footprint (search/use touch on the library map). */
export type FootprintKind =
  | "listed"
  | "retrieved"
  | "opened"
  | "linked"
  | "cited";

/** 0 = not lit; 1 seen; 2 read; 3 used; 4 cited */
export type TouchDepth = 0 | 1 | 2 | 3 | 4;

export type FootprintEvent = {
  id: string;
  cardId: string;
  at: string;
  kind: FootprintKind;
  depth: TouchDepth;
  querySessionId?: string;
  workItemId?: string;
  score?: number;
  actor: string;
  meta?: Record<string, unknown>;
};

export type QuerySession = {
  id: string;
  query: string;
  filters?: KnowledgeSearchFilters;
  at: string;
  hitCardIds: string[];
  scores?: Record<string, number>;
};

export type LibraryNode = {
  cardId: string;
  title: string;
  source: KnowledgeSource;
  x: number;
  y: number;
  clusterKey: string;
};

export type FootprintViewMode = "current_query" | "window" | "work_item";

export type FootprintLitEntry = {
  cardId: string;
  depth: TouchDepth;
  score?: number;
  touchCount: number;
};

export const FOOTPRINT_KIND_DEPTH: Record<FootprintKind, TouchDepth> = {
  listed: 0,
  retrieved: 1,
  opened: 2,
  linked: 3,
  cited: 4,
};

export const SOURCE_CLUSTER_ORDER: KnowledgeSource[] = [
  "meeting",
  "doc",
  "chat",
  "email",
  "manual",
];

export const SOURCE_CLUSTER_LABELS: Record<KnowledgeSource, string> = {
  meeting: "会议",
  doc: "文档",
  chat: "聊天",
  email: "邮件",
  manual: "手记",
};
