import { expect, it } from "vitest";
import { dropOverlayHint } from "@/app/track/knowledge/lib/folder-drop";
import { classifyTopLevelDrop } from "@/shared/knowledge/folder-import";

it("drop overlay copy mentions folders for multi-project", () => {
  expect(dropOverlayHint({ hasProject: false })).toMatch(/文件夹/);
  expect(dropOverlayHint({ hasProject: true })).toMatch(/新项目/);
});

it("A5 classify: two top-level folders → two projects (UI wiring input)", () => {
  const classified = classifyTopLevelDrop({
    directories: [
      {
        name: "项目甲",
        files: [{ relativePath: "a.md", content: "alpha" }],
      },
      {
        name: "项目乙",
        files: [
          { relativePath: "b.md", content: "beta" },
          { relativePath: "sub/c.md", content: "nested" },
        ],
      },
    ],
    looseFiles: [],
  });
  expect(classified.folderProjects).toHaveLength(2);
  expect(classified.folderProjects.map((p) => p.projectName)).toEqual([
    "项目甲",
    "项目乙",
  ]);
  expect(classified.folderProjects[1].files.map((f) => f.relativePath)).toEqual([
    "b.md",
    "sub/c.md",
  ]);
});
