/**
 * Metric layer on Project Intelligence Bench.
 * Goal → metrics → measure → compare → adjust → re-measure.
 */
import type { BenchCheckKind, BenchReport } from "./schema";
import { runBench } from "./evaluate";
import { PROJECT_INTELLIGENCE_BENCH } from "./catalog";

export type MetricId =
  | "overall_pass_rate"
  | "structure_pass_rate"
  | "search_intent_pass_rate"
  | "honesty_pass_rate"
  | "noise_pass_rate";

export type MetricDefinition = {
  id: MetricId;
  name: string;
  /** Families included; empty = all scenarios. */
  families: string[];
  threshold: number;
};

/** Primary metrics — gate. Offline suite is deterministic → threshold 1.0. */
export const PRIMARY_METRICS: MetricDefinition[] = [
  {
    id: "overall_pass_rate",
    name: "全量场景通过率",
    families: [],
    threshold: 1,
  },
  {
    id: "structure_pass_rate",
    name: "结构契约通过率",
    families: ["structure"],
    threshold: 1,
  },
  {
    id: "search_intent_pass_rate",
    name: "检索意图通过率",
    families: ["search", "quick"],
    threshold: 1,
  },
  {
    id: "honesty_pass_rate",
    name: "诚实/安全通过率",
    families: ["refuse", "safety"],
    threshold: 1,
  },
  {
    id: "noise_pass_rate",
    name: "噪声不升格通过率",
    families: ["noise"],
    threshold: 1,
  },
];

export type MetricScore = {
  id: MetricId;
  name: string;
  value: number;
  threshold: number;
  pass: boolean;
  numerator: number;
  denominator: number;
};

export type DiagnosticScore = {
  kind: string;
  value: number;
  numerator: number;
  denominator: number;
};

export type MetricsSnapshot = {
  schemaVersion: 1;
  name: "project-intelligence-metrics";
  suite: "offline-v0";
  ranAt: string;
  git?: { commit?: string; dirty?: boolean };
  goals: {
    product: string;
    engineering: string;
  };
  metrics: MetricScore[];
  diagnostics: DiagnosticScore[];
  bench: {
    total: number;
    passed: number;
    failed: number;
    byFamily: BenchReport["byFamily"];
  };
  /** Failed scenario ids for quick triage. */
  failedScenarioIds: string[];
  /**
   * Full per-scenario results for public experiment archives.
   * Optional on slim snapshots; publish always includes this.
   */
  scenarios?: Array<{
    id: string;
    family: string;
    difficulty: string;
    title: string;
    pass: boolean;
    checks: Array<{ kind: string; pass: boolean; detail: string }>;
  }>;
};

export function rateForFamilies(
  report: BenchReport,
  families: string[],
): { value: number; numerator: number; denominator: number } {
  if (families.length === 0) {
    const denominator = report.total;
    const numerator = report.passed;
    return {
      numerator,
      denominator,
      value: denominator === 0 ? 0 : numerator / denominator,
    };
  }
  let numerator = 0;
  let denominator = 0;
  for (const f of families) {
    const slot = report.byFamily[f];
    if (!slot) continue;
    numerator += slot.passed;
    denominator += slot.total;
  }
  return {
    numerator,
    denominator,
    value: denominator === 0 ? 0 : numerator / denominator,
  };
}

export function scorePrimaryMetrics(report: BenchReport): MetricScore[] {
  return PRIMARY_METRICS.map((def) => {
    const { value, numerator, denominator } = rateForFamilies(
      report,
      def.families,
    );
    return {
      id: def.id,
      name: def.name,
      value,
      threshold: def.threshold,
      pass: denominator > 0 && value + 1e-9 >= def.threshold,
      numerator,
      denominator,
    };
  });
}

