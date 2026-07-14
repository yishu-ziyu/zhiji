import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/shared/knowledge/search";
import { recordSearchFootprint } from "@/shared/knowledge/repository";
import type { KnowledgeSearchFilters } from "@/shared/types/knowledge";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string;
      filters?: KnowledgeSearchFilters;
      actor?: string;
      recordFootprint?: boolean;
    };
    const query = body.query ?? "";
    const hits = searchKnowledge(query, body.filters);
    let querySessionId: string | undefined;
    if (body.recordFootprint !== false) {
      const rec = recordSearchFootprint(
        query,
        hits,
        body.filters,
        body.actor ?? DEFAULT_ACTOR,
      );
      querySessionId = rec.querySessionId;
    }
    return NextResponse.json({
      hits,
      count: hits.length,
      querySessionId,
    });
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
  const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;
  const filters = projectId ? { projectId } : undefined;
  const hits = searchKnowledge(query, filters);
  const rec = recordSearchFootprint(query, hits, filters);
  return NextResponse.json({
    hits,
    count: hits.length,
    querySessionId: rec.querySessionId,
  });
}
