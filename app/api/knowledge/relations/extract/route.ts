import { NextRequest, NextResponse } from "next/server";
import { extractRelations } from "@/shared/knowledge/repository";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      cardId?: string;
      projectId?: string;
    };
    const result = extractRelations({
      cardId: body.cardId,
      projectId: body.projectId,
    });
    return NextResponse.json({
      count: result.count,
      items: result.created,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "抽边失败" },
      { status: 400 },
    );
  }
}
