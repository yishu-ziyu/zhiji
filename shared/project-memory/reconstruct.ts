/**
 * MVP V0 Task 4 — Agent state reconstruction + Owner resolution.
 * AnalysisRun uses AgentMemoryService (Reader + CandidateWriter) only.
 * Resolve path uses OwnerDecisionWriter only — never mixed into agent container.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  buildDeterministicUnderstandingBody,
  createAgentModelLoop,
  isFullySupportedAnchor,
  normalizeWhyClaim,
  sanitizeModelBody,
  WHY_UNKNOWN,
  type AgentModelLoop,
} from "./agent-model-loop";
import { assertAgentServiceShape } from "./reducer";
import {
  openProjectMemoryStore,
  type SqliteProjectMemoryStore,
} from "./sqlite-store";
import type {
  AgentMemoryService,
  AnalysisRun,
  ChangeEvent,
  Matter,
  MatterState,
  MatterStateReconstructionInput,
  MatterUnderstandingHead,
  OwnerDecisionWriter,
  OwnerResolution,
  ProjectMemoryReader,
  UnderstandingBody,
  UnderstandingRevision,
} from "./types";

export {
  WHY_UNKNOWN,
  createAgentModelLoop,
  buildDeterministicUnderstandingBody,
  isFullySupportedAnchor,
  normalizeWhyClaim,
  type AgentModelLoop,
};

export type {
  AgentMemoryService,
  AnalysisRun,
  ChangeEvent,
  Matter,
  MatterState,
  MatterUnderstandingHead,
  OwnerDecisionWriter,
  OwnerResolution,
  UnderstandingBody,
  UnderstandingRevision,
};

export type MemoryView = {
  matter: Matter;
  head: MatterUnderstandingHead;
  accepted: UnderstandingRevision | null;
  candidate: UnderstandingRevision | null;
  events: ChangeEvent[];
  six: UnderstandingBody | null;
};

export async function getMemoryView(
  reader: ProjectMemoryReader,
  projectId: string,
  matterId: string,
): Promise<MemoryView | null> {
  try {
    const state = await reader.getMatterState(projectId, matterId);
    const six = state.candidate?.body ?? state.accepted?.body ?? null;
    return {
      matter: state.matter,
      head: state.head,
      accepted: state.accepted ?? null,
      candidate: state.candidate ?? null,
      events: state.recentEvents,
      six,
    };
  } catch {
    return null;
  }
}

export type RunAnalysisInput = {
  projectId: string;
  matterId: string;
  eventIds?: string[];
  trigger?: AnalysisRun["trigger"];
  /** Citable source sentences → WhyClaim supported when path+revision known. */
  whySourceQuotes?: string[];
  relatedActionIds?: string[];
};

/**
 * Run reconstruction. `service` must be AgentMemoryService shape
 * (Reader + CandidateWriter; no OwnerDecisionWriter).
 */
