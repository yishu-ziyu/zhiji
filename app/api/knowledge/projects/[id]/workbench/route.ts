import { NextRequest, NextResponse } from "next/server";
import { loadWorkbenchBundle } from "@/shared/agent-memory";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

type Ctx = { params: Promise<{ id: string }> };

/** Dual-truth readiness: knowledge + materials + dialogue counts for one projectId. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(id);
    const bundle = loadWorkbenchBundle(projectId);
    return NextResponse.json({ bundle });
  } catch (err) {
    if (err instanceof ProjectScopeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
