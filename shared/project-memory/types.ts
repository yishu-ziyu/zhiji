/**
 * MVP-V0 Task 2: Project Memory domain contract (PRD §4, Lead amendment).
 * Immutable understanding revisions; head moves; split writer ports.
 */
import { createHash } from "node:crypto";

export type SourceGrant = {
  id: string;
  projectId: string;
  kind: "local_folder" | "local_git";
  rootPath: string;
  status: "active" | "disabled" | "revoked";
  createdAt: string;
  updatedAt: string;
  /** Grant access policy version applied at connect (PR-03). */
  policyVersion?: string;
};

export type OriginalRevision = {
  /**
   * Occurrence identity for this path/grant/version (not global content hash).
   * Format: `orev:<hex>` derived from project+grant+path+contentSha+previousOccurrence+tombstone.
   * CAS blob identity remains `sha256` field only.
   */
  id: string;
  projectId: string;
  grantId: string;
  relativePath: string;
  /** Content-addressed blob identity (CAS key). Multiple revisions may share one sha256. */
  sha256: string;
  sizeBytes: number;
  observedAt: string;
  previousRevisionId?: string;
  tombstone: boolean;
  /**
   * Optional capture provenance. Git history blobs use `git:<commit>:<blobOid>`.
   * These must not become the observer current-path tip or emit change events.
   */
  sourceVersion?: string;
};

export type ChangeKind =
  | "added"
  | "modified"
  | "renamed"
  | "deleted"
  | "reconciled";

export type ChangeEvent = {
  id: string;
  projectId: string;
  grantId: string;
  kind: ChangeKind;
  relativePath: string;
  previousPath?: string;
  beforeRevisionId?: string;
  afterRevisionId?: string;
  observedAt: string;
  dedupeKey: string;
};

export type Matter = {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  status: "active" | "resolved" | "archived";
  createdAt: string;
  updatedAt: string;
};

