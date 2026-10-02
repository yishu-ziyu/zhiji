#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function fingerprint(filePath, diagnostic, repositoryRoot = root) {
  return JSON.stringify([
    filePath.split(path.sep).join("/"), diagnostic.ruleId, diagnostic.severity,
    diagnostic.line, diagnostic.column,
    createHash("sha256").update(diagnostic.message.replaceAll(repositoryRoot, "<repo>")).digest("hex"),
  ]);
}

export function compareDiagnostics(results, baseline) {
  const remaining = new Map(baseline.map(({ key, count }) => [key, count]));
  const unexpected = [];
  let known = 0;
  for (const result of results) {
    const file = path.relative(root, result.filePath);
    for (const diagnostic of result.messages) {
      if (diagnostic.severity !== 2) continue;
      const key = fingerprint(file, diagnostic);
      const count = remaining.get(key) ?? 0;
      if (!diagnostic.fatal && count > 0) {
        remaining.set(key, count - 1);
        known++;
      } else {
        unexpected.push({ file, ...diagnostic });
      }
    }
  }
  return { known, unexpected, resolved: [...remaining.values()].reduce((a, b) => a + b, 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const require = createRequire(import.meta.url);
  const cli = path.join(path.dirname(require.resolve("eslint/package.json")), "bin/eslint.js");
  const run = spawnSync(process.execPath, [cli, ".", "--format", "json"], {
    cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error || run.signal || ![0, 1].includes(run.status)) {
    console.error(run.error ?? run.stderr ?? "ESLint failed to execute");
    process.exit(1);
  }
  // Invalid tool output must fail rather than silently count as an empty result.
  const results = JSON.parse(run.stdout);
  const baseline = JSON.parse(readFileSync(path.join(root, "config/eslint-baseline.json"), "utf8"));
  const outcome = compareDiagnostics(results, baseline.errors);
  const warnings = results.reduce((sum, result) => sum + result.warningCount, 0);
  console.log(`ESLint: ${outcome.known} known errors, ${outcome.unexpected.length} new errors, ${warnings} warnings; debt: ${baseline.issue}`);
  if (outcome.known) console.log(`::warning::${outcome.known} existing ESLint errors remain tracked in ${baseline.issue}`);
  if (outcome.resolved) console.log(`${outcome.resolved} baseline errors resolved; remove their baseline entries.`);
  for (const diagnostic of outcome.unexpected) console.error(diagnostic);
  process.exit(outcome.unexpected.length ? 1 : 0);
}
