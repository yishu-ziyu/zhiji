/**
 * Claim → Project Memory truth path (no second ledger).
 * Client claimText/status are never trusted; body comes from candidate revision.
 */
import { randomUUID } from "node:crypto";
import {
  resolveUnderstanding,
  type ResolveInput,
} from "../reconstruct";
import type {
  EvidenceAnchor,
  MatterUnderstandingHead,
  OwnerDecisionWriter,
  OwnerResolution as MemoryOwnerResolution,
  ProjectMemoryReader,
  UnderstandingBody,
  UnderstandingRevision,
} from "../types";
import { buildClaimBundleFromWhy, makeWhyClaimId } from "./claim-service";
import { applyOwnerResolution } from "./claim-service";
import type {
  Claim,
  ClaimBundle,
  PersistedClaimResolution,
} from "./types";

export type HydrateClaimsInput = {
  projectId: string;
  matterId: string;
  candidateRevisionId: string;
  body: UnderstandingBody;
  revisionTexts: Record<string, string>;
  runId?: string;
  now?: string;
};

function collectBodyPins(body: UnderstandingBody): EvidenceAnchor[] {
  const out: EvidenceAnchor[] = [];
  const push = (list?: EvidenceAnchor[]) => {
    for (const a of list ?? []) out.push(a);
  };
  push(body.now?.evidence);
  push(body.then?.evidence);
  for (const w of body.why ?? []) push(w.evidence);
  for (const c of body.changed ?? []) push(c.evidence);
  return out;
}

export function collectEvidenceRevisionIds(
  body: UnderstandingBody,
): string[] {
  const ids = new Set<string>();
  for (const id of body.evidenceRevisionIds ?? []) {
    if (id?.trim()) ids.add(id.trim());
  }
  for (const pin of collectBodyPins(body)) {
    if (pin.revisionId?.trim()) ids.add(pin.revisionId.trim());
  }
  return [...ids];
}

/**
 * Build claims for a fixed candidate. Ids include candidateRevisionId.
 */
export function hydrateClaimsFromCandidateBody(
  input: HydrateClaimsInput,
): Claim[] {
  return hydrateClaimBundleFromCandidateBody(input).claims;
}

export function hydrateClaimBundleFromCandidateBody(
  input: HydrateClaimsInput,
): ClaimBundle {
  const pins = collectBodyPins(input.body);
  return buildClaimBundleFromWhy(input.body, pins, {
    projectId: input.projectId,
    matterId: input.matterId,
    runId: input.runId,
    now: input.now,
    candidateRevisionId: input.candidateRevisionId,
    revisionTexts: input.revisionTexts,
  });
}

export function findClaimInBundle(
  claims: Claim[],
  claimId: string,
): Claim | null {
  const id = claimId.trim();
  return claims.find((c) => c.id === id) ?? null;
}

export async function loadRevisionTextsFromCas(
  reader: ProjectMemoryReader,
  body: UnderstandingBody,
): Promise<Record<string, string>> {
  const texts: Record<string, string> = {};
  for (const revisionId of collectEvidenceRevisionIds(body)) {
    try {
      const bytes = await reader.readRevision(revisionId);
      if (bytes && bytes.byteLength > 0) {
        texts[revisionId] = new TextDecoder("utf-8", {
          fatal: false,
        }).decode(bytes);
      } else {
        texts[revisionId] = "";
      }
    } catch {
      texts[revisionId] = "";
    }
  }
  return texts;
}

export type ResolveClaimDecisionInput = {
  projectId: string;
  matterId: string;
  candidateRevisionId: string;
  claimId: string;
  decision: "accept" | "accept_edited" | "reject" | "defer";
  reader: ProjectMemoryReader;
  writer: OwnerDecisionWriter;
  decisionStore: ClaimDecisionStore;
  note?: string;
  /** Required when decision is accept_edited. */
  editedText?: string;
};

export type ClaimDecisionStore = {
  saveClaimResolutionRecord(
    row: PersistedClaimResolution,
  ): PersistedClaimResolution | Promise<PersistedClaimResolution>;
  listClaimResolutionRecords(
    projectId: string,
    filter?: { candidateRevisionId?: string },
  ): PersistedClaimResolution[] | Promise<PersistedClaimResolution[]>;
  linkClaimResolutionRecords(
    candidateRevisionId: string,
    understandingResolutionId: string,
  ): void | Promise<void>;
};

export type ResolveClaimDecisionResult = {
  claim: Claim;
  understanding?: {
    resolution: MemoryOwnerResolution;
    accepted?: UnderstandingRevision;
    head: MatterUnderstandingHead;
  };
  /** Audit projection — written only after understanding resolve. */
  audit: PersistedClaimResolution;
  finalized: boolean;
  remaining: number;
};

const FINALIZING_DECISIONS = new Set([
  "accept",
  "accept_edited",
  "reject",
]);

