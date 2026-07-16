import { NextRequest, NextResponse } from "next/server";
import {
  getActionInProject,
  listActions,
  updateActionStatus,
} from "@/shared/knowledge/repository";
import { invokeKnowledgeMcpTool } from "@/shared/knowledge/mcp-tools";
import type { ActionStatus } from "@/shared/types/knowledge";
import { ACTION_STATUSES } from "@/shared/types/knowledge";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

export async function GET(req: NextRequest) {
  try {
    const projectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId"),
    );
    return NextResponse.json({
      actions: listActions({ projectId }),
      projectId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: string;
      taskId?: string;
      newStatus?: ActionStatus;
      context?: string;
      projectId?: string;
    };

    const op = body.action ?? "update";
    const projectId = requireProjectId(body.projectId);

    if (op === "list") {
      return NextResponse.json({
        actions: listActions({ projectId }),
        projectId,
      });
    }

    if (op === "suggest") {
      const result = invokeKnowledgeMcpTool("generate_action_suggestions", {
        context: body.context ?? "",
        projectId,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result.result);
    }

    if (op === "update" || op === "update_status") {
      const taskId = body.taskId?.trim();
      const newStatus = body.newStatus;
      if (!taskId || !newStatus) {
        return NextResponse.json(
          { error: "taskId 与 newStatus 必填" },
          { status: 400 },
        );
      }
      if (!ACTION_STATUSES.includes(newStatus)) {
        return NextResponse.json({ error: "newStatus 无效" }, { status: 400 });
      }
      if (!getActionInProject(projectId, taskId)) {
        return NextResponse.json(
          { error: "行动项不存在" },
          { status: 404 },
        );
      }
      const action = updateActionStatus(taskId, newStatus, {
        actor: "owner",
      });
      // re-check after update
      if (action.projectId !== projectId) {
        return NextResponse.json(
          { error: "行动项不在当前项目范围内" },
          { status: 404 },
        );
      }
      return NextResponse.json({ action, projectId });
    }

    return NextResponse.json({ error: `未知 action: ${op}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "状态更新失败",
      },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
}
