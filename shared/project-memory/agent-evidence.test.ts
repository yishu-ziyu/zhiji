import { describe, expect, it } from "vitest";
import {
  enforceSourceBackedBody,
  evidencePathsInGrant,
  isUsableEvidenceAnchor,
  quoteExistsInRevisionText,
} from "./agent-evidence";
import type { EvidenceAnchor, UnderstandingBody } from "./types";

const pin = (partial: Partial<EvidenceAnchor> = {}): EvidenceAnchor => ({
  revisionId: "rev-1",
  relativePath: "README.md",
  quote: "项目理解工作台",
  lastVerifiedAt: "2026-07-17T00:00:00.000Z",
  ...partial,
});

function baseBody(
  over: Partial<UnderstandingBody> & {
    now: UnderstandingBody["now"];
    why: UnderstandingBody["why"];
  },
): UnderstandingBody {
  return {
    then: {
      text: "",
      evidence: [],
      gaps: [],
      conflicts: [],
      at: "2026-07-17T00:00:00.000Z",
    },
    changed: [],
    depends: [],
    evidenceRevisionIds: [],
    nextDecision: "",
    ...over,
  };
}

describe("agent-evidence PR-07 no auto-fill", () => {
  it("demotes supported claims without their own evidence", () => {
    const body = baseBody({
      now: {
        text: "项目很快做完了",
        evidence: [],
        gaps: [],
        conflicts: [],
      },
      why: [
        {
          text: "项目很快做完了",
          status: "supported",
          evidence: [],
        },
      ],
    });
    const out = enforceSourceBackedBody(body, [pin()]);
    expect(out.why[0]?.status).toBe("unknown");
    expect(out.why[0]?.evidence).toEqual([]);
    // Must NOT attach the unrelated pin just to look green.
    expect(out.now.evidence).toEqual([]);
  });

  it("keeps claim-local evidence when present", () => {
    const claimPin = pin({ quote: "授权本地夹" });
    const body = baseBody({
      now: {
        text: "有授权",
        evidence: [claimPin],
        gaps: [],
        conflicts: [],
      },
      why: [
        {
          text: "需要授权",
          status: "supported",
          evidence: [claimPin],
        },
      ],
    });
    const out = enforceSourceBackedBody(body, [
      claimPin,
      pin({ revisionId: "rev-2" }),
    ]);
    expect(out.why[0]?.status).toBe("supported");
    expect(out.why[0]?.evidence).toEqual([claimPin]);
    expect(out.now.evidence).toEqual([claimPin]);
  });

  it("honest-unknown when zero usable pins", () => {
    const body = baseBody({
      now: { text: "瞎说", evidence: [], gaps: [], conflicts: [] },
      why: [{ text: "瞎说", status: "supported", evidence: [] }],
    });
    const out = enforceSourceBackedBody(body, [
      {
        revisionId: "quote:x",
        relativePath: "a.md",
        quote: "x",
        lastVerifiedAt: "2026-07-17T00:00:00.000Z",
      },
    ]);
    expect(out.why[0]?.status).toBe("unknown");
    expect(out.now.evidence).toEqual([]);
  });

  it("quote integrity and strict path scope", () => {
    expect(quoteExistsInRevisionText("hello", "say hello world")).toBe(true);
    expect(quoteExistsInRevisionText("bye", "say hello world")).toBe(false);
    expect(isUsableEvidenceAnchor(pin())).toBe(true);
    expect(evidencePathsInGrant([pin()], ["docs/README.md"])).toBe(false);
    expect(evidencePathsInGrant([pin()], ["README.md"])).toBe(true);
    // No loose suffix match across unrelated trees
    expect(
      evidencePathsInGrant(
        [pin({ relativePath: "evil/README.md" })],
        ["other/README.md"],
      ),
    ).toBe(false);
  });
});
