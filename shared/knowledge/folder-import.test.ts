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
      { relativePath: "only.md", content: "beta-only" },
    ]);
    expect(result.looseFiles).toEqual([{ name: "loose.md", content: "loose" }]);
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
          { relativePath: "one.md", content: "1" },
          { relativePath: "two.md", content: "2" },
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
});
