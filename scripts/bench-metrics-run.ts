/**
 * Invoked by scripts/bench-metrics.mjs via vite-node.
 * argv: measure | compare
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  compareSnapshots,
  measureOfflineMetrics,
  type MetricsSnapshot,
} from "../tests/bench/project-intelligence/metrics";

const root = path.resolve(import.meta.dirname, "..");
const reportsDir = path.join(
  root,
  "tests/bench/project-intelligence/reports",
);
const baselinePath = path.join(
  root,
  "tests/bench/project-intelligence/baselines/offline-v0.json",
);
const latestPath = path.join(reportsDir, "latest.json");

function gitMeta() {
  const commit = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  const dirty = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });
  return {
    commit: commit.status === 0 ? commit.stdout.trim() : undefined,
    dirty: dirty.status === 0 ? dirty.stdout.trim().length > 0 : undefined,
  };
}

function printMetricTable(snap: MetricsSnapshot) {
  console.log(`\nSuite ${snap.suite} · ${snap.ranAt}`);
  console.log(
    `Bench ${snap.bench.passed}/${snap.bench.total} · git ${(snap.git?.commit || "?").slice(0, 8)}${snap.git?.dirty ? " dirty" : ""}`,
  );
  console.log("\nPrimary metrics (goal → measure):");
  for (const m of snap.metrics) {
    const flag = m.pass ? "PASS" : "FAIL";
    console.log(
      `  [${flag}] ${m.id.padEnd(28)} ${(m.value * 100).toFixed(1)}%  gate≥${(m.threshold * 100).toFixed(0)}%  ${m.numerator}/${m.denominator}`,
    );
  }
  if (snap.failedScenarioIds?.length) {
    console.log("\nFailed scenarios:", snap.failedScenarioIds.join(", "));
  }
}

function measure() {
  fs.mkdirSync(reportsDir, { recursive: true });
  const snap = measureOfflineMetrics(gitMeta());
  fs.writeFileSync(latestPath, `${JSON.stringify(snap, null, 2)}\n`);
  const short = (snap.git?.commit || "nogit").slice(0, 8);
  const stamped = path.join(
    reportsDir,
    `${short}-${snap.ranAt.replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(stamped, `${JSON.stringify(snap, null, 2)}\n`);
  printMetricTable(snap);
  console.log(`\nWrote ${path.relative(root, latestPath)}`);
  console.log(`Wrote ${path.relative(root, stamped)}`);
  const gateFail = snap.metrics.some((m) => !m.pass);
  process.exit(gateFail ? 1 : 0);
}

function compare(aPath?: string, bPath?: string) {
  const left = aPath || baselinePath;
  const right = bPath || latestPath;
  if (!fs.existsSync(left)) {
    console.error(`Missing baseline: ${left}`);
    process.exit(1);
  }
  if (!fs.existsSync(right)) {
    console.error(`Missing candidate: ${right}`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(left, "utf8")) as MetricsSnapshot;
  const candidate = JSON.parse(
    fs.readFileSync(right, "utf8"),
  ) as MetricsSnapshot;
  const result = compareSnapshots(baseline, candidate);
  console.log(
    `\nCompare:\n  baseline: ${path.relative(root, left)}\n  current:  ${path.relative(root, right)}`,
  );
  console.log(result.summary);
  for (const r of result.regressions) {
    console.log(
      `  REGRESS ${r.id}: ${(r.baseline * 100).toFixed(1)}% → ${(r.current * 100).toFixed(1)}% (Δ ${r.delta.toFixed(4)})`,
    );
  }
  for (const r of result.improvements) {
    console.log(
      `  IMPROVE ${r.id}: ${(r.baseline * 100).toFixed(1)}% → ${(r.current * 100).toFixed(1)}%`,
    );
  }
  for (const id of result.gateFailures) {
    console.log(`  GATE_FAIL ${id}`);
  }
  process.exit(result.pass ? 0 : 1);
}

function baseline() {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  if (!fs.existsSync(latestPath)) {
    console.error("No latest.json — run measure first");
    process.exit(1);
  }
  fs.copyFileSync(latestPath, baselinePath);
  console.log(`Baseline updated → ${path.relative(root, baselinePath)}`);
}

const [, , cmd, arg1, arg2] = process.argv;
if (cmd === "measure") measure();
else if (cmd === "compare") compare(arg1, arg2);
else if (cmd === "baseline" || cmd === "write-baseline") baseline();
else {
  console.log(
    "Usage: vite-node scripts/bench-metrics-run.ts measure|compare|baseline",
  );
  process.exit(1);
}
