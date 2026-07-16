import { NextRequest, NextResponse } from "next/server";
import {
  executeSetCanvasView,
  planSetCanvasViewFromUtterance,
} from "@/shared/knowledge/set-canvas-view";
import { parseCanvasCommand } from "@/shared/knowledge/canvas-command";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Canvas-menu-v1 command API.
 * POST body:
 *  - { utterance: string } → resolve intent + command
 *  - { command: CanvasCommand } → validate set_canvas_view
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  try {
    const body = (await req.json()) as {
      utterance?: string;
      command?: unknown;
      focus?: { kind: string; id: string };
      highlightNodeKeys?: string[];
    };

    if (body.utterance?.trim()) {
      const plan = planSetCanvasViewFromUtterance(body.utterance.trim(), {
        projectFocus: { kind: "project", id: projectId },
        resolvedFocus: body.focus
          ? {
              kind: body.focus.kind as "project",
              id: body.focus.id,
            }
          : { kind: "project", id: projectId },
        highlightNodeKeys: body.highlightNodeKeys,
      });
      if (!plan.command) {
        return NextResponse.json({
          projectId,
          matched: false,
          command: null,
          reason: "未匹配画布意图",
        });
      }
      const executed = executeSetCanvasView(plan.command);
      return NextResponse.json({
        projectId,
        matched: true,
        shouldCallTool: plan.shouldCall,
        command: plan.command,
        tool: plan.toolCall,
        result: executed,
      });
    }

    if (body.command != null) {
      const executed = executeSetCanvasView(body.command);
      if (executed.outcome === "error") {
        return NextResponse.json(
          { projectId, error: executed.detail, result: executed },
          { status: 400 },
        );
      }
      return NextResponse.json({
        projectId,
        matched: true,
        command: executed.command,
        result: executed,
      });
    }

    return NextResponse.json(
      { error: "需要 utterance 或 command" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** GET: menu version probe */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  return NextResponse.json({
    projectId,
    menuVersion: "canvas-menu-v1",
    views: ["now", "by_kind", "decision", "evidence"],
    parseSample: parseCanvasCommand({ view: "now" }),
  });
}
