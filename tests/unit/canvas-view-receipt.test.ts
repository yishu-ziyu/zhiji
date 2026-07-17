import { describe, expect, it } from "vitest";
import { canvasCommandFromReceipt } from "@/app/track/knowledge/lib/canvas-view-receipt";

describe("canvasCommandFromReceipt", () => {
  it("applies the durable set_canvas_view receipt returned after a real run", () => {
    expect(
      canvasCommandFromReceipt({
        tool: "set_canvas_view",
        summary: "画布已切换为「decision」",
      }),
    ).toMatchObject({ view: "decision", menuVersion: "canvas-menu-v1" });
  });

  it("keeps focus and highlights when the normalized command detail is present", () => {
    expect(
      canvasCommandFromReceipt({
        tool: "set_canvas_view",
        summary:
          '画布已切换为「evidence」\n{"menuVersion":"canvas-menu-v1","view":"evidence","focus":{"kind":"project","id":"p1"},"highlightNodeKeys":["card:c1"]}',
      }),
    ).toMatchObject({
      view: "evidence",
      focus: { kind: "project", id: "p1" },
      highlightNodeKeys: ["card:c1"],
    });
  });

  it("refuses an unrelated receipt", () => {
    expect(
      canvasCommandFromReceipt({ tool: "read_path", summary: "已读 README.md" }),
    ).toBeNull();
  });
});
