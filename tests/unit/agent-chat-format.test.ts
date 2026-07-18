import { describe, expect, it } from "vitest";
import {
  AGENT_CHAT_QUICK_PROMPTS,
  parseAgentMessage,
} from "../../app/track/knowledge/lib/agent-chat-format";
import fs from "node:fs";
import path from "node:path";
import { planSetCanvasViewFromUtterance } from "../../shared/knowledge/set-canvas-view";

describe("parseAgentMessage", () => {
  it("returns plain for free-form agent text", () => {
    const parsed = parseAgentMessage("项目现在还在梳理证据。");
    expect(parsed.kind).toBe("plain");
    expect(parsed.lead).toContain("梳理证据");
    expect(parsed.showCandidateFooter).toBe(false);
  });

  it("parses 当前判断 / 依据 / 你现在只要决定 blocks", () => {
    const body = [
      "项目现在处在等待 Owner 拍板的状态。",
      "",
      "当前判断",
      "定价策略方向需要 Owner 决定，以便后续推进商业化方案。",
      "",
      "依据",
      "docs/PRD.md @ r14",
      "会议纪要/07-16.md @ r3",
      "",
      "你现在只要决定",
      "我们采用按量计费还是订阅制作为首发定价模式？",
      "",
      "候选判断 · 未自动写入项目事实",
    ].join("\n");

    const parsed = parseAgentMessage(body);
    expect(parsed.kind).toBe("structured");
    expect(parsed.lead).toContain("等待 Owner 拍板");
    expect(parsed.judgment).toContain("定价策略");
    expect(parsed.evidence).toHaveLength(2);
    expect(parsed.evidence?.[0]).toMatchObject({
      path: "docs/PRD.md",
      rev: "r14",
    });
    expect(parsed.evidence?.[1]?.path).toContain("会议纪要");
    expect(parsed.decision).toContain("按量计费");
    expect(parsed.decision).not.toContain("候选判断");
    expect(parsed.showCandidateFooter).toBe(true);
  });

  it("exposes canvas-driving quick prompts", () => {
    expect(AGENT_CHAT_QUICK_PROMPTS.map((q) => q.label)).toEqual([
      "现在怎样",
      "业务逻辑",
      "只看决策",
      "证据链",
      "关系类型",
      "阻塞在哪",
    ]);
    expect(AGENT_CHAT_QUICK_PROMPTS.every((q) => q.canvasHint)).toBe(true);
    for (const q of AGENT_CHAT_QUICK_PROMPTS) {
      const plan = planSetCanvasViewFromUtterance(q.text);
      expect(plan.shouldCall, q.text).toBe(true);
      expect(plan.command?.view, q.text).toBeTruthy();
    }
  });
});

describe("AgentChatPanel presentation contract", () => {
  const src = fs.readFileSync(
    path.join(
      process.cwd(),
      "app/track/knowledge/components/AgentChatPanel.tsx",
    ),
    "utf8",
  );

  it("keeps authorize + status + quick chips + canvas NL affordances", () => {
    expect(src).toContain('data-testid="agent-chat-authorize"');
    expect(src).toContain('data-testid="agent-chat-status"');
    expect(src).toContain('data-testid="agent-chat-quick-prompts"');
    expect(src).toContain('data-testid="agent-chat-canvas-strip"');
    expect(src).toContain("自然语言指挥中央画布");
    expect(src).toContain("知几");
    expect(src).toContain("agent-chat-canvas-notice");
    // Canvas morphology must not require folder grant in the panel.
    expect(src).toContain("Canvas control does not require folder grant");
  });
});
