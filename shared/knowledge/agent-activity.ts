/**
 * E7/E8: derive Agent process steps + feed + agent ids from knowledge facts.
 * Does not call models; never invents agent events.
 */
import type {
  ActionItem,
  AgentActivityView,
  AgentFeedItem,
  AgentProcessStepStatus,
  AgentProcessStepView,
  KnowledgeCard,
  WorkEvent,
} from "@/shared/types/knowledge";

export const AGENT_PROCESS_STEP_DEFS: Array<{ id: string; title: string }> = [
  { id: "observe", title: "看你授权的文件夹" },
  { id: "map", title: "摸清项目结构" },
  { id: "tools", title: "打开相关文件" },
  { id: "reason", title: "对着原文想清楚" },
  { id: "evidence", title: "够就说，不够就说不知道" },
  { id: "candidate", title: "整理出一段待确认的理解" },
  { id: "owner", title: "请你确认" },
  { id: "persist", title: "记住，并继续留意变化" },
];

export function isAgentActor(actor: string): boolean {
  return actor.startsWith("agent:") || actor === "agent";
}

export function agentDisplayName(actor: string): string {
  if (actor === "agent:project-reviewer") return "Agent 项目复核";
  if (actor === "agent:external") return "外部 Agent";
  if (actor.startsWith("agent:")) {
    const slug = actor.slice("agent:".length).trim();
    if (!slug) return "Agent";
    return `Agent ${slug}`;
  }
  return actor;
}

export function listAgentActors(events: WorkEvent[]): string[] {
  const set = new Set<string>();
  for (const event of events) {
    if (isAgentActor(event.actor)) set.add(event.actor);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function feedKind(type: WorkEvent["type"]): AgentFeedItem["kind"] {
  if (type === "result") return "result";
  if (type === "decision") return "decision";
  if (type === "status_change" || type === "next_step_change") return "status";
  if (type === "comment") return "comment";
  return "other";
}

export function buildAgentFeed(
  events: WorkEvent[],
  limit = 24,
): AgentFeedItem[] {
  return events
    .filter((event) => isAgentActor(event.actor))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      actor: event.actor,
      actorLabel: agentDisplayName(event.actor),
      kind: feedKind(event.type),
      body: event.body || event.type,
      createdAt: event.createdAt,
      ref:
        event.type === "result" || event.type === "decision"
          ? ({ kind: "event" as const, id: event.id })
          : ({ kind: "event" as const, id: event.id }),
    }));
}

/**
 * Map project facts → eight process statuses.
 * Evidence-backed heuristics only (materials / agent results / human await / checkpoint).
 */
export function deriveAgentProcessSteps(input: {
  cards: KnowledgeCard[];
  workItems: ActionItem[];
  events: WorkEvent[];
  hasCheckpoint: boolean;
}): {
  steps: AgentProcessStepView[];
  activeStepId: string | null;
  caption: string;
} {
  const materialCount = input.cards.filter(
    (c) => Boolean(c.content?.trim() || c.title?.trim() || c.sourceFileId),
  ).length;
  const agentEvents = input.events.filter((e) => isAgentActor(e.actor));
  const agentResults = agentEvents.filter((e) => e.type === "result");
  const hasReview = agentResults.some(
    (e) => e.meta && typeof e.meta === "object" && "review" in (e.meta as object),
  );
  const awaitingHuman = input.workItems.some((w) => {
    if (w.status === "confirmed") return true;
    if (w.status !== "doing") return false;
    return agentResults.some((e) => e.workItemId === w.id);
  });

  // Highest reached step index (0..7); statuses = done before, active at, pending after.
  let reached = 0; // observe
  if (materialCount > 0) reached = 1; // map
  if (materialCount >= 1) reached = Math.max(reached, 2); // tools available
  if (agentEvents.length > 0 || materialCount >= 3) reached = Math.max(reached, 2);
  if (agentResults.length > 0 || hasReview) reached = Math.max(reached, 4); // through evidence
  if (agentResults.length > 0) reached = Math.max(reached, 5); // candidate
  if (awaitingHuman) reached = 6; // owner
  else if (agentResults.length > 0 && input.hasCheckpoint) reached = 7; // persist
  else if (agentResults.length > 0 && !awaitingHuman) reached = 6; // at owner or just past candidate

  // Empty project: stay on observe.
  if (materialCount === 0 && agentEvents.length === 0) reached = 0;

  // All settled: materials + optional agent work confirmed via checkpoint, no await.
  const allSettled =
    materialCount > 0 &&
    input.hasCheckpoint &&
    !awaitingHuman &&
    (agentResults.length === 0 || agentResults.length > 0);

  const steps: AgentProcessStepView[] = AGENT_PROCESS_STEP_DEFS.map((def, index) => {
    let status: AgentProcessStepStatus;
    if (allSettled && agentResults.length > 0) {
      status = "done";
    } else if (allSettled && agentResults.length === 0) {
      // Materials only + checkpoint: observe..map done, rest pending except mild tools.
      status = index <= 1 ? "done" : index === 2 ? "active" : "pending";
    } else if (index < reached) status = "done";
    else if (index === reached) status = "active";
    else status = "pending";
    return { id: def.id, title: def.title, status };
  });

  const activeStep =
    steps.find((s) => s.status === "active")?.id ??
    (allSettled ? "persist" : "observe");

  let caption = "还没有 Agent 执行记录；授权或跑 Agent 后，步骤会跟着推进。";
  if (awaitingHuman) {
    caption = "Agent 已有结果，正在等你确认。";
  } else if (agentResults.length > 0) {
    caption = `已有 ${agentResults.length} 条 Agent 结果可回看。`;
  } else if (materialCount > 0) {
    caption = "已有材料；Agent 尚未写入结果。";
  }

  return { steps, activeStepId: activeStep, caption };
}

export function buildAgentActivityView(input: {
  cards: KnowledgeCard[];
  workItems: ActionItem[];
  events: WorkEvent[];
  hasCheckpoint: boolean;
}): AgentActivityView {
  const agentIds = listAgentActors(input.events);
  const feed = buildAgentFeed(input.events);
  const process = deriveAgentProcessSteps(input);
  return {
    hasAgentEvents: agentIds.length > 0,
    activeStepId: process.activeStepId,
    caption: process.caption,
    steps: process.steps,
    feed,
    agentIds,
  };
}
