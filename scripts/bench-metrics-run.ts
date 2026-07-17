/**
 * Invoked by scripts/bench-metrics.mjs via vite-node.
 * argv: measure | compare | baseline | publish
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  compareSnapshots,
  formatPublicExperimentMarkdown,
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
const publicMetricsDir = path.join(root, "docs/metrics");
const publicRunsDir = path.join(publicMetricsDir, "runs");
const experimentLogPath = path.join(publicMetricsDir, "EXPERIMENT_LOG.md");

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

function writeLocalReports(snap: MetricsSnapshot) {
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(latestPath, `${JSON.stringify(snap, null, 2)}\n`);
  const short = (snap.git?.commit || "nogit").slice(0, 8);
  const stamped = path.join(
    reportsDir,
    `${short}-${snap.ranAt.replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(stamped, `${JSON.stringify(snap, null, 2)}\n`);
  return stamped;
}

function measure(includeScenarios = false) {
  const snap = measureOfflineMetrics(gitMeta(), { includeScenarios });
  const stamped = writeLocalReports(snap);
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

function slugFromSnap(snap: MetricsSnapshot): string {
  const day = (snap.ranAt || new Date().toISOString()).slice(0, 10);
  const short = (snap.git?.commit || "nogit").slice(0, 8);
  return `${day}-${snap.suite}-${short}`;
}

function rebuildExperimentLog() {
  const runs = fs.existsSync(publicRunsDir)
    ? fs
        .readdirSync(publicRunsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse()
    : [];

  const lines: string[] = [
    "# Project Intelligence · Experiment Log",
    "",
    "Public, versioned experiment records for 知几 (Zhiji).",
    "",
    "Loop: **goal → metrics → measure → compare → adjust → re-measure**.",
    "",
    "Spec: [`docs/product/PROJECT_INTELLIGENCE_METRICS.md`](../product/PROJECT_INTELLIGENCE_METRICS.md)",
    "",
    "## Runs (newest first)",
    "",
    "| Slug | Date | Commit | Overall | Structure | Search | Honesty | Noise | Report |",
    "|---|---|---|---:|---:|---:|---:|---:|---|",
  ];

  for (const name of runs) {
    const snapPath = path.join(publicRunsDir, name, "snapshot.json");
    if (!fs.existsSync(snapPath)) continue;
    const snap = JSON.parse(
      fs.readFileSync(snapPath, "utf8"),
    ) as MetricsSnapshot;
    const m = Object.fromEntries(snap.metrics.map((x) => [x.id, x]));
    const pct = (id: string) =>
      m[id] ? `${(m[id].value * 100).toFixed(0)}%` : "—";
    lines.push(
      `| \`${name}\` | ${snap.ranAt.slice(0, 10)} | \`${(snap.git?.commit || "").slice(0, 8)}\` | ${pct("overall_pass_rate")} | ${pct("structure_pass_rate")} | ${pct("search_intent_pass_rate")} | ${pct("honesty_pass_rate")} | ${pct("noise_pass_rate")} | [REPORT](./runs/${name}/REPORT.md) |`,
    );
  }

  lines.push("");
  lines.push("## How to add a run");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run metrics:publish");
  lines.push("# commit docs/metrics/ + baselines if Primary improved");
  lines.push("```");
  lines.push("");

  fs.writeFileSync(experimentLogPath, `${lines.join("\n")}\n`);
}

function writePublicIndex(latestSlug: string, snap: MetricsSnapshot) {
  const md = `# 知几 · Public Metrics

Open experiment data for the **Project Intelligence** offline bench.

Repository: [yishu-ziyu/zhiji](https://github.com/yishu-ziyu/zhiji)

## Why metrics

Without metrics there is no stable feedback loop. A model or prompt change is only an improvement if Primary metrics hold or rise — not if answers merely look prettier.

\`\`\`text
goal → define metrics → measure → compare versions → adjust → re-measure
\`\`\`

## Latest published run

- **Slug:** \`${latestSlug}\`
- **When:** ${snap.ranAt}
- **Git:** \`${snap.git?.commit ?? "unknown"}\`
- **Bench:** ${snap.bench.passed}/${snap.bench.total}
- **Report:** [runs/${latestSlug}/REPORT.md](./runs/${latestSlug}/REPORT.md)
- **Raw JSON:** [runs/${latestSlug}/snapshot.json](./runs/${latestSlug}/snapshot.json)
- **Log:** [EXPERIMENT_LOG.md](./EXPERIMENT_LOG.md)

### Primary (latest)

| Metric | Value | Gate |
|---|---:|---:|
${snap.metrics
  .map(
    (m) =>
      `| ${m.id} | ${(m.value * 100).toFixed(1)}% | ≥${(m.threshold * 100).toFixed(0)}% |`,
  )
  .join("\n")}

## Reproduce

\`\`\`bash
git clone https://github.com/yishu-ziyu/zhiji.git
cd zhiji
npm ci
npm run test:bench
npm run metrics:measure
npm run metrics:compare
# publish a new public run (writes docs/metrics/runs/*)
npm run metrics:publish
\`\`\`

## Related

- Metric spec: [PROJECT_INTELLIGENCE_METRICS.md](../product/PROJECT_INTELLIGENCE_METRICS.md)
- Engineering playbook: [优化方案-工程开发范式.md](../product/优化方案-工程开发范式.md)
- Bench source: \`tests/bench/project-intelligence/\`
- Gate baseline (CI): \`tests/bench/project-intelligence/baselines/offline-v0.json\`

## License of data

Experiment JSON/Markdown in this folder is part of the repository and follows the same license as the project source.
`;
  fs.writeFileSync(path.join(publicMetricsDir, "README.md"), md);
  fs.writeFileSync(
    path.join(publicMetricsDir, "LATEST.md"),
    `# Latest metrics run\n\n→ [runs/${latestSlug}/REPORT.md](./runs/${latestSlug}/REPORT.md)\n\nCommit: \`${snap.git?.commit ?? "?"}\` · ${snap.ranAt}\n`,
  );
}

/**
 * Full public archive: detailed JSON + REPORT.md under docs/metrics/runs/
 * Intended to be committed and visible on GitHub.
 */
