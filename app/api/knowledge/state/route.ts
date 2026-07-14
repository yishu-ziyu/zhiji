import { NextRequest, NextResponse } from "next/server";
import {
  getAction,
  listActions,
  updateActionStatus,
} from "@/shared/knowledge/repository";
import { invokeKnowledgeMcpTool } from "@/shared/knowledge/mcp-tools";
import type { ActionStatus } from "@/shared/types/knowledge";
import { ACTION_STATUSES } from "@/shared/types/knowledge";

export async function GET() {
  return NextResponse.json({ actions: listActions() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: string;
      taskId?: string;
      newStatus?: ActionStatus;
      context?: string;
    };

    const op = body.action ?? "update";

    if (op === "list") {
      return NextResponse.json({ actions: listActions() });
    }

    if (op === "suggest") {
      const result = invokeKnowledgeMcpTool("generate_action_suggestions", {
        context: body.context ?? "",
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
      if (!getAction(taskId)) {
        return NextResponse.json({ error: "行动项不存在" }, { status: 404 });
      }
      const action = updateActionStatus(taskId, newStatus);
      return NextResponse.json({ action });
    }

    return NextResponse.json({ error: `未知 action: ${op}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "状态更新失败",
      },
      { status: 400 },
    );
  }
}
