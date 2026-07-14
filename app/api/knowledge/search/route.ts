import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/shared/knowledge/search";
import type { KnowledgeSearchFilters } from "@/shared/types/knowledge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string;
      filters?: KnowledgeSearchFilters;
    };
    const query = body.query ?? "";
    const hits = searchKnowledge(query, body.filters);
    return NextResponse.json({ hits, count: hits.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "检索失败",
      },
      { status: 400 },
    );
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  const hits = searchKnowledge(query);
  return NextResponse.json({ hits, count: hits.length });
}
