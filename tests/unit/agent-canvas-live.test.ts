import { describe, expect, it } from "vitest";
import {
  buildLiveFeedFromReceipts,
  deriveNodeAgentPhase,
  highlightIdsFromReceipts,
  pathHintsFromSummary,
  receiptTouchesNode,
} from "@/app/track/knowledge/lib/agent-canvas-live";

describe("agent-canvas-live · Canvasight bridge", () => {
  it("extracts path hints from read summaries", () => {
    const hints = pathHintsFromSummary("已读 PRODUCT.md L1-20（共 12 行）");
    expect(hints.some((h) => h.includes("product.md"))).toBe(true);
  });

  it("matches receipt to canvas material node", () => {
    expect(
      receiptTouchesNode(
        {
          sequence: 3,
          tool: "read_revision",
          outcome: "ok",
          summary: "已读 NOTES.md L1-8",
        },
        "NOTES.md",
      ),
    ).toBe(true);
  });

  it("marks material as reading while run is active", () => {
    const phase = deriveNodeAgentPhase({
      nodeKind: "card",
      nodeLabel: "PRODUCT.md",
      runStatus: "running",
      toolReceipts: [
        {
          sequence: 1,
          tool: "read_revision",
          outcome: "ok",
          summary: "已读 PRODUCT.md L1-10",
        },
      ],
    });
    expect(phase).toBe("reading");
  });

  it("marks material done after await_owner", () => {
    const phase = deriveNodeAgentPhase({
      nodeKind: "card",
      nodeLabel: "PRODUCT.md",
      runStatus: "awaiting_owner",
      toolReceipts: [
        {
          sequence: 1,
          tool: "read_revision",
          outcome: "ok",
          summary: "已读 PRODUCT.md",
        },
      ],
    });
    expect(phase).toBe("done");
  });

  it("marks project center mapped after project_map", () => {
    const phase = deriveNodeAgentPhase({
      nodeKind: "project",
      nodeLabel: "持节",
      runStatus: "running",
      toolReceipts: [
        {
          sequence: 1,
          tool: "project_map",
          outcome: "ok",
          summary: "项目地图 depth≤3：4 项",
        },
      ],
    });
    expect(phase).toBe("mapped");
  });

  it("builds live feed with last tool live while running", () => {
    const rows = buildLiveFeedFromReceipts(
      [
        {
          sequence: 1,
          tool: "project_map",
          outcome: "ok",
          summary: "地图 4 项",
        },
        {
          sequence: 2,
          tool: "read_revision",
          outcome: "ok",
          summary: "已读 PRODUCT.md",
        },
      ],
      { runStatus: "running", progressSummary: "正在精读…" },
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.live)).toBe(true);
    expect(rows.some((r) => r.title === "精读文件")).toBe(true);
  });

  it("highlights nodes touched by receipts", () => {
    const ids = highlightIdsFromReceipts(
      [
        { ref: { kind: "card", id: "c1" }, label: "PRODUCT.md" },
        { ref: { kind: "card", id: "c2" }, label: "other.txt" },
      ],
      [
        {
          sequence: 1,
          tool: "read_revision",
          outcome: "ok",
          summary: "已读 PRODUCT.md",
        },
      ],
      "running",
    );
    expect(ids).toContain("card:c1");
    expect(ids).not.toContain("card:c2");
  });
});
