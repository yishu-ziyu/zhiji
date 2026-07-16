/**
 * Canvas intent recognition v1 — rule layer (testable, fast).
 * Long-tail model fill can wrap this later; eval gates on this module.
 *
 * Rule order is priority (first match wins). Keep specific intents above generic.
 */

import {
  type CanvasCommand,
  type CanvasIntentId,
  type CanvasViewId,
  buildCanvasCommand,
  DEFAULT_CANVAS_VIEW,
} from "./canvas-command";
import type { CanvasNodeRef } from "@/shared/types/knowledge";

export type CanvasIntentMatch = {
  intentId: CanvasIntentId;
  view: CanvasViewId;
  confidence: "high" | "medium" | "low";
  reason: string;
  /** Optional entity phrase extracted for open_entity / resume */
  entityHint?: string;
};

export type ResolveCanvasIntentContext = {
  /** Current project focus if any */
  projectFocus?: CanvasNodeRef;
  /** Optional: resolved focus when entity already known */
  resolvedFocus?: CanvasNodeRef;
  highlightNodeKeys?: string[];
};

const RULES: Array<{
  intentId: Exclude<CanvasIntentId, "unknown">;
  view: CanvasViewId;
  reason: string;
  patterns: RegExp[];
}> = [
  {
    intentId: "why_evidence",
    view: "evidence",
    reason: "用户在要结论的依据/证据链",
    patterns: [
      /凭什么/,
      /证据/,
      /依据/,
      /佐证/,
      /出处/,
      /来源(是|在)?(哪|什么)?/,
      /根据(在|是)?哪/,
      /引用(自|了|哪)?/,
      /ground(ing|s)?/i,
      /怎么得(到|出)/,
      /如何得(到|出)/,
      /靠什么(材料|支撑|得出|证明)?/,
      /用什么(材料|证据|文件)?(支撑|证明)?/,
      /为什么(这么|这样|如此)?(说|判断|认|结)/,
      /为何(这么|这样)?(判断|说)/,
      /支撑(这个|该|此)?结论/,
      /支持(这个|该)?判断/,
      /材料从哪/,
      /哪(份|些)?材料/,
      /哪(个|些)?文件.*(支撑|证明|依据)/,
      /证据(链|网|在哪|从哪)/,
      /证据网/,
      /理解依据/,
      /有什么(依据|证据|材料)(说明|支撑)?/,
      /谁说的/,
      /基于什么(判断|材料|证据)?/,
      /怎么证明/,
      /空口/,
      /有没有(材料|证据|依据)(支撑|说明)?/,
    ],
  },
  {
    intentId: "whats_blocked",
    view: "decision",
    reason: "用户在找阻塞/卡点",
    patterns: [
      /卡(点|住|在|壳|死)/,
      /阻塞/,
      /堵住/,
      /堵点/,
      /过不去/,
      /走不动/,
      /卡住了?/,
      /blocked/i,
      /blocker/i,
      /拦着/,
      /拦路/,
      /障碍/,
      /瓶颈/,
      /风险点/,
      /什么在挡/,
      /哪里(过不去|卡住|阻塞)/,
      /有没有(阻塞|卡点|障碍|blocker)/i,
      /被(什么)?挡住/,
      /推进不了/,
      /动不了/,
    ],
  },
  {
    intentId: "decision_path",
    view: "decision",
    reason: "用户在看决策/行动通路",
    patterns: [
      /决策(通路|链路|路径|线)?/,
      /该动哪/,
      /该处理哪/,
      /先处理哪/,
      /优先(处理|做|干)/,
      /行动(边|链|项|路径)?/,
      /现在该(做|干)什么/,
      /下一步(动作|该|做|干|处理)?/,
      /to-?do\s*(顺序|优先|列表|排序)/i,
      /工作(顺序|优先级)/,
      /主线任务/,
      /该推哪(条|个)/,
      /行动通路/,
      /决策网/,
      /只看(要做|该做|行动|决策)/,
      /哪些(事|项)要先做/,
    ],
  },
  {
    intentId: "survey_types",
    view: "by_kind",
    reason: "用户在扫关系类型",
    patterns: [
      /关系(都有)?(什么|哪些)?类型/,
      /类型一眼/,
      /有哪些(种)?关系/,
      /关系种类/,
      /按类型看/,
      /关系色/,
      /边的?(种类|类型|分类)/,
      /连线(类型|种类|分类)/,
      /分类看(边|关系|连线)/,
      /有几种(关系|边|连线)/,
      /关系字典/,
      /关系类别/,
      /看(一下)?关系类型/,
      /按\s*(kind|种类)\s*看/i,
      /颜色(代表|对应)(什么|哪种)关系/,
      /不同颜色的(边|线|关系)/,
    ],
  },
  {
    intentId: "resume_recent",
    view: "now",
    reason: "用户在接续最近/昨天的项目工作",
    patterns: [
      /昨天/,
      /前天/,
      /上周/,
      /上次/,
      /上回/,
      /接着(看|干|做|弄|聊)/,
      /继续(看|干|做|弄|聊)/,
      /接上(次|回|来)/,
      /考察的?项目/,
      /最近(在|刚)?(看|干|做|弄|聊|打开|考察)的/,
      /刚(才|刚)?(在)?(看|做|弄)的/,
      /resume/i,
      /pick\s*up\s*where/i,
      /回到(昨天|上次|刚才)/,
      /切回(昨天|上次|最近)/,
      /我们(昨天|上次|刚)(在|做|看|考察)/,
      /想关注.*(昨天|上次|最近)/,
      /把.*昨天.*打开/,
      /继续昨天/,
    ],
  },
  {
    intentId: "open_entity",
    view: "now",
    reason: "用户在点名打开某个实体",
    patterns: [
      /打开\s*[「"'《]?/,
      /点开\s*[「"'《]?/,
      /跳到\s*[「"'《]?/,
      /跳转(到|至)\s*/,
      /进入\s*[「"'《]?/,
      /查看\s*[「"'《]?.+\.(md|tsx?|jsx?|py|json|ya?ml|txt|csv)/i,
      /看一下\s*[「"'《]?.+\.(md|tsx?|jsx?|py|json|ya?ml|txt|csv)/i,
      /看下\s*[「"'《]?.+\.(md|tsx?|py|json)/i,
      /聚焦(到|在)/,
      /定位到/,
      /切到\s*[「"'《]?/,
      /goto\s+/i,
      /show\s+me\s+/i,
      /open\s+[A-Za-z0-9_./-]+\.(md|tsx?|py|json)/i,
      /工作项\s*[「"'《].+[」"'》]/,
      /把\s*[「"'《].+[」"'》]\s*(打开|打开来|拉出来)/,
      /节点\s*[「"'《].+[」"'》]/,
    ],
  },
  {
    intentId: "what_now",
    view: "now",
    reason: "用户在问当前局面",
    patterns: [
      /现在怎样/,
      /现在怎么(样|办)/,
      /现在如何/,
      /目前怎样/,
      /目前怎么(样|办)/,
      /目前如何/,
      /当前(局面|状态|重点|情况|进度)/,
      /先干(啥|什么)/,
      /先做(啥|什么)/,
      /项目(现在|当前|目前)/,
      /项目概况/,
      /项目进度/,
      /整体(怎样|如何|情况|进度)/,
      /现状(是什么|如何|怎样)?/,
      /概览/,
      /总览/,
      /overview/i,
      /summary\s*(of\s*)?(the\s*)?project/i,
      /what'?s?\s*now/i,
      /what'?s?\s*the\s*(status|situation)/i,
      /局面(如何|怎样|是什么)/,
      /现在到哪(一步|里)了/,
      /进行到哪/,
      /工作台(现在|当前)/,
      /画布(现在|当前)(怎样|如何)?/,
      /帮我看看(现在|当前|整体)/,
      /快速了解(一下)?(项目|现状)/,
    ],
  },
];

/**
 * Classify utterance into a canvas intent (rule-based v1).
 */
export function matchCanvasIntent(utterance: string): CanvasIntentMatch {
  const text = utterance.trim();
  if (!text) {
    return {
      intentId: "unknown",
      view: DEFAULT_CANVAS_VIEW,
      confidence: "low",
      reason: "空输入",
    };
  }

  for (const rule of RULES) {
    for (const re of rule.patterns) {
      if (re.test(text)) {
        let entityHint: string | undefined;
        if (rule.intentId === "open_entity") {
          const m =
            text.match(
              /(?:打开|点开|跳到|跳转(?:到|至)|进入|聚焦(?:到|在)|定位到|切到|查看|看一下|看下)\s*[「"'《]?([^」"'》\s，。！？]+)/,
            ) ||
            text.match(
              /open\s+([A-Za-z0-9_./-]+\.(?:md|tsx?|jsx?|py|json))/i,
            ) ||
            text.match(/([A-Za-z0-9_./-]+\.(?:md|tsx?|py|json))/i);
          if (m?.[1]) entityHint = m[1].replace(/[》」"']+$/, "");
        }
        if (rule.intentId === "resume_recent") {
          const m = text.match(
            /([A-Za-z0-9_\u4e00-\u9fff-]{2,40})(?:项目|仓库)?/,
          );
          if (
            /昨天|前天|上周|上次|上回|考察|最近|刚才|刚/.test(text) &&
            m?.[1] &&
            m[1].length >= 2
          ) {
            entityHint = m[1];
          }
        }
        return {
          intentId: rule.intentId,
          view: rule.view,
          confidence: "high",
          reason: rule.reason,
          entityHint,
        };
      }
    }
  }

  return {
    intentId: "unknown",
    view: DEFAULT_CANVAS_VIEW,
    confidence: "low",
    reason: "未匹配画布意图",
  };
}

/**
 * Intent → validated CanvasCommand (ready for set_canvas_view / UI).
 */
export function resolveCanvasCommandFromUtterance(
  utterance: string,
  ctx: ResolveCanvasIntentContext = {},
): { match: CanvasIntentMatch; command: CanvasCommand | null } {
  const match = matchCanvasIntent(utterance);
  if (match.intentId === "unknown") {
    return { match, command: null };
  }

  const focus = ctx.resolvedFocus ?? ctx.projectFocus;
  const command = buildCanvasCommand({
    view: match.view,
    focus,
    highlightNodeKeys: ctx.highlightNodeKeys,
    fold: "1hop",
    reason: match.reason,
    intentId: match.intentId,
  });
  return { match, command };
}

/**
 * Whether Agent must call set_canvas_view for this utterance.
 */
export function shouldForceCanvasViewTool(utterance: string): boolean {
  const match = matchCanvasIntent(utterance);
  return match.intentId !== "unknown" && match.confidence !== "low";
}
