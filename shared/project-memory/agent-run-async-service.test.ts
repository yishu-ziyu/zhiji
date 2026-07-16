import { describe, expect, it, vi } from "vitest";
import {
  createAsyncAgentRunService,
  type AsyncRunRequest,
  type AsyncRunRunner,
} from "./agent-run-async-service";
import type { AnalysisRun, AgentRunRepository, AgentRunView } from "./types";

function memRepo() {
  const runs = new Map<string, AnalysisRun>();
  const repo: AgentRunRepository = {
    async createRun(run) {
      const existing = runs.get(run.id);
      if (existing) return { ...existing };
      const copy = { ...run, eventIds: [...run.eventIds] };
      runs.set(run.id, copy);
      return { ...copy, eventIds: [...copy.eventIds] };
    },
    async updateRun(run) {
      if (!runs.has(run.id)) throw new Error("not found");
      const copy = { ...run, eventIds: [...run.eventIds] };
      runs.set(run.id, copy);
      return { ...copy, eventIds: [...copy.eventIds] };
    },
    async getRun(projectId, runId) {
      const r = runs.get(runId);
      if (!r || r.projectId !== projectId) return null;
      return { ...r, eventIds: [...r.eventIds] };
    },
    async listRuns(projectId, matterId) {
      return [...runs.values()]
        .filter((r) => r.projectId === projectId)
        .filter((r) => !matterId || r.matterId === matterId)
        .map((r) => ({ ...r, eventIds: [...r.eventIds] }));
    },
    async listQueuedRuns() {
      return [...runs.values()]
        .filter((r) => r.status === "queued")
        .map((r) => ({ ...r, eventIds: [...r.eventIds] }));
    },
    async appendToolReceipt() {},
    async listToolReceipts() {
      return [];
    },
    async requestInterrupt(projectId, runId) {
      const r = runs.get(runId);
      if (!r || r.projectId !== projectId) throw new Error("not found");
      const next = {
        ...r,
        interruptRequested: true,
        status: "interrupted" as const,
        stopReason: "owner_interrupt" as const,
        eventIds: [...r.eventIds],
      };
      runs.set(runId, next);
      return { ...next, eventIds: [...next.eventIds] };
    },
    async getRunView(projectId, runId): Promise<AgentRunView | null> {
      const run = await repo.getRun(projectId, runId);
      if (!run) return null;
      return { run, toolReceipts: [], candidate: undefined };
    },
  };
  return { repo, runs };
}

const baseReq = (): AsyncRunRequest => ({
  projectId: "p1",
  matterId: "m1",
  trigger: "owner_question",
  eventIds: ["e1"],
  ownerUtterance: "现在怎样？",
  idempotencyKey: "idem-1",
});

describe("AsyncAgentRunService (PR-10, Matt TDD seams)", () => {
  it("enqueue persists queued run; same idempotency key returns same run id", async () => {
    const { repo } = memRepo();
    const svc = createAsyncAgentRunService({ repo });
    const a = await svc.enqueue(baseReq());
    expect(a.status).toBe("queued");
    const b = await svc.enqueue(baseReq());
    expect(b.id).toBe(a.id);
    expect(await repo.listRuns("p1")).toHaveLength(1);
  });

  it("worker leases run, invokes runner once with utterance, completes", async () => {
    const { repo } = memRepo();
    const runner: AsyncRunRunner = vi.fn(async (run, meta) => {
      expect(run.id).toBeTruthy();
      expect(meta.ownerUtterance).toBe("现在怎样？");
      return { ok: true as const, progressSummary: "done" };
    });
    const svc = createAsyncAgentRunService({ repo, runner });
    const run = await svc.enqueue({ ...baseReq(), idempotencyKey: "idem-2" });
    const processed = await svc.processNext();
    expect(processed?.id).toBe(run.id);
    expect(runner).toHaveBeenCalledTimes(1);
    const final = await repo.getRun("p1", run.id);
    expect(final?.status).toBe("completed");
  });

  it("cancel before process prevents runner side effects", async () => {
    const { repo } = memRepo();
    const runner: AsyncRunRunner = vi.fn(async () => ({
      ok: true as const,
      progressSummary: "should not run",
    }));
    const svc = createAsyncAgentRunService({ repo, runner });
    const run = await svc.enqueue({ ...baseReq(), idempotencyKey: "idem-3" });
    await svc.cancel("p1", run.id);
    const processed = await svc.processNext();
    expect(processed).toBeNull();
    expect(runner).not.toHaveBeenCalled();
    const final = await repo.getRun("p1", run.id);
    expect(final?.status).toBe("interrupted");
    expect(final?.interruptRequested).toBe(true);
  });

  it("runner failure marks failed without inventing success", async () => {
    const { repo } = memRepo();
    const runner: AsyncRunRunner = vi.fn(async () => ({
      ok: false as const,
      error: "model down",
    }));
    const svc = createAsyncAgentRunService({ repo, runner });
    const run = await svc.enqueue({ ...baseReq(), idempotencyKey: "idem-4" });
    await svc.processNext();
    const final = await repo.getRun("p1", run.id);
    expect(final?.status).toBe("failed");
    expect(final?.error).toMatch(/model down/);
  });

  it("new service instance re-discovers durable queued runs from repo", async () => {
    const { repo } = memRepo();
    const a = createAsyncAgentRunService({ repo });
    const run = await a.enqueue({
      ...baseReq(),
      idempotencyKey: "idem-restart",
      ownerUtterance: "重启后仍应处理",
    });
    expect(run.status).toBe("queued");
    expect(run.ownerUtterance).toBe("重启后仍应处理");

    const runner: AsyncRunRunner = vi.fn(async (r, meta) => {
      expect(r.id).toBe(run.id);
      expect(meta.ownerUtterance).toBe("重启后仍应处理");
      return { ok: true as const, progressSummary: "after-restart" };
    });
    // Fresh process: empty in-memory Maps; only durable repo rows.
    const b = createAsyncAgentRunService({ repo, runner });
    const processed = await b.processNext();
    expect(processed?.id).toBe(run.id);
    expect(runner).toHaveBeenCalledTimes(1);
    const final = await repo.getRun("p1", run.id);
    expect(final?.status).toBe("completed");
  });

  it("does not write synthesizing phase before runner starts", async () => {
    const { repo, runs } = memRepo();
    let sawPreRunnerStatuses: string[] = [];
    const runner: AsyncRunRunner = vi.fn(async (r) => {
      sawPreRunnerStatuses = [runs.get(r.id)?.status ?? ""];
      expect(runs.get(r.id)?.progressSummary ?? "").not.toMatch(
        /phase:synthesizing/,
      );
      return { ok: true as const, progressSummary: "ok" };
    });
    const svc = createAsyncAgentRunService({ repo, runner });
    await svc.enqueue({ ...baseReq(), idempotencyKey: "idem-phase" });
    await svc.processNext({ projectId: "p1" });
    expect(runner).toHaveBeenCalled();
    expect(sawPreRunnerStatuses[0]).toBe("running");
  });
});
