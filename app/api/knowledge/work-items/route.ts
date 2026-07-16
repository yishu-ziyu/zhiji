import { NextRequest, NextResponse } from "next/server";
import {
  addAction,
  listActions,
  WorkItemValidationError,
} from "@/shared/knowledge/repository";
import type { ActionStatus } from "@/shared/types/knowledge";
import { ACTION_STATUSES, DEFAULT_ACTOR } from "@/shared/types/knowledge";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = requireProjectId(searchParams.get("projectId"));
    const assignee = searchParams.get("assignee") ?? undefined;
    const openOnly = searchParams.get("openOnly") === "1";
    const statusParam = searchParams.get("status");
    let status: ActionStatus | ActionStatus[] | undefined;
    if (statusParam) {
      const parts = statusParam.split(",").filter(Boolean) as ActionStatus[];
      status = parts.length === 1 ? parts[0] : parts;
    }
    const items = listActions({ assignee, openOnly, status, projectId });
    return NextResponse.json({ items, projectId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      assignee?: string;
      nextStep?: string;
      status?: ActionStatus;
      verificationCriteria?: string;
      cardId?: string;
      deadline?: string;
      projectId?: string;
    };

    const description =
      body.description?.trim() || body.title?.trim() || "";
    if (!description) {
      return NextResponse.json(
        { error: "title 或 description 必填" },
        { status: 400 },
      );
    }

    if (body.status && !ACTION_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "status 无效" }, { status: 400 });
    }

    const projectId = requireProjectId(body.projectId);
    const item = addAction({
      title: body.title,
      description,
      assignee: body.assignee ?? DEFAULT_ACTOR,
      nextStep: body.nextStep,
      status: body.status ?? "todo",
      verificationCriteria: body.verificationCriteria,
      cardId: body.cardId,
      deadline: body.deadline,
      projectId,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof WorkItemValidationError ||
      error instanceof ProjectScopeError
        ? 400
        : 400;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "创建失败",
      },
      { status },
    );
  }
}