function publish(notes?: string) {
  const snap = measureOfflineMetrics(gitMeta(), { includeScenarios: true });
  writeLocalReports(snap);
  printMetricTable(snap);

  const slug = slugFromSnap(snap);
  const runDir = path.join(publicRunsDir, slug);
  fs.mkdirSync(runDir, { recursive: true });

  fs.writeFileSync(
    path.join(runDir, "snapshot.json"),
    `${JSON.stringify(snap, null, 2)}\n`,
  );

  // Slim index without huge nested checks for table consumers
  const index = {
    slug,
    ranAt: snap.ranAt,
    git: snap.git,
    suite: snap.suite,
    metrics: snap.metrics,
    byFamily: snap.bench.byFamily,
    scenarioCount: snap.scenarios?.length ?? 0,
    failedScenarioIds: snap.failedScenarioIds,
  };
  fs.writeFileSync(
    path.join(runDir, "index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
  );

  const reportMd = formatPublicExperimentMarkdown(snap, {
    slug,
    notes:
      notes ||
      "Public offline Project Intelligence Bench run. Deterministic pure-function evaluators (no live LLM).",
  });
  fs.writeFileSync(path.join(runDir, "REPORT.md"), reportMd);

  writePublicIndex(slug, snap);
  rebuildExperimentLog();

  // Keep gate baseline in sync when all primary pass (publish of clean 100%)
  if (snap.metrics.every((m) => m.pass)) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    // baseline stays slim (no scenarios) for smaller CI compare payloads
    const slim = { ...snap };
    delete slim.scenarios;
    fs.writeFileSync(baselinePath, `${JSON.stringify(slim, null, 2)}\n`);
  }

  console.log(`\nPublic experiment archived:`);
  console.log(`  ${path.relative(root, runDir)}/REPORT.md`);
  console.log(`  ${path.relative(root, runDir)}/snapshot.json`);
  console.log(`  ${path.relative(root, experimentLogPath)}`);
  console.log(`  ${path.relative(root, path.join(publicMetricsDir, "README.md"))}`);

  const gateFail = snap.metrics.some((m) => !m.pass);
  process.exit(gateFail ? 1 : 0);
}

const [, , cmd, arg1, arg2] = process.argv;
if (cmd === "measure") measure(false);
else if (cmd === "compare") compare(arg1, arg2);
else if (cmd === "baseline" || cmd === "write-baseline") baseline();
else if (cmd === "publish") publish(arg1);
else {
  console.log(
    "Usage: vite-node scripts/bench-metrics-run.ts measure|compare|baseline|publish",
  );
  process.exit(1);
}
