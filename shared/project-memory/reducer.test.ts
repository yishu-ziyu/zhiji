import { describe, expect, it } from "vitest";
import {
  applyOwnerResolution,
  ensureHonestWhy,
  HONEST_WHY_DEFAULT,
  markReviewNeededForEvidenceChange,
} from "./reducer";
import type { UnderstandingRevision } from "./types";

function candidate(
  overrides: Partial<UnderstandingRevision> = {},
): UnderstandingRevision {
  return {
    id: "u1",
    projectId: "p1",
    matterId: "m1",
    body: {
      now: "now",
      then: "then",
      changed: ["a"],
      why: "because source said X",
      depends: [],
      evidenceRevisionIds: ["sha256:aaa"],
      nextDecision: "next",
    },
    basedOnEventIds: ["e1"],
    status: "candidate",
    proposedBy: "agent",
    createdAt: "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("project-memory reducer", () => {
  it("owner accept supersedes prior accepted and keeps body", () => {
    const prior: UnderstandingRevision = {
      ...candidate({ id: "u0", status: "accepted", resolvedBy: "owner" }),
    };
    const result = applyOwnerResolution({
      candidate: candidate(),
      resolution: {
        id: "r1",
        understandingRevisionId: "u1",
        decision: "accept",
        actor: "owner",
        createdAt: "2026-07-16T01:00:00.000Z",
      },
      currentlyAccepted: [prior],
    });
    expect(result.resolved.status).toBe("accepted");
    expect(result.resolved.resolvedBy).toBe("owner");
    expect(result.supersededIds).toEqual(["u0"]);
  });

  it("edit_accept uses edited body without dropping evidence pins", () => {
    const edited = {
      now: "edited now",
      then: "then",
      changed: ["b"],
      why: "edited why",
      depends: [],
      evidenceRevisionIds: ["sha256:bbb"],
      nextDecision: "go",
    };
    const result = applyOwnerResolution({
      candidate: candidate(),
      resolution: {
        id: "r1",
        understandingRevisionId: "u1",
        decision: "edit_accept",
        editedBody: edited,
        actor: "owner",
        createdAt: "2026-07-16T01:00:00.000Z",
      },
      currentlyAccepted: [],
    });
    expect(result.resolved.body.now).toBe("edited now");
    expect(result.resolved.body.evidenceRevisionIds).toEqual(["sha256:bbb"]);
  });

  it("reject does not supersede accepted", () => {
    const prior = candidate({ id: "u0", status: "accepted" });
    const result = applyOwnerResolution({
      candidate: candidate(),
      resolution: {
        id: "r1",
        understandingRevisionId: "u1",
        decision: "reject",
        actor: "owner",
        createdAt: "2026-07-16T01:00:00.000Z",
      },
      currentlyAccepted: [prior],
    });
    expect(result.resolved.status).toBe("rejected");
    expect(result.supersededIds).toEqual([]);
  });

  it("rejects non-owner actor in pure reducer", () => {
    expect(() =>
      applyOwnerResolution({
        candidate: candidate(),
        resolution: {
          id: "r1",
          understandingRevisionId: "u1",
          decision: "accept",
          // @ts-expect-error intentional
          actor: "agent",
          createdAt: "2026-07-16T01:00:00.000Z",
        },
        currentlyAccepted: [],
      }),
    ).toThrow(/owner/i);
  });

  it("marks accepted understanding review_needed when evidence revision replaced", () => {
    const accepted = candidate({
      id: "u-acc",
      status: "accepted",
      body: {
        now: "n",
        then: "t",
        changed: [],
        why: "w",
        depends: [],
        evidenceRevisionIds: ["sha256:old", "sha256:other"],
        nextDecision: "d",
      },
    });
    const marked = markReviewNeededForEvidenceChange({
      accepted: [accepted],
      replacedRevisionIds: ["sha256:old"],
    });
    expect(marked).toHaveLength(1);
    expect(marked[0]!.status).toBe("review_needed");
    expect(marked[0]!.body.evidenceRevisionIds).toEqual([
      "sha256:old",
      "sha256:other",
    ]);
  });

  it("fills honest why default when empty", () => {
    const body = ensureHonestWhy({
      now: "n",
      then: "t",
      changed: [],
      why: "  ",
      depends: [],
      evidenceRevisionIds: [],
      nextDecision: "d",
    });
    expect(body.why).toBe(HONEST_WHY_DEFAULT);
  });
});
