/**
 * MVP V0 Task 4 — Agent state reconstruction + Owner resolution.
 * Uses shared runtime capability accessors (not a parallel store bootstrap).
 * AnalysisRun: AgentMemoryService only. Resolve: OwnerDecisionWriter only.
 */

import { randomUUID } from "node:crypto";
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
import type { MatterWatchSet } from "./types";
import {
  getSharedAgentMemoryService,
  getSharedOwnerDecisionWriter,
  getSharedProjectMemoryReader,
  getSharedProjectMemoryStore,
  resetSharedProjectMemoryStoreForTests,
} from "./runtime";
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
  /** Open candidate only — already-resolved candidates are excluded. */
  candidate: UnderstandingRevision | null;
  events: ChangeEvent[];
  six: UnderstandingBody | null;
};

export type MemoryViewOptions = {
  /** When true (default), hide candidates that already have an OwnerResolution. */
  excludeResolvedCandidates?: boolean;
  /** Injected for tests; production uses shared store accessor. */
  isCandidateResolved?: (candidateId: string) => boolean;
};

export async function getMemoryView(
  reader: ProjectMemoryReader,
  projectId: string,
  matterId: string,
  options: MemoryViewOptions = {},
): Promise<MemoryView | null> {
  try {
    const state = await reader.getMatterState(projectId, matterId);
    let candidate = state.candidate ?? null;
    const resolvedCheck =
      options.isCandidateResolved ?? defaultIsCandidateResolved;
    if (
      candidate &&
      options.excludeResolvedCandidates !== false &&
      resolvedCheck(candidate.id)
    ) {
      candidate = null;
    }
    const six = candidate?.body ?? state.accepted?.body ?? null;
    // Matter-relevant events only (not silent full project feed).
    const events = filterEventsForMatter(state.recentEvents, state);
    return {
      matter: state.matter,
      head: state.head,
      accepted: state.accepted ?? null,
      candidate,
      events,
      six,
    };
  } catch {
    return null;
  }
}

function defaultIsCandidateResolved(candidateId: string): boolean {
  try {
    const store = getSharedProjectMemoryStore();
    if (typeof store.isCandidateResolved === "function") {
      return store.isCandidateResolved(candidateId);
    }
  } catch {
    /* runtime not open */
  }
  return false;
}

function candidateAlreadyResolved(
  writer: OwnerDecisionWriter,
  candidateId: string,
): boolean {
  const w = writer as OwnerDecisionWriter & {
    isCandidateResolved?: (id: string) => boolean;
  };
  if (typeof w.isCandidateResolved === "function") {
    return w.isCandidateResolved(candidateId);
  }
  return defaultIsCandidateResolved(candidateId);
}

export type RunAnalysisInput = {
  projectId: string;
  matterId: string;
  eventIds?: string[];
  trigger?: AnalysisRun["trigger"];
  whySourceQuotes?: string[];
  relatedActionIds?: string[];
};

function pathMatchesPrefix(relativePath: string, prefix: string): boolean {
  const path = relativePath.replace(/\\/g, "/");
  const p = prefix.replace(/\\/g, "/").replace(/\/+$/, "");
  return path === p || path.startsWith(`${p}/`);
}

/**
 * Same relevance rules as grants.selectMatterEvents (inlined to avoid
 * pulling observer/@parcel/watcher into the Agent reconstruct graph).
 * Filters both implicit (all) and explicit eventId pools.
 */
