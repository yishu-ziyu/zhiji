/**
 * Golden utterances for canvas-menu-v1 intent eval.
 * Expand phrases only; do not add views/intents without menu version bump.
 */

import type { CanvasIntentId, CanvasViewId } from "./canvas-command";

export type GoldenCanvasUtterance = {
  id: string;
  utterance: string;
  intentId: CanvasIntentId;
  view: CanvasViewId;
};

/** Utterances that must stay unmatched (no false canvas force). */
export const GOLDEN_CANVAS_NEGATIVES: readonly string[] = [
  "今天天气不错",
  "你好",
  "谢谢",
  "帮我写一段周报文案",
  "把这段翻译成英文",
  "咖啡喝不喝",
  "随便聊聊",
  "1+1等于几",
] as const;

function g(
  id: string,
  utterance: string,
  intentId: CanvasIntentId,
  view: CanvasViewId,
): GoldenCanvasUtterance {
  return { id, utterance, intentId, view };
}

export const GOLDEN_CANVAS_UTTERANCES: readonly GoldenCanvasUtterance[] = [
  // —— what_now → now ——
  g("wn01", "现在怎样？", "what_now", "now"),
  g("wn02", "先干啥", "what_now", "now"),
  g("wn03", "当前局面是什么", "what_now", "now"),
  g("wn04", "项目现在状态如何", "what_now", "now"),
  g("wn05", "目前怎么样", "what_now", "now"),
  g("wn06", "目前如何", "what_now", "now"),
  g("wn07", "现状是什么", "what_now", "now"),
  g("wn08", "项目进度", "what_now", "now"),
  g("wn09", "项目概况", "what_now", "now"),
  g("wn10", "整体情况怎样", "what_now", "now"),
  g("wn11", "概览一下", "what_now", "now"),
  g("wn12", "总览", "what_now", "now"),
  g("wn13", "先做什么", "what_now", "now"),
  g("wn14", "局面如何", "what_now", "now"),
  g("wn15", "现在到哪一步了", "what_now", "now"),
  g("wn16", "进行到哪了", "what_now", "now"),
  g("wn17", "帮我看看现在", "what_now", "now"),
  g("wn18", "快速了解一下项目", "what_now", "now"),
  g("wn19", "当前重点是什么", "what_now", "now"),
  g("wn20", "what's now", "what_now", "now"),
  g("wn21", "project overview please", "what_now", "now"),
  g("wn22", "what's the status", "what_now", "now"),
  g("wn23", "画布现在怎样", "what_now", "now"),
  g("wn24", "工作台当前状态", "what_now", "now"),
  g("wn25", "现在如何", "what_now", "now"),
  g("wn26", "当前情况", "what_now", "now"),

  // —— resume_recent → now ——
  g("rr01", "我想关注我们昨天在考察的项目", "resume_recent", "now"),
  g("rr02", "接着看昨天的", "resume_recent", "now"),
  g("rr03", "继续做上次那个", "resume_recent", "now"),
  g("rr04", "最近在看的项目打开一下", "resume_recent", "now"),
  g("rr05", "前天那个呢", "resume_recent", "now"),
  g("rr06", "上周做的接着干", "resume_recent", "now"),
  g("rr07", "接上次", "resume_recent", "now"),
  g("rr08", "接上来继续聊", "resume_recent", "now"),
  g("rr09", "继续昨天", "resume_recent", "now"),
  g("rr10", "回到昨天的进度", "resume_recent", "now"),
  g("rr11", "切回最近那个", "resume_recent", "now"),
  g("rr12", "我们昨天在考察 scion", "resume_recent", "now"),
  g("rr13", "想关注最近打开的", "resume_recent", "now"),
  g("rr14", "刚才在看的那个", "resume_recent", "now"),
  g("rr15", "把昨天那个打开", "resume_recent", "now"),
  g("rr16", "resume where we left off", "resume_recent", "now"),
  g("rr17", "上回那个项目", "resume_recent", "now"),
  g("rr18", "接着弄", "resume_recent", "now"),
  g("rr19", "继续弄上次", "resume_recent", "now"),
  g("rr20", "昨天考察的项目呢", "resume_recent", "now"),

  // —— why_evidence → evidence ——
  g("we01", "这个结论凭什么", "why_evidence", "evidence"),
  g("we02", "得到这个结果是通过什么证据得到的", "why_evidence", "evidence"),
  g("we03", "依据在哪", "why_evidence", "evidence"),
  g("we04", "支撑这个结论的材料从哪来", "why_evidence", "evidence"),
  g("we05", "为什么这么判断", "why_evidence", "evidence"),
  g("we06", "证据在哪", "why_evidence", "evidence"),
  g("we07", "佐证呢", "why_evidence", "evidence"),
  g("we08", "出处是什么", "why_evidence", "evidence"),
  g("we09", "来源在哪", "why_evidence", "evidence"),
  g("we10", "根据在哪", "why_evidence", "evidence"),
  g("we11", "引用了什么", "why_evidence", "evidence"),
  g("we12", "怎么得出的", "why_evidence", "evidence"),
  g("we13", "如何得到这个结论", "why_evidence", "evidence"),
  g("we14", "靠什么材料支撑", "why_evidence", "evidence"),
  g("we15", "用什么证据证明", "why_evidence", "evidence"),
  g("we16", "为什么这样说", "why_evidence", "evidence"),
  g("we17", "为何这么判断", "why_evidence", "evidence"),
  g("we18", "支持该判断的是什么", "why_evidence", "evidence"),
  g("we19", "哪些材料能说明", "why_evidence", "evidence"),
  g("we20", "证据链给我看", "why_evidence", "evidence"),
  g("we21", "打开证据网", "why_evidence", "evidence"),
  g("we22", "理解依据在哪", "why_evidence", "evidence"),
  g("we23", "有什么依据说明", "why_evidence", "evidence"),
  g("we24", "谁说的", "why_evidence", "evidence"),
  g("we25", "基于什么判断", "why_evidence", "evidence"),
  g("we26", "怎么证明", "why_evidence", "evidence"),
  g("we27", "是不是空口", "why_evidence", "evidence"),
  g("we28", "有没有材料支撑", "why_evidence", "evidence"),
  g("we29", "哪个文件支撑这个判断", "why_evidence", "evidence"),
  g("we30", "show me the grounding", "why_evidence", "evidence"),

  // —— whats_blocked → decision ——
  g("wb01", "现在卡点在哪", "whats_blocked", "decision"),
  g("wb02", "有没有阻塞", "whats_blocked", "decision"),
  g("wb03", "卡住了吗", "whats_blocked", "decision"),
  g("wb04", "卡壳在哪", "whats_blocked", "decision"),
  g("wb05", "堵点是什么", "whats_blocked", "decision"),
  g("wb06", "哪里过不去", "whats_blocked", "decision"),
  g("wb07", "走不动了", "whats_blocked", "decision"),
  g("wb08", "有没有 blocker", "whats_blocked", "decision"),
  g("wb09", "什么在挡", "whats_blocked", "decision"),
  g("wb10", "哪里卡住", "whats_blocked", "decision"),
  g("wb11", "有障碍吗", "whats_blocked", "decision"),
  g("wb12", "瓶颈在哪", "whats_blocked", "decision"),
  g("wb13", "风险点有哪些", "whats_blocked", "decision"),
  g("wb14", "被什么挡住了", "whats_blocked", "decision"),
  g("wb15", "推进不了是为什么", "whats_blocked", "decision"),
  g("wb16", "动不了", "whats_blocked", "decision"),
  g("wb17", "拦路的是什么", "whats_blocked", "decision"),
  g("wb18", "show blocked items", "whats_blocked", "decision"),

  // —— decision_path → decision ——
  g("dp01", "看看决策通路", "decision_path", "decision"),
  g("dp02", "该动哪条", "decision_path", "decision"),
  g("dp03", "该处理哪个", "decision_path", "decision"),
  g("dp04", "先处理哪", "decision_path", "decision"),
  g("dp05", "优先处理什么", "decision_path", "decision"),
  g("dp06", "行动项有哪些", "decision_path", "decision"),
  g("dp07", "现在该做什么", "decision_path", "decision"),
  g("dp08", "下一步动作", "decision_path", "decision"),
  g("dp09", "todo 顺序", "decision_path", "decision"),
  g("dp10", "工作优先级", "decision_path", "decision"),
  g("dp11", "该推哪条", "decision_path", "decision"),
  g("dp12", "行动通路", "decision_path", "decision"),
  g("dp13", "决策链路给我", "decision_path", "decision"),
  g("dp14", "只看要做的", "decision_path", "decision"),
  g("dp15", "哪些事要先做", "decision_path", "decision"),
  g("dp16", "主线任务是啥", "decision_path", "decision"),

  // —— survey_types → by_kind ——
  g("st01", "关系都有什么类型", "survey_types", "by_kind"),
  g("st02", "按类型看关系", "survey_types", "by_kind"),
  g("st03", "类型一眼", "survey_types", "by_kind"),
  g("st04", "有哪些种关系", "survey_types", "by_kind"),
  g("st05", "关系种类", "survey_types", "by_kind"),
  g("st06", "边的类型有哪些", "survey_types", "by_kind"),
  g("st07", "连线类型", "survey_types", "by_kind"),
  g("st08", "分类看边", "survey_types", "by_kind"),
  g("st09", "有几种关系", "survey_types", "by_kind"),
  g("st10", "关系字典", "survey_types", "by_kind"),
  g("st11", "关系类别", "survey_types", "by_kind"),
  g("st12", "看一下关系类型", "survey_types", "by_kind"),
  g("st13", "颜色代表什么关系", "survey_types", "by_kind"),
  g("st14", "不同颜色的边是什么意思", "survey_types", "by_kind"),
  g("st15", "按 kind 看", "survey_types", "by_kind"),
  g("st16", "关系色怎么读", "survey_types", "by_kind"),

  // —— open_entity → now ——
  g("oe01", "打开 CONTEXT.md", "open_entity", "now"),
  g("oe02", "点开 README.md", "open_entity", "now"),
  g("oe03", "跳到 PRODUCT.md", "open_entity", "now"),
  g("oe04", "聚焦到 DECISIONS.md", "open_entity", "now"),
  g("oe05", "定位到 src/app.ts", "open_entity", "now"),
  g("oe06", "切到 package.json", "open_entity", "now"),
  g("oe07", "查看 NOTES.md", "open_entity", "now"),
  g("oe08", "看一下 config.json", "open_entity", "now"),
  g("oe09", "看下 main.py", "open_entity", "now"),
  g("oe10", "open README.md", "open_entity", "now"),
  g("oe11", "goto AGENTS.md", "open_entity", "now"),
  g("oe12", "show me TODO.md", "open_entity", "now"),
  g("oe13", "进入「确认项目目标」", "open_entity", "now"),
  g("oe14", "把「审阅 CONTEXT」打开", "open_entity", "now"),
  g("oe15", "跳转至 README.md", "open_entity", "now"),
  g("oe16", "节点「CONTEXT.md」", "open_entity", "now"),
] as const;
