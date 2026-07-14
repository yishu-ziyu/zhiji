import { complete, extractJson } from "@/shared/llm/adapter";

// 会议纪要 Agent 的 system prompt
// 内联定义以应用 E4.6/E4.9/E4.10 三条质量约束（assignee / date / 里程碑）
// E4.11/E4.12：注入当前日期，让 LLM 能正确解析"今天/明天/下周X"等相对日期与年份
// E4.13-E4.21：强化 decisions/actionItems 边界、priority、participants、milestone、keyQuotes、timeline、模糊日期
// E4.22-E4.30：priority 规则引擎、assignee 清洗、decisions 不漏、keyQuotes 收观点、timeline 过滤 null、责任分配归类、SSR 样卡
function buildMinutesSystem(): string {
  // 用本地日期（Asia/Shanghai）而非 UTC，确保"今天"解析为用户实际的当天；
  // toISOString() 在 UTC+8 凌晨会落在昨天，导致 E4.11 date 字段差一天
  const today = new Date().toLocaleDateString("en-CA");
  return `你是一位专业的会议纪要整理员。擅长从会议记录中提取关键信息，输出结构化纪要。

当前日期：${today}（ISO 格式 YYYY-MM-DD，以此作为"今天"基准）。

【重要】actionItems.deadline 和 decisions.date 中的相对日期（今天/明天/后天/下周X/这周X/本周X/本周内/下周内 等）必须**保留原文**（如"下周一""这周六""本周内"），由后端规则化引擎统一处理。只有绝对日期（如"7月15日""2026-07-15"）才解析为 ISO YYYY-MM-DD。这样可以避免 LLM 推断不稳定导致的日期错误。

输出 JSON 格式：
{
  "title": "会议主题",
  "date": "会议日期 YYYY-MM-DD 或 待确认",
  "participants": ["参会人1"],
  "decisions": [
    { "item": "决议结论描述", "context": "背景说明", "date": "决议关联日期 YYYY-MM-DD 或 null" }
  ],
  "actionItems": [
    { "task": "可执行动作", "assignee": "负责人", "deadline": "截止时间 YYYY-MM-DD 或 待确认", "priority": "高 | 中 | 低" }
  ],
  "timeline": [
    { "time": "YYYY-MM-DD 或 null", "event": "事件描述", "note": "时间解析说明（可选）" }
  ],
  "keyQuotes": ["观点性/决策性发言摘要"]
}

=== date 字段（会议日期）规则 ===
- 若 transcript 有明确日期（绝对日期或相对日期如"今天/明天/下周三"），基于当前日期 ${today} 推断为 YYYY-MM-DD
- 若 transcript 含会议类型词（X会/晨会/周会/启动会/评审会/例会/站会/夕会）但无明确日期，date 默认填当前日期 ${today}（不填"待确认"）
- 若完全无法推断且无会议类型词，填"待确认"

=== participants 规则 ===
- 只放 transcript 中识别到的具体人名（如"小王""张三""李总"）
- 找不到任何人名时返回空数组 []，禁止追加"待确认""未知""未提及"等占位符
- 不要把部门/角色（如"前端团队""产品组"）当人名

=== decisions 规则（决议结论，E4.24）===
- decisions 收录"决议结论"和"决定：X"列表项。典型形式：采用方案 X / 产品于 7月15日 发布 / 通过 Q3 预算 / 确认上线日期
- 原文明确写出"决定：1. 2. 3."或"决定：X"的条目必须全部进 decisions，不得遗漏（即使含动作语义）
- 【重要】decisions 必须包含 transcript 中所有编号决议（1. 2. 3. ...），不得遗漏。如果决议超过 5 项，全部列出，不要省略。
- 决议含日期时必须提取到 date 字段（ISO YYYY-MM-DD）。例如"产品7月15日正式发布" → item="产品正式发布", date="2026-07-15"。无日期时 date 填 null（不是"待确认"）
- 里程碑类条目（"达成X用户/交付X/上线X版本" 后跟日期）归入 decisions，且把日期写入 date 字段
- 纯角色分工（"小王负责设计""小李对接客户"且无 deadline）归 decisions

=== actionItems 规则（可执行动作）===
- actionItems 收录可执行动作，task 必须动词开头（如"完成前端开发""联系供应商""提交测试报告""整理需求文档""发送邀请函""修复登录bug""启动新功能开发"）
- actionItems 收录规则（E4.38）：
  - 收录：以动词开头的可执行工作任务（"完成X""交付X""修复X""准备X"）
  - 不收录：请假/休年假/出差等个人事项（这些放 participants.note 或单独字段）
  - 不收录：会议/汇报/评审等会议事件（这些放 timeline）
  - 不收录：里程碑（"完成设计阶段"放 decisions）
- assignee 未知时返回 null，不得返回"待确认""未提及"等字符串占位符（E4.23）
- deadline 规则：
  - 绝对日期或相对日期（今天/明天/下周X/本周五）基于 ${today} 推断为 YYYY-MM-DD
  - "尽快/紧急/ASAP" → today+3（即 ${today} 后 3 天，YYYY-MM-DD）
  - "本周内" → 本周日（当前周所属周日的 YYYY-MM-DD）
  - "下月初" → 下月 1 号（YYYY-MM-DD）
  - "节后" → 无明确节日时填"待确认"（不要瞎猜节日日期）
  - 完全无法推断填"待确认"
- priority 字段必填，取值"高"/"中"/"低"（后端规则引擎会基于 deadline 重新计算覆盖，LLM 填写仅为兜底，E4.22）
- 含动作语义（修复/完成/启动/联系/整理/发送/调研/确认/编写/评审/提交）的条目必须进 actionItems，即使 deadline 为"待确认"（如"节后启动新功能"）也必须收录，禁止以"日期模糊"为由丢弃
- 模糊日期不等于无 actionItem：deadline 待确认的条目仍必须出现在 actionItems 中

=== decisions 与 actionItems 边界（E4.24/E4.28）===
- decisions 和 actionItems 不是互斥：同一条信息可同时出现在两个列表（双标注）
- 原文"决定：X"列表项必须进 decisions（带 date，无日期则 date=null）；若 X 含动作语义则同时进 actionItems
- 纯动作（无"决定"前缀）只进 actionItems
- 责任分配归类规则（E4.28）：
  - 有 deadline 的责任分配（"小王负责设计改版，下周三前完成"）→ actionItems
  - 纯角色分工无 deadline（"小王负责设计""小李对接客户"）→ decisions
- 里程碑（含日期的目标达成，如"达成1万用户""交付v2.0"）进 decisions 并把日期写入 date 字段
- 模糊日期的动作（"尽快修复bug""本周内完成迁移""节后启动新功能"）进 actionItems，deadline 填"待确认"或推断日期；若原文有"决定"前缀则同时进 decisions

=== timeline 规则（E4.26/E4.29）===
- timeline 只收录项目级 milestone（如产品发布、项目交付、版本上线、阶段启动），不收录个人 actionItem 的 deadline（E4.29）
- timeline.time 强制 ISO 格式 YYYY-MM-DD；模糊日期不进 timeline（后端会过滤 time=null 条目，E4.26）
- 模糊日期的动作应进 actionItems（deadline="待确认"），不进 timeline
- 时间区间（如"7月10日到7月15日"）拆为两条独立 timeline 条目，分别记开始与结束（仅当为 milestone 时）
- 不要把带括号备注、区间文本、未解析文本直接塞进 time 字段

=== keyQuotes 规则（E4.25/E4.36）===
keyQuotes 收录规则：
- 收录：以"我认为""我觉得""建议""担心""希望"开头的观点性发言原文
- 收录：决议过程中的争议性发言（如"小王认为方案A更好，但小李担心成本"）
- 不收录：decisions 中的结论（"决定：X"已进 decisions，避免复读）
- 不收录：actionItems 中的待办描述
- 不收录：纯事实陈述或动作描述
- 若无观点性发言，返回空数组 []
- 区分标准：是"立场/观点"则收录，是"动作/结论"则不收录

=== 其他 ===
- 其他无法确定的字段标注为"待确认"，不要用"未提及"
- 只返回 JSON，不要任何解释文字`;
}

