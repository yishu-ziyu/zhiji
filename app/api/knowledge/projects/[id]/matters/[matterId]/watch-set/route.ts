import { NextRequest, NextResponse } from "next/server";
import { requireProjectId } from "@/shared/knowledge/project-scope";
import {
  getDefaultSourceGrantManager,
  SourceGrantNotFoundError,
  SourceGrantStateError,
} from "@/shared/project-memory/grants";

type Ctx = { params: Promise<{ id: string; matterId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id, matterId } = await ctx.params;
    const projectId = requireProjectId(id);
    const watchSet = await getDefaultSourceGrantManager().getWatchSet(projectId, matterId);
    return NextResponse.json({ projectId, matterId, watchSet });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取 watch set 失败" },
      { status: 400 },
    );
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id, matterId } = await ctx.params;
    const projectId = requireProjectId(id);
    const body = (await req.json()) as {
      grantId?: string;
      includePathPrefixes?: string[];
      excludePathPrefixes?: string[];
      status?: "active" | "disabled";
    };
    if (!body.grantId?.trim()) {
      return NextResponse.json({ error: "grantId 必填" }, { status: 400 });
    }
    if (
      body.includePathPrefixes !== undefined &&
      !Array.isArray(body.includePathPrefixes)
    ) {
      return NextResponse.json(
        { error: "includePathPrefixes 必须至少包含一个显式路径前缀" },
        { status: 400 },
      );
    }
    const watchSet = await getDefaultSourceGrantManager().upsertWatchSet({
      projectId,
      matterId,
      grantId: body.grantId,
      includePathPrefixes: body.includePathPrefixes,
      excludePathPrefixes: body.excludePathPrefixes,
      status: body.status,
    });
    return NextResponse.json({ projectId, matterId, watchSet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "写入 watch set 失败";
    const status = error instanceof SourceGrantNotFoundError ? 404 : error instanceof SourceGrantStateError ? 400 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
