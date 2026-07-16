/**
 * Owner-visible working steps — plain language, not internal jargon.
 */

export type AgentProcessStepId =
  | "observe"
  | "map"
  | "tools"
  | "reason"
  | "evidence"
  | "candidate"
  | "owner"
  | "persist";

export type AgentProcessStepStatus = "pending" | "active" | "done";

export type AgentProcessStep = {
  id: AgentProcessStepId;
  index: number;
  title: string;
  detail: string;
};

export const AGENT_PROCESS_STEPS: AgentProcessStep[] = [
  {
    id: "observe",
    index: 1,
    title: "看你授权的文件夹",
    detail: "只在这个边界里观察，不扫整台电脑。",
  },
  {
    id: "map",
    index: 2,
    title: "摸清项目结构",
    detail: "弄清有哪些材料和入口，方便接着读。",
  },
  {
    id: "tools",
    index: 3,
    title: "打开相关文件",
    detail: "在边界内搜索、阅读需要的内容。",
  },
  {
    id: "reason",
    index: 4,
    title: "对着原文想清楚",
    detail: "结论要能指回具体文件，不能空谈。",
  },
  {
    id: "evidence",
    index: 5,
    title: "够就说，不够就说不知道",
    detail: "不编造；说不清会标成不确定。",
  },
  {
    id: "candidate",
    index: 6,
    title: "整理出一段待确认的理解",
    detail: "这是草稿，还不算你已认下的结论。",
  },
  {
    id: "owner",
    index: 7,
    title: "请你确认",
    detail: "就这样 / 改一改 / 先不用——只有你能拍板。",
  },
  {
    id: "persist",
    index: 8,
    title: "记住，并继续留意变化",
    detail: "保存结果；文件夹再变会再提醒你，不会悄悄改掉你已确认的内容。",
  },
];

export type AgentPipelinePhase =
  | "idle"
  | "observe"
  | "map"
  | "tools"
  | "reason"
  | "candidate"
  | "owner"
  | "persist";

const ORDER: AgentProcessStepId[] = AGENT_PROCESS_STEPS.map((s) => s.id);

export function stepIndex(id: AgentProcessStepId): number {
  return ORDER.indexOf(id);
}

export function deriveProcessFromMemory(memory: {
  candidate?: { body?: unknown } | null;
  accepted?: { body?: unknown } | null;
  events?: unknown[];
  head?: { reviewState?: string; acceptedRevisionId?: string | null };
}): AgentProcessStepId {
  if (memory.accepted?.body) {
    if (memory.head?.reviewState === "review_needed") return "observe";
    return "persist";
  }
  if (memory.candidate?.body) return "owner";
  if (memory.events && memory.events.length > 0) return "tools";
  return "observe";
}

/**
 * Map durable AnalysisRun + tool receipts → 8-step cursor.
 * Used so UI follows real agent work, not hand-written phase jumps.
 */
export function deriveProcessFromRun(input: {
  runStatus?: string | null;
  progressSummary?: string | null;
  toolNames?: string[];
  hasCandidate?: boolean;
  hasAccepted?: boolean;
}): AgentProcessStepId {
  if (input.hasAccepted) return "persist";
  if (
    input.hasCandidate ||
    input.runStatus === "awaiting_owner" ||
    input.runStatus === "confirmation_required"
  ) {
    return "owner";
  }
  if (input.runStatus === "interrupted" || input.runStatus === "failed") {
    return "tools";
  }
  const tools = input.toolNames ?? [];
  // Real file open (revision or path) advances past search.
  if (tools.includes("read_revision") || tools.includes("read_path")) {
    return input.runStatus === "running" ? "reason" : "evidence";
  }
  if (tools.includes("search_text") || tools.includes("search_symbols")) {
    return "tools";
  }
  if (tools.includes("project_map")) return "map";
  if (input.runStatus === "running" || input.runStatus === "queued") {
    return "observe";
  }
  if (input.progressSummary?.includes("候选")) return "candidate";
  return "observe";
}

