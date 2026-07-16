/**
 * PR-14/15 bridge: Claim list from UnderstandingBody (candidate).
 * Pure — no fetch. claim ids must include candidateRevisionId.
 */
import { buildClaimBundleFromWhy } from "@/shared/project-memory/claims/claim-service";
import type { Claim } from "@/shared/project-memory/claims/types";
import type {
  EvidenceAnchor,
  UnderstandingBody,
} from "@/shared/project-memory/types";

export type CandidateClaimsInput = {
  projectId: string;
  matterId?: string;
  runId?: string;
  /** Required for scoped claim ids (truth path). */
  candidateRevisionId?: string;
  body: UnderstandingBody | null | undefined;
  now?: string;
  /** Prefer server-hydrated revision texts when available. */
  revisionTexts?: Record<string, string>;
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

/**
 * Returns claims for ClaimReviewPanel, or [] when body has no why rows.
 * When candidateRevisionId is set, claim.id = claim:<candId>:why:<i>:<hash>.
 */
export function candidateClaimsFromBody(input: CandidateClaimsInput): Claim[] {
  if (!input.body) return [];
  if (!input.projectId.trim()) return [];
  const pins = collectBodyPins(input.body);
  const bundle = buildClaimBundleFromWhy(input.body, pins, {
    projectId: input.projectId,
    matterId: input.matterId,
    runId: input.runId,
    now: input.now,
    candidateRevisionId: input.candidateRevisionId,
    revisionTexts: input.revisionTexts,
  });
  return bundle.claims;
}

export function hasReviewableClaims(claims: Claim[]): boolean {
  return claims.length > 0;
}
