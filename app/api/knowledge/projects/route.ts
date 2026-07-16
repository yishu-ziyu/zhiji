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
    const body = (await req.json()) as {
      name?: string;
      summary?: string;
      sensitive?: boolean;
      sensitivity?: string;
      visibility?: string;
    };
    const sensitive =
      body.sensitive === true ||
      body.sensitivity === "sensitive" ||
      body.visibility === "sensitive";
    const project = addProject({
      name: body.name ?? "",
      summary: body.summary,
      sensitive,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建项目失败" },
      { status: 400 },
    );
  }
}
