/**
 * Pure Project Memory state transitions (understanding resolution + review).
 * No I/O — sqlite-store applies results transactionally.
 */
import type {
  OwnerResolution,
  UnderstandingBody,
  UnderstandingRevision,
} from "./types";

export type ResolveTransition = {
  resolved: UnderstandingRevision;
  supersededIds: string[];
};

/**
 * Apply Owner resolution to a candidate understanding.
 * Agent self-accept is rejected by caller (actor check); this only models Owner.
 */
export function applyOwnerResolution(input: {
  candidate: UnderstandingRevision;
  resolution: OwnerResolution;
  /** Currently accepted revisions for this matter (to supersede on accept). */
  currentlyAccepted: UnderstandingRevision[];
  nowIso?: string;
}): ResolveTransition {
  const { candidate, resolution, currentlyAccepted } = input;
  if (resolution.actor !== "owner") {
    throw new Error("only owner may resolve understanding");
  }
  if (candidate.status !== "candidate" && candidate.status !== "review_needed") {
    throw new Error(
      `cannot resolve understanding in status ${candidate.status}`,
    );
  }
  if (resolution.understandingRevisionId !== candidate.id) {
    throw new Error("resolution target mismatch");
  }

  const now = input.nowIso ?? new Date().toISOString();
  const body: UnderstandingBody =
    resolution.decision === "edit_accept" && resolution.editedBody
      ? resolution.editedBody
      : candidate.body;

  if (resolution.decision === "reject") {
    return {
      resolved: {
        ...candidate,
        status: "rejected",
        resolvedAt: now,
        resolvedBy: "owner",
      },
      supersededIds: [],
    };
  }

  // accept | edit_accept
  const supersededIds = currentlyAccepted
    .filter((r) => r.id !== candidate.id)
    .map((r) => r.id);

  return {
    resolved: {
      ...candidate,
      body,
      status: "accepted",
      previousRevisionId:
        candidate.previousRevisionId ??
        currentlyAccepted.find((r) => r.status === "accepted")?.id,
      resolvedAt: now,
      resolvedBy: "owner",
    },
    supersededIds,
  };
}

/**
 * When a path gains a new non-tombstone revision, accepted understandings
 * that cited the prior revision become review_needed (body and old ids kept).
 */
export function markReviewNeededForEvidenceChange(input: {
  accepted: UnderstandingRevision[];
  /** Prior revision ids that are no longer the tip for their path. */
  replacedRevisionIds: string[];
}): UnderstandingRevision[] {
  const replaced = new Set(input.replacedRevisionIds);
  if (replaced.size === 0) return [];
  return input.accepted
    .filter((u) => u.status === "accepted")
    .filter((u) =>
      u.body.evidenceRevisionIds.some((id) => replaced.has(id)),
    )
    .map((u) => ({
      ...u,
      status: "review_needed" as const,
    }));
}

/** Default honest why when no citable source sentence exists. */
export const HONEST_WHY_DEFAULT = "原因尚无可核对依据";

export function ensureHonestWhy(body: UnderstandingBody): UnderstandingBody {
  const why = body.why?.trim();
  if (!why) {
    return { ...body, why: HONEST_WHY_DEFAULT };
  }
  return body;
}
