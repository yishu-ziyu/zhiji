import type { ExtractCommitmentsResponse } from "./types";
import dialog01 from "../../tests/fixtures/delivery/dialog-01.json";

export type FixtureId = "dialog-01";

const FIXTURES: Record<
  FixtureId,
  {
    transcript: string;
    response: ExtractCommitmentsResponse;
  }
> = {
  "dialog-01": {
    transcript: dialog01.transcript,
    response: {
      summary: dialog01.title,
      commitments: [
        {
          text: "输出落地页改版原型",
          kind: "hard",
          sourceExcerpt: "下周能先看到新落地页的改版原型",
          suggestedPriority: "高",
        },
        {
          text: "本周五前上线可分享预览链接",
          kind: "hard",
          sourceExcerpt: "本周五前给一个可分享的预览链接",
          suggestedDeadline: undefined,
          suggestedPriority: "高",
        },
        {
          text: "体验好一点、别太乱",
          kind: "clarification",
          sourceExcerpt: "体验上最好再好一点，别太乱",
          suggestedPriority: "中",
        },
      ],
      risks: ["「体验好一点」缺少可验收标准，需再对齐"],
      _mock: true,
    },
  },
};

export function getFixtureTranscript(id: FixtureId = "dialog-01"): string {
  return FIXTURES[id].transcript;
}

export function extractCommitmentsMock(
  transcript: string,
  fixtureId?: FixtureId,
): ExtractCommitmentsResponse {
  if (fixtureId && FIXTURES[fixtureId]) {
    return structuredClone(FIXTURES[fixtureId].response);
  }

  // Match known gold script text loosely
  if (transcript.includes("落地页") && transcript.includes("预览链接")) {
    return structuredClone(FIXTURES["dialog-01"].response);
  }

  // Generic deterministic fallback: one hard commitment from first non-empty line
  const line =
    transcript
      .split(/\n/)
      .map((s) => s.trim())
      .find((s) => s.length >= 8) ?? "跟进客户需求并交付结果";

  return {
    summary: "离线提取（通用兜底）",
    commitments: [
      {
        text: line.slice(0, 80),
        kind: "hard",
        suggestedPriority: "中",
      },
    ],
    risks: ["LLM 不可用，已使用离线兜底提取"],
    _mock: true,
  };
}

export function listFixtureIds(): FixtureId[] {
  return Object.keys(FIXTURES) as FixtureId[];
}
