/**
 * Claim–Evidence first-class types (PR-12 / Epic E).
 * Compatible projection to legacy UnderstandingBody remains elsewhere.
 */

export type ClaimSupportStatus =
  | "supported"
  | "partially_supported"
  | "unsupported"
  | "conflicted"
  | "owner_stated"
  | "unknown";

export type EvidenceRelation =
  | "supports"
  | "contradicts"
  | "background"
  | "neutral";

export type PreciseEvidenceAnchor = {
  id: string;
  projectId: string;
  revisionId: string;
  contentHash?: string;
  relativePath: string;
  /** 1-based inclusive line range when available */
  startLine?: number;
  endLine?: number;
  /** Byte offsets when line numbers unavailable */
  startOffset?: number;
  endOffset?: number;
  quote: string;
  lastVerifiedAt?: string;
};

export type ClaimEvidenceLink = {
  id: string;
  claimId: string;
  anchorId: string;
  relation: EvidenceRelation;
  /** Optional human note: why this quote supports/contradicts */
  rationale?: string;
};

export type Claim = {
  id: string;
  projectId: string;
  matterId?: string;
  runId?: string;
  text: string;
  status: ClaimSupportStatus;
  /** Links must be consulted for supported/conflicted */
  linkIds: string[];
  createdAt: string;
  supersedesClaimId?: string;
};

export type ConflictSet = {
  id: string;
  projectId: string;
  claimIds: string[];
  summary: string;
  createdAt: string;
  resolvedAt?: string;
};

export type OwnerResolutionDecision =
  | "accept"
  | "accept_edited"
  | "reject"
  | "defer";

export type OwnerResolution = {
  id: string;
  projectId: string;
  claimId: string;
  decision: OwnerResolutionDecision;
  editedText?: string;
  note?: string;
  resolvedAt: string;
};

/** Durable per-candidate Claim decision stored in Project Memory SQLite. */
export type PersistedClaimResolution = OwnerResolution & {
  candidateRevisionId: string;
  matterId: string;
  claimText: string;
  resultingClaimStatus: ClaimSupportStatus;
  runId?: string;
  understandingResolutionId?: string;
};

export type ClaimBundle = {
  claims: Claim[];
  anchors: PreciseEvidenceAnchor[];
  links: ClaimEvidenceLink[];
  conflicts: ConflictSet[];
  resolutions: OwnerResolution[];
};

/** Invariant: supported claim must have ≥1 supports link. */
export function claimHasSupportLink(
  claim: Claim,
  links: ClaimEvidenceLink[],
): boolean {
  if (claim.status === "owner_stated") return true;
  if (claim.status !== "supported" && claim.status !== "partially_supported") {
    return true;
  }
  return links.some(
    (l) =>
      l.claimId === claim.id &&
      claim.linkIds.includes(l.id) &&
      l.relation === "supports",
  );
}

export function demoteUnsupportedClaims(
  claims: Claim[],
  links: ClaimEvidenceLink[],
): Claim[] {
  return claims.map((c) => {
    if (
      (c.status === "supported" || c.status === "partially_supported") &&
      !claimHasSupportLink(c, links)
    ) {
      return { ...c, status: "unsupported" as const };
    }
    return c;
  });
}
