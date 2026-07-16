/**
 * Async Agent Run service (PR-10): enqueue → lease → process → cancel.
 * Coordination only; model/tool work is injected via AsyncRunRunner.
 *
 * Durability: processNext discovers queued runs from the repository
 * (not only process-local Maps), so restart re-picks persisted queued rows.
 * Progress phases advance from real runner outcomes — not synthetic pre-runner writes.
 *
 * Matt TDD seams: enqueue (idempotent), processNext, cancel.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  transitionAgentRun,
  type AgentRunStatus,
} from "./agent-run-state-machine";
import type { AgentRunRepository, AnalysisRun } from "./types";

export type AsyncRunRequest = {
  projectId: string;
  matterId: string;
  trigger: AnalysisRun["trigger"];
  eventIds?: string[];
  ownerUtterance?: string;
  grantId?: string;
  /** Same key + project + matter → same run id. */
  idempotencyKey?: string;
};

export type AsyncRunRunnerResult =
  | {
      ok: true;
      progressSummary?: string;
      candidateRevisionId?: string;
      /** Optional real phase after runner (default synthesizing → complete). */
      terminalPhase?: "awaiting_owner" | "completed";
    }
  | { ok: false; error: string };

export type AsyncRunRunner = (
  run: AnalysisRun,
  meta: { ownerUtterance?: string },
) => Promise<AsyncRunRunnerResult>;

export type AsyncAgentRunService = {
  enqueue(req: AsyncRunRequest): Promise<AnalysisRun>;
  processNext(filter?: { projectId?: string }): Promise<AnalysisRun | null>;
  cancel(projectId: string, runId: string): Promise<AnalysisRun | null>;
  getPhase(runId: string): AgentRunStatus | undefined;
};

