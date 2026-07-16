import { NextRequest, NextResponse } from "next/server";
import {
  getActionInProject,
  getWorkItemDetail,
  patchWorkItem,
  WorkItemValidationError,
} from "@/shared/knowledge/repository";
import type { ActionStatus } from "@/shared/types/knowledge";
import { ACTION_STATUSES, DEFAULT_ACTOR } from "@/shared/types/knowledge";
import {
  ProjectAccessError,
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId"),
    );
    if (!getActionInProject(projectId, id)) {
      return NextResponse.json({ error: "工作项不存在" }, { status: 404 });
    }
    const detail = getWorkItemDetail(id);
    if (!detail || detail.item.projectId !== projectId) {
      return NextResponse.json({ error: "工作项不存在" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
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
      projectId?: string;
    };

    const projectId = requireProjectId(
      body.projectId ?? req.nextUrl.searchParams.get("projectId"),
    );

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
      { projectId },
    );

    const detail = getWorkItemDetail(item.id);
    return NextResponse.json(detail);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新失败";
    const code =
      error instanceof ProjectAccessError || msg.includes("不存在")
        ? 404
        : error instanceof WorkItemValidationError ||
            error instanceof ProjectScopeError
          ? 400
          : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
