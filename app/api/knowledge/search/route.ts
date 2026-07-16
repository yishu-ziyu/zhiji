import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/shared/knowledge/search";
import {
  recordSearchFootprint,
  searchProjectRecords,
} from "@/shared/knowledge/repository";
import type { KnowledgeSearchFilters } from "@/shared/types/knowledge";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string;
      filters?: KnowledgeSearchFilters;
      recordFootprint?: boolean;
      projectId?: string;
    };
    const projectId = requireProjectId(
      body.filters?.projectId ?? body.projectId,
    );
    const query = body.query ?? "";
    const filters: KnowledgeSearchFilters = {
      ...body.filters,
      projectId,
    };
    const hits = searchKnowledge(query, filters);
    const projectHits = searchProjectRecords(
      projectId,
      query,
      filters.limit ?? 12,
    );
    let querySessionId: string | undefined;
    if (body.recordFootprint !== false) {
      const rec = recordSearchFootprint(
        query,
        hits,
        filters,
        DEFAULT_ACTOR,
      );
      querySessionId = rec.querySessionId;
    }
    return NextResponse.json({
      hits,
      projectHits,
      count: hits.length,
      querySessionId,
      projectId,
    });
  } catch (error) {
    const status = error instanceof ProjectScopeError ? 400 : 400;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "检索失败",
      },
      { status },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q") ?? "";
    const projectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId"),
    );
    const filters = { projectId };
    const hits = searchKnowledge(query, filters);
    const projectHits = searchProjectRecords(projectId, query);
    const rec = recordSearchFootprint(query, hits, filters);
    return NextResponse.json({
      hits,
      projectHits,
      count: hits.length,
      querySessionId: rec.querySessionId,
      projectId,
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
