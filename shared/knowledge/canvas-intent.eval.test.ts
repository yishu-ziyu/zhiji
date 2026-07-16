import { describe, expect, it } from "vitest";
import {
  GOLDEN_CANVAS_NEGATIVES,
  GOLDEN_CANVAS_UTTERANCES,
} from "./canvas-golden-intents";
import { matchCanvasIntent, resolveCanvasCommandFromUtterance } from "./canvas-intent";
import {
  filterEdgesForView,
  parseCanvasCommand,
  type CanvasViewId,
} from "./canvas-command";
import {
  executeSetCanvasView,
  planSetCanvasViewFromUtterance,
} from "./set-canvas-view";
import type { CanvasEdge } from "@/shared/types/knowledge";

describe("canvas-menu-v1 · golden intent eval (full gate)", () => {
  it("matches all golden utterances on intentId + view", () => {
    const failures: string[] = [];
    for (const g of GOLDEN_CANVAS_UTTERANCES) {
      const match = matchCanvasIntent(g.utterance);
      if (match.intentId !== g.intentId || match.view !== g.view) {
        failures.push(
          `${g.id} 「${g.utterance}」 expected ${g.intentId}/${g.view} got ${match.intentId}/${match.view}`,
        );
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
    expect(GOLDEN_CANVAS_UTTERANCES.length).toBeGreaterThanOrEqual(100);
  });

  it("negatives stay unknown (no false force)", () => {
    for (const u of GOLDEN_CANVAS_NEGATIVES) {
      const match = matchCanvasIntent(u);
      expect(match.intentId, u).toBe("unknown");
    }
  });

  it("resolveCanvasCommandFromUtterance produces valid commands", () => {
    for (const g of GOLDEN_CANVAS_UTTERANCES) {
      const { command, match } = resolveCanvasCommandFromUtterance(g.utterance, {
        projectFocus: { kind: "project", id: "p1" },
      });
      expect(match.intentId).toBe(g.intentId);
      expect(command).not.toBeNull();
      expect(command!.view).toBe(g.view);
      expect(command!.menuVersion).toBe("canvas-menu-v1");
      expect(command!.focus).toEqual({ kind: "project", id: "p1" });
    }
  });
});

describe("set_canvas_view tool", () => {
  it("rejects invalid input", () => {
    const bad = executeSetCanvasView({ view: "nope" });
    expect(bad.outcome).toBe("error");
    if (bad.outcome === "error") {
      expect(bad.errorClass).toBe("invalid_input");
    }
  });

  it("accepts valid command", () => {
    const ok = executeSetCanvasView({
      view: "evidence",
      focus: { kind: "card", id: "c1" },
      intentId: "why_evidence",
      reason: "要证据",
    });
    expect(ok.outcome).toBe("ok");
    if (ok.outcome === "ok") {
      expect(ok.command.view).toBe("evidence");
      const re = parseCanvasCommand(JSON.parse(ok.detail));
      expect(re.ok).toBe(true);
    }
  });

  it("forces tool plan for golden utterances", () => {
    for (const g of GOLDEN_CANVAS_UTTERANCES) {
      const plan = planSetCanvasViewFromUtterance(g.utterance, {
        projectFocus: { kind: "project", id: "p1" },
      });
      expect(plan.shouldCall, g.id).toBe(true);
      expect(plan.toolCall?.name).toBe("set_canvas_view");
      expect(plan.toolCall?.input.view).toBe(g.view);
    }
  });

  it("does not force tool for chitchat", () => {
    const plan = planSetCanvasViewFromUtterance("今天天气不错");
    expect(plan.shouldCall).toBe(false);
  });
});

describe("filterEdgesForView", () => {
  const edges: CanvasEdge[] = [
    {
      id: "e1",
      source: { kind: "project", id: "p" },
      target: { kind: "work_item", id: "w1" },
      label: "当前重点",
      status: "confirmed",
      direction: "out",
      kind: "attention",
      strength: "strong",
    },
    {
      id: "e2",
      source: { kind: "project", id: "p" },
      target: { kind: "card", id: "c1" },
      label: "理解依据",
      status: "confirmed",
      direction: "out",
      kind: "evidence",
      strength: "strong",
    },
    {
      id: "e3",
      source: { kind: "project", id: "p" },
      target: { kind: "card", id: "c2" },
      label: "最近打开",
      status: "confirmed",
      direction: "out",
      kind: "recent",
      strength: "weak",
    },
    {
      id: "e4",
      source: { kind: "project", id: "p" },
      target: { kind: "work_item", id: "w2" },
      label: "阻塞",
      status: "confirmed",
      direction: "out",
      kind: "blocked",
      strength: "strong",
    },
  ];

  it("now hides weak", () => {
    const ids = filterEdgesForView(edges, "now").map((e) => e.id);
    expect(ids).not.toContain("e3");
    expect(ids).toContain("e1");
  });

  it("evidence keeps evidence/attention only", () => {
    const ids = filterEdgesForView(edges, "evidence").map((e) => e.id);
    expect(ids.sort()).toEqual(["e1", "e2"]);
  });

  it("decision keeps attention/blocked/work-strong", () => {
    const ids = filterEdgesForView(edges, "decision").map((e) => e.id);
    expect(ids).toContain("e1");
    expect(ids).toContain("e4");
    expect(ids).not.toContain("e2");
    expect(ids).not.toContain("e3");
  });

  it("by_kind hides weak", () => {
    const v: CanvasViewId = "by_kind";
    const ids = filterEdgesForView(edges, v).map((e) => e.id);
    expect(ids).not.toContain("e3");
  });
});
