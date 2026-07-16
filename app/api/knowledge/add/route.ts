import { NextRequest, NextResponse } from "next/server";
import { addCard, listCards } from "@/shared/knowledge/repository";
import type { KnowledgeSource } from "@/shared/types/knowledge";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      content?: string;
      source?: KnowledgeSource;
      tags?: string[];
      title?: string;
      links?: string[];
      projectId?: string;
    };

    const projectId = requireProjectId(body.projectId);
    const card = addCard({
      content: body.content ?? "",
      source: body.source,
      tags: body.tags,
      title: body.title,
      links: body.links,
      projectId,
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "保存失败",
      },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const projectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId"),
    );
    return NextResponse.json({
      cards: listCards({ projectId }),
      projectId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "读取失败",
      },
      { status: 400 },
    );
  }
}
