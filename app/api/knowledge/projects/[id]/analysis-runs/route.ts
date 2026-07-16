import { NextRequest, NextResponse } from "next/server";
import { createAgentModelLoop } from "@/shared/project-memory/agent-model-loop";
import {
  createProjectAgentRuntime,
  runToolAugmentedAnalysis,
} from "@/shared/project-memory/agent-runtime";
import {
  getAgentMemoryService,
  runStateReconstruction,
} from "@/shared/project-memory/reconstruct";
import { getSharedProjectMemoryStore } from "@/shared/project-memory/runtime";

type Ctx = { params: Promise<{ id: string }> };

/**
 * AnalysisRun: tool-augmented ProjectAgentRuntime by default.
 * AGENT_TOOL_LOOP=0 → legacy single-shot propose.
 * AGENT_RUN_MODE=deterministic → no live model.
 *
 * GET ?runId= → AgentRunView (poll progress without re-running)
 * GET (no runId) → recent runs for project (optional matterId)
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  try {
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
  const { id: projectId } = await ctx.params;
  try {
    const body = (await req.json()) as {
      matterId?: string;
      eventIds?: string[];
      trigger?: "source_change" | "owner_question" | "retry";
      whySourceQuotes?: string[];
      relatedActionIds?: string[];
      ownerUtterance?: string;
    };
    if (!body.matterId?.trim()) {
      return NextResponse.json({ error: "matterId 必填" }, { status: 400 });
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
