import { NextResponse } from "next/server";
import { requireProjectId } from "@/shared/knowledge/project-scope";
import {
  getDefaultSourceGrantManager,
  SourceGrantNotFoundError,
  SourceGrantStateError,
} from "@/shared/project-memory/grants";
import { checkLocalTrustFromRequest } from "@/shared/security/local-session";

type Ctx = { params: Promise<{ id: string; grantId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const trust = checkLocalTrustFromRequest(_req);
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
  try {
    const { id, grantId } = await ctx.params;
    const projectId = requireProjectId(id);
    const result = await getDefaultSourceGrantManager().reconcile(projectId, grantId);
    return NextResponse.json({
      projectId,
      grant: result.grant,
      observed: result.signals.length,
      ingested: result.ingested,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "对账失败";
    const status =
      error instanceof SourceGrantNotFoundError
        ? 404
        : error instanceof SourceGrantStateError
          ? 400
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
