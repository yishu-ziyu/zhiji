import { NextRequest, NextResponse } from "next/server";
import { getLibraryMapData } from "@/shared/knowledge/repository";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

export async function GET(req?: NextRequest) {
  try {
    const projectId = requireProjectId(
      req?.nextUrl?.searchParams?.get("projectId") ?? null,
    );
    const data = getLibraryMapData(projectId);
    return NextResponse.json({ ...data, projectId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "读取失败",
      },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
}
