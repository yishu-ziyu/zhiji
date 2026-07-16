/**
 * MVP-V0 Task 2: Project Memory domain contract (PRD §4, Lead amendment).
 * Immutable understanding revisions; head moves; split writer ports.
 */

export type SourceGrant = {
  id: string;
  projectId: string;
  kind: "local_folder" | "local_git";
  rootPath: string;
  status: "active" | "disabled" | "revoked";
  createdAt: string;
  updatedAt: string;
};

export type OriginalRevision = {
  /** sha256:<hex> */
  id: string;
  projectId: string;
  grantId: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  observedAt: string;
  previousRevisionId?: string;
  tombstone: boolean;
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
  status: "queued" | "running" | "awaiting_owner" | "completed" | "failed";
  attempt: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
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

export interface AgentModelLoop {
  propose(input: MatterStateReconstructionInput): Promise<UnderstandingBody>;
}

export function revisionIdFromSha256(sha256: string): string {
  const hex = sha256.replace(/^sha256:/, "").toLowerCase();
  return `sha256:${hex}`;
}

export function sha256FromRevisionId(id: string): string {
  return id.replace(/^sha256:/, "").toLowerCase();
}
