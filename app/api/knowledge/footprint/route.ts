import { NextRequest, NextResponse } from "next/server";
import { getFootprintData } from "@/shared/knowledge/repository";
import type { FootprintViewMode } from "@/shared/types/knowledge";

const MODES: FootprintViewMode[] = ["current_query", "window", "work_item"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "window") as FootprintViewMode;
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: "mode 无效" }, { status: 400 });
  }
  const querySessionId = searchParams.get("querySessionId") ?? undefined;
  const workItemId = searchParams.get("workItemId") ?? undefined;
  const sinceDays = searchParams.get("sinceDays");
  if (mode === "current_query" && !querySessionId) {
    return NextResponse.json(
      { error: "current_query 需要 querySessionId" },
      { status: 400 },
    );
  }
  if (mode === "work_item" && !workItemId) {
    return NextResponse.json(
      { error: "work_item 需要 workItemId" },
      { status: 400 },
    );
  }
  const data = getFootprintData({
    mode,
    querySessionId,
    workItemId,
    sinceDays: sinceDays ? Number(sinceDays) : 7,
  });
  return NextResponse.json(data);
}