/** Owner-visible explicit path prefixes; never silent full-root. */
export type MatterWatchSet = {
  id: string;
  projectId: string;
  matterId: string;
  grantId: string;
  includePathPrefixes: string[];
  excludePathPrefixes: string[];
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type EvidenceAnchor = {
  revisionId: string;
  relativePath: string;
  /** Exact source span; empty forbidden for a supported claim. */
  quote: string;
  lastVerifiedAt: string;
};

export type StateClaim = {
  text: string;
  evidence: EvidenceAnchor[];
  gaps: string[];
  conflicts: string[];
};

export type ChangeClaim = {
  before: string;
  after: string;
  eventIds: string[];
  evidence: EvidenceAnchor[];
};

export type WhyClaim = {
  text: string;
  status: "supported" | "unknown" | "conflicted";
  evidence: EvidenceAnchor[];
};

export type UnderstandingBody = {
  now: StateClaim;
  then: StateClaim & { at: string };
  changed: ChangeClaim[];
  why: WhyClaim[];
  depends: Array<{
    kind: "matter" | "action" | "evidence";
    id: string;
    reason: string;
  }>;
  evidenceRevisionIds: string[];
  nextDecision: string;
};

/**
 * Immutable understanding row. Never UPDATE body/kind after insert.
 * kind is fixed at creation: candidate | accepted.
 */
export type UnderstandingRevision = {
  id: string;
  projectId: string;
  matterId: string;
  kind: "candidate" | "accepted";
  previousAcceptedRevisionId?: string;
  body: UnderstandingBody;
  basedOnEventIds: string[];
  proposedBy: "agent" | "owner";
  createdAt: string;
};

export type OwnerResolution = {
  id: string;
  candidateRevisionId: string;
  decision: "accept" | "edit_accept" | "reject";
  editedBody?: UnderstandingBody;
  actor: "owner";
  createdAt: string;
  /** Set only for accept/edit_accept. */
  acceptedRevisionId?: string;
};

/** Mutable pointer only — not an understanding body. */
export type MatterUnderstandingHead = {
  matterId: string;
  acceptedRevisionId?: string;
  reviewState: "current" | "review_needed";
  reviewReasonEventIds: string[];
  updatedAt: string;
};

export type AnalysisRun = {
  id: string;
  projectId: string;
  matterId: string;
  trigger: "source_change" | "owner_question" | "retry";
  eventIds: string[];
  status:
    | "queued"
    | "running"
    | "awaiting_owner"
    | "completed"
    | "failed"
    | "interrupted"
    | "confirmation_required";
  attempt: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  /** D-51 durable stop / progress (additive; legacy rows omit). */
  grantId?: string;
  stopReason?: AgentStopReason;
  modelReceipt?: AgentRunReceipt;
  interruptRequested?: boolean;
  candidateRevisionId?: string;
  progressSummary?: string;
  /** Durable owner utterance for async workers after process restart. */
  ownerUtterance?: string;
};

/** Observer → memory ingest signal (not knowledge). */
export type ObservationSignal = {
  projectId: string;
  grantId: string;
  kind: ChangeKind;
  relativePath: string;
  previousPath?: string;
  content?: Uint8Array;
  observedAt: string;
  dedupeKey?: string;
};

export type MatterState = {
  matter: Matter;
  head: MatterUnderstandingHead;
  accepted?: UnderstandingRevision;
  candidate?: UnderstandingRevision;
  recentEvents: ChangeEvent[];
  watchSet?: MatterWatchSet;
};

export type MatterStateReconstructionInput = {
  projectId: string;
  matterId: string;
  events: ChangeEvent[];
  accepted?: UnderstandingRevision;
  evidenceSnippets: Array<{ revisionId: string; text: string }>;
};

export type StopHandle = { stop: () => Promise<void> };

export interface ObservationAdapter {
  start(
    grant: SourceGrant,
    emit: (signal: ObservationSignal) => Promise<void>,
  ): Promise<StopHandle>;
  reconcile(grant: SourceGrant): Promise<ObservationSignal[]>;
}

export interface ProjectMemoryReader {
  readRevision(id: string): Promise<Uint8Array | null>;
  listEvents(projectId: string, after?: string): Promise<ChangeEvent[]>;
  getMatterState(projectId: string, matterId: string): Promise<MatterState>;
}

export interface ObservationWriter {
  ingest(
    signal: ObservationSignal,
  ): Promise<{ event?: ChangeEvent; revision?: OriginalRevision }>;
}

export interface CandidateWriter {
  saveCandidate(
    run: AnalysisRun,
    body: UnderstandingBody,
  ): Promise<UnderstandingRevision>;
}

/** Never inject into AgentModelLoop or background AnalysisRun services. */
export interface OwnerDecisionWriter {
  resolveCandidate(input: OwnerResolution): Promise<{
    resolution: OwnerResolution;
    accepted?: UnderstandingRevision;
    head: MatterUnderstandingHead;
  }>;
}

/**
 * Agent-facing surface: read + propose candidates only.
 * Must not include OwnerDecisionWriter.
 */
export type AgentMemoryService = ProjectMemoryReader & CandidateWriter;

/**
 * Legacy D-50 single-shot propose surface.
 * Keep until Wave C migrates its caller; Wave B/D-51 consume ProjectAgentModelLoop only.
 */
export interface AgentModelLoop {
  propose(input: MatterStateReconstructionInput): Promise<UnderstandingBody>;
}

/** D-51/D-52 iterative model step (Wave B+). Distinct from legacy AgentModelLoop.propose. */
export interface ProjectAgentModelLoop {
  nextStep(
    input: AgentLoopContext,
    signal: AbortSignal,
  ): Promise<{ decision: AgentLoopDecision; receipt: AgentModelCallReceipt }>;
}

// --- D-51 / D-52 domain contracts (Wave A): tools, loop decisions, receipts, budgets ---

export type ProjectAgentToolCall =
  | {
      id: string;
      name: "project_map";
      input: { scope: "initial_root" | "matter"; maxDepth?: number };
    }
  | {
      id: string;
      name: "read_revision";
      input: { revisionId: string; startLine?: number; endLine?: number };
    }
  | {
      /** Read a file under grant root by relative path (when revision id unknown). */
      id: string;
      name: "read_path";
      input: { relativePath: string; startLine?: number; endLine?: number };
    }
  | {
      id: string;
      name: "search_text";
      input: { query: string; pathPrefix?: string; limit?: number };
    }
  | {
      id: string;
      name: "search_symbols";
      input: {
        query: string;
        kind?: string;
        pathPrefix?: string;
        limit?: number;
      };
    }
  | {
      id: string;
      name: "search_relations";
      input: { query?: string; limit?: number };
    }
  | { id: string; name: "git_status"; input: Record<string, never> }
  | {
      id: string;
      name: "git_log";
      input: { limit?: number; relativePath?: string };
    }
  | {
      id: string;
      name: "git_diff";
      input: { base: string; head?: string; relativePath?: string };
    }
  | {
      id: string;
      name: "git_show";
      input: { commit: string; relativePath?: string };
    }
  | {
      id: string;
      name: "git_blame";
      input: {
        commit?: string;
        relativePath: string;
        startLine?: number;
        endLine?: number;
      };
    }
  | {
      id: string;
      name: "compare_history";
      input: { leftRevisionId: string; rightRevisionId: string };
    }
  | {
      id: string;
      name: "query_project_memory";
      input: { include: "accepted" | "events" | "both"; limit?: number };
    }
  | {
      /**
       * UI canvas presentation command (no disk I/O).
       * Validated against canvas-menu-v1; Owner UI applies command.
       */
      id: string;
      name: "set_canvas_view";
      input: {
        view: "now" | "by_kind" | "decision" | "evidence";
        focus?: { kind: string; id: string };
        highlightNodeKeys?: string[];
        fold?: "1hop" | "path";
        reason?: string;
        intentId?: string;
        menuVersion?: string;
      };
    };

export type AgentLoopDecision =
  | { kind: "tools"; calls: ProjectAgentToolCall[] }
  | {
      kind: "finish";
      proposedStop: "evidence_sufficient" | "unknown";
      body: UnderstandingBody;
    }
  | {
      kind: "confirmation_required";
      reason: "expand_scope" | "sensitive_source" | "write_action";
      summary: string;
    };

export type AgentStopReason =
  | "evidence_sufficient"
  | "unknown"
  | "owner_interrupt"
  | "budget"
  | "confirm_expand"
  | "confirm_sensitive"
  | "confirm_write"
  | "error";

export type AgentRunBudget = {
  maxModelTurns: number;
  maxToolCalls: number;
  maxFilesRead: number;
  maxWallMs: number;
  maxToolResultBytes: number;
  maxContextBytes: number;
};

export const DEFAULT_AGENT_RUN_BUDGET = {
  maxModelTurns: 12,
  maxToolCalls: 24,
  maxFilesRead: 32,
  maxWallMs: 180_000,
  maxToolResultBytes: 64 * 1024,
  maxContextBytes: 256 * 1024,
} as const satisfies AgentRunBudget;

export type AgentRunReceipt = {
  /** Active connector provider id (e.g. px_proxy, minimax_token_plan). */
  provider: string;
  /** proxy | official | legacy */
  connectionKind?: string;
  /** Wire protocol used for this run. */
  protocol?: string;
  /** Model id actually requested (alias as requested, never guessed). */
  model: string;
  requestedModel?: string;
  /** Hostname only of base URL (no path/query/secrets). */
  baseHost?: string;
  profileFingerprint?: string;
  effort: "high";
  calls: number;
  fallback:
    | { used: false }
    | {
        used: true;
        kind: "deterministic";
        errorClass:
          | "timeout"
          | "auth"
          | "rate_limit"
          | "provider_4xx"
          | "provider_5xx"
          | "network"
          | "invalid_response"
          | "unknown";
      };
};

/** Alias used by model-step protocol (same durable shape as AgentRunReceipt). */
export type AgentModelCallReceipt = AgentRunReceipt;

export type ToolReceipt = {
  id: string;
  runId: string;
  sequence: number;
  tool: ProjectAgentToolCall["name"];
  projectId: string;
  grantId: string;
  scope: {
    mode: "initial_root" | "matter";
    relativePaths: string[];
    reason?: string;
  };
  outcome: "ok" | "error" | "confirm_required" | "interrupted";
  summary: string;
  pins: EvidenceAnchor[];
  startedAt: string;
  finishedAt: string;
  errorClass?: string;
};

/** Compact dual-memory pack (dialogue + prefs + Owner project statements). */
export type AgentChatContextPack = {
  writingStyle: "concise" | "detailed";
  confirmStyle: "always" | "auto_low_risk";
  favoritePathPrefixes: string[];
  recentDialogue: Array<{ role: string; content: string }>;
  ownerStatements: Array<{ id: string; text: string; createdAt: string }>;
  openDialogueSessions: number;
  canvasReady: boolean;
  ownerUtterance?: string;
};

/** Context for model nextStep: project facts + optional dialogue pack. */
export type AgentLoopContext = {
  projectId: string;
  matterId: string;
  grantId: string;
  runId: string;
  eventIds: string[];
  accepted?: UnderstandingRevision;
  toolReceiptSummaries: Array<{ sequence: number; tool: string; summary: string }>;
  budget: AgentRunBudget;
  /** Dual memory: session dialogue + user prefs (never replaces evidence). */
  chat?: AgentChatContextPack;
  /** Analysis trigger — owner_question gets answer-first prompt. */
  trigger?: AnalysisRun["trigger"];
  /** Raw owner question for this run (also mirrored in chat.ownerUtterance). */
  ownerUtterance?: string;
};

export type AgentRunView = {
  run: AnalysisRun;
  toolReceipts: ToolReceipt[];
  candidate?: UnderstandingRevision;
};

export interface AgentRunRepository {
  createRun(run: AnalysisRun): Promise<AnalysisRun>;
  updateRun(run: AnalysisRun): Promise<AnalysisRun>;
  getRun(projectId: string, runId: string): Promise<AnalysisRun | null>;
  listRuns(projectId: string, matterId?: string): Promise<AnalysisRun[]>;
  /** Global durable queue discovery for a fresh worker process. */
  listQueuedRuns(): Promise<AnalysisRun[]>;
  appendToolReceipt(receipt: ToolReceipt): Promise<void>;
  listToolReceipts(runId: string): Promise<ToolReceipt[]>;
  requestInterrupt(projectId: string, runId: string): Promise<AnalysisRun>;
  getRunView(projectId: string, runId: string): Promise<AgentRunView | null>;
}

export type CaptureGitBlobInput = {
  projectId: string;
  grantId: string;
  relativePath: string;
  /** Full commit object id. */
  commit: string;
  /** Git blob object id (hex). */
  blobOid: string;
  content: Uint8Array;
  observedAt?: string;
};

export interface SourceRevisionCatalog {
  /** Current observer tips only (excludes git-history captures). */
  listCurrentRevisions(
    projectId: string,
    grantId: string,
  ): Promise<OriginalRevision[]>;
  /**
   * Idempotent CAS + original row for a Git blob used as evidence.
   * Does not insert change_events and does not move the path tip.
   */
  captureGitBlob(input: CaptureGitBlobInput): Promise<OriginalRevision>;
}

export interface ProjectAgentRuntime {
  start(input: {
    projectId: string;
    matterId: string;
    trigger: AnalysisRun["trigger"];
    eventIds?: string[];
    budget?: Partial<AgentRunBudget>;
    /** Owner natural language → may force set_canvas_view tool */
    ownerUtterance?: string;
    /**
     * When set (async worker path), reuse this durable run id for receipts/SSE.
     * Must already exist as queued/running for the same project+matter.
     */
    runId?: string;
  }): Promise<AnalysisRun>;
  get(projectId: string, runId: string): Promise<AgentRunView | null>;
  interrupt(projectId: string, runId: string): Promise<AnalysisRun>;
}

/** @deprecated Content SHA is not a revision occurrence id. Prefer makeOccurrenceRevisionId. */
export function revisionIdFromSha256(sha256: string): string {
  const hex = sha256.replace(/^sha256:/, "").toLowerCase();
  return `sha256:${hex}`;
}

export function sha256FromRevisionId(id: string): string {
  return id.replace(/^(sha256:|orev:)/, "").toLowerCase();
}

/**
 * Stable occurrence id: unique per project/grant/path/content/previous tip/tombstone.
 * Same content on two paths → distinct ids; A→B→A (prev differs) → distinct ids.
 */
export function makeOccurrenceRevisionId(input: {
  projectId: string;
  grantId: string;
  relativePath: string;
  contentSha256: string;
  previousRevisionId?: string | null;
  tombstone: boolean;
  /**
   * Optional identity material (e.g. git sourceVersion).
   * Omitted for ordinary observer tips so existing IDs stay stable.
   */
  identityExtra?: string | null;
}): string {
  const material = [
    input.projectId,
    input.grantId,
    input.relativePath.replace(/\\/g, "/"),
    input.contentSha256.replace(/^sha256:/, "").toLowerCase(),
    input.previousRevisionId ?? "",
    input.tombstone ? "1" : "0",
    ...(input.identityExtra != null && input.identityExtra !== ""
      ? [input.identityExtra]
      : []),
  ].join("\0");
  const hex = createHash("sha256").update(material).digest("hex");
  return `orev:${hex}`;
}

/** Git object id for blob contents: sha1/sha256 of `blob <size>\0` + bytes. */
export function gitBlobObjectId(
  content: Uint8Array,
  algorithm: "sha1" | "sha256" = "sha1",
): string {
  const header = `blob ${content.byteLength}\0`;
  return createHash(algorithm).update(header).update(content).digest("hex");
}

/** Full Git object ids only (40 hex sha1 or 64 hex sha256). */
export function isFullGitObjectId(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value) || /^[0-9a-f]{64}$/.test(value);
}
