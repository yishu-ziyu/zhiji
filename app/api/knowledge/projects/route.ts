import { NextRequest, NextResponse } from "next/server";
import {
  addProject,
  listProjects,
} from "@/shared/knowledge/repository";

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; summary?: string };
    const project = addProject({
      name: body.name ?? "",
      summary: body.summary,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建项目失败" },
      { status: 400 },
    );
  }
}
