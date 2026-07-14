import { NextRequest, NextResponse } from "next/server";
import { addCard, listCards } from "@/shared/knowledge/repository";
import type { KnowledgeSource } from "@/shared/types/knowledge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      content?: string;
      source?: KnowledgeSource;
      tags?: string[];
      title?: string;
      links?: string[];
    };

    const card = addCard({
      content: body.content ?? "",
      source: body.source,
      tags: body.tags,
      title: body.title,
      links: body.links,
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "保存失败",
      },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ cards: listCards() });
}
