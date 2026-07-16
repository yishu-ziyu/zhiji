import { NextRequest, NextResponse } from "next/server";
import {
  addWorkEvent,
  ensureResultCandidateCard,
  getWorkItemDetail,
  patchWorkItem,
} from "@/shared/knowledge/repository";
import { reviewWorkItem } from "@/shared/knowledge/project-review-agent";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const detail = getWorkItemDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "工作项不存在" }, { status: 404 });
  }
  if (detail.item.status === "done" || detail.item.status === "cancelled") {
    return NextResponse.json({ error: "已结束的工作不能交给 Agent" }, { status: 400 });
  }
  if (!detail.item.nextStep.trim() || detail.evidence.length === 0) {
    const reason = !detail.item.nextStep.trim()
      ? "需要先明确下一步"
      : "需要先关联至少一条依据";
    addWorkEvent(id, {
      type: "block",
      actor: "agent:project-reviewer",
      body: `Agent 无法开始：${reason}`,
      meta: { error: reason },
    });
    return NextResponse.json(
      { error: `交给 Agent 前${reason}` },
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
      DEFAULT_ACTOR,
    );
    const running = getWorkItemDetail(id)!;
    const mode = process.env.AGENT_RUN_MODE === "model" ? "model" : "deterministic";
    const review = await reviewWorkItem(running, { mode });
    if (review.evidenceIds.length === 0) {
      throw new Error("Agent 未引用有效依据");
    }
    // Write result only. Do not self-transition work status to confirmed
    // (ActionStatus.confirmed = 「待确认」 is a human work gate, not Agent knowledge confirm).
    const resultEvent = addWorkEvent(id, {
      type: "result",
      actor: "agent:project-reviewer",
      body: `当前判断：${review.judgment}\n建议下一步：${review.nextStep}`,
      meta: { review },
    });
    const candidate = ensureResultCandidateCard({
      projectId: running.item.projectId,
      resultEvent,
      evidence: running.evidence,
    });
    return NextResponse.json({ detail: getWorkItemDetail(id), review, candidate });
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
