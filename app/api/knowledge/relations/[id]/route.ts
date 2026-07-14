import { NextRequest, NextResponse } from "next/server";
import {
  deleteRelation,
  getRelation,
  patchRelation,
  RelationValidationError,
} from "@/shared/knowledge/repository";
import type { RelationStatus, RelationType } from "@/shared/types/knowledge";
import {
  RELATION_STATUSES,
  RELATION_TYPES,
} from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const item = getRelation(id);
  if (!item) {
    return NextResponse.json({ error: "关系不存在" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      status?: RelationStatus;
      relationType?: RelationType;
      evidenceSentence?: string;
      workItemId?: string | null;
    };

    if (body.status && !RELATION_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "status 无效" }, { status: 400 });
    }
    if (body.relationType && !RELATION_TYPES.includes(body.relationType)) {
      return NextResponse.json({ error: "relationType 无效" }, { status: 400 });
    }

    const item = patchRelation(id, body);
    return NextResponse.json({ item });
  } catch (error) {
    const code = error instanceof RelationValidationError ? 400 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新失败" },
      { status: code },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = deleteRelation(id);
  if (!ok) {
    return NextResponse.json({ error: "关系不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
