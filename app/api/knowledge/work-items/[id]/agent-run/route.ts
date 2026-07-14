import { NextRequest, NextResponse } from "next/server";
import {
  addWorkEvent,
  getWorkItemDetail,
  patchWorkItem,
} from "@/shared/knowledge/repository";
import { reviewWorkItem } from "@/shared/knowledge/project-review-agent";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { actor?: string };
  const actor = body.actor?.trim() || DEFAULT_ACTOR;
  const detail = getWorkItemDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "工作项不存在" }, { status: 404 });
  }
  if (detail.item.status === "done" || detail.item.status === "cancelled") {
    return NextResponse.json({ error: "已结束的工作不能交给 Agent" }, { status: 400 });
  }
  if (!detail.item.nextStep.trim() || detail.evidence.length === 0) {
    return NextResponse.json(
      { error: "交给 Agent 前需要明确下一步并关联至少一条依据" },
      { status: 400 },
    );
  }

  try {
    patchWorkItem(
      id,
      {
        assignee: "Agent 项目复核",
        status: "doing",
        blockedReason: null,
      },
      actor,
    );
    const running = getWorkItemDetail(id)!;
    const mode = process.env.AGENT_RUN_MODE === "model" ? "model" : "deterministic";
    const review = await reviewWorkItem(running, { mode });
    addWorkEvent(id, {
      type: "result",
      actor: "agent:project-reviewer",
      body: `当前判断：${review.judgment}\n建议下一步：${review.nextStep}`,
      meta: { review },
    });
    patchWorkItem(id, { status: "confirmed" }, "agent:project-reviewer");
    return NextResponse.json({ detail: getWorkItemDetail(id), review });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent 执行失败";
    addWorkEvent(id, {
      type: "block",
      actor: "agent:project-reviewer",
      body: `Agent 执行失败：${message}`,
      meta: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
