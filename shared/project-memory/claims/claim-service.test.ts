import { describe, expect, it } from "vitest";
import type { UnderstandingBody } from "../types";
import {
  applyOwnerResolution,
  buildClaimBundleFromWhy,
  canLinkAsSupports,
  quoteAppearsInRevision,
} from "./claim-service";
import type { Claim } from "./types";

const NOW = "2026-07-17T03:30:00.000Z";

function emptyBody(overrides: Partial<UnderstandingBody> = {}): UnderstandingBody {
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
    why: [],
    depends: [],
    evidenceRevisionIds: [],
    nextDecision: "next",
    ...overrides,
  };
}

function baseClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "claim-1",
    projectId: "p1",
    matterId: "m1",
    runId: "run-1",
    text: "项目目标是本地知识工作台",
    status: "supported",
    linkIds: [],
    createdAt: NOW,
    ...overrides,
  };
}

describe("buildClaimBundleFromWhy", () => {
  it("demotes supported why with no usable link to unsupported", () => {
    const body = emptyBody({
      why: [
        {
          text: "没有出处的断言",
          status: "supported",
          evidence: [],
        },
      ],
    });

    const bundle = buildClaimBundleFromWhy(body, [], {
      projectId: "p1",
      matterId: "m1",
      runId: "run-1",
      now: NOW,
    });

    expect(bundle.claims).toHaveLength(1);
    expect(bundle.claims[0]!.status).toBe("unsupported");
    expect(bundle.claims[0]!.linkIds).toEqual([]);
    expect(bundle.links).toEqual([]);
  });

  it("keeps supported when why evidence produces a supports link", () => {
    const pin = {
      revisionId: "orev:abc",
      relativePath: "README.md",
      quote: "本地优先的项目理解",
      lastVerifiedAt: NOW,
    };
    const body = emptyBody({
      why: [
        {
          text: "这是本地优先产品",
          status: "supported",
          evidence: [pin],
        },
      ],
      evidenceRevisionIds: [pin.revisionId],
    });

    const bundle = buildClaimBundleFromWhy(body, [pin], {
      projectId: "p1",
      matterId: "m1",
      runId: "run-1",
      now: NOW,
      revisionTexts: {
        "orev:abc": "# README\n本地优先的项目理解工作台\n",
      },
    });

    expect(bundle.claims).toHaveLength(1);
    expect(bundle.claims[0]!.status).toBe("supported");
    expect(bundle.claims[0]!.linkIds.length).toBeGreaterThan(0);
    expect(bundle.anchors).toHaveLength(1);
    expect(bundle.links).toHaveLength(1);
    expect(bundle.links[0]!.relation).toBe("supports");
  });

  it("refuses supports and demotes when revisionTexts missing entirely", () => {
    const pin = {
      revisionId: "orev:abc",
      relativePath: "README.md",
      quote: "本地优先的项目理解",
      lastVerifiedAt: NOW,
    };
    const body = emptyBody({
      why: [
        {
          text: "无正文校验仍标 supported",
          status: "supported",
          evidence: [pin],
        },
      ],
    });

    const bundle = buildClaimBundleFromWhy(body, [pin], {
      projectId: "p1",
      now: NOW,
      // no revisionTexts
    });

    expect(bundle.links).toEqual([]);
    expect(bundle.claims[0]!.status).toBe("unsupported");
  });

  it("refuses supports and demotes when revision body missing for revisionId", () => {
    const pin = {
      revisionId: "orev:missing",
      relativePath: "A.md",
      quote: "有摘录",
      lastVerifiedAt: NOW,
    };
    const body = emptyBody({
      why: [
        {
          text: "revision 无正文",
          status: "supported",
          evidence: [pin],
        },
      ],
    });

    const bundle = buildClaimBundleFromWhy(body, [pin], {
      projectId: "p1",
      now: NOW,
      revisionTexts: {
        "orev:other": "别的文件正文",
      },
    });

    expect(bundle.links).toEqual([]);
    expect(bundle.claims[0]!.status).toBe("unsupported");
  });

  it("refuses supports when revision body is empty string", () => {
    const pin = {
      revisionId: "orev:empty",
      relativePath: "E.md",
      quote: "任意",
      lastVerifiedAt: NOW,
    };
    const body = emptyBody({
      why: [
        {
          text: "空正文",
          status: "supported",
          evidence: [pin],
        },
      ],
    });

    const bundle = buildClaimBundleFromWhy(body, [pin], {
      projectId: "p1",
      now: NOW,
      revisionTexts: { "orev:empty": "   " },
    });

    expect(bundle.links).toEqual([]);
    expect(bundle.claims[0]!.status).toBe("unsupported");
  });

  it("does not attach unrelated pins to empty why evidence", () => {
    const strayPin = {
      revisionId: "orev:other",
      relativePath: "OTHER.md",
      quote: "无关摘录",
      lastVerifiedAt: NOW,
    };
    const body = emptyBody({
      why: [
        {
          text: "看起来 supported 但无自带证据",
          status: "supported",
          evidence: [],
        },
      ],
    });

    const bundle = buildClaimBundleFromWhy(body, [strayPin], {
      projectId: "p1",
      now: NOW,
    });

    expect(bundle.claims[0]!.status).toBe("unsupported");
    expect(bundle.links).toEqual([]);
  });

  it("maps unknown why to unsupported claim status", () => {
    const body = emptyBody({
      why: [{ text: "还不知道", status: "unknown", evidence: [] }],
    });
    const bundle = buildClaimBundleFromWhy(body, [], {
      projectId: "p1",
      now: NOW,
    });
    expect(bundle.claims[0]!.status).toBe("unsupported");
  });

  it("maps conflicted why through", () => {
    const body = emptyBody({
      why: [{ text: "两边打架", status: "conflicted", evidence: [] }],
    });
    const bundle = buildClaimBundleFromWhy(body, [], {
      projectId: "p1",
      now: NOW,
    });
    expect(bundle.claims[0]!.status).toBe("conflicted");
  });
});