export function statusesForActive(
  active: AgentProcessStepId,
): Record<AgentProcessStepId, AgentProcessStepStatus> {
  const activeIdx = stepIndex(active);
  const out = {} as Record<AgentProcessStepId, AgentProcessStepStatus>;
  for (const step of AGENT_PROCESS_STEPS) {
    const i = stepIndex(step.id);
    if (i < activeIdx) out[step.id] = "done";
    else if (i === activeIdx) out[step.id] = "active";
    else out[step.id] = "pending";
  }
  return out;
}

export function statusesAllDone(): Record<
  AgentProcessStepId,
  AgentProcessStepStatus
> {
  const out = {} as Record<AgentProcessStepId, AgentProcessStepStatus>;
  for (const step of AGENT_PROCESS_STEPS) out[step.id] = "done";
  return out;
}

export function resolveProcessStatuses(input: {
  pipelinePhase: AgentPipelinePhase | null;
  memory: {
    candidate?: { body?: unknown } | null;
    accepted?: { body?: unknown } | null;
    events?: unknown[];
    head?: { reviewState?: string; acceptedRevisionId?: string | null };
  } | null;
  connected: boolean;
  /** Live analysis run (preferred over coarse pipelinePhase when present). */
  run?: {
    status?: string | null;
    progressSummary?: string | null;
  } | null;
  toolNames?: string[];
}): {
  active: AgentProcessStepId | null;
  statuses: Record<AgentProcessStepId, AgentProcessStepStatus>;
  caption: string;
} {
  const { pipelinePhase, memory, connected, run, toolNames } = input;

  if (pipelinePhase && pipelinePhase !== "idle") {
    // Prefer real tool progress when receipts already exist mid-pipeline.
    if (toolNames && toolNames.length > 0 && pipelinePhase === "tools") {
      const fromRun = deriveProcessFromRun({
        runStatus: run?.status ?? "running",
        progressSummary: run?.progressSummary,
        toolNames,
        hasCandidate: Boolean(memory?.candidate?.body),
        hasAccepted: Boolean(memory?.accepted?.body),
      });
      return {
        active: fromRun,
        statuses: statusesForActive(fromRun),
        caption: run?.progressSummary?.trim() || "正在打开相关文件…",
      };
    }
    if (pipelinePhase === "persist") {
      return {
        active: "persist",
        statuses: statusesAllDone(),
        caption: "正在记住…",
      };
    }
    return {
      active: pipelinePhase,
      statuses: statusesForActive(pipelinePhase),
      caption: run?.progressSummary?.trim() || "正在按步骤阅读你的项目",
    };
  }

  if (!connected || !memory) {
    return {
      active: null,
      statuses: statusesForActive("observe"),
      caption: "选好文件夹后，会按这些步骤工作。",
    };
  }

  if (memory.accepted?.body && memory.head?.reviewState !== "review_needed") {
    return {
      active: "persist",
      statuses: statusesAllDone(),
      caption: "理解已确认；有新变化会再提醒你。",
    };
  }

  if (run?.status || (toolNames && toolNames.length > 0)) {
    const active = deriveProcessFromRun({
      runStatus: run?.status,
      progressSummary: run?.progressSummary,
      toolNames,
      hasCandidate: Boolean(memory.candidate?.body),
      hasAccepted: Boolean(memory.accepted?.body),
    });
    let caption = run?.progressSummary?.trim() || "进度在这里。";
    if (active === "owner") {
      caption = run?.progressSummary?.trim() || "有一段理解等你确认。";
    }
    return {
      active,
      statuses: statusesForActive(active),
      caption,
    };
  }

  const active = deriveProcessFromMemory(memory);
  let caption = "进度在这里。";
  if (active === "owner") {
    caption = "有一段理解等你确认。";
  } else if (active === "tools" || active === "reason" || active === "evidence") {
    caption = "已看到变化；正在加强阅读与依据。";
  } else if (
    active === "observe" &&
    memory.head?.reviewState === "review_needed"
  ) {
    caption = "文件夹有新变化，需要再看一遍。";
  }

  return {
    active,
    statuses: statusesForActive(active),
    caption,
  };
}
