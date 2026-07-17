/**
 * Project Intelligence Bench — offline CI gate.
 * Product vertical metrics (structure / search intent / refuse / noise / safety).
 */
import { describe, expect, it } from "vitest";
import { benchCatalogStats, PROJECT_INTELLIGENCE_BENCH } from "./catalog";
import { runBench } from "./evaluate";

describe("Project Intelligence Bench (offline)", () => {
  it("catalog has enough scenarios for a vertical product bench", () => {
    const stats = benchCatalogStats();
    expect(stats.total).toBeGreaterThanOrEqual(50);
    // Families required by optimization playbook
    for (const family of [
      "structure",
      "search",
      "decision",
      "reentry",
      "conflict",
      "refuse",
      "noise",
      "quick",
      "safety",
    ] as const) {
      expect(stats.byFamily[family] ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it("all offline scenarios pass pure evaluators", () => {
    const report = runBench(PROJECT_INTELLIGENCE_BENCH, {
      name: "project-intelligence-bench",
      version: "0.1.0",
    });

    if (report.failed > 0) {
      const fails = report.results
        .filter((r) => !r.pass)
        .map((r) => {
          const bad = r.checks
            .filter((c) => !c.pass)
            .map((c) => `${c.kind}:${c.detail}`)
            .join("; ");
          return `${r.id} ${r.title} → ${bad}`;
        });
      expect.fail(
        `${report.failed}/${report.total} failed\n${fails.join("\n")}`,
      );
    }

    expect(report.passed).toBe(report.total);
    expect(report.failed).toBe(0);
  });

  it("reports by-family coverage without empty buckets", () => {
    const report = runBench(PROJECT_INTELLIGENCE_BENCH);
    for (const [family, slot] of Object.entries(report.byFamily)) {
      expect(slot.total, family).toBeGreaterThan(0);
      expect(slot.passed, family).toBe(slot.total);
    }
  });
});
