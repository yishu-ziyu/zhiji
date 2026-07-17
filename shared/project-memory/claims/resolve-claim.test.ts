import { describe, expect, it } from "vitest";
import type {
  OwnerDecisionWriter,
  ProjectMemoryReader,
  UnderstandingBody,
  UnderstandingRevision,
} from "../types";
import {
  findClaimInBundle,
  hydrateClaimsFromCandidateBody,
  makeWhyClaimId,
  resolveClaimDecision,
  type ClaimDecisionStore,
} from "./resolve-claim";

const NOW = "2026-07-17T05:00:00.000Z";

function body(why: UnderstandingBody["why"]): UnderstandingBody {
  return {
    now: { text: "n", evidence: [], gaps: [], conflicts: [] },
    then: {
      text: "t",
      at: "2026-07-01T00:00:00.000Z",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [],
    why,
    depends: [],
    evidenceRevisionIds: [],
    nextDecision: "next",
  };
}

describe("hydrateClaimsFromCandidateBody (truth-scoped ids)", () => {
  it("claim id includes candidateRevisionId", () => {
    const candId = "cand-rev-abc";
    const claims = hydrateClaimsFromCandidateBody({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: candId,
      now: NOW,
      body: body([
        { text: "命题甲", status: "supported", evidence: [] },
      ]),
      revisionTexts: {},
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]!.id).toBe(makeWhyClaimId(0, "命题甲", candId));
    expect(claims[0]!.id).toContain(candId);
    expect(claims[0]!.id).toMatch(/^claim:cand-rev-abc:why:0:/);
  });

  it("findClaimInBundle rejects foreign claimId (not in this candidate)", () => {
    const candId = "cand-1";
    const claims = hydrateClaimsFromCandidateBody({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: candId,
      now: NOW,
      body: body([
        { text: "真实命题", status: "unknown", evidence: [] },
      ]),
      revisionTexts: {},
    });
    expect(findClaimInBundle(claims, claims[0]!.id)).not.toBeNull();
    expect(
      findClaimInBundle(claims, "claim:other-cand:why:0:deadbeef"),
    ).toBeNull();
    expect(
      findClaimInBundle(claims, makeWhyClaimId(0, "真实命题", "other-cand")),
    ).toBeNull();
  });
});

describe("resolveClaimDecision (per-claim truth)", () => {
  it("does not resolve the whole candidate until every claim has a decision", async () => {
    const candidate: UnderstandingRevision = {
      id: "cand-1",
      projectId: "p1",
      matterId: "m1",
      kind: "candidate",
      body: body([
        { text: "保留甲", status: "unknown", evidence: [] },
        { text: "删除乙", status: "unknown", evidence: [] },
      ]),
      basedOnEventIds: [],
      proposedBy: "agent",
      createdAt: NOW,
    };
    const reader: ProjectMemoryReader = {
      async readRevision() { return null; },
      async listEvents() { return []; },
      async getMatterState() {
        return {
          matter: {
            id: "m1",
            projectId: "p1",
            title: "m",
            goal: "g",
            status: "active",
            createdAt: NOW,
            updatedAt: NOW,
          },
          head: {
            matterId: "m1",
            reviewState: "review_needed",
            reviewReasonEventIds: [],
            updatedAt: NOW,
          },
          candidate,
          recentEvents: [],
        };
      },
    };
    const rows = new Map<string, import("./types").PersistedClaimResolution>();
    const decisionStore: ClaimDecisionStore = {
      saveClaimResolutionRecord(row) {
        rows.set(row.claimId, row);
        return row;
      },
      listClaimResolutionRecords() {
        return [...rows.values()];
      },
      linkClaimResolutionRecords() {},
    };
    const resolvedInputs: Array<
      Parameters<OwnerDecisionWriter["resolveCandidate"]>[0]
    > = [];
    const writer: OwnerDecisionWriter = {
      async resolveCandidate(input) {
        resolvedInputs.push(input);
        return {
          resolution: input,
          accepted: undefined,
          head: {
            matterId: "m1",
            reviewState: "current",
            reviewReasonEventIds: [],
            updatedAt: input.createdAt,
          },
        };
      },
    };
    const claims = hydrateClaimsFromCandidateBody({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: "cand-1",
      body: candidate.body,
      revisionTexts: {},
      now: NOW,
    });

    const first = await resolveClaimDecision({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: "cand-1",
      claimId: claims[0]!.id,
      decision: "accept",
      reader,
      writer,
      decisionStore,
    });
    expect(first.finalized).toBe(false);
    expect(first.remaining).toBe(1);
    expect(resolvedInputs).toHaveLength(0);

    const second = await resolveClaimDecision({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: "cand-1",
      claimId: claims[1]!.id,
      decision: "reject",
      reader,
      writer,
      decisionStore,
    });
    expect(second.finalized).toBe(true);
    expect(second.remaining).toBe(0);
    expect(resolvedInputs[0]).toMatchObject({ decision: "edit_accept" });
    expect(resolvedInputs[0]?.editedBody?.why.map((row) => row.text)).toEqual([
      "保留甲",
    ]);
  });

  it("defer persists but does not finalize Accepted", async () => {
    const candidate: UnderstandingRevision = {
      id: "cand-defer",
      projectId: "p1",
      matterId: "m1",
      kind: "candidate",
      body: body([
        { text: "命题甲", status: "unknown", evidence: [] },
        { text: "命题乙", status: "unknown", evidence: [] },
      ]),
      basedOnEventIds: [],
      proposedBy: "agent",
      createdAt: NOW,
    };
    const reader: ProjectMemoryReader = {
      async readRevision() {
        return null;
      },
      async listEvents() {
        return [];
      },
      async getMatterState() {
        return {
          matter: {
            id: "m1",
            projectId: "p1",
            title: "m",
            goal: "g",
            status: "active",
            createdAt: NOW,
            updatedAt: NOW,
          },
          head: {
            matterId: "m1",
            reviewState: "review_needed",
            reviewReasonEventIds: [],
            updatedAt: NOW,
          },
          candidate,
          recentEvents: [],
        };
      },
    };
    const rows = new Map<string, import("./types").PersistedClaimResolution>();
    const decisionStore: ClaimDecisionStore = {
      saveClaimResolutionRecord(row) {
        rows.set(row.claimId, row);
        return row;
      },
      listClaimResolutionRecords() {
        return [...rows.values()];
      },
      linkClaimResolutionRecords() {},
    };
    const writer: OwnerDecisionWriter = {
      async resolveCandidate(input) {
        return {
          resolution: input,
          accepted: undefined,
          head: {
            matterId: "m1",
            reviewState: "current",
            reviewReasonEventIds: [],
            updatedAt: input.createdAt,
          },
        };
      },
    };
    const claims = hydrateClaimsFromCandidateBody({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: "cand-defer",
      body: candidate.body,
      revisionTexts: {},
      now: NOW,
    });

    const deferred = await resolveClaimDecision({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: "cand-defer",
      claimId: claims[0]!.id,
      decision: "defer",
      reader,
      writer,
      decisionStore,
    });
    expect(deferred.finalized).toBe(false);
    expect(deferred.remaining).toBe(2); // defer does not finalize either claim for Accepted
    expect(deferred.audit.decision).toBe("defer");
    expect(rows.get(claims[0]!.id)?.decision).toBe("defer");

    // accept both finalizing → then can finalize
    await resolveClaimDecision({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: "cand-defer",
      claimId: claims[0]!.id,
      decision: "accept",
      reader,
      writer,
      decisionStore,
    });
    const last = await resolveClaimDecision({
      projectId: "p1",
      matterId: "m1",
      candidateRevisionId: "cand-defer",
      claimId: claims[1]!.id,
      decision: "accept_edited",
      editedText: "改写后的命题乙",
      reader,
      writer,
      decisionStore,
    });
    expect(last.finalized).toBe(true);
    expect(last.audit.decision).toBe("accept_edited");
    expect(last.audit.editedText).toBe("改写后的命题乙");
  });
});
