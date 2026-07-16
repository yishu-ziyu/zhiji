import { NextRequest, NextResponse } from "next/server";
import {
  getCardInProject,
  getFootprintData,
  recordOpenedFootprint,
} from "@/shared/knowledge/repository";
import type { FootprintViewMode } from "@/shared/types/knowledge";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

const MODES: FootprintViewMode[] = ["current_query", "window", "work_item"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = requireProjectId(searchParams.get("projectId"));
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
      projectId,
      querySessionId,
      workItemId,
      sinceDays: sinceDays ? Number(sinceDays) : 7,
    });
    return NextResponse.json({ ...data, projectId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "读取失败",
      },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { cardId?: string; projectId?: string };
    if (!body.cardId) {
      return NextResponse.json({ error: "cardId 必填" }, { status: 400 });
    }
    const projectId = requireProjectId(body.projectId);
    if (!getCardInProject(projectId, body.cardId)) {
      return NextResponse.json({ error: "卡片不存在" }, { status: 404 });
    }
    recordOpenedFootprint(body.cardId, DEFAULT_ACTOR);
    return NextResponse.json({ ok: true, projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "记录失败";
    return NextResponse.json(
      { error: message },
      {
        status:
          message.includes("不存在") || message.includes("范围")
            ? 404
            : 400,
      },
    );
  }
}
