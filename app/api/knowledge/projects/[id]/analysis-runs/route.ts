import { NextRequest, NextResponse } from "next/server";
import { createAgentModelLoop } from "@/shared/project-memory/agent-model-loop";
import {
  createProjectAgentRuntime,
  runToolAugmentedAnalysis,
} from "@/shared/project-memory/agent-runtime";
import {
  createAsyncAgentRunService,
  type AsyncRunRunner,
} from "@/shared/project-memory/agent-run-async-service";
import {
  getAgentMemoryService,
  runStateReconstruction,
} from "@/shared/project-memory/reconstruct";
import { getSharedProjectMemoryStore } from "@/shared/project-memory/runtime";
import { checkLocalTrustFromRequest } from "@/shared/security/local-session";

/** One process-local queue consumer; durable discovery comes from SQLite. */
let asyncService: ReturnType<typeof createAsyncAgentRunService> | null = null;
let drainPromise: Promise<void> | null = null;
let drainRequested = false;

function getAsyncService() {
  if (asyncService) return asyncService;
  const store = getSharedProjectMemoryStore();
  const runner: AsyncRunRunner = async (run, meta) => {
    try {
      const modelMode =
        process.env.AGENT_RUN_MODE === "deterministic"
          ? "deterministic"
          : "model";
      const result = await runToolAugmentedAnalysis(
        {
          projectId: run.projectId,
          matterId: run.matterId,
          eventIds: run.eventIds,
          trigger: run.trigger,
          ownerUtterance: meta.ownerUtterance,
          // Same durable id as outer enqueue → receipts/SSE match
          runId: run.id,
        },
        { modelMode, toolsEnabled: process.env.AGENT_TOOL_LOOP !== "0" },
      );
      if (result.run.status === "failed") {
        return {
          ok: false as const,
          error: result.run.error || "分析失败",
        };
      }
      return {
        ok: true as const,
        progressSummary: result.run.progressSummary,
        candidateRevisionId: result.run.candidateRevisionId,
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };
  asyncService = createAsyncAgentRunService({
    repo: {
      createRun: (r) => store.createRun(r),
      updateRun: (r) => store.updateRun(r),
      getRun: (p, id) => store.getRun(p, id),
      listRuns: (p, m) => store.listRuns(p, m),
      listQueuedRuns: () => store.listQueuedRuns(),
      appendToolReceipt: (x) => store.appendToolReceipt(x),
      listToolReceipts: (id) => store.listToolReceipts(id),
      requestInterrupt: (p, id) => store.requestInterrupt(p, id),
      getRunView: (p, id) => store.getRunView(p, id),
    },
    runner,
  });
  return asyncService;
}

/** Drain every durable queued row; safe to call from enqueue or a restart GET. */
function drainAsyncQueue(): Promise<void> {
  drainRequested = true;
  if (drainPromise) return drainPromise;
  const service = getAsyncService();
  drainPromise = (async () => {
    do {
      drainRequested = false;
      while (await service.processNext()) {
        // Serial execution prevents duplicate process-local leases.
      }
    } while (drainRequested);
  })().finally(() => {
    drainPromise = null;
  });
  return drainPromise;
}

type Ctx = { params: Promise<{ id: string }> };

/**
 * AnalysisRun: tool-augmented ProjectAgentRuntime by default.
 * AGENT_TOOL_LOOP=0 → legacy single-shot propose.
 * AGENT_RUN_MODE=deterministic → no live model.
 *
 * GET ?runId= → AgentRunView (poll progress without re-running)
 * GET (no runId) → recent runs for project (optional matterId)
 *
 * --- PR-10 async skeleton (opt-in draft only; default remains sync) ---
 * Target contract (PRD D-01): POST creates queued run → 202 + eventsUrl;
 * worker/lease executes; UI polls GET ?runId= or SSE.
 * Pure state machine: shared/project-memory/agent-run-state-machine.ts
 * Enable draft only when BOTH:
 *   process.env.ASYNC_ANALYSIS_RUNS_DRAFT === "1"
 *   and query ?async=1 (or body.async === true on POST)
 * Draft does NOT persist, does NOT start a worker, does NOT break 201 tests.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  try {
    // First read after an app restart resumes persisted queued work.
    void drainAsyncQueue().catch(() => {
      /* individual run failures are persisted */
    });
    const runId = req.nextUrl.searchParams.get("runId")?.trim();
    const matterId = req.nextUrl.searchParams.get("matterId")?.trim();
    const store = getSharedProjectMemoryStore();
    const runtime = createProjectAgentRuntime();

    if (runId) {
      const view = await runtime.get(projectId, runId);
      if (!view) {
        return NextResponse.json({ error: "运行不存在" }, { status: 404 });
      }
      return NextResponse.json({
        run: view.run,
        toolReceipts: view.toolReceipts,
        candidate: view.candidate ?? null,
        projectId,
      });
    }

    const runs = await store.listRuns(projectId, matterId || undefined);
    return NextResponse.json({
      runs: runs.slice(0, 20),
      projectId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const trust = checkLocalTrustFromRequest(req);
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
  const { id: projectId } = await ctx.params;
  try {
    const body = (await req.json()) as {
      matterId?: string;
      eventIds?: string[];
      trigger?: "source_change" | "owner_question" | "retry";
      whySourceQuotes?: string[];
      relatedActionIds?: string[];
      ownerUtterance?: string;
      /** PR-10 draft only — ignored unless ASYNC_ANALYSIS_RUNS_DRAFT=1 */
      async?: boolean;
    };
    if (!body.matterId?.trim()) {
      return NextResponse.json({ error: "matterId 必填" }, { status: 400 });
    }

    // PR-10: durable async path (opt-in). Default remains sync 201 for compatibility.
    // Enable: ASYNC_ANALYSIS_RUNS=1 or body.async=true or ?async=1
    // Draft-only (no worker): ASYNC_ANALYSIS_RUNS_DRAFT=1 alone → empty 202 (legacy tests).
    const asyncRequested =
      process.env.ASYNC_ANALYSIS_RUNS === "1" ||
      body.async === true ||
      req.nextUrl.searchParams.get("async") === "1";
    const draftOnly =
      process.env.ASYNC_ANALYSIS_RUNS_DRAFT === "1" &&
      process.env.ASYNC_ANALYSIS_RUNS !== "1" &&
      !body.async &&
      req.nextUrl.searchParams.get("async") !== "1";

    if (draftOnly) {
      // Never invent a phantom runId that cannot be GET/SSE'd.
      return NextResponse.json(
        {
          error:
            "ASYNC_ANALYSIS_RUNS_DRAFT  alone is disabled. Set ASYNC_ANALYSIS_RUNS=1 for durable async, or omit async for sync 201.",
        },
        { status: 400 },
      );
    }

    if (asyncRequested) {
      const svc = getAsyncService();
      const idempotencyKey =
        req.headers.get("idempotency-key")?.trim() ||
        req.headers.get("Idempotency-Key")?.trim() ||
        undefined;
      const run = await svc.enqueue({
        projectId,
        matterId: body.matterId.trim(),
        trigger: body.trigger ?? "owner_question",
        eventIds: body.eventIds,
        ownerUtterance: body.ownerUtterance,
        idempotencyKey,
      });
      // Fire-and-forget worker step (in-process). Durable row already on disk.
      // UI should subscribe to SSE eventsUrl; GET ?runId= remains for poll fallback.
      void drainAsyncQueue().catch(() => {
        /* worker errors stored on run */
      });
      const eventsUrl = `/api/knowledge/projects/${encodeURIComponent(projectId)}/analysis-runs/${encodeURIComponent(run.id)}/events`;
      return NextResponse.json(
        {
          accepted: true,
          runId: run.id,
          status: run.status,
          run,
          eventsUrl,
          pollUrl: `/api/knowledge/projects/${encodeURIComponent(projectId)}/analysis-runs?runId=${encodeURIComponent(run.id)}`,
          projectId,
          matterId: body.matterId.trim(),
          mode: "async",
        },
        { status: 202 },
      );
    }

    // Default: real LLM. Only AGENT_RUN_MODE=deterministic forces offline path.
    const modelMode =
      process.env.AGENT_RUN_MODE === "deterministic"
        ? "deterministic"
        : "model";
    const useTools = process.env.AGENT_TOOL_LOOP !== "0";
    const requireLiveModel =
      modelMode === "model" && process.env.AGENT_ALLOW_DETERMINISTIC_FALLBACK !== "1";

    if (useTools) {
      const result = await runToolAugmentedAnalysis(
        {
          projectId,
          matterId: body.matterId.trim(),
          eventIds: body.eventIds,
          trigger: body.trigger,
          whySourceQuotes: body.whySourceQuotes,
          relatedActionIds: body.relatedActionIds,
          ownerUtterance: body.ownerUtterance,
        },
        { modelMode, toolsEnabled: true },
      );
      if (result.run.status === "failed") {
        const modelFail =
          requireLiveModel &&
          (result.run.modelReceipt?.fallback?.used === true ||
            /模型|网关|LLM|读懂/i.test(
              `${result.run.error ?? ""} ${result.run.progressSummary ?? ""}`,
            ));
        return NextResponse.json(
          {
            error:
              result.run.error ||
              (modelFail
                ? "真模型调用失败，已拒绝静默降级。请检查 LLM 网关与密钥。"
                : "分析失败：未能形成有来源的理解。"),
            run: result.run,
            candidate: null,
            toolReceipts: result.toolReceipts,
            projectId,
            modelReceipt: result.run.modelReceipt,
          },
          { status: modelFail ? 502 : 422 },
        );
      }
      if (
        requireLiveModel &&
        result.run.modelReceipt?.fallback?.used === true
      ) {
        return NextResponse.json(
          {
            error: "真模型调用失败，已拒绝静默降级。请检查 LLM 网关与密钥。",
            run: result.run,
            candidate: null,
            toolReceipts: result.toolReceipts,
            projectId,
            modelReceipt: result.run.modelReceipt,
          },
          { status: 502 },
        );
      }
      return NextResponse.json(
        {
          run: result.run,
          candidate: result.candidate,
          toolReceipts: result.toolReceipts,
          projectId,
          modelMode,
          liveModel: result.run.modelReceipt?.fallback?.used !== true,
        },
        { status: 201 },
      );
    }

    const service = getAgentMemoryService();
    const model = createAgentModelLoop({ mode: modelMode });
    const result = await runStateReconstruction(service, model, {
      projectId,
      matterId: body.matterId.trim(),
      eventIds: body.eventIds,
      trigger: body.trigger,
      whySourceQuotes: body.whySourceQuotes,
      relatedActionIds: body.relatedActionIds,
    });
    return NextResponse.json(
      {
        run: result.run,
        candidate: result.candidate,
        toolReceipts: [],
        projectId,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败";
    const status = message.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
