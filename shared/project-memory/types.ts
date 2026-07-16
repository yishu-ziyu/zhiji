/**
 * MVP-V0 Task 2: Project Memory domain contract (PRD §4).
 * Truth layer types only — no UI/API/observer.
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

export type UnderstandingBody = {
  now: string;
  then: string;
  changed: string[];
  why: string;
  depends: Array<{
    kind: "matter" | "action" | "evidence";
    id: string;
    reason: string;
  }>;
  evidenceRevisionIds: string[];
  nextDecision: string;
};

export type UnderstandingRevision = {
  id: string;
  projectId: string;
  matterId: string;
  previousRevisionId?: string;
  body: UnderstandingBody;
  basedOnEventIds: string[];
  status:
    | "candidate"
    | "accepted"
    | "rejected"
    | "superseded"
    | "review_needed";
  proposedBy: "agent" | "owner";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: "owner";
};

export type OwnerResolution = {
  id: string;
  understandingRevisionId: string;
  decision: "accept" | "edit_accept" | "reject";
  editedBody?: UnderstandingBody;
  actor: "owner";
  createdAt: string;
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
  /** Required for added/modified/reconciled when creating a non-tombstone revision. */
  content?: Uint8Array;
  observedAt: string;
  /** Optional override; default derived for content-addressed idempotency. */
  dedupeKey?: string;
};

export type MatterState = {
  matter: Matter;
  accepted?: UnderstandingRevision;
  candidate?: UnderstandingRevision;
  recentEvents: ChangeEvent[];
  reviewNeeded: UnderstandingRevision[];
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

export interface ProjectMemoryStore {
  ingest(
    signal: ObservationSignal,
  ): Promise<{ event?: ChangeEvent; revision?: OriginalRevision }>;
  readRevision(id: string): Promise<Uint8Array | null>;
  listEvents(projectId: string, after?: string): Promise<ChangeEvent[]>;
  getMatterState(projectId: string, matterId: string): Promise<MatterState>;
  saveCandidate(
    run: AnalysisRun,
    body: UnderstandingBody,
  ): Promise<UnderstandingRevision>;
  resolve(input: OwnerResolution): Promise<UnderstandingRevision>;
}

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
