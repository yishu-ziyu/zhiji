import { NextRequest, NextResponse } from "next/server";
import { getProjectCanvasSnapshot } from "@/shared/knowledge/repository";
import type { CanvasNodeKind, CanvasNodeRef } from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = new Set<CanvasNodeKind>([
  "project",
  "card",
  "work_item",
  "event",
  "agent",
]);

function parseFocus(value: string | null, projectId: string): CanvasNodeRef {
  if (!value) return { kind: "project", id: projectId };
  const separator = value.indexOf(":");
  const kind = value.slice(0, separator) as CanvasNodeKind;
  const id = value.slice(separator + 1);
  if (separator < 1 || !KINDS.has(kind) || !id) {
    throw new Error("focus 格式无效");
  }
  return { kind, id };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const focus = parseFocus(req.nextUrl.searchParams.get("focus"), id);
    // pin=cardId,cardId2 — Agent business-logic chain nodes forced onto hub.
    const pinRaw = req.nextUrl.searchParams.get("pin") ?? "";
    const pinCardIds = pinRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith("card:") ? s.slice("card:".length) : s))
      .filter(Boolean)
      .slice(0, 12);
    return NextResponse.json({
      snapshot: getProjectCanvasSnapshot(id, focus, undefined, {
        pinCardIds,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取画布失败";
    return NextResponse.json(
      { error: message },
      { status: message === "项目不存在" ? 404 : 400 },
    );
  }
}
