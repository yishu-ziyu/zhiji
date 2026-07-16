import { describe, expect, it } from "vitest";
import {
  classifyTopLevelDrop,
  classifyWebkitRelativeFiles,
  normalizeImportRelativePath,
  shouldSkipImportName,
} from "./folder-import";

describe("folder-import A5", () => {
  it("groups webkitRelativePath files by top-level folder name", () => {
    const result = classifyWebkitRelativeFiles([
      {
        name: "a.md",
        content: "alpha",
        webkitRelativePath: "Alpha/a.md",
      },
      {
        name: "b.md",
        content: "nested",
        webkitRelativePath: "Alpha/sub/b.md",
      },
      {
        name: "only.md",
        content: "beta-only",
        webkitRelativePath: "Beta/only.md",
      },
      {
        name: "loose.md",
        content: "loose",
        webkitRelativePath: "loose.md",
      },
    ]);

    expect(result.folderProjects).toHaveLength(2);
    const alpha = result.folderProjects.find((p) => p.projectName === "Alpha");
    const beta = result.folderProjects.find((p) => p.projectName === "Beta");
    expect(alpha?.files.map((f) => f.relativePath).sort()).toEqual([
      "a.md",
      "sub/b.md",
    ]);
    expect(beta?.files).toEqual([
      { relativePath: "only.md", content: "beta-only", encoding: "utf8" },
    ]);
    expect(result.looseFiles).toEqual([
      { name: "loose.md", content: "loose", encoding: "utf8" },
    ]);
  });

  it("treats single-level folder of only files as one project", () => {
    const result = classifyTopLevelDrop({
      directories: [
        {
          name: "FlatNotes",
          files: [
            { relativePath: "one.md", content: "1" },
            { relativePath: "two.md", content: "2" },
          ],
        },
      ],
      looseFiles: [],
    });
    expect(result.folderProjects).toEqual([
      {
        projectName: "FlatNotes",
        files: [
          { relativePath: "one.md", content: "1", encoding: "utf8" },
          { relativePath: "two.md", content: "2", encoding: "utf8" },
        ],
      },
    ]);
  });

  it("skips junk names and drops traversal segments", () => {
    expect(shouldSkipImportName(".DS_Store")).toBe(true);
    // ".." segments are stripped; remaining parts join (no absolute escape).
    expect(normalizeImportRelativePath("sub/../ok.md")).toBe("sub/ok.md");
    expect(normalizeImportRelativePath("a/b/c.md")).toBe("a/b/c.md");
  });

  it("preserves base64 encoding on folder materials", () => {
    const result = classifyWebkitRelativeFiles([
      {
        name: "a.md",
        content: "# hi",
        encoding: "utf8",
        webkitRelativePath: "Pack/a.md",
      },
      {
        name: "pic.png",
        content: "iVBORw0KGgo=",
        encoding: "base64",
        webkitRelativePath: "Pack/pic.png",
      },
    ]);
    expect(result.folderProjects).toHaveLength(1);
    const files = result.folderProjects[0].files;
    expect(files.find((f) => f.relativePath === "a.md")?.encoding).toBe("utf8");
    expect(files.find((f) => f.relativePath === "pic.png")?.encoding).toBe(
      "base64",
    );
  });
});
