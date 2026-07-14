import { NextRequest, NextResponse } from "next/server";
import {
  getWorkItemDetail,
  patchWorkItem,
  WorkItemValidationError,
} from "@/shared/knowledge/repository";
import type { ActionStatus } from "@/shared/types/knowledge";
import { ACTION_STATUSES, DEFAULT_ACTOR } from "@/shared/types/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const detail = getWorkItemDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "工作项不存在" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      assignee?: string;
      deadline?: string;
      status?: ActionStatus;
      verificationCriteria?: string;
      nextStep?: string;
      blockedReason?: string | null;
    };

    if (body.status && !ACTION_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "status 无效" }, { status: 400 });
    }

    const item = patchWorkItem(
      id,
      {
        title: body.title,
        description: body.description,
        assignee: body.assignee,
        deadline: body.deadline,
        status: body.status,
        verificationCriteria: body.verificationCriteria,
        nextStep: body.nextStep,
        blockedReason: body.blockedReason,
      },
      DEFAULT_ACTOR,
    );

    const detail = getWorkItemDetail(item.id);
    return NextResponse.json(detail);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新失败";
    const code =
      msg.includes("不存在") ? 404 : error instanceof WorkItemValidationError ? 400 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
