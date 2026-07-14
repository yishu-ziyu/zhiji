import { NextRequest, NextResponse } from "next/server";
import { addProjectCheckpoint } from "@/shared/knowledge/repository";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      goal?: string;
      completed?: string[];
      unresolved?: string[];
      nextStep?: string;
    };
    const checkpoint = addProjectCheckpoint(id, {
      goal: body.goal ?? "",
      completed: Array.isArray(body.completed) ? body.completed : [],
      unresolved: Array.isArray(body.unresolved) ? body.unresolved : [],
      nextStep: body.nextStep ?? "",
      confirmedBy: DEFAULT_ACTOR,
    });
    return NextResponse.json({ checkpoint }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存状态失败";
    return NextResponse.json(
      { error: message },
      { status: message === "项目不存在" ? 404 : 400 },
    );
  }
}
