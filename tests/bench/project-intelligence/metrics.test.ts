import { describe, expect, it } from "vitest";
import {
  buildMetricsSnapshot,
  compareSnapshots,
  measureOfflineMetrics,
  PRIMARY_METRICS,
  rateForFamilies,
  scorePrimaryMetrics,
} from "./metrics";
import { runBench } from "./evaluate";
import { PROJECT_INTELLIGENCE_BENCH } from "./catalog";
import type { MetricsSnapshot } from "./metrics";

describe("Project Intelligence Metrics loop", () => {
  it("defines five primary metrics with thresholds", () => {
    expect(PRIMARY_METRICS.map((m) => m.id)).toEqual([
      "overall_pass_rate",
      "structure_pass_rate",
      "search_intent_pass_rate",
      "honesty_pass_rate",
      "noise_pass_rate",
    ]);
    for (const m of PRIMARY_METRICS) {
      expect(m.threshold).toBe(1);
    }
  });

  it("measure: offline suite scores 100% on all primary metrics", () => {
    const snap = measureOfflineMetrics({ commit: "test", dirty: false });
    expect(snap.schemaVersion).toBe(1);
    expect(snap.bench.total).toBeGreaterThanOrEqual(50);
    expect(snap.failedScenarioIds).toEqual([]);
    for (const m of snap.metrics) {
      expect(m.pass, m.id).toBe(true);
      expect(m.value, m.id).toBe(1);
      expect(m.denominator, m.id).toBeGreaterThan(0);
    }
    // diagnostics populated
    expect(snap.diagnostics.length).toBeGreaterThan(0);
    const kinds = snap.diagnostics.map((d) => d.kind);
    expect(kinds).toContain("format_roundtrip_structured");
    expect(kinds).toContain("search_queries_contain");
  });

  it("compare: identical snapshots → PASS no regression", () => {
    const a = measureOfflineMetrics();
    const b = structuredClone(a) as MetricsSnapshot;
    b.ranAt = new Date().toISOString();
    const cmp = compareSnapshots(a, b);
    expect(cmp.pass).toBe(true);
    expect(cmp.regressions).toEqual([]);
    expect(cmp.gateFailures).toEqual([]);
  });

  it("compare: primary drop → REGRESSION fail", () => {
    const baseline = measureOfflineMetrics();
    const worse = structuredClone(baseline) as MetricsSnapshot;
    const overall = worse.metrics.find((m) => m.id === "overall_pass_rate");
    expect(overall).toBeTruthy();
    if (overall) {
      overall.value = 0.5;
      overall.pass = false;
      overall.numerator = Math.floor(overall.denominator / 2);
    }
    const cmp = compareSnapshots(baseline, worse);
    expect(cmp.pass).toBe(false);
    expect(cmp.regressions.some((r) => r.id === "overall_pass_rate")).toBe(
      true,
    );
    expect(cmp.gateFailures).toContain("overall_pass_rate");
  });

  it("rateForFamilies isolates structure family", () => {
    const report = runBench(PROJECT_INTELLIGENCE_BENCH);
    const all = rateForFamilies(report, []);
    const structure = rateForFamilies(report, ["structure"]);
    expect(all.denominator).toBe(report.total);
    expect(structure.denominator).toBe(
      report.byFamily.structure?.total ?? 0,
    );
    expect(structure.denominator).toBeGreaterThan(0);
    expect(structure.value).toBe(1);
    const scores = scorePrimaryMetrics(report);
    expect(scores.every((s) => s.pass)).toBe(true);
  });

  it("buildMetricsSnapshot keeps goal text for the loop", () => {
    const report = runBench(PROJECT_INTELLIGENCE_BENCH);
    const snap = buildMetricsSnapshot(report);
    expect(snap.goals.product).toContain("拍板");
    expect(snap.goals.engineering).toContain("可重复测量");
  });
});
