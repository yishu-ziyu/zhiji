import { NextRequest, NextResponse } from "next/server";
import {
  linkEvidence,
  unlinkEvidence,
} from "@/shared/knowledge/repository";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      cardId?: string;
    };
    if (!body.cardId?.trim()) {
      return NextResponse.json({ error: "cardId 必填" }, { status: 400 });
    }
    const item = linkEvidence(
      id,
      body.cardId.trim(),
      DEFAULT_ACTOR,
    );
    return NextResponse.json({ item });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "关联失败";
    const code = msg.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId");
    if (!cardId) {
      return NextResponse.json({ error: "cardId 必填" }, { status: 400 });
    }
    const item = unlinkEvidence(id, cardId, DEFAULT_ACTOR);
    return NextResponse.json({ item });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "取消关联失败";
    const code = msg.includes("不存在") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
