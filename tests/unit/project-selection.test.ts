import { describe, expect, it } from "vitest";
import {
  bumpSelectionEpoch,
  createSelectionToken,
  projectResourceQueryKey,
  selectionTokenMatches,
  shouldApplyProjectFetch,
} from "@/app/track/knowledge/workbench/project-selection";
import {
  candidateClaimsFromBody,
  hasReviewableClaims,
} from "@/app/track/knowledge/workbench/candidate-claims";
import type { UnderstandingBody } from "@/shared/project-memory/types";

describe("shouldApplyProjectFetch (stale after project switch)", () => {
  it("applies only when projectId + epoch still match", () => {
    expect(
      shouldApplyProjectFetch({
        requestedProjectId: "p1",
        activeProjectId: "p1",
        requestEpoch: 3,
        activeEpoch: 3,
      }),
    ).toBe(true);

    // User switched to p2; p1 response is late
    expect(
      shouldApplyProjectFetch({
        requestedProjectId: "p1",
        activeProjectId: "p2",
        requestEpoch: 3,
        activeEpoch: 4,
      }),
    ).toBe(false);
  });

  it("rejects aborted or mismatched epoch even on same project", () => {
    expect(
      shouldApplyProjectFetch({
        requestedProjectId: "p1",
        activeProjectId: "p1",
        requestEpoch: 1,
        activeEpoch: 2,
      }),
    ).toBe(false);

    expect(
      shouldApplyProjectFetch({
        requestedProjectId: "p1",
        activeProjectId: "p1",
        requestEpoch: 2,
        activeEpoch: 2,
        aborted: true,
      }),
    ).toBe(false);
  });

  it("query key includes projectId so cache does not cross projects", () => {
    expect(projectResourceQueryKey("p1", "snapshot")).toEqual([
      "knowledge",
      "project",
      "p1",
      "snapshot",
    ]);
    expect(projectResourceQueryKey("p1", "snapshot")).not.toEqual(
      projectResourceQueryKey("p2", "snapshot"),
    );
  });

  it("selection token matches only same project+epoch", () => {
    const a = createSelectionToken("p1", bumpSelectionEpoch(0));
    const b = createSelectionToken("p1", a.epoch);
    const switched = createSelectionToken("p2", bumpSelectionEpoch(a.epoch));
    expect(selectionTokenMatches(a, b)).toBe(true);
    expect(selectionTokenMatches(a, switched)).toBe(false);
  });
});

describe("candidateClaimsFromBody", () => {
  const body = (why: UnderstandingBody["why"]): UnderstandingBody => ({
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
  });

  it("returns empty when no body / no why", () => {
    expect(
      candidateClaimsFromBody({ projectId: "p1", body: null }),
    ).toEqual([]);
    expect(
      hasReviewableClaims(
        candidateClaimsFromBody({
          projectId: "p1",
          body: body([]),
        }),
      ),
    ).toBe(false);
  });

  it("builds claims and demotes supported-without-link", () => {
    const claims = candidateClaimsFromBody({
      projectId: "p1",
      matterId: "m1",
      now: "2026-07-17T04:00:00.000Z",
      body: body([
        {
          text: "无出处断言",
          status: "supported",
          evidence: [],
        },
      ]),
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]!.status).toBe("unsupported");
    expect(hasReviewableClaims(claims)).toBe(true);
  });
});
