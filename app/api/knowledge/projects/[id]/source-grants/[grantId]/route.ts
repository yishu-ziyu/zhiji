import { NextRequest, NextResponse } from "next/server";
import { requireProjectId } from "@/shared/knowledge/project-scope";
import {
  getDefaultSourceGrantManager,
  SourceGrantNotFoundError,
  SourceGrantStateError,
} from "@/shared/project-memory/grants";
import { checkLocalTrustFromRequest } from "@/shared/security/local-session";

type Ctx = { params: Promise<{ id: string; grantId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id, grantId } = await ctx.params;
    const projectId = requireProjectId(id);
    const grant = getDefaultSourceGrantManager().get(projectId, grantId);
    if (!grant) return NextResponse.json({ error: "source grant not found" }, { status: 404 });
    return NextResponse.json({ grant, projectId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const trust = checkLocalTrustFromRequest(_req);
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
  try {
    const { id, grantId } = await ctx.params;
    const projectId = requireProjectId(id);
    const grant = await getDefaultSourceGrantManager().revoke(projectId, grantId);
    return NextResponse.json({ grant, projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "撤销失败";
    const status =
      error instanceof SourceGrantNotFoundError
        ? 404
        : error instanceof SourceGrantStateError
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
