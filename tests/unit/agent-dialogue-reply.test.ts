import { describe, expect, it } from "vitest";
import { formatAgentDialogueReply } from "../../shared/project-memory/agent-dialogue-reply";
import { parseAgentMessage } from "../../app/track/knowledge/lib/agent-chat-format";
import type { UnderstandingBody } from "../../shared/project-memory/types";

function sampleBody(over: Partial<UnderstandingBody> = {}): UnderstandingBody {
  return {
    now: {
      text: "项目现在处在等待 Owner 拍板的状态。",
      evidence: [
        {
          revisionId: "orev:abcdef1234567890",
          relativePath: "docs/PRD.md",
          quote: "定价待定",
          lastVerifiedAt: "2026-07-17T00:00:00.000Z",
        },
      ],
      gaps: [],
      conflicts: [],
    },
    then: {
      text: "先前无确认理解",
      at: "unknown",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [],
    why: [
      {
        text: "定价策略方向需要 Owner 决定，以便后续推进商业化方案。",
        status: "supported",
        evidence: [
          {
            revisionId: "orev:abcdef1234567890",
            relativePath: "docs/PRD.md",
            quote: "定价待定",
            lastVerifiedAt: "2026-07-17T00:00:00.000Z",
          },
          {
            revisionId: "orev:bbbbbb1111111111",
            relativePath: "会议纪要/07-16.md",
            quote: "讨论订阅制",
            lastVerifiedAt: "2026-07-17T00:00:00.000Z",
          },
        ],
      },
    ],
    depends: [],
    evidenceRevisionIds: ["orev:abcdef1234567890"],
    nextDecision: "我们采用按量计费还是订阅制作为首发定价模式？",
    ...over,
  };
}

describe("formatAgentDialogueReply", () => {
  it("emits UI-parseable 当前判断 / 依据 / 你现在只要决定 blocks", () => {
    const text = formatAgentDialogueReply(sampleBody(), {
      ownerUtterance: "这个项目现在最该决定什么？",
    });
    expect(text).toContain("当前判断");
    expect(text).toContain("依据");
    expect(text).toContain("你现在只要决定");
    expect(text).toContain("候选判断 · 未自动写入项目事实");
    expect(text).toContain("docs/PRD.md @ r");
    expect(text).toContain("按量计费");

    const parsed = parseAgentMessage(text);
    expect(parsed.kind).toBe("structured");
    expect(parsed.judgment).toContain("定价策略");
    expect(parsed.evidence?.length).toBeGreaterThanOrEqual(1);
    expect(parsed.decision).toContain("订阅制");
    expect(parsed.showCandidateFooter).toBe(true);
  });

  it("still structures when evidence is missing (honest gap)", () => {
    const text = formatAgentDialogueReply(
      sampleBody({
        now: {
          text: "材料不足，尚不能判断。",
          evidence: [],
          gaps: ["授权夹内没有定价相关文件"],
          conflicts: [],
        },
        why: [{ text: "未知", status: "unknown", evidence: [] }],
      }),
    );
    expect(text).toContain("依据");
    expect(text).toMatch(/限制|未钉上/);
    expect(parseAgentMessage(text).kind).toBe("structured");
  });
});
