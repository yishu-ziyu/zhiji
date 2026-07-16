import { describe, expect, it } from "vitest";
import {
  allowsSideEffects,
  canTransition,
  isTerminalStatus,
  transitionAgentRun,
} from "./agent-run-state-machine";

describe("agent-run-state-machine (PR-10)", () => {
  it("walks happy path to awaiting_owner then completed", () => {
    let s = transitionAgentRun("queued", { type: "lease" });
    expect(s).toEqual({ ok: true, status: "leased" });
    s = transitionAgentRun("leased", { type: "start_plan" });
    expect(s.ok && s.status).toBe("planning");
    s = transitionAgentRun("planning", { type: "start_tools" });
    expect(s.ok && s.status).toBe("tooling");
    s = transitionAgentRun("tooling", { type: "start_synthesis" });
    expect(s.ok && s.status).toBe("synthesizing");
    s = transitionAgentRun("synthesizing", { type: "candidate_ready" });
    expect(s.ok && s.status).toBe("awaiting_owner");
    s = transitionAgentRun("awaiting_owner", { type: "complete" });
    expect(s.ok && s.status).toBe("completed");
    expect(isTerminalStatus("completed")).toBe(true);
  });

  it("rejects illegal transitions and terminal mutations", () => {
    expect(canTransition("queued", "complete")).toBe(false);
    const bad = transitionAgentRun("queued", { type: "complete" });
    expect(bad.ok).toBe(false);
    const term = transitionAgentRun("failed", { type: "lease" });
    expect(term.ok).toBe(false);
  });

  it("cancel and pause paths", () => {
    expect(transitionAgentRun("tooling", { type: "pause" })).toEqual({
      ok: true,
      status: "paused",
    });
    expect(transitionAgentRun("paused", { type: "resume" })).toEqual({
      ok: true,
      status: "leased",
    });
    expect(transitionAgentRun("planning", { type: "cancel" })).toEqual({
      ok: true,
      status: "cancelling",
    });
    expect(transitionAgentRun("cancelling", { type: "cancel_done" })).toEqual({
      ok: true,
      status: "cancelled",
    });
    expect(allowsSideEffects("paused")).toBe(false);
    expect(allowsSideEffects("tooling")).toBe(true);
  });
});