export function filterEventsForMatter(
  allEvents: ChangeEvent[],
  state: MatterState,
  explicitEventIds?: string[],
  relatedActionIds?: string[],
): ChangeEvent[] {
  const pool = explicitEventIds?.length
    ? allEvents.filter((e) => explicitEventIds.includes(e.id))
    : allEvents;

  const evidenceIds = new Set(state.accepted?.body.evidenceRevisionIds ?? []);
  const linkedEventIds = new Set(relatedActionIds ?? []);
  const watchSet: MatterWatchSet | undefined = state.watchSet;
  const out: ChangeEvent[] = [];

  for (const event of pool) {
    let relevant = false;
    if (watchSet?.status === "active") {
      const excluded = watchSet.excludePathPrefixes.some((prefix) =>
        pathMatchesPrefix(event.relativePath, prefix),
      );
      const watched =
        !excluded &&
        watchSet.includePathPrefixes.some((prefix) =>
          pathMatchesPrefix(event.relativePath, prefix),
        );
      if (watched) relevant = true;
    }
    if (!relevant) {
      const revs = [event.beforeRevisionId, event.afterRevisionId].filter(
        (v): v is string => Boolean(v),
      );
      if (revs.some((id) => evidenceIds.has(id))) relevant = true;
      else if (linkedEventIds.has(event.id)) relevant = true;
    }
    if (relevant) out.push(event);
  }
  return out;
}

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
  const events = filterEventsForMatter(
    allEvents,
    state,
    input.eventIds,
    input.relatedActionIds,
  );

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

  // 无事件时禁止调模型编造英文空话：给短中文诚实结果。
  if (events.length === 0) {
    body = {
      now: {
        text: "目前还没有可核对的文件变化。",
        evidence: [],
        gaps: ["授权夹里暂无新的可读文件变化"],
        conflicts: [],
      },
      then: {
        text: state.accepted?.body.now.text ?? "还没有已确认的先前理解",
        at: state.accepted?.createdAt ?? "unknown",
        evidence: state.accepted?.body.now.evidence ?? [],
        gaps: state.accepted ? [] : ["尚无已确认理解"],
        conflicts: [],
      },
      changed: [
        {
          before: "",
          after: "未发现新的文件变化",
          eventIds: [],
          evidence: [],
        },
      ],
      why: [
        {
          text: "没有新的文件内容可供核对。只新建空文件夹通常不会记成变化。",
          status: "unknown",
          evidence: [],
        },
      ],
      depends: [],
      evidenceRevisionIds: [],
      nextDecision:
        "在文件夹中放入或修改文件后，再点「再读一遍变化」。不必对空结果强行确认。",
    };
    run = {
      ...run,
      status: "awaiting_owner",
      updatedAt: new Date().toISOString(),
    };
  } else try {
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

  const pathByRev = new Map<string, string>();
  for (const e of events) {
    if (e.afterRevisionId) {
      pathByRev.set(e.afterRevisionId, e.relativePath.replace(/\\/g, "/"));
    }
    if (e.beforeRevisionId) {
      pathByRev.set(e.beforeRevisionId, e.relativePath.replace(/\\/g, "/"));
    }
  }

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

  // Downgrade false supported claims; never abort the run.
  body = await verifySupportedWhyAgainstRevisions(service, body, pathByRev);

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

export function revisionBytesContainQuote(
  bytes: Uint8Array,
  quote: string,
): boolean {
  const q = quote.trim();
  if (!q) return false;
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).includes(q);
  } catch {
    return false;
  }
}

/**
 * supported requires exact quote in revision bytes and relativePath matching
 * the event/revision canonical path. Failures downgrade to unknown (no throw).
 */
export async function verifySupportedWhyAgainstRevisions(
  reader: ProjectMemoryReader,
  body: UnderstandingBody,
  pathByRev: Map<string, string> = new Map(),
): Promise<UnderstandingBody> {
  const why: UnderstandingBody["why"] = [];
  for (const claim of body.why ?? []) {
    if (claim.status !== "supported") {
      why.push(claim);
      continue;
    }
    let ok = claim.evidence.length > 0;
    for (const anchor of claim.evidence) {
      if (!ok) break;
      const claimedPath = anchor.relativePath?.replace(/\\/g, "/").trim();
      const canonical =
        pathByRev.get(anchor.revisionId)?.replace(/\\/g, "/") ?? claimedPath;
      if (!claimedPath || !canonical || claimedPath !== canonical) {
        ok = false;
        break;
      }
      try {
        const bytes = await reader.readRevision(anchor.revisionId);
        if (!bytes || !revisionBytesContainQuote(bytes, anchor.quote)) {
          ok = false;
        }
      } catch {
        ok = false;
      }
    }
    if (ok) {
      why.push(normalizeWhyClaim(claim));
    } else {
      why.push(
        normalizeWhyClaim({
          text: claim.text?.trim() || WHY_UNKNOWN,
          status: "unknown",
          evidence: [],
        }),
      );
    }
  }
  return { ...body, why };
}

