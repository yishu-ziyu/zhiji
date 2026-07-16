import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  kindFromName,
  listProjectMaterials,
  looksLikeBinaryText,
  materialCardSummary,
  readProjectMaterial,
  renderMarkdownLite,
  sanitizeMaterialFileName,
  writeProjectMaterial,
} from "./materials";

describe("materials", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-materials-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.KNOWLEDGE_DATA_DIR;
    } else {
      process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("classifies markdown, image, and binary files", () => {
    expect(kindFromName("note.md")).toBe("markdown");
    expect(kindFromName("logo-horizontal.png")).toBe("image");
    expect(kindFromName("x.PDF")).toBe("binary");
    expect(kindFromName("readme.txt")).toBe("text");
  });

  it("renders a heading and paragraph without raw tags", () => {
    const html = renderMarkdownLite("# 标题\n\n一段 **粗体** 和 <script>");
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<strong>粗体</strong>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("writes a file under the project id and reads it back", () => {
    const projectId = "proj-user-1";
    const meta = writeProjectMaterial(projectId, "note.md", "hello material");
    expect(meta.projectId).toBe(projectId);
    expect(meta.id).toBe("note.md");
    expect(listProjectMaterials(projectId)).toHaveLength(1);
    const read = readProjectMaterial(projectId, "note.md");
    expect(read?.content).toBe("hello material");
    expect(read?.previewMode).toBe("text");
    expect(fs.existsSync(path.join(tmpDir, "files", projectId, "note.md"))).toBe(
      true,
    );
  });

  it("A8: markdown body stays readable", () => {
    writeProjectMaterial("p-md", "brief.md", "# 标题\n\n正文可读");
    const read = readProjectMaterial("p-md", "brief.md");
    expect(read?.previewMode).toBe("text");
    expect(read?.content).toContain("正文可读");
    expect(read?.content).not.toMatch(/\uFFFD{3,}/);
  });

  it("A7: PNG is never returned as utf8 dump; image or unsupported", () => {
    // Valid tiny 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    writeProjectMaterial("p-img", "logo-horizontal.png", png.toString("base64"), {
      encoding: "base64",
    });
    const read = readProjectMaterial("p-img", "logo-horizontal.png");
    expect(read?.meta.kind).toBe("image");
    expect(read?.previewMode).toBe("image");
    expect(read?.content).toBe("");
    expect(read?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(read?.content).not.toContain("IHDR");
  });

  it("A7: corrupted utf8-stored PNG becomes unsupported message not mojibake wall", () => {
    // Simulate historical file.text() write: starts with U+FFFD bytes EF BF BD
    const corrupted = Buffer.from([
      0xef, 0xbf, 0xbd, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const dir = path.join(tmpDir, "files", "p-bad");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "logo-horizontal.png"), corrupted);
    const read = readProjectMaterial("p-bad", "logo-horizontal.png");
    expect(read?.previewMode).toBe("unsupported");
    expect(read?.content).toBe("");
    expect(read?.unsupportedMessage).toContain("不支持文本预览");
    expect(read?.unsupportedMessage).toContain("logo-horizontal.png");
    expect(read?.unsupportedMessage).toContain("png");
  });

  it("A7: materialCardSummary never returns binary dump for images", () => {
    const dump = `${"\uFFFD".repeat(20)}PNG\r\n${"x".repeat(500)}`;
    expect(looksLikeBinaryText(dump)).toBe(true);
    const summary = materialCardSummary("logo-horizontal.png", dump);
    expect(summary).toContain("不支持文本预览");
    expect(summary).toContain("logo-horizontal.png");
    expect(summary.length).toBeLessThan(200);
  });

  it("rejects path traversal names", () => {
    expect(() => sanitizeMaterialFileName("../x.md")).not.toThrow();
    // basename strips parent segments; write still stays in project dir.
    const meta = writeProjectMaterial("p1", "../escape.md", "x");
    expect(meta.id).toBe("escape.md");
    expect(fs.existsSync(path.join(tmpDir, "files", "p1", "escape.md"))).toBe(
      true,
    );
  });
});
