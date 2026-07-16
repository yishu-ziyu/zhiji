import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  kindFromName,
  listProjectMaterials,
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

  it("classifies markdown files", () => {
    expect(kindFromName("note.md")).toBe("markdown");
    expect(kindFromName("x.PDF")).toBe("other");
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
    expect(readProjectMaterial(projectId, "note.md")?.content).toBe(
      "hello material",
    );
    expect(fs.existsSync(path.join(tmpDir, "files", projectId, "note.md"))).toBe(
      true,
    );
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