export function scoreDiagnostics(report: BenchReport): DiagnosticScore[] {
  const bag = new Map<string, { n: number; d: number }>();
  for (const r of report.results) {
    for (const c of r.checks) {
      const slot = bag.get(c.kind) ?? { n: 0, d: 0 };
      slot.d += 1;
      if (c.pass) slot.n += 1;
      bag.set(c.kind, slot);
    }
  }
  return [...bag.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, { n, d }]) => ({
      kind,
      numerator: n,
      denominator: d,
      value: d === 0 ? 0 : n / d,
    }));
}

export function buildMetricsSnapshot(
  report: BenchReport,
  git?: MetricsSnapshot["git"],
  options?: { includeScenarios?: boolean },
): MetricsSnapshot {
  const metrics = scorePrimaryMetrics(report);
  const snap: MetricsSnapshot = {
    schemaVersion: 1,
    name: "project-intelligence-metrics",
    suite: "offline-v0",
    ranAt: report.ranAt,
    git,
    goals: {
      product:
        "授权夹内用可审计轨迹给出可点开证据与一个拍板问题；做不到就明确失败",
      engineering:
        "输出契约、检索意图、诚实拒答、噪声/安全边界在固定题集上可重复测量",
    },
    metrics,
    diagnostics: scoreDiagnostics(report),
    bench: {
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      byFamily: report.byFamily,
    },
    failedScenarioIds: report.results.filter((r) => !r.pass).map((r) => r.id),
  };
  if (options?.includeScenarios) {
    snap.scenarios = report.results.map((r) => ({
      id: r.id,
      family: r.family,
      difficulty: r.difficulty,
      title: r.title,
      pass: r.pass,
      checks: r.checks.map((c) => ({
        kind: c.kind,
        pass: c.pass,
        detail: c.detail,
      })),
    }));
  }
  return snap;
}

/** Run catalog + score (no fs). */
export function measureOfflineMetrics(
  git?: MetricsSnapshot["git"],
  options?: { includeScenarios?: boolean },
): MetricsSnapshot {
  const report = runBench(PROJECT_INTELLIGENCE_BENCH, {
    name: "project-intelligence-bench",
    version: "0.1.0",
  });
  return buildMetricsSnapshot(report, git, options);
}

