import { NextRequest, NextResponse } from "next/server";
import {
  addWorkEvent,
  listEventsForWorkItem,
  WorkItemValidationError,
} from "@/shared/knowledge/repository";
import type { WorkEventType } from "@/shared/types/knowledge";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };
const PUBLIC_EVENT_TYPES: WorkEventType[] = [
  "comment",
  "decision",
  "block",
  "unblock",
  "result",
];

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const events = listEventsForWorkItem(id);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      type?: WorkEventType;
      actor?: string;
      body?: string;
      meta?: Record<string, unknown>;
    };

    if (!body.type || !PUBLIC_EVENT_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "type 无效" }, { status: 400 });
    }

    if (body.type === "result" && !body.body?.trim()) {
      return NextResponse.json({ error: "result 需要写明结果" }, { status: 400 });
    }

    const meta =
      body.type === "decision" && body.meta?.reaffirmsNextStep === true
        ? { reaffirmsNextStep: true }
        : body.type === "block" && typeof body.meta?.reason === "string"
          ? { reason: body.meta.reason }
          : undefined;

    const event = addWorkEvent(id, {
      type: body.type,
      actor: body.type === "result" ? "agent:external" : DEFAULT_ACTOR,
      body: body.body,
      meta,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "写入事件失败";
    const code =
      msg.includes("不存在")
        ? 404
        : error instanceof WorkItemValidationError
          ? 400
          : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