function buildMinutesPrompt(transcript: string): string {
  return `请整理以下会议记录为结构化纪要：\n\n${transcript}`;
}

// LLM 不可用或返回非法 JSON 时的 mock fallback（不返回 500，保证看板可渲染）
// 满足 E4.6（assignee=null）、E4.9（date=具体日期）、E4.10（actionItems 为动词开头可执行动作）
// E4.11/E4.12：date 用当前日期动态生成，不硬编码年份
// E4.13-E4.21：对齐新 schema（decisions.date / actionItems.priority / participants 不放占位符 / timeline ISO）
// E4.22-E4.30：assignee 用 null（E4.23）、priority 用规则引擎结果（E4.22，待确认→中）
function buildMockMinutes(): Record<string, unknown> {
  // 用本地日期（Asia/Shanghai）而非 UTC，确保"今天"解析为用户实际的当天；
  // toISOString() 在 UTC+8 凌晨会落在昨天，导致 E4.11 date 字段差一天
  const today = new Date().toLocaleDateString("en-CA");
  return {
    title: "会议纪要（离线兜底）",
    date: today,
    participants: [],
    decisions: [],
    actionItems: [], // E4.55: 改为空数组，mock fallback 不注入看板任务（避免幻觉元任务）
    timeline: [],
    keyQuotes: [],
    _mock: true,
  };
}

