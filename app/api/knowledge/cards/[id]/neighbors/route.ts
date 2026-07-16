import { NextRequest, NextResponse } from "next/server";
import {
  getNeighbors,
  ProjectAccessError,
  ProjectScopeError,
  RelationValidationError,
} from "@/shared/knowledge/repository";
import type { RelationStatus } from "@/shared/types/knowledge";
import { RELATION_STATUSES } from "@/shared/types/knowledge";
import { requireProjectId } from "@/shared/knowledge/project-scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const projectId = requireProjectId(searchParams.get("projectId"));
    const statusParam = searchParams.get("status");
    let status: RelationStatus | RelationStatus[] | undefined;
    if (statusParam) {
      const parts = statusParam
        .split(",")
        .filter((s): s is RelationStatus =>
          RELATION_STATUSES.includes(s as RelationStatus),
        );
      status = parts.length === 1 ? parts[0] : parts.length ? parts : undefined;
    }
    const view = getNeighbors(id, { status, projectId });
    return NextResponse.json({ ...view, projectId });
  } catch (error) {
    const code =
      error instanceof ProjectAccessError
        ? 404
        : error instanceof ProjectScopeError
          ? 400
          : error instanceof RelationValidationError
            ? 404
            : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "查询失败" },
      { status: code },
    );
  }
}
