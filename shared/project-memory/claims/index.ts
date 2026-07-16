/**
 * Claims domain barrel (PR-12 + SQLite-backed Owner resolution).
 */
export type {
  Claim,
  ClaimBundle,
  ClaimEvidenceLink,
  ClaimSupportStatus,
  ConflictSet,
  EvidenceRelation,
  OwnerResolution,
  OwnerResolutionDecision,
  PersistedClaimResolution,
  PreciseEvidenceAnchor,
} from "./types";

export {
  claimHasSupportLink,
  demoteUnsupportedClaims,
} from "./types";

export {
  applyOwnerResolution,
  buildClaimBundleFromWhy,
  canLinkAsSupports,
  quoteAppearsInRevision,
} from "./claim-service";

export {
  claimReviewActionsEnabled,
  planClaimReviewAction,
} from "./claim-review-policy";

export {
  findClaimInBundle,
  hydrateClaimBundleFromCandidateBody,
  hydrateClaimsFromCandidateBody,
  loadRevisionTextsFromCas,
  resolveClaimDecision,
} from "./resolve-claim";

export { makeWhyClaimId } from "./claim-service";