function stableRunId(req: AsyncRunRequest): string {
  if (!req.idempotencyKey?.trim()) return randomUUID();
  const material = [
    req.projectId,
    req.matterId,
    req.trigger,
    req.idempotencyKey.trim(),
  ].join("\0");
  const digest = createHash("sha256").update(material).digest("hex").slice(0, 32);
  return `run_${digest}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function phaseToAnalysisStatus(
  phase: AgentRunStatus,
): AnalysisRun["status"] {
  switch (phase) {
    case "queued":
      return "queued";
    case "leased":
    case "planning":
    case "tooling":
    case "synthesizing":
    case "paused":
    case "cancelling":
      return "running";
    case "awaiting_owner":
      return "awaiting_owner";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "interrupted";
    default:
      return "failed";
  }
}

function mapStatusToPhase(status: AnalysisRun["status"]): AgentRunStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "tooling";
    case "awaiting_owner":
    case "confirmation_required":
      return "awaiting_owner";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "interrupted":
      return "cancelled";
    default:
      return "failed";
  }
}

export function createAsyncAgentRunService(options: {
  repo: AgentRunRepository;
  runner?: AsyncRunRunner;
  clock?: () => string;
}): AsyncAgentRunService {
  const clock = options.clock ?? nowIso;
  const runner: AsyncRunRunner =
    options.runner ??
    (async () => ({ ok: false, error: "no runner configured" }));

  /** Soft cache only — never the sole discovery source for processNext. */
  const phases = new Map<string, AgentRunStatus>();
  const knownProjects = new Set<string>();
  const interruptFlags = new Map<string, boolean>();
  const idempotencyIndex = new Map<string, string>();

  async function persist(
    run: AnalysisRun,
    phase: AgentRunStatus,
    patch?: Partial<AnalysisRun>,
  ): Promise<AnalysisRun> {
    phases.set(run.id, phase);
    knownProjects.add(run.projectId);
    return options.repo.updateRun({
      ...run,
      ...patch,
      status: phaseToAnalysisStatus(phase),
      updatedAt: clock(),
      progressSummary:
        patch?.progressSummary ??
        `[phase:${phase}] ${patch?.error ?? run.progressSummary ?? ""}`.trim(),
    });
  }

  async function discoverQueued(filter?: {
    projectId?: string;
  }): Promise<AnalysisRun[]> {
    if (!filter?.projectId) {
      return options.repo.listQueuedRuns();
    }
    const projectIds = filter?.projectId
      ? [filter.projectId]
      : [...knownProjects];
    const byId = new Map<string, AnalysisRun>();
    for (const projectId of projectIds) {
      // Durable: listRuns recovers queued rows after process restart.
      const listed = await options.repo.listRuns(projectId);
      for (const r of listed) {
        if (r.status === "queued") byId.set(r.id, r);
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  return {
    async enqueue(req) {
      const projectId = req.projectId.trim();
      const matterId = req.matterId.trim();
      if (!projectId || !matterId) {
        throw new Error("projectId and matterId required");
      }
      knownProjects.add(projectId);

      if (req.idempotencyKey?.trim()) {
        const ik = `${projectId}\0${matterId}\0${req.idempotencyKey.trim()}`;
        const knownId = idempotencyIndex.get(ik);
        if (knownId) {
          const existing = await options.repo.getRun(projectId, knownId);
          if (existing) return existing;
        }
        const stableId = stableRunId(req);
        const existing = await options.repo.getRun(projectId, stableId);
        if (existing) {
          idempotencyIndex.set(ik, existing.id);
          phases.set(existing.id, mapStatusToPhase(existing.status));
          return existing;
        }
      }

      const id = stableRunId(req);
      const t = clock();
      const ownerUtterance = req.ownerUtterance?.trim() || undefined;
      const run: AnalysisRun = {
        id,
        projectId,
        matterId,
        trigger: req.trigger,
        eventIds: req.eventIds ?? [],
        status: "queued",
        attempt: 1,
        createdAt: t,
        updatedAt: t,
        grantId: req.grantId,
        ownerUtterance,
        progressSummary: "[phase:queued] accepted",
      };
      const stored = await options.repo.createRun(run);
      phases.set(stored.id, "queued");
      if (req.idempotencyKey?.trim()) {
        idempotencyIndex.set(
          `${projectId}\0${matterId}\0${req.idempotencyKey.trim()}`,
          stored.id,
        );
      }
      return stored;
    },

    async processNext(filter) {
      const ordered = await discoverQueued(filter);

      for (const current of ordered) {
        if (filter?.projectId && current.projectId !== filter.projectId) {
          continue;
        }
        if (current.interruptRequested || interruptFlags.get(current.id)) {
          await persist(current, "cancelled", {
            interruptRequested: true,
            stopReason: "owner_interrupt",
            progressSummary: "[phase:cancelled] skipped",
          });
          continue;
        }

        let phase: AgentRunStatus = "queued";
        const lease = transitionAgentRun(phase, { type: "lease" });
        if (!lease.ok) continue;
        phase = lease.status;
        // Lease only before runner — no synthetic planning/tooling/synthesizing burst.
        let run = await persist(current, phase, {
          progressSummary: "[phase:leased] worker acquired",
        });

        const beforeRun = await options.repo.getRun(run.projectId, run.id);
        if (
          !beforeRun ||
          beforeRun.interruptRequested ||
          interruptFlags.get(run.id)
        ) {
          return persist(beforeRun ?? run, "cancelled", {
            interruptRequested: true,
            stopReason: "owner_interrupt",
            progressSummary: "[phase:cancelled] skipped runner",
          });
        }

        // Enter tooling only as runner is about to execute (truthful progress).
        // State machine: leased → planning → tooling.
        const plan = transitionAgentRun(phase, { type: "start_plan" });
        if (plan.ok) phase = plan.status;
        const startTools = transitionAgentRun(phase, { type: "start_tools" });
        if (startTools.ok) {
          phase = startTools.status;
          run = await persist(beforeRun, phase, {
            progressSummary: "[phase:tooling] runner started",
          });
        }

        const latestBefore = await options.repo.getRun(run.projectId, run.id);
        if (
          !latestBefore ||
          latestBefore.interruptRequested ||
          interruptFlags.get(run.id)
        ) {
          return persist(latestBefore ?? run, "cancelled", {
            interruptRequested: true,
            stopReason: "owner_interrupt",
            progressSummary: "[phase:cancelled] during tooling",
          });
        }

        const result = await runner(latestBefore, {
          ownerUtterance: latestBefore.ownerUtterance,
        });
        if (!result.ok) {
          const fail = transitionAgentRun(phase, { type: "fail" });
          phase = fail.ok ? fail.status : "failed";
          return persist(latestBefore, phase, {
            error: result.error,
            progressSummary: `[phase:failed] ${result.error}`,
          });
        }

        // Synthesis only after runner returned ok (not before tools).
        const synth = transitionAgentRun(phase, { type: "start_synthesis" });
        if (synth.ok) {
          phase = synth.status;
          await persist(latestBefore, phase, {
            progressSummary: "[phase:synthesizing] runner finished",
          });
        }

        if (result.candidateRevisionId) {
          const awaitOwner = transitionAgentRun(phase, {
            type: "candidate_ready",
          });
          if (awaitOwner.ok) {
            return persist(latestBefore, awaitOwner.status, {
              candidateRevisionId: result.candidateRevisionId,
              progressSummary:
                result.progressSummary ?? "[phase:awaiting_owner]",
            });
          }
        }

        const completed = transitionAgentRun(phase, { type: "complete" });
        phase = completed.ok ? completed.status : "completed";
        return persist(latestBefore, phase, {
          candidateRevisionId: result.candidateRevisionId,
          progressSummary: result.progressSummary ?? "[phase:completed]",
        });
      }

      return null;
    },

    async cancel(projectId, runId) {
      const run = await options.repo.getRun(projectId, runId);
      if (!run) return null;
      const phase = phases.get(runId) ?? mapStatusToPhase(run.status);
      if (
        phase === "completed" ||
        phase === "failed" ||
        phase === "cancelled"
      ) {
        return run;
      }

      interruptFlags.set(runId, true);

      let p: AgentRunStatus = phase;
      const toCancel = transitionAgentRun(p, { type: "cancel" });
      p = toCancel.ok ? toCancel.status : "cancelling";
      const done = transitionAgentRun(
        p === "cancelling" ? "cancelling" : "cancelling",
        { type: "cancel_done" },
      );
      const finalPhase: AgentRunStatus = done.ok ? done.status : "cancelled";
      phases.set(runId, finalPhase);

      return options.repo.updateRun({
        ...run,
        status: "interrupted",
        interruptRequested: true,
        stopReason: "owner_interrupt",
        progressSummary: `[phase:${finalPhase}] cancelled`,
        updatedAt: clock(),
      });
    },

    getPhase(runId) {
      return phases.get(runId);
    },
  };
}
