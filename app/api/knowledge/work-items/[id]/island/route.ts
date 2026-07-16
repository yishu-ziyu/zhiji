import { NextRequest, NextResponse } from "next/server";
import {
  getEvidenceIsland,
  ProjectAccessError,
  ProjectScopeError,
} from "@/shared/knowledge/repository";
import { requireProjectId } from "@/shared/knowledge/project-scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId"),
    );
    const island = getEvidenceIsland(id, { projectId });
    return NextResponse.json({ ...island, projectId });
  } catch (error) {
    const code =
      error instanceof ProjectAccessError
        ? 404
        : error instanceof ProjectScopeError
          ? 400
          : 404;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "查询失败" },
      { status: code },
    );
  }
}
