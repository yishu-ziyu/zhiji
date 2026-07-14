import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/shared/knowledge/search";
import {
  recordSearchFootprint,
  searchProjectRecords,
} from "@/shared/knowledge/repository";
import type { KnowledgeSearchFilters } from "@/shared/types/knowledge";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string;
      filters?: KnowledgeSearchFilters;
      recordFootprint?: boolean;
    };
    const query = body.query ?? "";
    const hits = searchKnowledge(query, body.filters);
    const projectHits = body.filters?.projectId
      ? searchProjectRecords(
          body.filters.projectId,
          query,
          body.filters.limit ?? 12,
        )
      : [];
    let querySessionId: string | undefined;
    if (body.recordFootprint !== false) {
      const rec = recordSearchFootprint(
        query,
        hits,
        body.filters,
        DEFAULT_ACTOR,
      );
      querySessionId = rec.querySessionId;
    }
    return NextResponse.json({
      hits,
      projectHits,
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
  const projectHits = projectId
    ? searchProjectRecords(projectId, query)
    : [];
  const rec = recordSearchFootprint(query, hits, filters);
  return NextResponse.json({
    hits,
    projectHits,
    count: hits.length,
    querySessionId: rec.querySessionId,
  });
}