/** Human-readable report for public GitHub docs. */
export function formatPublicExperimentMarkdown(
  snap: MetricsSnapshot,
  meta?: { slug?: string; notes?: string },
): string {
  const lines: string[] = [];
  lines.push(`# Experiment · ${meta?.slug ?? snap.suite}`);
  lines.push("");
  lines.push(`- **ranAt:** ${snap.ranAt}`);
  lines.push(
    `- **git:** \`${snap.git?.commit ?? "unknown"}\`${snap.git?.dirty ? " (dirty tree at measure)" : ""}`,
  );
  lines.push(`- **suite:** ${snap.suite}`);
  lines.push(
    `- **bench:** ${snap.bench.passed}/${snap.bench.total} passed`,
  );
  lines.push("");
  lines.push("## Goals");
  lines.push("");
  lines.push(`- **Product:** ${snap.goals.product}`);
  lines.push(`- **Engineering:** ${snap.goals.engineering}`);
  if (meta?.notes) {
    lines.push("");
    lines.push("## Notes");
    lines.push("");
    lines.push(meta.notes);
  }
  lines.push("");
  lines.push("## Primary metrics (M1–M5)");
  lines.push("");
  lines.push("| ID | Name | Value | Threshold | Pass | n/N |");
  lines.push("|---|---|---:|---:|---|---:|");
  for (const m of snap.metrics) {
    lines.push(
      `| ${m.id} | ${m.name} | ${(m.value * 100).toFixed(1)}% | ${(m.threshold * 100).toFixed(0)}% | ${m.pass ? "yes" : "NO"} | ${m.numerator}/${m.denominator} |`,
    );
  }
  lines.push("");
  lines.push("## By family");
  lines.push("");
  lines.push("| Family | Passed | Total | Rate |");
  lines.push("|---|---:|---:|---:|");
  for (const [family, slot] of Object.entries(snap.bench.byFamily).sort()) {
    const rate = slot.total === 0 ? 0 : slot.passed / slot.total;
    lines.push(
      `| ${family} | ${slot.passed} | ${slot.total} | ${(rate * 100).toFixed(1)}% |`,
    );
  }
  lines.push("");
  lines.push("## Diagnostics (check kinds)");
  lines.push("");
  lines.push("| Kind | Passed | Total | Rate |");
  lines.push("|---|---:|---:|---:|");
  for (const d of snap.diagnostics) {
    lines.push(
      `| \`${d.kind}\` | ${d.numerator} | ${d.denominator} | ${(d.value * 100).toFixed(1)}% |`,
    );
  }
  if (snap.scenarios?.length) {
    lines.push("");
    lines.push("## All scenarios");
    lines.push("");
    lines.push("| ID | Family | Diff | Pass | Title |");
    lines.push("|---|---|---|---|---|");
    for (const s of snap.scenarios) {
      lines.push(
        `| \`${s.id}\` | ${s.family} | ${s.difficulty} | ${s.pass ? "pass" : "FAIL"} | ${s.title.replace(/\|/g, "/")} |`,
      );
    }
    lines.push("");
    lines.push("## Scenario check detail");
    lines.push("");
    for (const s of snap.scenarios) {
      lines.push(`### \`${s.id}\` · ${s.title}`);
      lines.push("");
      lines.push(`- family: ${s.family} · difficulty: ${s.difficulty}`);
      lines.push(`- result: **${s.pass ? "pass" : "FAIL"}**`);
      for (const c of s.checks) {
        lines.push(
          `  - [${c.pass ? "x" : " "}] \`${c.kind}\` — ${c.detail.replace(/\n/g, " ")}`,
        );
      }
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("");
  lines.push(
    "Generated by Project Intelligence Metrics. See `docs/product/PROJECT_INTELLIGENCE_METRICS.md`.",
  );
  lines.push("");
  return lines.join("\n");
}

export type MetricDelta = {
  id: MetricId;
  baseline: number;
  current: number;
  delta: number;
  /** true if current < baseline - eps */
  regression: boolean;
  /** true if current meets threshold */
  gatePass: boolean;
};

export type CompareResult = {
  pass: boolean;
  regressions: MetricDelta[];
  improvements: MetricDelta[];
  unchanged: MetricDelta[];
  gateFailures: MetricId[];
  summary: string;
};

const EPS = 1e-9;

export function compareSnapshots(
  baseline: MetricsSnapshot,
  current: MetricsSnapshot,
): CompareResult {
  const baseMap = new Map(baseline.metrics.map((m) => [m.id, m]));
  const regressions: MetricDelta[] = [];
  const improvements: MetricDelta[] = [];
  const unchanged: MetricDelta[] = [];
  const gateFailures: MetricId[] = [];

  for (const cur of current.metrics) {
    const base = baseMap.get(cur.id);
    if (!base) continue;
    const delta = cur.value - base.value;
    const row: MetricDelta = {
      id: cur.id,
      baseline: base.value,
      current: cur.value,
      delta,
      regression: delta < -EPS,
      gatePass: cur.pass,
    };
    if (!cur.pass) gateFailures.push(cur.id);
    if (row.regression) regressions.push(row);
    else if (delta > EPS) improvements.push(row);
    else unchanged.push(row);
  }

  const pass = gateFailures.length === 0 && regressions.length === 0;
  const summary = pass
    ? `PASS · primary metrics hold (n=${current.metrics.length})`
    : `FAIL · gate=${gateFailures.join(",") || "none"} · regression=${regressions.map((r) => r.id).join(",") || "none"}`;

  return {
    pass,
    regressions,
    improvements,
    unchanged,
    gateFailures,
    summary,
  };
}

export function assertCheckKindsCovered(
  kinds: BenchCheckKind[],
  diagnostics: DiagnosticScore[],
): boolean {
  const have = new Set(diagnostics.map((d) => d.kind));
  return kinds.every((k) => have.has(k));
}
