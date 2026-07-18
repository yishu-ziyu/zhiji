import { describe, expect, it } from "vitest";
import {
  planLogicCanvasFromPaths,
  rankPathsForLogicPresentation,
  resolveCardKeysFromPaths,
} from "@/shared/knowledge/logic-canvas";
import { matchCanvasIntent } from "@/shared/knowledge/canvas-intent";

describe("logic-canvas path → card keys", () => {
  const materials = [
    { id: "c-readme", sourceFileId: "README.md", title: "README" },
    { id: "c-prd", sourceFileId: "docs/PRD.md", title: "产品说明" },
    { id: "c-flow", sourceFileId: "docs/flow.md", title: "主流程" },
  ];

  it("maps relative paths to card: keys in order", () => {
    const keys = resolveCardKeysFromPaths(
      ["README.md", "docs/flow.md", "missing.ts"],
      materials,
    );
    expect(keys).toEqual(["card:c-readme", "card:c-flow"]);
  });

  it("ranks structural docs first", () => {
    const ranked = rankPathsForLogicPresentation([
      "src/util.ts",
      "README.md",
      "docs/architecture.md",
    ]);
    expect(ranked[0]).toMatch(/readme|architecture/i);
  });

  it("builds present_logic canvas command with highlights", () => {
    const cmd = planLogicCanvasFromPaths({
      projectId: "p1",
      relativePaths: ["README.md", "docs/PRD.md"],
      materials,
    });
    expect(cmd.view).toBe("now");
    expect(cmd.intentId).toBe("present_logic");
    expect(cmd.fold).toBe("path");
    expect(cmd.highlightNodeKeys).toEqual(["card:c-readme", "card:c-prd"]);
    expect(cmd.focus).toEqual({ kind: "project", id: "p1" });
  });
});

describe("present_logic intent", () => {
  it("matches owner asks for business logic presentation", () => {
    for (const u of [
      "展示业务逻辑",
      "把业务逻辑串起来",
      "这个项目在做什么",
      "show me the business logic",
    ]) {
      expect(matchCanvasIntent(u).intentId, u).toBe("present_logic");
      expect(matchCanvasIntent(u).view, u).toBe("now");
    }
  });
});