describe("quote / supports gate", () => {
  it("quoteAppearsInRevision is true when quote is substring", () => {
    expect(
      quoteAppearsInRevision(
        "本地优先",
        "# 标题\n本地优先的项目理解工作台\n",
      ),
    ).toBe(true);
  });

  it("rejects supports when quote is not in revisionText", () => {
    const result = canLinkAsSupports(
      "这段话根本不在文件里",
      "# README\n真实内容只有这些\n",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/quote|revisionText|不在|not found/i);
    }
  });

  it("allows supports when quote is exact span in revisionText", () => {
    const text = "授权后真读项目夹";
    const result = canLinkAsSupports("真读项目夹", text);
    expect(result).toEqual({ ok: true });
  });

  it("buildClaimBundle drops supports link when pin quote fails revision check", () => {
    const pin = {
      revisionId: "orev:x",
      relativePath: "SPEC.md",
      quote: "幻觉引用",
      lastVerifiedAt: NOW,
    };
    const body = emptyBody({
      why: [
        {
          text: "错误引用仍标 supported",
          status: "supported",
          evidence: [pin],
        },
      ],
    });

    const bundle = buildClaimBundleFromWhy(body, [pin], {
      projectId: "p1",
      now: NOW,
      /** revision bodies keyed by revisionId — missing/wrong quote → no supports */
      revisionTexts: {
        "orev:x": "# SPEC\n真实规格只有这些字\n",
      },
    });

    expect(bundle.links).toEqual([]);
    expect(bundle.claims[0]!.status).toBe("unsupported");
  });
});

describe("applyOwnerResolution", () => {
  it("accept leaves claim text/status, records resolution", () => {
    const claim = baseClaim({ status: "supported", linkIds: ["l1"] });
    const result = applyOwnerResolution(claim, "accept", {
      projectId: "p1",
      id: "res-1",
      resolvedAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim.text).toBe(claim.text);
    expect(result.claim.status).toBe("supported");
    expect(result.resolution.decision).toBe("accept");
    expect(result.resolution.claimId).toBe("claim-1");
  });

  it("reject demotes claim to unsupported", () => {
    const claim = baseClaim({ status: "supported", linkIds: ["l1"] });
    const result = applyOwnerResolution(claim, "reject", {
      projectId: "p1",
      resolvedAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim.status).toBe("unsupported");
    expect(result.resolution.decision).toBe("reject");
  });

  it("accept_edited requires editedText and updates claim text", () => {
    const claim = baseClaim();
    const missing = applyOwnerResolution(claim, "accept_edited", {
      projectId: "p1",
    });
    expect(missing.ok).toBe(false);

    const ok = applyOwnerResolution(claim, "accept_edited", {
      projectId: "p1",
      editedText: "更正后的命题",
      resolvedAt: NOW,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.claim.text).toBe("更正后的命题");
    expect(ok.resolution.decision).toBe("accept_edited");
    expect(ok.resolution.editedText).toBe("更正后的命题");
  });

  it("defer does not change claim fields", () => {
    const claim = baseClaim({ status: "partially_supported" });
    const result = applyOwnerResolution(claim, "defer", {
      projectId: "p1",
      resolvedAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim).toEqual(claim);
    expect(result.resolution.decision).toBe("defer");
  });

  it("rejects empty decision path / illegal second accept not required", () => {
    const claim = baseClaim({ status: "unsupported", linkIds: [] });
    // Owner may still accept an honest unsupported claim as owner belief
    const result = applyOwnerResolution(claim, "accept", {
      projectId: "p1",
      resolvedAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claim.status).toBe("owner_stated");
  });
});
