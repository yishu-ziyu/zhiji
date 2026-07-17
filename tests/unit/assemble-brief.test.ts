/**
 * Brief hard gate — grounded map/search/read required for Candidate brief.
 */
import { describe, expect, it } from "vitest";
import {
  assembleProjectIntelligenceBrief,
  canShowCandidateBrief,
  formatMissingToolsMessage,
  hasMapSearchReadReceipts,
  selectBriefSelection,
  selectBriefSource,
} from "@/shared/project-memory/brief/assemble-brief";
import type { UnderstandingBody } from "@/shared/project-memory/types";
import type { Claim } from "@/shared/project-memory/claims/types";

function body(partial: Partial<UnderstandingBody> = {}): UnderstandingBody {
  return {
    now: {
      text: "工程已打包测试，Owner 黄金路径未完成，不能写 accepted",
      evidence: [],
      gaps: ["未见 Owner 点验记录"],
      conflicts: [],
    },
    then: {
      text: "仅有工程证据",
      at: "earlier",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [
      {
        before: "只有工程证据",
        after: "仍缺 Owner 黄金路径",
        eventIds: [],
        evidence: [],
      },
    ],
    why: [
      {
        text: "产品清单写明不得写 accepted 直到 Owner 点验",
        status: "supported",
        evidence: [],
      },
      {
        text: "录屏黄金路径是否通过尚无现场记录",
        status: "unknown",
        evidence: [],
      },
    ],
    depends: [],
    evidenceRevisionIds: ["rev-product-list"],
    nextDecision: "是否现在就走黄金路径点验，还是继续补证据？",
    ...partial,
  };
}

const FULL_TOOLS = ["project_map", "search_text", "read_revision"] as const;

describe("hasMapSearchReadReceipts (hard gate tools)", () => {
  it("requires project_map + search_text + read_*", () => {
    expect(hasMapSearchReadReceipts([...FULL_TOOLS])).toBe(true);
    expect(
      hasMapSearchReadReceipts(["project_map", "search_text", "read_path"]),
    ).toBe(true);
    // search_symbols alone is not enough
    expect(
      hasMapSearchReadReceipts([
        "project_map",
        "search_symbols",
        "read_path",
      ]),
    ).toBe(false);
    expect(hasMapSearchReadReceipts(["project_map", "search_text"])).toBe(
      false,
    );
  });
});

describe("canShowCandidateBrief / grounded hard gate", () => {
  it("body 存在但无 receipts → 不产生 Candidate Brief", () => {
    const gate = canShowCandidateBrief({
      runStatus: "awaiting_owner",
      body: body(),
      candidateId: "c1",
      runCandidateRevisionId: "c1",
      toolNames: [],
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.missing).toEqual(["map", "search", "read"]);
    }
    expect(
      assembleProjectIntelligenceBrief({
        matterId: "m1",
        body: body(),
        kind: "candidate",
        toolNames: [],
        requireGrounded: true,
      }),
    ).toBeNull();
    const sel = selectBriefSelection({
      matterId: "m1",
      candidate: { id: "c1", body: body() },
      runStatus: "awaiting_owner",
      runCandidateRevisionId: "c1",
      toolNames: [],
    });
    expect(sel.status).toBe("insufficient");
    if (sel.status === "insufficient") {
      expect(sel.message).toMatch(/依据不足|尚不能形成/);
      expect(sel.missing).toContain("map");
    }
  });

  it("只有 map/read、缺 search → 不产生", () => {
    const gate = canShowCandidateBrief({
      runStatus: "awaiting_owner",
      body: body(),
      candidateId: "c1",
      runCandidateRevisionId: "c1",
      toolNames: ["project_map", "read_path"],
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.missing).toEqual(["search"]);
    expect(
      selectBriefSource({
        matterId: "m1",
        candidate: { id: "c1", body: body() },
        runStatus: "awaiting_owner",
        runCandidateRevisionId: "c1",
        toolNames: ["project_map", "read_path"],
      }),
    ).toBeNull();
  });

  it("map/search/read 完整且 Run 成功 → 产生", () => {
    const gate = canShowCandidateBrief({
      runStatus: "awaiting_owner",
      body: body(),
      candidateId: "c1",
      runCandidateRevisionId: "c1",
      toolNames: [...FULL_TOOLS],
    });
    expect(gate.ok).toBe(true);
    const brief = assembleProjectIntelligenceBrief({
      matterId: "m1",
      body: body(),
      kind: "candidate",
      runId: "run-9",
      toolNames: [...FULL_TOOLS],
      claims: [
        {
          id: "claim:c1:why:0:aa",
          projectId: "p",
          text: "产品清单写明不得写 accepted 直到 Owner 点验",
          status: "supported",
          linkIds: [],
          createdAt: "t",
        },
      ] as Claim[],
    });
    expect(brief).not.toBeNull();
    expect(brief!.currentJudgment).toMatch(/不能写 accepted/);
    expect(brief!.suggestion?.status).toBe("suggestion");
    expect(brief!.groundedInTools).toBe(true);
    expect(brief!.decisionPrompt).toMatch(/黄金路径|点验/);
  });

  it("当前 Run failed + 旧 Candidate/Accepted → 显示本轮失败，不显示成功简报", () => {
    const sel = selectBriefSelection({
      matterId: "m1",
      candidate: { id: "old-c", body: body() },
      accepted: {
        id: "old-a",
        body: body({
          now: {
            text: "历史已确认",
            evidence: [],
            gaps: [],
            conflicts: [],
          },
        }),
      },
      runStatus: "failed",
      toolNames: [...FULL_TOOLS],
      runCandidateRevisionId: "old-c",
    });
    expect(sel.status).toBe("run_failed");
    expect(selectBriefSource({
      matterId: "m1",
      candidate: { id: "old-c", body: body() },
      accepted: { id: "old-a", body: body() },
      runStatus: "failed",
      toolNames: [...FULL_TOOLS],
    })).toBeNull();
  });

  it("Candidate 与 Run 的 candidateRevisionId 不一致 → 不产生", () => {
    const gate = canShowCandidateBrief({
      runStatus: "awaiting_owner",
      body: body(),
      candidateId: "cand-A",
      runCandidateRevisionId: "cand-B",
      toolNames: [...FULL_TOOLS],
    });
    expect(gate.ok).toBe(false);
  });
});

describe("accepted restore", () => {
  it("无新 Run 时恢复上次已确认判断（非本轮成功简报）", () => {
    const sel = selectBriefSelection({
      matterId: "m1",
      accepted: {
        id: "a1",
        body: body({
          now: {
            text: "已确认判断",
            evidence: [],
            gaps: [],
            conflicts: [],
          },
        }),
      },
      runStatus: undefined,
    });
    expect(sel.status).toBe("accepted_restore");
    if (sel.status === "accepted_restore") {
      expect(sel.brief.currentJudgment).toBe("已确认判断");
      expect(sel.brief.restoreLabel).toBe("上次已确认判断");
      expect(sel.brief.kind).toBe("accepted");
    }
  });
});

describe("formatMissingToolsMessage", () => {
  it("lists missing parts in Chinese", () => {
    expect(formatMissingToolsMessage(["search"])).toMatch(/搜索/);
    expect(formatMissingToolsMessage(["map", "read"])).toMatch(/地图/);
  });
});
