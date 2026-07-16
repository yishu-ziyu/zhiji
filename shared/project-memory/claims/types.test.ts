import { describe, expect, it } from "vitest";
import {
  claimHasSupportLink,
  demoteUnsupportedClaims,
  type Claim,
  type ClaimEvidenceLink,
} from "./types";

describe("claims model (PR-12)", () => {
  it("requires supports link for supported claims", () => {
    const claim: Claim = {
      id: "c1",
      projectId: "p",
      text: "目标是工作台",
      status: "supported",
      linkIds: [],
      createdAt: "2026-07-17T00:00:00.000Z",
    };
    expect(claimHasSupportLink(claim, [])).toBe(false);
    const link: ClaimEvidenceLink = {
      id: "l1",
      claimId: "c1",
      anchorId: "a1",
      relation: "supports",
    };
    const fixed = { ...claim, linkIds: ["l1"] };
    expect(claimHasSupportLink(fixed, [link])).toBe(true);
    const demoted = demoteUnsupportedClaims([claim], []);
    expect(demoted[0]?.status).toBe("unsupported");
  });
});