export async function runStateReconstruction(
  service: AgentMemoryService,
  model: AgentModelLoop,
  input: RunAnalysisInput,
): Promise<{ run: AnalysisRun; candidate: UnderstandingRevision }> {
  assertAgentServiceShape(service);

  let state: MatterState;
  try {
    state = await service.getMatterState(input.projectId, input.matterId);
  } catch {
    throw new Error("事项不存在");
  }

  const allEvents = await service.listEvents(input.projectId);
  const events = input.eventIds?.length
    ? allEvents.filter((e) => input.eventIds!.includes(e.id))
    : allEvents.slice(-20);

  const evidenceSnippets: MatterStateReconstructionInput["evidenceSnippets"] =
    [];
  for (const quote of input.whySourceQuotes ?? []) {
    const text = quote.trim();
    if (!text) continue;
    const pin =
      events.find((e) => e.afterRevisionId)?.afterRevisionId ??
      events.find((e) => e.beforeRevisionId)?.beforeRevisionId ??
      "quote:unpinned";
    evidenceSnippets.push({ revisionId: pin, text });
  }

  const reconInput: MatterStateReconstructionInput = {
    projectId: input.projectId,
    matterId: input.matterId,
    events,
    accepted: state.accepted,
    evidenceSnippets,
  };

  const now = new Date().toISOString();
  let run: AnalysisRun = {
    id: randomUUID(),
    projectId: input.projectId,
    matterId: input.matterId,
    trigger: input.trigger ?? "source_change",
    eventIds: events.map((e) => e.id),
    status: "running",
    attempt: 1,
    createdAt: now,
    updatedAt: now,
  };

  let body: UnderstandingBody;
  try {
    body = sanitizeModelBody(await model.propose(reconInput), reconInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : "model failed";
    body = buildDeterministicUnderstandingBody(reconInput);
    body = {
      ...body,
      now: { ...body.now, text: `${body.now.text}（模型失败）` },
      nextDecision: "需 Owner 判断",
    };
    run = {
      ...run,
      status: "awaiting_owner",
      error: message,
      updatedAt: new Date().toISOString(),
    };
  }

  // Project-scope pin filter via events + readRevision existence
  const validPins: string[] = [];
  for (const id of body.evidenceRevisionIds) {
    if (await revisionBelongsToProject(service, id, input.projectId)) {
      validPins.push(id);
    }
  }
  body = {
    ...body,
    evidenceRevisionIds: validPins,
    why: body.why.map(normalizeWhyClaim),
  };

  if (input.relatedActionIds?.length) {
    const extra = input.relatedActionIds.map((id) => ({
      kind: "action" as const,
      id,
      reason: "可能受影响的行动",
    }));
    body = { ...body, depends: [...body.depends, ...extra] };
  }

  if (!body.why.length) {
    body = {
      ...body,
      why: [{ text: WHY_UNKNOWN, status: "unknown", evidence: [] }],
    };
  }

  const candidate = await service.saveCandidate(run, body);
  run = {
    ...run,
    status: "awaiting_owner",
    updatedAt: new Date().toISOString(),
  };
  return { run, candidate };
}

export async function revisionBelongsToProject(
  reader: ProjectMemoryReader,
  revisionId: string,
  projectId: string,
): Promise<boolean> {
  const bytes = await reader.readRevision(revisionId);
  if (!bytes) return false;
  const events = await reader.listEvents(projectId);
  return events.some(
    (e) =>
      e.afterRevisionId === revisionId || e.beforeRevisionId === revisionId,
  );
}

export class OwnerOnlyResolutionError extends Error {
  readonly status = 403;
  constructor(message = "仅 Owner 可决议理解候选") {
    super(message);
    this.name = "OwnerOnlyResolutionError";
  }
}

export type ResolveInput = {
  candidateRevisionId: string;
  decision: "accept" | "edit_accept" | "reject";
  editedBody?: UnderstandingBody;
  /** Must be owner; agent or missing → 403 */
  actor: string;
};

/**
 * Owner resolution via OwnerDecisionWriter only.
 * accept/edit_accept INSERT new accepted revision (store plan); never mutates candidate.
 */
export async function resolveUnderstanding(
  writer: OwnerDecisionWriter,
  input: ResolveInput,
): Promise<{
  resolution: OwnerResolution;
  accepted?: UnderstandingRevision;
  head: MatterUnderstandingHead;
}> {
  if (input.actor !== "owner") {
    throw new OwnerOnlyResolutionError();
  }
  // Defense: writer surface must be resolveCandidate, not agent bag
  if (typeof writer.resolveCandidate !== "function") {
    throw new Error("OwnerDecisionWriter required");
  }
  if ("saveCandidate" in writer && "asAgentMemoryService" in (writer as object)) {
    // Full store is OK for owner route; agent facade is not.
  }

  const resolution: OwnerResolution = {
    id: randomUUID(),
    candidateRevisionId: input.candidateRevisionId,
    decision: input.decision,
    editedBody: input.editedBody,
    actor: "owner",
    createdAt: new Date().toISOString(),
  };
  return writer.resolveCandidate(resolution);
}

/** Default full store for process (routes pick agent vs owner surface). */
let defaultStore: SqliteProjectMemoryStore | null = null;

export function getDefaultSqliteStore(): SqliteProjectMemoryStore {
  if (!defaultStore) {
    const dataDir =
      process.env.PROJECT_MEMORY_DIR ??
      path.join(process.cwd(), ".data", "project-memory");
    defaultStore = openProjectMemoryStore(dataDir);
  }
  return defaultStore;
}

/** AnalysisRun / memory GET — Reader + CandidateWriter only. */
export function getAgentMemoryService(): AgentMemoryService {
  return getDefaultSqliteStore().asAgentMemoryService();
}

/** Resolve route — OwnerDecisionWriter only (full store implements the port). */
export function getOwnerDecisionWriter(): OwnerDecisionWriter {
  return getDefaultSqliteStore();
}

export function resetDefaultProjectMemoryStoreForTests(dataDir?: string): void {
  if (defaultStore) {
    try {
      defaultStore.close();
    } catch {
      /* ignore */
    }
  }
  defaultStore = dataDir ? openProjectMemoryStore(dataDir) : null;
}
