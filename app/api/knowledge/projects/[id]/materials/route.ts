import { NextRequest, NextResponse } from "next/server";
import {
  kindFromName,
  listProjectMaterials,
  materialCardSummary,
  readProjectMaterial,
  renderMarkdownLite,
  writeProjectMaterial,
} from "@/shared/knowledge/materials";
import { addCard, getProject } from "@/shared/knowledge/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const fileId = req.nextUrl.searchParams.get("file");
  if (fileId) {
    const file = readProjectMaterial(id, fileId);
    if (!file) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    const isText = file.previewMode === "text";
    const html =
      isText &&
      (file.meta.kind === "markdown" || file.meta.kind === "text")
        ? renderMarkdownLite(file.content)
        : undefined;
    return NextResponse.json({
      file: file.meta,
      content: isText ? file.content : "",
      html,
      preview: isText,
      previewMode: file.previewMode,
      mimeType: file.mimeType,
      typeLabel: file.typeLabel,
      dataUrl: file.dataUrl,
      sizeBytes: file.sizeBytes ?? file.meta.sizeBytes,
      sizeLabel: file.sizeLabel,
      unsupportedMessage: file.unsupportedMessage,
    });
  }
  // M2: list already sorted newest-first by listProjectMaterials.
  return NextResponse.json({ materials: listProjectMaterials(id) });
}

/** Add one local file into this project (single-file; no recursive folder). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!getProject(id)) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    const body = (await req.json()) as {
      name?: string;
      content?: string;
      title?: string;
      encoding?: "utf8" | "base64";
    };
    const name = body.name?.trim() ?? "";
    if (!name) {
      return NextResponse.json({ error: "文件名不能为空" }, { status: 400 });
    }
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "文件内容无效" }, { status: 400 });
    }
    const encoding = body.encoding === "base64" ? "base64" : "utf8";
    const material = writeProjectMaterial(id, name, body.content, { encoding });
    const kind = kindFromName(material.name);
    // A7: do not store binary dumps into card content (overview source).
    const rawText =
      encoding === "base64"
        ? ""
        : typeof body.content === "string"
          ? body.content
          : "";
    const cardContent = materialCardSummary(
      material.relativePath || material.name,
      kind === "image" || kind === "binary" ? "" : rawText,
    );
    const card = addCard({
      projectId: id,
      title: body.title?.trim() || material.name,
      content: cardContent,
      source: "doc",
      sourceFileId: material.id,
    });
    return NextResponse.json({ material, card }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "添加文件失败" },
      { status: 400 },
    );
  }
}
