/**
 * Pure Agent Run state machine (PR-10).
 * No I/O — only legal transitions and invariants.
 */

export type AgentRunStatus =
  | "queued"
  | "leased"
  | "planning"
  | "tooling"
  | "synthesizing"
  | "awaiting_owner"
  | "paused"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "completed";

export type AgentRunEvent =
  | { type: "lease" }
  | { type: "start_plan" }
  | { type: "start_tools" }
  | { type: "start_synthesis" }
  | { type: "candidate_ready" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "cancel" }
  | { type: "cancel_done" }
  | { type: "fail"; reason?: string }
  | { type: "complete" };

const TERMINAL: ReadonlySet<AgentRunStatus> = new Set([
  "cancelled",
  "failed",
  "completed",
]);

/** Legal directed edges: from → allowed event types → to */
const TRANSITIONS: Record<
  AgentRunStatus,
  Partial<Record<AgentRunEvent["type"], AgentRunStatus>>
> = {
  queued: {
    lease: "leased",
    cancel: "cancelling",
    fail: "failed",
  },
  leased: {
    start_plan: "planning",
    pause: "paused",
    cancel: "cancelling",
    fail: "failed",
  },
  planning: {
    start_tools: "tooling",
    start_synthesis: "synthesizing",
    pause: "paused",
    cancel: "cancelling",
    fail: "failed",
  },
  tooling: {
    start_synthesis: "synthesizing",
    start_tools: "tooling",
    pause: "paused",
    cancel: "cancelling",
    fail: "failed",
  },
  synthesizing: {
    candidate_ready: "awaiting_owner",
    complete: "completed",
    pause: "paused",
    cancel: "cancelling",
    fail: "failed",
  },
  awaiting_owner: {
    complete: "completed",
    cancel: "cancelling",
    fail: "failed",
  },
  paused: {
    resume: "leased",
    cancel: "cancelling",
    fail: "failed",
  },
  cancelling: {
    cancel_done: "cancelled",
    fail: "failed",
  },
  cancelled: {},
  failed: {},
  completed: {},
};

export function isTerminalStatus(status: AgentRunStatus): boolean {
  return TERMINAL.has(status);
}

export function canTransition(
  from: AgentRunStatus,
  event: AgentRunEvent["type"],
): boolean {
  return Boolean(TRANSITIONS[from]?.[event]);
}

export type TransitionResult =
  | { ok: true; status: AgentRunStatus }
  | { ok: false; status: AgentRunStatus; error: string };

export function transitionAgentRun(
  from: AgentRunStatus,
  event: AgentRunEvent,
): TransitionResult {
  if (isTerminalStatus(from)) {
    return {
      ok: false,
      status: from,
      error: `run already terminal: ${from}`,
    };
  }
  const next = TRANSITIONS[from]?.[event.type];
  if (!next) {
    return {
      ok: false,
      status: from,
      error: `illegal transition ${from} + ${event.type}`,
    };
  }
  return { ok: true, status: next };
}

/** Whether a new model/tool call is allowed in this status. */
export function allowsSideEffects(status: AgentRunStatus): boolean {
  return (
    status === "planning" ||
    status === "tooling" ||
    status === "synthesizing" ||
    status === "leased"
  );
}
