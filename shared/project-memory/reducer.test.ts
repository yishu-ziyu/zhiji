import { describe, expect, it } from "vitest";
import {
  assertAgentServiceShape,
  ensureHonestWhy,
  HONEST_WHY_DEFAULT,
  planHeadReviewNeeded,
  planOwnerResolution,
} from "./reducer";
import type {
  MatterUnderstandingHead,
  UnderstandingBody,
  UnderstandingRevision,
} from "./types";

function sampleBody(
  evidenceRevisionIds: string[] = ["sha256:aaa"],
): UnderstandingBody {
  return {
    now: {
      text: "now",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    then: {
      text: "then",
      at: "2026-07-01T00:00:00.000Z",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [],
    why: [
      {
        text: "because source said X",
        status: "supported",
        evidence: [
          {
            revisionId: evidenceRevisionIds[0]!,
            relativePath: "SPEC.md",
            quote: "exact quote",
            lastVerifiedAt: "2026-07-16T00:00:00.000Z",
          },
        ],
      },
    ],
    depends: [],
    evidenceRevisionIds,
    nextDecision: "next",
  };
}

function candidate(
  overrides: Partial<UnderstandingRevision> = {},
): UnderstandingRevision {
  return {
    id: "cand-1",
    projectId: "p1",
    matterId: "m1",
    kind: "candidate",
    body: sampleBody(),
    basedOnEventIds: ["e1"],
    proposedBy: "agent",
    createdAt: "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

const emptyHead = (): MatterUnderstandingHead => ({
  matterId: "m1",
  reviewState: "current",
  reviewReasonEventIds: [],
  updatedAt: "2026-07-16T00:00:00.000Z",
});

describe("project-memory reducer (immutable revisions)", () => {
  it("accept plans NEW accepted revision and moves head; candidate id untouched", () => {
    const head = {
      ...emptyHead(),
      acceptedRevisionId: "old-accepted",
    };
    const plan = planOwnerResolution({
      candidate: candidate(),
      resolution: {
        id: "r1",
        candidateRevisionId: "cand-1",
        decision: "accept",
        actor: "owner",
        createdAt: "2026-07-16T01:00:00.000Z",
      },
      currentHead: head,
    });
    expect(plan.acceptedToInsert?.kind).toBe("accepted");
    expect(plan.acceptedToInsert?.id).not.toBe("cand-1");
    expect(plan.acceptedToInsert?.previousAcceptedRevisionId).toBe(
      "old-accepted",
    );
    expect(plan.candidateId).toBe("cand-1");
    expect(plan.nextHead.acceptedRevisionId).toBe(plan.acceptedToInsert!.id);
    expect(plan.nextHead.reviewState).toBe("current");
    expect(plan.resolution.acceptedRevisionId).toBe(plan.acceptedToInsert!.id);
  });

  it("edit_accept uses edited body on the NEW accepted revision only", () => {
    const edited = sampleBody(["sha256:bbb"]);
    edited.now.text = "edited now";
    const plan = planOwnerResolution({
      candidate: candidate(),
      resolution: {
        id: "r1",
        candidateRevisionId: "cand-1",
        decision: "edit_accept",
        editedBody: edited,
        actor: "owner",
        createdAt: "2026-07-16T01:00:00.000Z",
      },
      currentHead: emptyHead(),
    });
    expect(plan.acceptedToInsert?.body.now.text).toBe("edited now");
    expect(plan.acceptedToInsert?.proposedBy).toBe("owner");
  });

  it("reject does not create accepted revision or move head accepted pointer", () => {
    const head = { ...emptyHead(), acceptedRevisionId: "keep" };
    const plan = planOwnerResolution({
      candidate: candidate(),
      resolution: {
        id: "r1",
        candidateRevisionId: "cand-1",
        decision: "reject",
        actor: "owner",
        createdAt: "2026-07-16T01:00:00.000Z",
      },
      currentHead: head,
    });
    expect(plan.acceptedToInsert).toBeUndefined();
    expect(plan.nextHead.acceptedRevisionId).toBe("keep");
  });

  it("evidence change only updates head reviewState, not revision body", () => {
    const accepted = candidate({
      id: "acc-1",
      kind: "accepted",
      body: sampleBody(["sha256:old"]),
    });
    const head: MatterUnderstandingHead = {
      matterId: "m1",
      acceptedRevisionId: "acc-1",
      reviewState: "current",
      reviewReasonEventIds: [],
      updatedAt: "2026-07-16T00:00:00.000Z",
    };
    const next = planHeadReviewNeeded({
      head,
      accepted,
      replacedRevisionIds: ["sha256:old"],
      reasonEventId: "evt-9",
    });
    expect(next?.reviewState).toBe("review_needed");
    expect(next?.reviewReasonEventIds).toContain("evt-9");
    expect(accepted.kind).toBe("accepted");
    expect(accepted.body.evidenceRevisionIds).toEqual(["sha256:old"]);
  });

  it("fills honest unknown why when supported without quote", () => {
    const body = ensureHonestWhy({
      ...sampleBody(),
      why: [
        {
          text: "guess",
          status: "supported",
          evidence: [
            {
              revisionId: "sha256:aaa",
              relativePath: "x",
              quote: "",
              lastVerifiedAt: "t",
            },
          ],
        },
      ],
    });
    expect(body.why[0]!.status).toBe("unknown");
  });

  it("assertAgentServiceShape rejects resolve methods", () => {
    expect(() =>
      assertAgentServiceShape({
        readRevision: async () => null,
        resolveCandidate: async () => ({}),
      }),
    ).toThrow(/OwnerDecisionWriter|must not expose/i);
    expect(() =>
      assertAgentServiceShape({
        readRevision: async () => null,
        listEvents: async () => [],
        getMatterState: async () => ({}),
        saveCandidate: async () => ({}),
      }),
    ).not.toThrow();
  });

  it("empty why becomes honest default", () => {
    const body = ensureHonestWhy({
      ...sampleBody(),
      why: [],
    });
    expect(body.why[0]!.text).toBe(HONEST_WHY_DEFAULT);
    expect(body.why[0]!.status).toBe("unknown");
  });
});