/**
 * Persist one claim decision. The candidate head advances only after every
 * claim has a finalizing decision (accept / accept_edited / reject).
 * defer is durable and refresh-visible but does not finalize the whole body.
 */
export async function resolveClaimDecision(
  input: ResolveClaimDecisionInput,
): Promise<ResolveClaimDecisionResult> {
  const projectId = input.projectId.trim();
  const matterId = input.matterId.trim();
  const candidateRevisionId = input.candidateRevisionId.trim();
  const claimId = input.claimId.trim();
  if (!projectId || !matterId || !candidateRevisionId || !claimId) {
    throw new Error("projectId、matterId、candidateRevisionId、claimId 均必填");
  }
  const allowed = ["accept", "accept_edited", "reject", "defer"] as const;
  if (!allowed.includes(input.decision as (typeof allowed)[number])) {
    throw new Error(
      "decision 仅支持 accept | accept_edited | reject | defer",
    );
  }

  const state = await input.reader.getMatterState(projectId, matterId);
  if (state.matter.projectId !== projectId) {
    throw new Error("事项不属于该项目");
  }
  const candidate = state.candidate;
  if (!candidate || candidate.id !== candidateRevisionId) {
    throw new Error("候选不存在或 candidateRevisionId 不匹配");
  }
  if (candidate.projectId !== projectId || candidate.matterId !== matterId) {
    throw new Error("候选不属于该 project/matter");
  }

  const revisionTexts = await loadRevisionTextsFromCas(
    input.reader,
    candidate.body,
  );
  const claims = hydrateClaimsFromCandidateBody({
    projectId,
    matterId,
    candidateRevisionId,
    body: candidate.body,
    revisionTexts,
  });
  const claim = findClaimInBundle(claims, claimId);
  if (!claim) {
    throw new Error("claimId 不属于该候选理解（服务端校验失败）");
  }

  const applied = applyOwnerResolution(claim, input.decision, {
    projectId,
    note: input.note,
    editedText: input.editedText,
    id: `ores-claim:${randomUUID()}`,
  });
  if (!applied.ok) throw new Error(applied.reason);
  const audit = await input.decisionStore.saveClaimResolutionRecord({
    ...applied.resolution,
    projectId,
    matterId,
    candidateRevisionId,
    claimText: applied.claim.text,
    resultingClaimStatus: applied.claim.status,
    runId: claim.runId,
  });

  const decisions = await input.decisionStore.listClaimResolutionRecords(
    projectId,
    { candidateRevisionId },
  );
  const decisionByClaim = new Map(decisions.map((row) => [row.claimId, row]));
  // defer counts as persisted but not finalizing — still remaining for Accepted.
  const remaining = claims.filter((row) => {
    const d = decisionByClaim.get(row.id)?.decision;
    return !d || !FINALIZING_DECISIONS.has(d);
  }).length;
  if (remaining > 0) {
    return {
      claim: applied.claim,
      audit,
      finalized: false,
      remaining,
    };
  }

  const acceptedIndexes = claims
    .map((row, index) => {
      const d = decisionByClaim.get(row.id)?.decision;
      return d === "accept" || d === "accept_edited" ? index : -1;
    })
    .filter((index) => index >= 0);

  const whyForAccepted = acceptedIndexes.map((index) => {
    const row = candidate.body.why[index]!;
    const decision = decisionByClaim.get(claims[index]!.id);
    if (decision?.decision === "accept_edited" && decision.editedText?.trim()) {
      return { ...row, text: decision.editedText.trim() };
    }
    return row;
  });

  const resolveInput: ResolveInput = {
    projectId,
    matterId,
    candidateRevisionId,
    decision:
      acceptedIndexes.length === 0
        ? "reject"
        : acceptedIndexes.length === claims.length
          ? "accept"
          : "edit_accept",
    editedBody:
      acceptedIndexes.length > 0 && acceptedIndexes.length < claims.length
        ? {
            ...candidate.body,
            why: whyForAccepted,
          }
        : acceptedIndexes.length === claims.length &&
            decisions.some((d) => d.decision === "accept_edited")
          ? {
              ...candidate.body,
              why: whyForAccepted,
            }
          : undefined,
    actor: "owner",
  };
  // When all accepted but some accept_edited, still need edited body for text.
  if (
    resolveInput.decision === "accept" &&
    decisions.some((d) => d.decision === "accept_edited")
  ) {
    resolveInput.decision = "edit_accept";
    resolveInput.editedBody = {
      ...candidate.body,
      why: whyForAccepted,
    };
  }

  const understanding = await resolveUnderstanding(
    input.writer,
    input.reader,
    resolveInput,
  );
  await input.decisionStore.linkClaimResolutionRecords(
    candidateRevisionId,
    understanding.resolution.id,
  );

  return {
    claim: applied.claim,
    understanding,
    audit: {
      ...audit,
      understandingResolutionId: understanding.resolution.id,
    },
    finalized: true,
    remaining: 0,
  };
}

export { makeWhyClaimId };
