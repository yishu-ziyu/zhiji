import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const navigatorSource = fs.readFileSync(
  path.join(
    root,
    "app/track/knowledge/components/ProjectNavigator.tsx",
  ),
  "utf8",
);
const pageSource = fs.readFileSync(
  path.join(root, "app/track/knowledge/page.tsx"),
  "utf8",
);

describe("ProjectNavigator demo navigation contract", () => {
  it("makes the project header plus create a project", () => {
    expect(navigatorSource).toMatch(/aria-label="新增项目"/);
    expect(navigatorSource).toMatch(/onClick=\{onCreateProject\}/);
    expect(pageSource).toMatch(
      /onCreateProject=\{\(\) => setCreateProjectOpen\(true\)\}/,
    );
  });

  it("shows the shortcut that the workspace actually handles", () => {
    expect(navigatorSource).toContain("<kbd>⌘F</kbd>");
    expect(navigatorSource).not.toContain("<kbd>⌘K</kbd>");
  });

  it("does not expose disabled future destinations in the demo sidebar", () => {
    expect(navigatorSource).not.toContain("<span>收藏</span>");
    expect(navigatorSource).not.toContain("<span>模板</span>");
  });
});
