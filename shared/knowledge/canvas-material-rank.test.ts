import { describe, expect, it } from "vitest";
import {
  canvasMaterialRankScore,
  isCanvasNoiseMaterial,
  isUsefulCanvasCard,
  sortCardsForCanvas,
} from "./canvas-material-rank";

describe("canvas-material-rank", () => {
  it("flags lockfiles, media, and tooling scripts as noise", () => {
    expect(isCanvasNoiseMaterial("package-lock.json")).toBe(true);
    expect(isCanvasNoiseMaterial("pnpm-lock.yaml")).toBe(true);
    expect(isCanvasNoiseMaterial("clip.mp3")).toBe(true);
    expect(isCanvasNoiseMaterial("run-form.mjs")).toBe(true);
    expect(isCanvasNoiseMaterial("_options.css")).toBe(true);
    expect(isCanvasNoiseMaterial("README.md")).toBe(false);
    expect(isCanvasNoiseMaterial("CONTEXT.md")).toBe(false);
  });

  it("ranks markdown notes above scripts", () => {
    const cards = [
      { id: "1", title: "run-media.mjs", content: "x" },
      { id: "2", title: "CONTEXT.md", content: "north star text ".repeat(20) },
      { id: "3", title: "TODO.md", content: "tasks" },
    ];
    const ordered = sortCardsForCanvas(cards);
    expect(ordered[0].id).toBe("2");
    expect(ordered.every((c) => isUsefulCanvasCard(c) || c.id === "1")).toBe(true);
    expect(canvasMaterialRankScore(cards[0])).toBeLessThan(0);
    expect(canvasMaterialRankScore(cards[1])).toBeGreaterThan(0);
  });
});
