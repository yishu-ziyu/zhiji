/**
 * Shared UnderstandingBody fixtures for offline bench cases.
 */
import type { UnderstandingBody } from "@/shared/project-memory/types";

const nowIso = "2026-07-18T00:00:00.000Z";

export function bodyGroundedPricing(): UnderstandingBody {
  return {
    now: {
      text: "项目现在处在等待定价模式拍板的状态。",
      evidence: [
        {
          revisionId: "orev:aaa111bbb222",
          relativePath: "docs/PRD.md",
          quote: "定价待定",
          lastVerifiedAt: nowIso,
        },
      ],
      gaps: [],
      conflicts: [],
    },
    then: {
      text: "先前未确认定价方向",
      at: "unknown",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [],
    why: [
      {
        text: "定价策略方向需要决定，以便推进商业化方案。",
        status: "supported",
        evidence: [
          {
            revisionId: "orev:aaa111bbb222",
            relativePath: "docs/PRD.md",
            quote: "定价待定",
            lastVerifiedAt: nowIso,
          },
          {
            revisionId: "orev:ccc333ddd444",
            relativePath: "会议纪要/07-16.md",
            quote: "讨论订阅制与按量",
            lastVerifiedAt: nowIso,
          },
        ],
      },
    ],
    depends: [],
    evidenceRevisionIds: ["orev:aaa111bbb222", "orev:ccc333ddd444"],
    nextDecision: "首发采用按量计费还是订阅制？",
  };
}

export function bodyConflictDataset(): UnderstandingBody {
  return {
    now: {
      text: "材料对数据集是否参与评测说法不一致。",
      evidence: [
        {
          revisionId: "orev:readme01",
          relativePath: "README.md",
          quote: "数据集仅作样例",
          lastVerifiedAt: nowIso,
        },
      ],
      gaps: [],
      conflicts: ["README 称样例；EVAL.md 称已跑 benchmark"],
    },
    then: {
      text: "先前未确认",
      at: "unknown",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [],
    why: [
      {
        text: "README 与 EVAL 对数据集角色冲突。",
        status: "conflicted",
        evidence: [
          {
            revisionId: "orev:readme01",
            relativePath: "README.md",
            quote: "数据集仅作样例",
            lastVerifiedAt: nowIso,
          },
          {
            revisionId: "orev:eval01",
            relativePath: "docs/EVAL.md",
            quote: "已在公开 benchmark 评测",
            lastVerifiedAt: nowIso,
          },
        ],
      },
    ],
    depends: [],
    evidenceRevisionIds: ["orev:readme01", "orev:eval01"],
    nextDecision: "以 README 还是 EVAL 作为对外口径？",
  };
}

export function bodyInsufficient(): UnderstandingBody {
  return {
    now: {
      text: "授权夹内尚无足够材料支持判断。",
      evidence: [],
      gaps: ["未找到与问题相关的可读文件"],
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
    why: [{ text: "证据不足", status: "unknown", evidence: [] }],
    depends: [],
    evidenceRevisionIds: [],
    nextDecision: "需要补充哪类材料才能继续判断？",
  };
}

export function bodyReentryDelta(): UnderstandingBody {
  return {
    now: {
      text: "相对上次确认，新增了会议纪要并更新了 PRD。",
      evidence: [
        {
          revisionId: "orev:prd02",
          relativePath: "docs/PRD.md",
          quote: "验收标准已改",
          lastVerifiedAt: nowIso,
        },
      ],
      gaps: [],
      conflicts: [],
    },
    then: {
      text: "上次确认：工程可用但未验收",
      at: "2026-07-10T00:00:00.000Z",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [
      {
        before: "PRD 旧验收",
        after: "PRD 新验收标准",
        eventIds: ["e1"],
        evidence: [
          {
            revisionId: "orev:prd02",
            relativePath: "docs/PRD.md",
            quote: "验收标准已改",
            lastVerifiedAt: nowIso,
          },
        ],
      },
    ],
    why: [
      {
        text: "重进后关键变化集中在验收口径。",
        status: "supported",
        evidence: [
          {
            revisionId: "orev:prd02",
            relativePath: "docs/PRD.md",
            quote: "验收标准已改",
            lastVerifiedAt: nowIso,
          },
        ],
      },
    ],
    depends: [],
    evidenceRevisionIds: ["orev:prd02"],
    nextDecision: "是否接受新的验收标准作为当前事实？",
  };
}

export function bodyNoiseTravel(): UnderstandingBody {
  return {
    now: {
      text: "主线仍是交付验收；夹内出现与主线无关的旅行笔记。",
      evidence: [
        {
          revisionId: "orev:todo01",
          relativePath: "TODO.md",
          quote: "完成验收录屏",
          lastVerifiedAt: nowIso,
        },
      ],
      gaps: [],
      conflicts: [],
    },
    then: {
      text: "先前聚焦交付",
      at: "unknown",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: [],
    why: [
      {
        text: "旅行笔记与项目交付无关，不应升格为项目事实。",
        status: "supported",
        evidence: [
          {
            revisionId: "orev:todo01",
            relativePath: "TODO.md",
            quote: "完成验收录屏",
            lastVerifiedAt: nowIso,
          },
        ],
      },
    ],
    depends: [],
    evidenceRevisionIds: ["orev:todo01"],
    nextDecision: "是否忽略旅行笔记并继续按 TODO 推进验收？",
  };
}

export function bodyAsRecord(body: UnderstandingBody): Record<string, unknown> {
  return body as unknown as Record<string, unknown>;
}
