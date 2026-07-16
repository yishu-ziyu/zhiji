import { NextResponse } from "next/server";
import { createProjectAgentRuntime } from "@/shared/project-memory/agent-runtime";
import { checkLocalTrustFromRequest } from "@/shared/security/local-session";

type Ctx = { params: Promise<{ id: string; runId: string }> };

/** Owner interrupt for an in-flight analysis run. */
export async function POST(_req: Request, ctx: Ctx) {
  const trust = checkLocalTrustFromRequest(_req);
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
  const { id: projectId, runId } = await ctx.params;
  try {
    if (!runId?.trim()) {
      return NextResponse.json({ error: "runId 必填" }, { status: 400 });
    }
    const runtime = createProjectAgentRuntime();
    const run = await runtime.interrupt(projectId, runId.trim());
    return NextResponse.json({ run, projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "中断失败";
    const status = message.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
