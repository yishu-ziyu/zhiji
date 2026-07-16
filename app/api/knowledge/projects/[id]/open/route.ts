import { NextRequest, NextResponse } from "next/server";
import { touchProjectOpened } from "@/shared/knowledge/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const project = touchProjectOpened(id);
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "记录打开失败" },
      { status: 400 },
    );
  }
}