// E4.22: priority 规则引擎——基于 deadline 距今天数稳定推断，不依赖 LLM 自由推断
// 同一输入永远得到同一 priority（消除"高/中/中"不稳定问题）
// E4.39: 扩展为考虑业务关键性（关键词 + 关键路径 deadline 对齐）
function computePriority(
  task: string,
  deadline: string | undefined,
  today: Date,
  decisions: { item?: string; date?: string | null }[] = [],
): string {
  // 关键业务任务至少"中"
  const criticalKeywords = [
    "合同", "签约", "付款", "上线", "发布", "交付", "回款", "审批", "签字",
  ];
  const isCritical = criticalKeywords.some((kw) => task.includes(kw));

  if (!deadline || deadline === "待确认") {
    return isCritical ? "中" : "中"; // 无 deadline 默认"中"
  }

  // E4.42: deadline "2026-07-07" 解析为本地零点，避免 UTC 午夜导致 days 多算 1
  const parts = deadline.split("-").map(Number);
  const d = parts.length === 3 && parts.every((p) => Number.isFinite(p))
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(deadline);
  if (isNaN(d.getTime())) return "中";

  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // 检查是否在某个 decision date 的关键路径上（±2 天）
  // E4.42: dec.date 也用本地零点解析
  const isOnCriticalPath = decisions.some((dec) => {
    if (!dec.date) return false;
    const decParts = dec.date.split("-").map(Number);
    const decDate = decParts.length === 3 && decParts.every((p) => Number.isFinite(p))
      ? new Date(decParts[0], decParts[1] - 1, decParts[2])
      : new Date(dec.date);
    if (isNaN(decDate.getTime())) return false;
    const diff = Math.abs(decDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 2;
  });

  if (days <= 3) return "高";
  if (days <= 7) return isCritical || isOnCriticalPath ? "高" : "中";
  if (days <= 14) return isCritical || isOnCriticalPath ? "中" : "低";
  return isCritical ? "中" : "低";
}

// E4.31/E4.37: 相对日期规则引擎——稳定解析"今天/明天/下周X/这周X/X月X日"等
// 不再依赖 LLM 自由推断，确保同一输入永远得到同一日期
// E4.31/E4.37: 用本地日期格式化（避免 toISOString 在 UTC+8 凌晨少一天）
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// todayWeekday: 周日=0, 周一=1, ..., 周六=6
function resolveRelativeDate(text: string, today: Date): string | null {
  if (!text) return null;

  // 今天/明天/后天
  if (/今天|今日/.test(text)) {
    return formatLocalDate(today);
  }
  if (/明天|明日/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  }
  if (/后天/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return formatLocalDate(d);
  }

  const weekDayMap: Record<string, number> = {
    "日": 0, "天": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6,
  };
  const todayWeekday = today.getDay();

  // 这周X / 本周X：本周已过的返回今天，本周未到的返回本周该日
  const thisWeekMatch = text.match(/[这本]周(日|天|一|二|三|四|五|六)/);
  if (thisWeekMatch) {
    const target = weekDayMap[thisWeekMatch[1]];
    const diff = target - todayWeekday;
    const d = new Date(today);
    d.setDate(d.getDate() + (diff < 0 ? 0 : diff)); // 已过返回今天
    return formatLocalDate(d);
  }

  // 下周X：下周一 = 今天 + (8 - todayWeekday)，下周日 = 今天 + (7 - todayWeekday)
  const nextWeekMatch = text.match(/下周(日|天|一|二|三|四|五|六)/);
  if (nextWeekMatch) {
    const target = weekDayMap[nextWeekMatch[1]];
    const d = new Date(today);
    const daysToNext = target === 0 ? 7 - todayWeekday : 7 + target - todayWeekday;
    d.setDate(d.getDate() + daysToNext);
    return formatLocalDate(d);
  }

  // X月X日 / X月X号
  const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    let year = today.getFullYear();
    // RED-NEW-5: 过期日期合理性校验——早于今天超过 30 天视为"明年同日"
    const candidate = new Date(year, month - 1, day);
    const diffDays = (candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < -30) {
      year = year + 1;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 下个月X日
  const nextMonthMatch = text.match(/下个月(\d{1,2})[日号]/);
  if (nextMonthMatch) {
    const day = parseInt(nextMonthMatch[1], 10);
    const d = new Date(today);
    d.setMonth(d.getMonth() + 1, day);
    return formatLocalDate(d);
  }

  // 尽快/马上/立刻 → 3 天内
  if (/尽快|马上|立刻/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 3);
    return formatLocalDate(d);
  }

  // 本周内/这周内 → 本周日（如果今天就是周日，返回今天）
  if (/本周内|这周内/.test(text)) {
    const d = new Date(today);
    const daysToSunday = 7 - todayWeekday;
    d.setDate(d.getDate() + (daysToSunday === 0 ? 0 : daysToSunday));
    return formatLocalDate(d);
  }

  // 下周内 → 下周日
  if (/下周内/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7 + (7 - todayWeekday));
    return formatLocalDate(d);
  }

  // E4.58: 模糊日期——月底前/月底/本月内 → 当月最后一天
  // RED-NEW-4: "本月内" 归一化为当月最后一天
  if (/月底前|月底|本月内/.test(text)) {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 0); // 当月最后一天
    return formatLocalDate(d);
  }
  // E4.58: 下月初 → 下月 1 号
  if (/下月初/.test(text)) {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return formatLocalDate(d);
  }
  // E4.58: 本月初 → 当月 1 号
  if (/本月初/.test(text)) {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return formatLocalDate(d);
  }

  // 节后/年末 → 无法精确解析，返回 null 保留 LLM 输出
  if (/节后|年末/.test(text)) {
    return null;
  }

  // E4.48: 英文相对日期
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  }
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return formatLocalDate(d);
  }
  const nextDayMatch = lower.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (nextDayMatch) {
    const enDayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };
    const target = enDayMap[nextDayMatch[1]];
    const d = new Date(today);
    const daysToNext = target === 0 ? 7 - todayWeekday : 7 + target - todayWeekday;
    d.setDate(d.getDate() + daysToNext);
    return formatLocalDate(d);
  }

  return null; // 无法规则化，保留 LLM 输出
}

// E4.23: assignee 清洗——"待确认"/"未提及"/空字符串 → null
// 前端 page.tsx 已有 {task.assignee && ...} 守卫，null 不会渲染
function sanitizeAssignee(assignee: unknown): string | null {
  if (typeof assignee !== "string") return null;
  const trimmed = assignee.trim();
  if (trimmed === "待确认" || trimmed === "未提及" || trimmed === "") return null;
  return trimmed;
}

// E4.26: timeline 过滤——剔除 time=null/空/非字符串 条目
// 模糊日期不应进 timeline（与 E4.20 ISO 格式冲突）
function filterTimeline(timeline: unknown[]): unknown[] {
  return timeline.filter((t) => {
    if (!t || typeof t !== "object") return false;
    const time = (t as Record<string, unknown>).time;
    return typeof time === "string" && time.length > 0 && time !== "null";
  });
}

// E4.56/E4.63: 同义动作归一化 map（用于去重判断，不修改原始 task 文本）
const ACTION_SYNONYMS: Record<string, string> = {
  "签约": "签约", "完成签约": "签约", "签约工作": "签约", "签订合同": "签约", "签合同": "签约",
  "交付": "交付", "完成交付": "交付", "交付工作": "交付", "交付物": "交付",
  "上线": "上线", "完成上线": "上线", "上线工作": "上线",
  "完成": "完成", "完成工作": "完成",
};

// E4.63: 扩展同义词组（任务表述归一化）
const TASK_SYNONYMS: Record<string, string> = {
  ...ACTION_SYNONYMS,
  "整理文档": "写文档", "撰写文档": "写文档", "编写文档": "写文档", "写文档": "写文档",
  "整理需求": "写需求", "撰写需求": "写需求", "编写需求": "写需求",
  "整理报告": "写报告", "撰写报告": "写报告", "编写报告": "写报告",
  "联系客户": "联系客户", "跟进客户": "联系客户", "沟通客户": "联系客户",
  "安排会议": "安排会议", "组织会议": "安排会议", "召集会议": "安排会议",
};

const CANONICAL_ACTIONS = new Set(Object.values(TASK_SYNONYMS));

