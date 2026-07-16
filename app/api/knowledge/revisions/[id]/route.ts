import { NextRequest, NextResponse } from "next/server";
import {
  getAgentMemoryService,
  revisionBelongsToProject,
} from "@/shared/project-memory/reconstruct";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: revisionId } = await ctx.params;
  const projectId = req.nextUrl.searchParams.get("projectId")?.trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId 必填" }, { status: 400 });
  }
  const reader = getAgentMemoryService();
  if (!(await revisionBelongsToProject(reader, revisionId, projectId))) {
    return NextResponse.json(
      { error: "版本不存在或无权访问" },
      { status: 404 },
    );
  }
  const bytes = await reader.readRevision(revisionId);
  if (!bytes) {
    return NextResponse.json({ error: "版本内容不可用" }, { status: 404 });
  }
  const encoding = req.nextUrl.searchParams.get("encoding");
  return NextResponse.json({
    revisionId,
    content:
      encoding === "base64"
        ? Buffer.from(bytes).toString("base64")
        : new TextDecoder().decode(bytes),
  });
}
