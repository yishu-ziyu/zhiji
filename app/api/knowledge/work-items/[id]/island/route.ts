import { NextRequest, NextResponse } from "next/server";
import { getEvidenceIsland } from "@/shared/knowledge/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const island = getEvidenceIsland(id);
    return NextResponse.json(island);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "查询失败" },
      { status: 404 },
    );
  }
}
