/**
 * T-19 S2: generic zero-leak redacted cross-project hint (G5 RED surface).
 * Route name frozen by G5@6d224c4c: GET .../redacted-hints
 * Never returns project title/id, object id, content, hit, or revision.
 * Does not scan/search or create cross-project object references.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getRedactedCrossProjectHint,
  listRedactedCrossProjectHints,
  ProjectScopeError,
} from "@/shared/knowledge/repository";
import { requireProjectId } from "@/shared/knowledge/project-scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const hostProjectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId") ?? id,
    );
    if (hostProjectId !== id) {
      return NextResponse.json(
        { error: "projectId 与路径项目不一致" },
        { status: 400 },
      );
    }
    const hint = getRedactedCrossProjectHint(hostProjectId);
    // Strip to typed shape only — no host/source metadata may leave.
    const safe = hint
      ? {
          kind: "approved_source_may_be_relevant" as const,
          message: hint.message,
        }
      : null;
    const hints = listRedactedCrossProjectHints(hostProjectId).map((h) => ({
      kind: "approved_source_may_be_relevant" as const,
      message: h.message,
    }));
    return NextResponse.json({
      hint: safe,
      hints,
      projectId: hostProjectId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
}