// E4.56: 强动作词——包含这些特定业务动作的 task 归一化为该词本身
// 仅收录"签约/交付"等不会因对象不同而语义分化的终端业务动作；
// "完成/开发/测试/设计"等泛化动词不收录，避免"完成前端开发"与"完成后端开发"被误合并
const STRONG_ACTIONS = ["签约", "交付"];

// RED-NEW-2: 动作动词集——若一方归一化后恰为某动词、另一方包含它，视为同一任务
// 覆盖 LLM 抖动场景（"开发" vs "负责产品开发"）
const ACTION_VERBS = new Set([
  "签约", "交付", "上线", "发布", "修复", "启动", "开发", "测试", "设计",
  "评审", "提交", "确认", "联系", "整理", "发送", "调研", "编写", "完成",
]);

// E4.60: 非核心后缀/填充词，归一化时移除以便按核心动作/字符集去重
const FILLER_WORDS = ["工作", "任务", "事项", "阶段", "评审", "进度", "相关", "的", "了", "等"];

function stripFiller(t: string): string {
  let r = t;
  for (const f of FILLER_WORDS) {
    r = r.split(f).join("");
  }
  return r.trim();
}

// E4.57: 去掉相对日期词，便于按核心动作去重
const stripRelativeDate = (t: string): string =>
  t.replace(/(今天|明天|后天|下周[一二三四五六日天]|本周[内一二三四五六日]?|这周[一二三四五六日]?|\d+月\d+日|\d{4}-\d{2}-\d{2})/g, "").trim();

// E4.56/E4.60/E4.63: 归一化 task 用于去重比较（不修改原始文本）
function normalizeTaskForDedup(task: string): string {
  let t = stripRelativeDate(task);
  t = stripFiller(t);
  // E4.56: 强动作归一化——包含"签约"/"交付"等特定业务动作的 task 归一化为该动作
  for (const action of STRONG_ACTIONS) {
    if (t.includes(action)) return action;
  }
  // 按 key 长度降序替换（长的先替换，避免短 key 覆盖长 key 的语义）
  const keys = Object.keys(TASK_SYNONYMS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (t.includes(k)) {
      t = t.split(k).join(TASK_SYNONYMS[k]);
    }
  }
  return t;
}

// E4.60: 按字符排序，用于词序归一化比较
function sortByChars(s: string): string {
  return [...s].sort().join("");
}

// P0-1: 核心动作提取——去掉标点/日期/人名/filler/弱动词，提取核心动作词用于去重比较
// 解决"完成前端开发" vs "前端开发，下周一完成"类同任务重复（归一化后因词序/长度差不命中现有子串/词序检查）
function extractCoreAction(t: string): string {
  return t
    .replace(/[\s，,。.、：:；;！!？?]/g, "")
    .replace(/(今天|明天|后天|下周[一二三四五六日天]|本周[内一二三四五六日]?|这周[一二三四五六日]?|月底前?|下月初|本月初|\d+月\d+日|\d{4}-\d{2}-\d{2})/g, "")
    .replace(/[张李王刘陈赵钱孙周吴郑]总|总/g, "")
    .replace(/(张三|李四|王五|赵六|钱七|孙八|周九|张总|李总|王总|李经理|王经理)/g, "")
    .replace(/(工作|任务|事项|阶段|评审|进度|相关|的|了|等|完成|负责|需要|应该)/g, "")
    .trim();
}

// P0-1: 信息完整度评分——去重时优先保留 assignee 非 null + deadline 非待确认 的那条
// assignee 有效得 2 分，deadline 有效得 1 分
function completenessScore(it: Record<string, unknown>): number {
  let score = 0;
  const a = it.assignee;
  if (a !== null && a !== undefined && typeof a === "string") {
    const t = a.trim();
    if (t !== "" && t !== "待确认" && t !== "未提及") score += 2;
  }
  const d = it.deadline;
  if (typeof d === "string") {
    const t = d.trim();
    if (t !== "" && t !== "待确认") score += 1;
  }
  return score;
}

// E4.56/E4.57/E4.60/E4.63/RED-NEW-2: 统一去重判断——同义归一化 + 日期剥离 + 后缀剥离 + 子串 + 动作词 + 词序
function isSameTask(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = normalizeTaskForDedup(a);
  const nb = normalizeTaskForDedup(b);
  if (na === nb) return true;
  // 子串检查（length > 3）
  if (na.length > 3 && nb.includes(na)) return true;
  if (nb.length > 3 && na.includes(nb)) return true;
  // RED-NEW-2: 动作动词子串——一方归一化后恰为动作动词，另一方包含它
  // 覆盖 LLM 抖动："开发" vs "负责产品开发"
  if (na.length >= 2 && ACTION_VERBS.has(na) && nb.includes(na)) return true;
  if (nb.length >= 2 && ACTION_VERBS.has(nb) && na.includes(nb)) return true;
  // 规范动作子串：一方归一化后恰为规范动作，另一方包含它
  if (CANONICAL_ACTIONS.has(na) && nb.includes(na)) return true;
  if (CANONICAL_ACTIONS.has(nb) && na.includes(nb)) return true;
  // E4.60: 词序归一化（仅对长度差 ≤ 2 的 task，避免误合并）
  if (na.length > 0 && Math.abs(na.length - nb.length) <= 2 && sortByChars(na) === sortByChars(nb)) return true;
  // P0-1: 核心动作子串比较——剥离日期/人名/filler/弱动词后，若一方核心动作是另一方子串则视为重复
  // 覆盖"完成前端开发" vs "前端开发，下周一完成"（核心动作均为"前端开发"）
  // 用子串而非字符集交集，避免"前端开发" vs "后端开发"被误合并
  const coreA = extractCoreAction(a);
  const coreB = extractCoreAction(b);
  if (coreA && coreB) {
    if (coreA === coreB) return true;
    if (coreA.length >= 2 && coreB.includes(coreA)) return true;
    if (coreB.length >= 2 && coreA.includes(coreB)) return true;
  }
  return false;
}

