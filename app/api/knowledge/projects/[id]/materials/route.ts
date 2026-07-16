import { NextRequest, NextResponse } from "next/server";
import {
  listProjectMaterials,
  readProjectMaterial,
  renderMarkdownLite,
} from "@/shared/knowledge/materials";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const fileId = req.nextUrl.searchParams.get("file");
  if (fileId) {
    const file = readProjectMaterial(id, fileId);
    if (!file) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    const html =
      file.meta.kind === "markdown" || file.meta.kind === "text"
        ? renderMarkdownLite(file.content)
        : undefined;
    return NextResponse.json({
      file: file.meta,
      content: file.content,
      html,
      preview:
        file.meta.kind === "markdown" || file.meta.kind === "text"
          ? true
          : false,
    });
  }
  return NextResponse.json({ materials: listProjectMaterials(id) });
}
