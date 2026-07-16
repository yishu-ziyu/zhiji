/**
 * Pure Project Memory transitions (immutable revisions + head moves).
 * Never mutates UnderstandingRevision rows in place — callers INSERT + move head.
 */
import { randomUUID } from "node:crypto";
import type {
  MatterUnderstandingHead,
  OwnerResolution,
  UnderstandingBody,
  UnderstandingRevision,
  WhyClaim,
} from "./types";

export type OwnerResolvePlan = {
  /** New accepted revision to INSERT (accept/edit_accept only). */
  acceptedToInsert?: UnderstandingRevision;
  /** Candidate row is left unchanged forever. */
  candidateId: string;
  resolution: OwnerResolution;
  nextHead: MatterUnderstandingHead;
};

/**
 * Plan Owner resolution without UPDATE of candidate/accepted bodies.
 * accept/edit_accept → new accepted revision; reject → head unchanged, resolution only.
 */
export function planOwnerResolution(input: {
  candidate: UnderstandingRevision;
  resolution: OwnerResolution;
  currentHead: MatterUnderstandingHead;
  nowIso?: string;
}): OwnerResolvePlan {
  const { candidate, resolution, currentHead } = input;
  if (resolution.actor !== "owner") {
    throw new Error("only owner may resolve understanding");
  }
  if (candidate.kind !== "candidate") {
    throw new Error("can only resolve a candidate revision");
  }
  if (resolution.candidateRevisionId !== candidate.id) {
    throw new Error("resolution target mismatch");
  }

  const now = input.nowIso ?? resolution.createdAt ?? new Date().toISOString();

  if (resolution.decision === "reject") {
    return {
      candidateId: candidate.id,
      resolution: { ...resolution },
      nextHead: { ...currentHead, updatedAt: now },
    };
  }

  const body: UnderstandingBody =
    resolution.decision === "edit_accept" && resolution.editedBody
      ? resolution.editedBody
      : candidate.body;

  const acceptedId = randomUUID();
  const accepted: UnderstandingRevision = {
    id: acceptedId,
    projectId: candidate.projectId,
    matterId: candidate.matterId,
    kind: "accepted",
    previousAcceptedRevisionId: currentHead.acceptedRevisionId,
    body,
    basedOnEventIds: [...candidate.basedOnEventIds],
    proposedBy: resolution.decision === "edit_accept" ? "owner" : candidate.proposedBy,
    createdAt: now,
  };

  const resolutionOut: OwnerResolution = {
    ...resolution,
    acceptedRevisionId: acceptedId,
  };

  const nextHead: MatterUnderstandingHead = {
    matterId: candidate.matterId,
    acceptedRevisionId: acceptedId,
    reviewState: "current",
    reviewReasonEventIds: [],
    updatedAt: now,
  };

  return {
    acceptedToInsert: accepted,
    candidateId: candidate.id,
    resolution: resolutionOut,
    nextHead,
  };
}

/**
 * When accepted evidence revision is replaced by a newer original, only head moves
 * to review_needed — accepted UnderstandingRevision rows stay immutable.
 */
export function planHeadReviewNeeded(input: {
  head: MatterUnderstandingHead;
  accepted: UnderstandingRevision | null;
  replacedRevisionIds: string[];
  reasonEventId?: string;
  nowIso?: string;
}): MatterUnderstandingHead | null {
  if (!input.accepted || !input.head.acceptedRevisionId) return null;
  if (input.accepted.id !== input.head.acceptedRevisionId) return null;
  const replaced = new Set(input.replacedRevisionIds);
  if (replaced.size === 0) return null;
  const cites = input.accepted.body.evidenceRevisionIds.some((id) =>
    replaced.has(id),
  );
  if (!cites) return null;

  const reasonIds = [...input.head.reviewReasonEventIds];
  if (input.reasonEventId && !reasonIds.includes(input.reasonEventId)) {
    reasonIds.push(input.reasonEventId);
  }
  return {
    ...input.head,
    reviewState: "review_needed",
    reviewReasonEventIds: reasonIds,
    updatedAt: input.nowIso ?? new Date().toISOString(),
  };
}

export const HONEST_WHY_DEFAULT = "原因尚无可核对依据";

export function ensureHonestWhy(body: UnderstandingBody): UnderstandingBody {
  const why: WhyClaim[] = body.why.map((w) => {
    if (w.status === "supported" && (!w.evidence.length || w.evidence.some((e) => !e.quote.trim()))) {
      return {
        text: w.text.trim() || HONEST_WHY_DEFAULT,
        status: "unknown" as const,
        evidence: w.evidence.filter((e) => e.quote.trim()),
      };
    }
    if (!w.text.trim() && w.status !== "supported") {
      return { ...w, text: HONEST_WHY_DEFAULT, status: "unknown" as const };
    }
    return w;
  });
  if (why.length === 0) {
    why.push({
      text: HONEST_WHY_DEFAULT,
      status: "unknown",
      evidence: [],
    });
  }
  return { ...body, why };
}

/** Agent service must not expose OwnerDecisionWriter. */
export function assertAgentServiceShape(service: object): void {
  if ("resolveCandidate" in service || "resolve" in service) {
    throw new Error(
      "AgentMemoryService must not expose OwnerDecisionWriter methods",
    );
  }
}