// RED-NEW-5: 过期日期合理性校验——早于今天超过 30 天的绝对日期视为"明年同日"
function sanitizePastDate(dateStr: string, today: Date): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return dateStr;
  const diffDays = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < -30) {
    d.setFullYear(d.getFullYear() + 1);
    return formatLocalDate(d);
  }
  return dateStr;
}

// E4.59: 规则引擎从 transcript 提取 decisions（兜底，不注入幻觉）
function extractDecisionsFromTranscript(transcript: string): Array<Record<string, unknown>> {
  const decisions: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const pushIfNew = (text: string) => {
    const t = text.trim();
    if (t.length >= 5 && !seen.has(t)) {
      seen.add(t);
      decisions.push({ item: t, context: "", date: null });
    }
  };
  // "决定：X" / "决议：X" / "确认：X"
  const p1 = /(?:决定|决议|确认)[：:]\s*([^。！!\n]{5,80})/g;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(transcript)) !== null) pushIfNew(m[1]);
  // 编号项 "1. X" / "1、X" / "1) X"
  const p2 = /\d+[.、)]\s*([^\d\n。！!]{5,80})/g;
  while ((m = p2.exec(transcript)) !== null) pushIfNew(m[1]);
  return decisions;
}

// E4.59: 规则引擎从 transcript 提取 actionItems（兜底，不注入幻觉）
function extractActionItemsFromTranscript(transcript: string): Array<Record<string, unknown>> {
  const actions: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  // "待办：X" / "负责：X" / "跟进：X"
  const p1 = /(?:待办|负责|跟进)[：:]\s*([^。！!\n]{5,80})/g;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(transcript)) !== null) {
    const t = m[1].trim();
    if (t.length >= 5 && !seen.has(t)) {
      seen.add(t);
      actions.push({ task: t, assignee: null, deadline: "待确认", priority: "中" });
    }
  }
  // "X总/X经理 ... 动作"
  const p2 = /([\u4e00-\u9fa5]{1,4}(?:总|经理))\s*(?:负责|跟进|去|要)?\s*([^。！!\n]{5,80})/g;
  while ((m = p2.exec(transcript)) !== null) {
    const assignee = m[1].trim();
    const t = m[2].trim();
    if (t.length >= 5 && !seen.has(t)) {
      seen.add(t);
      actions.push({ task: t, assignee, deadline: "待确认", priority: "中" });
    }
  }
  return actions;
}

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();
    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return Response.json({ error: "请提供会议记录文本" }, { status: 400 });
    }
    const prompt = buildMinutesPrompt(transcript.trim());
    let text: string;
    try {
      text = await complete(prompt, buildMinutesSystem());
    } catch {
      // LLM 调用失败，返回 mock fallback（不 500）
      return Response.json(buildMockMinutes());
    }
    let result: Record<string, unknown>;
    try {
      result = extractJson(text);
    } catch {
      // JSON 解析失败，返回 mock fallback（不 500）
      return Response.json(buildMockMinutes());
    }

    // E4.59: 偶发空返回兜底——actionItems 和 decisions 均为空且 transcript 足够长时，重试 1 次；
    // 重试仍空则用规则引擎从 transcript 提取；规则提取也为空则返回离线兜底（不注入幻觉任务）
    const isEmptyMinutes = (r: Record<string, unknown>): boolean => {
      const ai = Array.isArray(r.actionItems) ? r.actionItems.length : 0;
      const dc = Array.isArray(r.decisions) ? r.decisions.length : 0;
      return ai === 0 && dc === 0;
    };
    if (isEmptyMinutes(result) && transcript.trim().length > 50) {
      let recovered = false;
      try {
        const retryText = await complete(prompt, buildMinutesSystem());
        const retryResult = extractJson(retryText);
        if (!isEmptyMinutes(retryResult)) {
          result = retryResult;
          recovered = true;
        }
      } catch {
        // 重试失败，落规则引擎兜底
      }
      if (!recovered && isEmptyMinutes(result)) {
        const ruleDecisions = extractDecisionsFromTranscript(transcript);
        const ruleActions = extractActionItemsFromTranscript(transcript);
        if (ruleDecisions.length > 0 || ruleActions.length > 0) {
          result = {
            ...result,
            decisions: ruleDecisions,
            actionItems: ruleActions,
          };
        } else {
          // 规则提取也为空，返回离线兜底（不注入幻觉任务）
          return Response.json(buildMockMinutes());
        }
      }
    }

    // E4.61/RED-NEW-1: 无条件从 transcript 提取所有编号项（供 decisions 补全 + actionItems 误分类回移 + 跨类去重保留）
    // E4.61 fix: 原 [^\d\n。！!] 排除数字，导致含日期的编号项（"1. 产品7月15日上线"）被截断为"产品"（2 字 < 5），无法匹配
    const allNumberedItems: string[] = [];
    {
      const numberedRegex = /\d+[.、)]\s*([^\n。！!]{5,80})/g;
      let nm: RegExpExecArray | null;
      while ((nm = numberedRegex.exec(transcript)) !== null) {
        allNumberedItems.push(nm[1].trim());
      }
    }

    // E4.61: decisions 后置校验——无条件补回 LLM 遗漏的编号决议（不是只在 decisions 为空时才补）
    if (Array.isArray(result.decisions)) {
      const existingDecItems = (result.decisions as Array<Record<string, unknown>>)
        .map((d) => typeof d?.item === "string" ? d.item : "");
      for (const itemText of allNumberedItems) {
        // 用 isSameTask 做更精确的重复判断（避免"张三负责前端"误匹配"张三负责前端开发"）
        const already = existingDecItems.some((e) => isSameTask(e, itemText));
        if (!already) {
          (result.decisions as Array<Record<string, unknown>>).push({
            item: itemText,
            context: "",
            date: null,
          });
          existingDecItems.push(itemText);
        }
      }
    }


    // E4.22: priority 规则化（不依赖 LLM 自由推断，确保同一输入稳定）
    // E4.23: assignee 清洗占位符（"待确认"/"未提及" → null）
    // E4.26: timeline 过滤 time=null 条目
    // E4.31/E4.37: deadline 规则化（resolveRelativeDate 覆盖 LLM 自由推断）
    // E4.38: actionItems 过滤个人事项（请假/休假/年假/出差）
    // E4.39: priority 考虑业务关键性（关键词 + decisions 关键路径）
    // E4.42: today 取本地零点，避免 UTC+8 凌晨 days 多算 1 天
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // E4.36: keyQuotes 后置过滤——排除与 decisions 内容重复的项（避免复读机）
    if (Array.isArray(result.keyQuotes) && Array.isArray(result.decisions)) {
      const decisionItems = (result.decisions as Array<Record<string, unknown>>)
        .map((d) => (typeof d === "object" && d !== null ? (d.item as string) : (d as string)))
        .filter((d): d is string => typeof d === "string");
      result.keyQuotes = (result.keyQuotes as unknown[]).filter((q) => {
        if (typeof q !== "string") return true;
        return !decisionItems.some((d) => d === q || d.includes(q) || q.includes(d));
      });
    }

    // E4.38: actionItems 后置过滤——排除请假/休假/年假/出差等个人事项
    const personalKeywords = ["请假", "休假", "年假", "出差", "调休", "病假", "事假"];
    if (Array.isArray(result.actionItems)) {
      result.actionItems = (result.actionItems as Array<Record<string, unknown>>).filter((item) => {
        const task = typeof item.task === "string" ? item.task : "";
        return !personalKeywords.some((kw) => task.includes(kw));
      });
    }

    // E4.41: title 完全用 transcript 首句（确定性），不依赖 LLM 自由推断
    // LLM 对 title 推断不稳定（同一输入返回"下周一正式启动项目"/"项目启动会议"等不同值）
    // 用 transcript 首句前 20 字作为 title，确保同一输入稳定输出
    {
      const firstSentence = transcript.split(/[。！？\n.!?]/)[0]?.trim() || "";
      result.title = firstSentence.length > 0 ? firstSentence.slice(0, 20) + (firstSentence.length > 20 ? "..." : "") : "会议纪要";
    }

    // E4.41: date 规则化兜底——会议类型词 + 今天
    // RED-NEW-3: 英文 transcript date="待确认" → 英文日期词解析 + 今天兜底
    if (typeof result.date !== "string" || result.date === "待确认" || result.date.trim().length === 0) {
      const meetingTypeRegex = /(\w+会|晨会|周会|启动会|评审会|例会|站会|夕会|复盘会|讨论会|研讨会)/;
      if (meetingTypeRegex.test(transcript)) {
        result.date = formatLocalDate(today);
      }
      // 如果 transcript 含明确中文日期，用 resolveRelativeDate 提取
      const dateMatch = transcript.match(/(今天|明天|后天|下周[日天一二三四五六]|[本这]周[日天一二三四五六]|\d{1,2}月\d{1,2}[日号])/);
      if (dateMatch) {
        const resolved = resolveRelativeDate(dateMatch[0], today);
        if (resolved) result.date = resolved;
      }
      // RED-NEW-3: 英文日期词解析（today/tomorrow/next week/next Monday 等）
      if (typeof result.date !== "string" || result.date === "待确认" || result.date.trim().length === 0) {
        const enDateMatch = transcript.match(/\b(today|tomorrow|next week|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i);
        if (enDateMatch) {
          const resolved = resolveRelativeDate(enDateMatch[0], today);
          if (resolved) result.date = resolved;
        }
      }
      // RED-NEW-3: 含英文日期词但仍无法解析 → 回填今天（不留"待确认"）
      if (typeof result.date !== "string" || result.date === "待确认" || result.date.trim().length === 0) {
        if (/\b(today|tomorrow|next week|meeting|standup|sync|review)\b/i.test(transcript)) {
          result.date = formatLocalDate(today);
        }
      }
    }

    // E4.43 + E4.31: decisions.date 处理
    // E4.43: 检测 item 中的相对日期关键词，强制覆盖 LLM 的 ISO 日期
    // E4.31 fallback: 如果 date 为 null/空，但 item 含相对日期关键词，从 item 提取
    if (Array.isArray(result.decisions)) {
      for (const dec of result.decisions as Array<Record<string, unknown>>) {
        const dateRaw = typeof dec.date === "string" ? dec.date : "";
        const itemText = typeof dec.item === "string" ? dec.item : "";

        // E4.43: 检测 item 中的相对日期关键词，强制覆盖 LLM 的 ISO 日期
        const relativeDateMatch = itemText.match(/(下周一|下周二|下周三|下周四|下周五|下周六|下周日|下周天|这周一|这周二|这周三|这周四|这周五|这周六|这周日|这周天|本周一|本周二|本周三|本周四|本周五|本周六|本周日|本周天|今天|明天|后天)/);
        if (relativeDateMatch) {
          const resolved = resolveRelativeDate(relativeDateMatch[0], today);
          if (resolved) {
            dec.date = resolved; // 强制覆盖 LLM 的 ISO 日期
          }
        } else {
          // E4.31 fallback: 优先用 date 字段，fallback 从 item 提取
          const source = dateRaw || (/[下周这本周今天明后天]/.test(itemText) ? itemText : "");
          if (source) {
            const resolved = resolveRelativeDate(source, today);
            if (resolved) dec.date = resolved;
          }
        }
        // RED-NEW-5: 过期日期合理性校验——早于今天超过 30 天视为"明年同日"
        if (typeof dec.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dec.date)) {
          dec.date = sanitizePastDate(dec.date, today);
        }
      }
    }

    // P0-2: decisions.date 兜底解析——date 仍为 null/待确认 时，从 item + context 提取日期词解析
    // 覆盖"王五负责测试，7月20日前完成"场景（X月X日 不被现有相对日期正则匹配，resolveRelativeDate 能处理）
    if (Array.isArray(result.decisions)) {
      for (const dec of result.decisions as Array<Record<string, unknown>>) {
        const decDate = dec.date;
        const needsResolve = decDate === null || decDate === undefined ||
          (typeof decDate === "string" && (decDate === "待确认" || decDate.trim() === ""));
        if (needsResolve) {
          const itemText = typeof dec.item === "string" ? dec.item : "";
          const ctxText = typeof dec.context === "string" ? dec.context : "";
          const textToCheck = `${itemText} ${ctxText}`.trim();
          if (textToCheck) {
            const resolved = resolveRelativeDate(textToCheck, today);
            if (resolved) dec.date = resolved;
          }
        }
      }
    }

    // E4.50/E4.51: 含动作关键词的 decisions 同时进 actionItems
    // E4.53: 用子串检查替代精确匹配，并从 decision 文本提取纯任务名（去掉日期/人名前缀）
    if (Array.isArray(result.decisions) && Array.isArray(result.actionItems)) {
      const actionKeywords = ["签约", "完成", "交付", "上线", "发布", "启动", "修复", "联系", "整理", "发送", "调研", "确认", "编写", "评审", "提交", "开发", "测试", "设计"];
      const existingTaskList = (result.actionItems as Array<Record<string, unknown>>)
        .map((item) => typeof item.task === "string" ? item.task : "")
        .filter(Boolean);

      for (const dec of result.decisions as Array<Record<string, unknown>>) {
        const itemText = typeof dec.item === "string" ? dec.item : "";
        const decDate = typeof dec.date === "string" ? dec.date : undefined;

        // 检测是否含动作关键词
        const hasActionKeyword = actionKeywords.some((kw) => itemText.includes(kw));
        if (!hasActionKeyword) continue;

        // E4.53: 从 decision 文本提取纯任务名（去掉开头日期/"X负责"前缀）
        const cleanTaskText = itemText
          .replace(/^\d{1,2}月\d{1,2}日?/, '') // 去掉开头日期
          .replace(/^[^，。\s]{1,4}负责/, '')     // 去掉"X负责"前缀
          .trim();
        const taskForCheck = cleanTaskText || itemText;

        // E4.56/E4.57/E4.60/E4.63: 统一去重——同义归一化 + 日期剥离 + 子串 + 词序
        const isDuplicate = existingTaskList.some((t) => isSameTask(t, taskForCheck));

        if (!isDuplicate) {
          (result.actionItems as Array<Record<string, unknown>>).push({
            task: taskForCheck,
            assignee: null,
            deadline: decDate || "待确认",
            priority: "中", // 后面会被 computePriority 重新计算
          });
          existingTaskList.push(taskForCheck);
        }
      }
    }

    // E4.47/E4.56/E4.57/E4.60/E4.63: actionItems 去重——同义归一化 + 日期剥离 + 子串 + 词序
    // 词序归一化重复时保留较短的一条；其他重复取较早的 deadline
    if (Array.isArray(result.actionItems)) {
      const items = result.actionItems as Array<Record<string, unknown>>;
      const kept: Record<string, unknown>[] = [];
      const keptTasks: string[] = [];
      for (const item of items) {
        const task = typeof item.task === "string" ? item.task : "";
        if (!task) continue;
        // E4.56/E4.57/E4.60/E4.63: 统一去重判断
        const duplicateIdx = keptTasks.findIndex((t) => isSameTask(t, task));
        if (duplicateIdx === -1) {
          kept.push({ ...item });
          keptTasks.push(task);
        } else {
          const existing = kept[duplicateIdx];
          const existingTask = keptTasks[duplicateIdx];
          // P0-1: 重复时优先保留信息更全的一条（assignee 非 null + deadline 非待确认）
          const existingScore = completenessScore(existing);
          const newScore = completenessScore(item);
          if (newScore > existingScore) {
            kept[duplicateIdx] = { ...item };
            keptTasks[duplicateIdx] = task;
          } else if (newScore === existingScore) {
            // 信息完整度相同，回退到原有策略
            // E4.60: 词序归一化重复（排序后相同但归一化后不同）→ 保留较短的一条
            const na = normalizeTaskForDedup(existingTask);
            const nb = normalizeTaskForDedup(task);
            const isWordOrderDup = na !== nb &&
              Math.abs(na.length - nb.length) <= 2 &&
              na.length > 0 &&
              sortByChars(na) === sortByChars(nb);
            if (isWordOrderDup) {
              if (task.length < existingTask.length) {
                kept[duplicateIdx] = { ...item };
                keptTasks[duplicateIdx] = task;
              }
              // 否则保留现有（较短）
            } else {
              // 其他重复：取较早的 deadline
              const existingDeadline = typeof existing.deadline === "string" ? existing.deadline : "9999-12-31";
              const newDeadline = typeof item.deadline === "string" ? item.deadline : "9999-12-31";
              if (newDeadline < existingDeadline) {
                kept[duplicateIdx] = { ...item };
                keptTasks[duplicateIdx] = task;
              }
            }
          }
          // else newScore < existingScore: 保留现有（信息更全）
        }
      }
      result.actionItems = kept;
    }

    if (Array.isArray(result.actionItems)) {
      for (const item of result.actionItems as Array<Record<string, unknown>>) {
        // E4.31/E4.37: 先规则化 deadline，再计算 priority（确保 priority 用稳定日期）
        const resolved = resolveRelativeDate(
          typeof item.deadline === "string" ? item.deadline : "",
          today,
        );
        if (resolved) item.deadline = resolved;

        // RED-NEW-5: 过期日期合理性校验——早于今天超过 30 天视为"明年同日"
        if (typeof item.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.deadline)) {
          item.deadline = sanitizePastDate(item.deadline, today);
        }

        // E4.49: "之前完成X" 逻辑——从 transcript 上下文检测"之前"，task 含前置动作时 deadline 减 1 天
        // LLM 提取的 task 通常不含"之前"（"之前"是上下文连接词），需从 transcript 检测
        const taskText = typeof item.task === "string" ? item.task : "";
        const deadlineStr = typeof item.deadline === "string" ? item.deadline : "";
        const hasBeforeContext = /之前/.test(transcript);
        const hasPreAction = /完成|测试|修复|准备|整理|编写|开发|设计|确认/.test(taskText);
        if (hasBeforeContext && hasPreAction && deadlineStr && deadlineStr !== "待确认") {
          const dparts = deadlineStr.split("-").map(Number);
          const d = dparts.length === 3 && dparts.every((p) => Number.isFinite(p))
            ? new Date(dparts[0], dparts[1] - 1, dparts[2])
            : new Date(deadlineStr);
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() - 1);
            item.deadline = formatLocalDate(d);
          }
        }

        // E4.39: priority 考虑业务关键性（关键词 + decisions 关键路径）
        item.priority = computePriority(
          typeof item.task === "string" ? item.task : "",
          typeof item.deadline === "string" ? item.deadline : undefined,
          today,
          (result.decisions as Array<Record<string, unknown>>) || [],
        );
        item.assignee = sanitizeAssignee(item.assignee);
      }
    }

    // E4.62: 跨类去重——同一动作同时出现在 decisions 和 actionItems 时，从 decisions 移除
    // 保留 actionItem（信息更全：assignee/deadline/priority），仅对动作类 decision 去重
    // RED-NEW-1: 编号项决议保留在 decisions（即使同时在 actionItems 中），避免 LLM 误分类导致编号决议丢失
    if (Array.isArray(result.actionItems) && Array.isArray(result.decisions)) {
      const crossActionKeywords = ["签约", "完成", "交付", "上线", "发布", "启动", "修复", "联系", "整理", "发送", "调研", "确认", "编写", "评审", "提交", "开发", "测试", "设计"];
      const actionTasks = (result.actionItems as Array<Record<string, unknown>>)
        .map((a) => typeof a?.task === "string" ? a.task : "");
      result.decisions = (result.decisions as Array<Record<string, unknown>>).filter((dec) => {
        const decItem = typeof dec?.item === "string" ? dec.item : "";
        if (!decItem) return true;
        // RED-NEW-1: 编号项决议无条件保留（它们是从 transcript 编号列表提取的，不应被跨类去重移除）
        if (allNumberedItems.some((ni) => isSameTask(ni, decItem))) return true;
        // 仅对动作类 decision 去重（含动作关键词），保留纯观点类 decision
        const isActionType = crossActionKeywords.some((kw) => decItem.includes(kw));
        if (!isActionType) return true;
        // 与任一 actionItem 核心动作相同则从 decisions 移除
        return !actionTasks.some((at) => isSameTask(at, decItem));
      });
    }

    // RED-NEW-1: actionItems 中 assignee=null 且 task 匹配编号项的，判定为误分类的 decision，移回 decisions
    // 场景：超长 transcript 中 LLM 把编号决议错误归入 actionItems（assignee=null），导致 decisions 严重遗漏
    if (Array.isArray(result.actionItems) && Array.isArray(result.decisions)) {
      const decItems = (result.decisions as Array<Record<string, unknown>>)
        .map((d) => typeof d?.item === "string" ? d.item : "");
      const movedToDecisions: Array<Record<string, unknown>> = [];
      const keptActions: Array<Record<string, unknown>> = [];
      for (const item of result.actionItems as Array<Record<string, unknown>>) {
        const task = typeof item.task === "string" ? item.task : "";
        // assignee=null 且 task 匹配 transcript 中某编号项 → 误分类的 decision
        const matchesNumbered = item.assignee === null &&
          allNumberedItems.some((ni) => isSameTask(ni, task));
        if (matchesNumbered) {
          const isDup = decItems.some((e) => isSameTask(e, task));
          if (!isDup) {
            movedToDecisions.push({
              item: task,
              context: "",
              date: typeof item.deadline === "string" && item.deadline !== "待确认" ? item.deadline : null,
            });
            decItems.push(task);
          }
        } else {
          keptActions.push(item);
        }
      }
      if (movedToDecisions.length > 0) {
        (result.decisions as Array<Record<string, unknown>>).push(...movedToDecisions);
        result.actionItems = keptActions;
      }
    }

    // E4.44: participants 合并同指人——"王总/王经理/小王"合并为"王总"
    if (Array.isArray(result.participants)) {
      const participants = result.participants as string[];
      // 按姓氏分组
      const surnameMap = new Map<string, string[]>(); // 姓氏 → [原始名称列表]
      for (const name of participants) {
        if (typeof name !== "string" || name.length < 1) continue;
        const surname = name[0];
        if (!surnameMap.has(surname)) surnameMap.set(surname, []);
        surnameMap.get(surname)!.push(name);
      }
      // 合并：E4.54——只有实际存在"X总"时才合并为"X总"；多条"X经理"合并为"X经理"；否则不合并
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const name of participants) {
        if (typeof name !== "string" || name.length < 1) continue;
        if (seen.has(name)) continue;
        const surname = name[0];
        const sameSurname = surnameMap.get(surname) || [];
        const hasZong = sameSurname.some((n) => n.endsWith("总"));
        const hasJingli = sameSurname.some((n) => n.endsWith("经理"));
        if (hasZong) {
          // 有"X总"，统一用"X总"
          const mergedName = `${surname}总`;
          if (!seen.has(mergedName)) {
            merged.push(mergedName);
            seen.add(mergedName);
          }
          // 标记同姓氏所有名称为已处理
          sameSurname.forEach((n) => seen.add(n));
        } else if (hasJingli && sameSurname.length > 1) {
          // 只有多条"X经理"才合并为"X经理"（去重）
          const mergedName = `${surname}经理`;
          if (!seen.has(mergedName)) {
            merged.push(mergedName);
            seen.add(mergedName);
          }
          sameSurname.forEach((n) => seen.add(n));
        } else {
          // 单条，不合并
          merged.push(name);
          seen.add(name);
        }
      }
      result.participants = merged;
    }

    if (Array.isArray(result.timeline)) {
      result.timeline = filterTimeline(result.timeline);
    }
    return Response.json(result);
  } catch (error) {
    console.error("/api/efficiency/minutes error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "生成纪要失败" }, { status: 500 });
  }
}
