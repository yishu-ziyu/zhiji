#!/usr/bin/env node
/**
 * Thin wrapper → vite-node TypeScript entry (Metric loop).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const entry = path.join(__dirname, "bench-metrics-run.ts");
const args = process.argv.slice(2);

const run = spawnSync(
  "npx",
  ["vite-node", "--config", "vitest.config.ts", entry, ...args],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(run.status ?? 1);
