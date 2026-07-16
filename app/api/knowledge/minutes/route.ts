import { NextRequest, NextResponse } from "next/server";
import { complete, extractJson } from "@/shared/llm/adapter";
import {
  buildKnowledgeMinutesPrompt,
  KNOWLEDGE_MINUTES_SYSTEM,
} from "@/shared/llm/prompts/knowledge";
import { addActions, addCards } from "@/shared/knowledge/repository";
import type {
  ActionItem,
  KnowledgeCard,
  MinutesResult,
} from "@/shared/types/knowledge";
import { requireProjectId } from "@/shared/knowledge/project-scope";

function offlineMinutes(transcript: string, projectId: string): MinutesResult {
  const scope = requireProjectId(projectId);
  const lines = transcript
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const snippet = lines.slice(0, 3).join("；") || transcript.slice(0, 120);

  const cards = addCards([
    {
      title: "会议要点（离线）",
      content: snippet,
      source: "meeting",
      tags: ["会议", "离线兜底"],
      projectId: scope,
    },
  ]);

  const actionItems = addActions([
    {
      description: "核对会议纪要并补全验收标准",
      assignee: "待定",
      deadline: "待确认",
      verificationCriteria: "卡片内容与原文一致且可检索",
      cardId: cards[0]?.id,
      projectId: scope,
    },
  ]);

  return {
    title: "会议纪要（离线兜底）",
    summary: "LLM 不可用时，已把原文前几行收成知识卡片，并生成核对任务。",
    cards,
    actionItems,
    offline: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      transcript?: string;
      projectId?: string;
    };
    const transcript = body.transcript?.trim();
    if (!transcript) {
      return NextResponse.json({ error: "transcript 不能为空" }, { status: 400 });
    }
    const projectId = requireProjectId(body.projectId);

    try {
      const raw = await complete(
        buildKnowledgeMinutesPrompt(transcript),
        KNOWLEDGE_MINUTES_SYSTEM,
        { timeout: 45000, maxRetries: 2 },
      );
      const parsed = extractJson(raw) as {
        title?: string;
        summary?: string;
        cards?: Array<{
          content?: string;
          source?: string;
          tags?: string[];
          title?: string;
        }>;
        actionItems?: Array<{
          description?: string;
          assignee?: string;
          deadline?: string;
          verificationCriteria?: string;
        }>;
      };

      let cards: KnowledgeCard[] = addCards(
        (parsed.cards ?? [])
          .filter((c) => c.content?.trim())
          .map((c) => ({
            content: c.content!,
            source: (c.source as KnowledgeCard["source"]) || "meeting",
            tags: c.tags ?? ["会议"],
            title: c.title,
            projectId,
          })),
      );

      if (cards.length === 0) {
        cards = addCards([
          {
            title: parsed.title || "会议摘要",
            content: parsed.summary || transcript.slice(0, 200),
            source: "meeting",
            tags: ["会议"],
            projectId,
          },
        ]);
      }

      const actionItems: ActionItem[] = addActions(
        (parsed.actionItems ?? [])
          .filter((a) => a.description?.trim())
          .map((a) => ({
            description: a.description!,
            assignee: a.assignee,
            deadline: a.deadline,
            verificationCriteria: a.verificationCriteria,
            cardId: cards[0]?.id,
            projectId,
          })),
      );

      return NextResponse.json({
        title: parsed.title || "会议纪要",
        summary: parsed.summary || "",
        cards,
        actionItems,
        offline: false,
      } satisfies MinutesResult);
    } catch {
      return NextResponse.json(offlineMinutes(transcript, projectId));
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "纪要失败",
      },
      { status: 500 },
    );
  }
}
