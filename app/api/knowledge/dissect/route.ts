import { NextRequest, NextResponse } from "next/server";
import { complete, extractJson } from "@/shared/llm/adapter";
import {
  buildDissectPrompt,
  KNOWLEDGE_DISSECT_SYSTEM,
} from "@/shared/llm/prompts/knowledge";
import { addActions } from "@/shared/knowledge/repository";
import { invokeKnowledgeMcpTool } from "@/shared/knowledge/mcp-tools";
import type { ActionItem, DissectResult } from "@/shared/types/knowledge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { goal?: string };
    const goal = body.goal?.trim();
    if (!goal) {
      return NextResponse.json({ error: "goal 不能为空" }, { status: 400 });
    }

    try {
      const raw = await complete(
        buildDissectPrompt(goal),
        KNOWLEDGE_DISSECT_SYSTEM,
        { timeout: 45000, maxRetries: 2 },
      );
      const parsed = extractJson(raw) as {
        goal?: string;
        actionItems?: Array<{
          description?: string;
          assignee?: string;
          deadline?: string;
          verificationCriteria?: string;
        }>;
      };

      const actionItems: ActionItem[] = addActions(
        (parsed.actionItems ?? [])
          .filter((a) => a.description?.trim())
          .map((a) => ({
            description: a.description!,
            assignee: a.assignee,
            deadline: a.deadline,
            verificationCriteria: a.verificationCriteria,
          })),
      );

      if (actionItems.length === 0) {
        const fallback = invokeKnowledgeMcpTool("dissect_task", { goal });
        return NextResponse.json(fallback.result as DissectResult);
      }

      return NextResponse.json({
        goal: parsed.goal || goal,
        actionItems,
        offline: false,
      } satisfies DissectResult);
    } catch {
      const fallback = invokeKnowledgeMcpTool("dissect_task", { goal });
      if (!fallback.ok) {
        return NextResponse.json(
          { error: fallback.error || "拆解失败" },
          { status: 400 },
        );
      }
      return NextResponse.json(fallback.result as DissectResult);
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "拆解失败",
      },
      { status: 500 },
    );
  }
}
