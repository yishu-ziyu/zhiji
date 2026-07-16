import { describe, expect, it } from "vitest";
import { applyDagreLayout } from "@/app/track/knowledge/lib/canvas-auto-layout";

describe("applyDagreLayout", () => {
  it("places center above neighbors in TB layout", () => {
    const nodes = [
      {
        id: "project:p1",
        width: 200,
        height: 148,
        position: { x: 0, y: 0 },
        isCenter: true,
      },
      {
        id: "work_item:w1",
        width: 196,
        height: 96,
        position: { x: 0, y: 0 },
      },
      {
        id: "work_item:w2",
        width: 196,
        height: 96,
        position: { x: 0, y: 0 },
      },
    ];
    const edges = [
      { id: "e1", source: "project:p1", target: "work_item:w1" },
      { id: "e2", source: "project:p1", target: "work_item:w2" },
    ];
    const { nodes: laid, engine } = applyDagreLayout(nodes, edges, {
      direction: "TB",
    });
    expect(engine).toBe("dagre");
    const center = laid.find((n) => n.id === "project:p1")!;
    const w1 = laid.find((n) => n.id === "work_item:w1")!;
    const w2 = laid.find((n) => n.id === "work_item:w2")!;
    // Center should be above (smaller y) than work nodes in TB.
    expect(center.position.y).toBeLessThan(w1.position.y);
    expect(center.position.y).toBeLessThan(w2.position.y);
    // Neighbors should not stack on identical coords.
    expect(
      Math.abs(w1.position.x - w2.position.x) > 4 ||
        Math.abs(w1.position.y - w2.position.y) > 4,
    ).toBe(true);
  });

  it("returns empty for empty input", () => {
    const r = applyDagreLayout([], []);
    expect(r.nodes).toEqual([]);
  });
});
