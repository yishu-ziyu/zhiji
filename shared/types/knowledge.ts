/** Knowledge workbench: evidence cards + work items + timeline events. */

export type KnowledgeSource = "meeting" | "email" | "chat" | "doc" | "manual";

export const DEFAULT_PROJECT_ID = "project-fc-opc-ibot";

export type ProjectStatus = "active" | "paused" | "archived";

export type Project = {
  id: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  /** Last time the user opened this project in the workbench (attention). */
  lastOpenedAt?: string;
  /**
   * T-19: sensitive projects never disclose title or hits across projects by default.
   */
  sensitive?: boolean;
};

/**
 * Owner-approved, revision-pinned reference from host project to a source object
 * in another project (T-19 / D-27 minimum cross-project path).
 */
export type CrossProjectReference = {
  id: string;
  hostProjectId: string;
  sourceProjectId: string;
  sourceKind: "card" | "material";
  /** Card id or material relativePath (material.id). */
  sourceObjectId: string;
  /** SHA-256 (or equivalent) of source content at approval time. */
  sourceContentHash: string;
  approvedBy: string;
  approvedAt: string;
  lastVerifiedAt: string;
  /** True when current source hash differs from pinned hash. */
  reviewRequired: boolean;
  /**
   * Display title at approval — empty when source project is sensitive
   * (never leak sensitive titles into host project).
   */
  sourceTitle?: string;
};

/**
 * T-19 S2: Owner-preauthorized host→source grant receipt.
 * Stores no credential, title, locator, object id, content, hit, or revision.
 * Effective = no disabledAt, no revokedAt, expiresAt null/future.
 */
export type ProjectSourceGrant = {
  id: string;
  hostProjectId: string;
  sourceProjectId: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string | null;
  disabledAt?: string;
  disabledBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
};

/**
 * T-19 S2: generic zero-leak hint. Ephemeral read result only.
 * No project title/id, object id, content, hit, revision, count, or rank.
 */
export type RedactedCrossProjectHint = {
  kind: "approved_source_may_be_relevant";
  message: string;
};

/** Fixed Chinese message for the sole generic hint (frozen S2 contract). */
export const REDACTED_CROSS_PROJECT_HINT_MESSAGE =
  "一项已授权来源可能相关；如需使用，请先由 Owner 明确引用。";

export type CanvasNodeKind =
  | "project"
  | "card"
  | "work_item"
  | "event"
  /** Synthetic focus node for an agent actor (id = full actor string, e.g. agent:project-reviewer). */
  | "agent";

export type CanvasNodeRef = {
  kind: CanvasNodeKind;
  id: string;
};

/** E7: right-panel process + live-ish feed derived from project facts (no fake animation). */
export type AgentProcessStepStatus = "pending" | "active" | "done";

export type AgentProcessStepView = {
  id: string;
  title: string;
  status: AgentProcessStepStatus;
};

export type AgentFeedItem = {
  id: string;
  actor: string;
  actorLabel: string;
  kind: "result" | "decision" | "status" | "comment" | "other";
  body: string;
  createdAt: string;
  ref: CanvasNodeRef;
};

export type AgentActivityView = {
  /** True when at least one agent:* work event exists. */
  hasAgentEvents: boolean;
  activeStepId: string | null;
  caption: string;
  steps: AgentProcessStepView[];
  feed: AgentFeedItem[];
  /** Distinct agent actor ids present in this project. */
  agentIds: string[];
};

export type ProjectCheckpoint = {
  id: string;
  projectId: string;
  goal: string;
  completed: string[];
  unresolved: string[];
  nextStep: string;
  confirmedBy: string;
  createdAt: string;
};

export type PlanAssessment = {
  status: "continue" | "adjust" | "insufficient";
  reason: string;
  evidence: CanvasNodeRef[];
};

/** B-2: project-level “现在怎样” on open (deterministic, evidence-backed). */
export type ProjectNowView = {
  status: "empty" | "ready";
  judgment: string;
  gaps: string[];
  nextStep: string;
  /** Clickable material cards only; ids must exist in project. */
  evidence: Array<{ kind: "card"; id: string; label: string }>;
  mode: "deterministic" | "model";
};

export type AttentionReasonCode =
  | "blocked"
  | "awaiting_confirmation"
  | "overdue"
  | "recent_change"
  | "agent_result"
  | "stale";

export type AttentionItem = {
  target: CanvasNodeRef;
  reasonCode: AttentionReasonCode;
  reason: string;
  evidenceEventIds: string[];
  score: number;
};

export type CanvasNode = {
  ref: CanvasNodeRef;
  label: string;
  subtitle?: string;
  state: "neutral" | "active" | "changed" | "confirmed" | "blocked";
  depth: 0 | 1;
  evidence: CanvasNodeRef[];
};

export type CanvasEdgeDirection = "out" | "in" | "both";

/** Product edge dictionary for industrial canvas (presentation + filter). */
export type CanvasEdgeKind =
  | "attention"
  | "work"
  | "evidence"
  | "relation"
  | "material"
  | "recent"
  | "project"
  | "blocked"
  | "activity"
  | "other";

export type CanvasEdgeStrength = "strong" | "medium" | "weak";

export type CanvasEdge = {
  id: string;
  relationId?: string;
  source: CanvasNodeRef;
  target: CanvasNodeRef;
  label: string;
  evidenceSentence?: string;
  status: "confirmed" | "suggested";
  /** 相对本次 snapshot.focus 的方向；不是持久化关系字段。 */
  direction: CanvasEdgeDirection;
  /** Typed edge for styling / filter (additive). */
  kind?: CanvasEdgeKind;
  /** Visual priority: strong = solid bold; weak = dashed, labels off by default. */
  strength?: CanvasEdgeStrength;
  /** One-line why this edge exists (edge click / inspector). */
  why?: string;
};