export class OwnerOnlyResolutionError extends Error {
  readonly status = 403;
  constructor(message = "仅 Owner 可决议理解候选") {
    super(message);
    this.name = "OwnerOnlyResolutionError";
  }
}

export class ResolveValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ResolveValidationError";
  }
}

export type ResolveInput = {
  projectId: string;
  matterId: string;
  candidateRevisionId: string;
  decision: "accept" | "edit_accept" | "reject";
  editedBody?: UnderstandingBody;
  actor: string;
};

/**
 * Owner resolution via OwnerDecisionWriter only.
 * Requires projectId + matterId + candidateId; edit_accept requires editedBody.
 * Repeat resolve is idempotent (store one-shot resolution).
 */
export async function resolveUnderstanding(
  writer: OwnerDecisionWriter,
  reader: ProjectMemoryReader,
  input: ResolveInput,
): Promise<{
  resolution: OwnerResolution;
  accepted?: UnderstandingRevision;
  head: MatterUnderstandingHead;
}> {
  if (input.actor !== "owner") {
    throw new OwnerOnlyResolutionError();
  }
  if (typeof writer.resolveCandidate !== "function") {
    throw new Error("OwnerDecisionWriter required");
  }
  if (!input.projectId?.trim() || !input.matterId?.trim()) {
    throw new ResolveValidationError("projectId 与 matterId 必填");
  }
  if (!input.candidateRevisionId?.trim()) {
    throw new ResolveValidationError("candidateId 必填");
  }
  if (input.decision === "edit_accept" && !input.editedBody) {
    throw new ResolveValidationError("edit_accept 必须提供 editedBody");
  }

  let state: MatterState;
  try {
    state = await reader.getMatterState(input.projectId, input.matterId);
  } catch {
    throw new ResolveValidationError("事项不存在或不属于该项目");
  }
  if (state.matter.projectId !== input.projectId) {
    throw new ResolveValidationError("projectId 与事项不匹配");
  }

  const alreadyResolved = candidateAlreadyResolved(
    writer,
    input.candidateRevisionId,
  );

  if (state.candidate) {
    if (
      state.candidate.id === input.candidateRevisionId &&
      (state.candidate.projectId !== input.projectId ||
        state.candidate.matterId !== input.matterId)
    ) {
      throw new ResolveValidationError("candidate 不属于该 project/matter");
    }
    if (
      state.candidate.id !== input.candidateRevisionId &&
      !alreadyResolved
    ) {
      throw new ResolveValidationError("candidateId 与当前事项候选不一致");
    }
  } else if (!alreadyResolved && !state.accepted) {
    // No open candidate and never resolved → unknown target
    throw new ResolveValidationError("候选不存在");
  }

  const resolution: OwnerResolution = {
    id: randomUUID(),
    candidateRevisionId: input.candidateRevisionId,
    decision: input.decision,
    editedBody: input.editedBody,
    actor: "owner",
    createdAt: new Date().toISOString(),
  };

  const result = await writer.resolveCandidate(resolution);

  // Post-validate scope (covers idempotent path where open candidate is gone).
  if (result.accepted) {
    if (
      result.accepted.projectId !== input.projectId ||
      result.accepted.matterId !== input.matterId
    ) {
      throw new ResolveValidationError("决议结果不属于该 project/matter");
    }
  }
  if (result.resolution.candidateRevisionId !== input.candidateRevisionId) {
    throw new ResolveValidationError("决议 candidateId 不匹配");
  }
  if (result.head.matterId !== input.matterId) {
    throw new ResolveValidationError("head.matterId 不匹配");
  }

  return result;
}

/** @deprecated Prefer capability accessors. Boot/tests only. */
export function getDefaultSqliteStore() {
  return getSharedProjectMemoryStore();
}

export function getAgentMemoryService(): AgentMemoryService {
  return getSharedAgentMemoryService();
}

export function getProjectMemoryReader(): ProjectMemoryReader {
  return getSharedProjectMemoryReader();
}

export function getOwnerDecisionWriter(): OwnerDecisionWriter {
  return getSharedOwnerDecisionWriter();
}

export function resetDefaultProjectMemoryStoreForTests(dataDir?: string): void {
  resetSharedProjectMemoryStoreForTests(dataDir);
}
