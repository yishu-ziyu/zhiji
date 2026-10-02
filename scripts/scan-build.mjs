#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

// Scan the actual distributable web runtime, including traced dependencies.
const roots = [".next/standalone", ".next/static", "public"];
const visited = new Set();
let files = 0;
let envFiles = 0;
let keyFiles = 0;
const patterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
  /\b(?:LLM_API_KEY|OPENAI_API_KEY)\s*=\s*["'][^"'\s]{20,}["']/,
];
function walk(target) {
  const real = fs.realpathSync(target);
  if (visited.has(real)) return;
  visited.add(real);
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target)) walk(path.join(target, name));
  } else if (stat.isFile()) {
    files++;
    if (path.basename(target).startsWith(".env")) envFiles++;
    const contents = fs.readFileSync(target).toString("utf8");
    if (patterns.some((pattern) => pattern.test(contents))) keyFiles++;
  }
}
for (const root of roots) walk(root);
console.log(`Build scan: paths=${roots.join(",")} files=${files} env_count=${envFiles} leak_count=${keyFiles}`);
if (envFiles || keyFiles) process.exit(1);
