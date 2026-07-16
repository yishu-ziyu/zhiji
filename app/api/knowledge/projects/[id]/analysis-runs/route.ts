import { NextRequest, NextResponse } from "next/server";
import { createAgentModelLoop } from "@/shared/project-memory/agent-model-loop";
import {
  getAgentMemoryService,
  runStateReconstruction,
} from "@/shared/project-memory/reconstruct";

type Ctx = { params: Promise<{ id: string }> };

/**
 * AnalysisRun path: AgentMemoryService only (Reader + CandidateWriter).
 * Never injects OwnerDecisionWriter.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  try {
    const body = (await req.json()) as {
      matterId?: string;
      eventIds?: string[];
      trigger?: "source_change" | "owner_question" | "retry";
      whySourceQuotes?: string[];
      relatedActionIds?: string[];
    };
    if (!body.matterId?.trim()) {
      return NextResponse.json({ error: "matterId 必填" }, { status: 400 });
    }
    const service = getAgentMemoryService();
    const model = createAgentModelLoop({
      mode: process.env.AGENT_RUN_MODE === "model" ? "model" : "deterministic",
    });
    const result = await runStateReconstruction(service, model, {
      projectId,
      matterId: body.matterId.trim(),
      eventIds: body.eventIds,
      trigger: body.trigger,
      whySourceQuotes: body.whySourceQuotes,
      relatedActionIds: body.relatedActionIds,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败";
    const status = message.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