export type CanvasAction =
  | "open_evidence"
  | "link_evidence"
  | "update_work"
  | "comment"
  | "create_relation"
  | "update_next_step"
  | "confirm_checkpoint"
  | "run_agent";

export type CanvasInspector = {
  title: string;
  summary: string;
  whyImportant: string;
  evidence: CanvasNodeRef[];
  impacts: CanvasNodeRef[];
  availableActions: CanvasAction[];
  workItem?: ActionItem;
};

export type CanvasTimelineEvent = {
  id: string;
  ref: CanvasNodeRef;
  workItemId: string;
  type: WorkEventType;
  actor: string;
  body: string;
  createdAt: string;
  phase: "now" | "history";
  review?: {
    judgment: string;
    gaps: string[];
    nextStep: string;
    evidenceIds: string[];
    mode: "model" | "deterministic";
  };
};

export type CanvasTimeline = {
  now: CanvasTimelineEvent[];
  history: CanvasTimelineEvent[];
};

export type ProjectCanvasSnapshot = {
  project: Project;
  focus: CanvasNodeRef;
  checkpoint: ProjectCheckpoint | null;
  checkpointSource: "confirmed" | "inferred";
  changesSinceCheckpoint: CanvasTimelineEvent[];
  planAssessment: PlanAssessment;
  /** B-2: 打开项目优先看到的「现在怎样」+ 可点依据 */
  projectNow: ProjectNowView;
  /** E7: Agent 八步过程 + 动态 feed（来自真实事件，可空） */
  agentActivity: AgentActivityView;
  attention: AttentionItem[];
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  foldedNodes: CanvasNode[];
  foldedEdges: CanvasEdge[];
  hiddenNeighborCount: number;
  inspector: CanvasInspector;
  timeline: CanvasTimeline;
};

/** Knowledge state is distinct from ActionStatus (which describes work). */
export type KnowledgeIdentity = "candidate" | "evidence" | "claim" | "stale";

export type KnowledgeCard = {
  id: string;
  projectId: string;
  content: string;
  source: KnowledgeSource;
  tags: string[];
  timestamp: string;
  /** Related card IDs */
  links: string[];
  title?: string;
  /** Optional path into project materials store (knowledge base file). */
  sourceFileId?: string;
  /**
   * SHA-256 of material bytes when this citation was stamped (T-16 / D-24).
   * Path id remains sourceFileId; hash pins cited version (2a stamp-on-cite).
   */
  sourceContentHash?: string;
  /** ISO time when sourceContentHash was first set (create or one-time backfill). */
  sourceCitedAt?: string;
  /** Candidate/evidence/claim state; never inferred from ActionStatus.confirmed. */
  identity?: KnowledgeIdentity;
  /** Stable locator for the result WorkEvent that produced this candidate. */
  resultEventLocator?: string;
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
  projectId: string;
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
  projectId?: string;
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

export type ProjectSearchHit = {
  ref: CanvasNodeRef;
  title: string;
  summary: string;
  score: number;
  updatedAt: string;
  source?: KnowledgeSource;
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

/** Explicit card↔card relation (first-class edge). */
export type RelationType =
  | "supports"
  | "contradicts"
  | "depends_on"
  | "derived_from"
  | "same_topic"
  | "follows"
  | "mentions"
  | "custom";

export type RelationStatus = "confirmed" | "suggested" | "rejected";

export type RelationSource = "manual" | "rule" | "import" | "model";

export type KnowledgeRelation = {
  id: string;
  fromCardId: string;
  toCardId: string;
  relationType: RelationType;
  evidenceSentence: string;
  anchorCardId?: string;
  status: RelationStatus;
  directed: boolean;
  confidence?: number;
  source: RelationSource;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  workItemId?: string;
  meta?: Record<string, unknown>;
};

export type RelationNeighborEdge = {
  id: string;
  relationType: RelationType;
  direction: "out" | "in" | "both";
  evidenceSentence: string;
  status: RelationStatus;
  otherCard: {
    id: string;
    title: string;
    source: KnowledgeSource;
  };
};

export type NeighborView = {
  cardId: string;
  edges: RelationNeighborEdge[];
};

export type PathView = {
  nodes: string[];
  edges: string[];
  length: number;
};

export const RELATION_TYPES: RelationType[] = [
  "supports",
  "contradicts",
  "depends_on",
  "derived_from",
  "same_topic",
  "follows",
  "mentions",
  "custom",
];

/** P0 selectable types in UI */
export const RELATION_TYPES_P0: RelationType[] = [
  "supports",
  "contradicts",
  "depends_on",
  "derived_from",
  "same_topic",
  "follows",
];

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  supports: "支持",
  contradicts: "矛盾",
  depends_on: "依赖",
  derived_from: "出自",
  same_topic: "同题",
  follows: "后续",
  mentions: "提及",
  custom: "其他",
};

export const RELATION_STATUSES: RelationStatus[] = [
  "confirmed",
  "suggested",
  "rejected",
];

export const RELATION_SOURCES: RelationSource[] = [
  "manual",
  "rule",
  "import",
  "model",
];

/** Undirected types: store one edge, query expands both ways. */
export const UNDIRECTED_RELATION_TYPES: RelationType[] = ["same_topic"];

export const EVIDENCE_SENTENCE_MAX = 280;
