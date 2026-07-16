import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatByteSize,
  kindFromName,
  listProjectMaterials,
  looksLikeBinaryText,
  materialCardSummary,
  materialContentHash,
  readProjectMaterial,
  renderMarkdownLite,
  sanitizeMaterialFileName,
  typeLabelFromName,
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

  it("classifies markdown, image, audio, and binary files", () => {
    expect(kindFromName("note.md")).toBe("markdown");
    expect(kindFromName("logo-horizontal.png")).toBe("image");
    expect(kindFromName("clip.mp3")).toBe("audio");
    expect(kindFromName("x.PDF")).toBe("binary");
    expect(kindFromName("readme.txt")).toBe("text");
    expect(typeLabelFromName("clip.mp3")).toBe("音频");
    expect(typeLabelFromName("a.png")).toBe("图片");
    expect(typeLabelFromName("a.md")).toBe("文档");
    expect(formatByteSize(2048)).toMatch(/KB/);
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

  it("materialContentHash is stable sha256 hex of raw bytes", () => {
    const a = materialContentHash("hello material");
    const b = materialContentHash(Buffer.from("hello material", "utf8"));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
    expect(materialContentHash("hello material")).toBe(a);
    expect(materialContentHash("other")).not.toBe(a);
    expect(materialContentHash(Buffer.alloc(0))).toMatch(/^[a-f0-9]{64}$/);
  });

  it("write/read/list expose contentHash while id stays relativePath", () => {
    const projectId = "proj-hash-1";
    const bodyA = "# v1\n\nstable path cite";
    const metaA = writeProjectMaterial(projectId, "brief.md", bodyA);
    expect(metaA.id).toBe("brief.md");
    expect(metaA.relativePath).toBe("brief.md");
    expect(metaA.contentHash).toBe(materialContentHash(bodyA));

    const readA = readProjectMaterial(projectId, "brief.md");
    expect(readA?.meta.id).toBe("brief.md");
    expect(readA?.meta.contentHash).toBe(metaA.contentHash);

    const listed = listProjectMaterials(projectId);
    expect(listed[0]?.id).toBe("brief.md");
    expect(listed[0]?.contentHash).toBe(metaA.contentHash);

    const bodyB = "# v2\n\noverwritten bytes";
    const metaB = writeProjectMaterial(projectId, "brief.md", bodyB);
    expect(metaB.id).toBe("brief.md");
    expect(metaB.contentHash).toBe(materialContentHash(bodyB));
    expect(metaB.contentHash).not.toBe(metaA.contentHash);
  });

  it("base64 write hashes decoded bytes not the base64 text", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const meta = writeProjectMaterial(
      "p-hash-bin",
      "dot.png",
      png.toString("base64"),
      { encoding: "base64" },
    );
    expect(meta.id).toBe("dot.png");
    expect(meta.contentHash).toBe(materialContentHash(png));
    expect(meta.contentHash).not.toBe(
      materialContentHash(png.toString("base64")),
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
    expect(read?.unsupportedMessage).toContain("无法预览");
    expect(read?.unsupportedMessage).toContain("logo-horizontal.png");
    expect(read?.typeLabel).toBe("图片");
  });

  it("M2: mp3 is audio preview with dataUrl, not unsupported wall", () => {
    // Minimal bytes; not a real mp3 frame but enough for storage/preview mode.
    const fake = Buffer.from("ID3fake-audio-bytes");
    writeProjectMaterial("p-audio", "clip.mp3", fake.toString("base64"), {
      encoding: "base64",
    });
    const read = readProjectMaterial("p-audio", "clip.mp3");
    expect(read?.meta.kind).toBe("audio");
    expect(read?.previewMode).toBe("audio");
    expect(read?.typeLabel).toBe("音频");
    expect(read?.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
    expect(read?.sizeLabel).toBeTruthy();
    expect(read?.unsupportedMessage).toBeUndefined();
  });

  it("M2: list sorts newest first", () => {
    writeProjectMaterial("p-order", "old.md", "old");
    const older = path.join(tmpDir, "files", "p-order", "old.md");
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(older, past, past);
    writeProjectMaterial("p-order", "new.md", "new");
    const listed = listProjectMaterials("p-order");
    expect(listed.map((f) => f.id)).toEqual(["new.md", "old.md"]);
  });

  it("A7: materialCardSummary never returns binary dump for images", () => {
    const dump = `${"\uFFFD".repeat(20)}PNG\r\n${"x".repeat(500)}`;
    expect(looksLikeBinaryText(dump)).toBe(true);
    const summary = materialCardSummary("logo-horizontal.png", dump);
    expect(summary).toContain("无法预览");
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
