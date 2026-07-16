#!/usr/bin/env node
/**
 * Build minimal Next standalone staging for Electron packaging.
 * Usage: node scripts/prepare-desktop-bundle.mjs
 * Expects: npm run build already produced .next/standalone
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const stageDir = path.join(root, ".desktop-stage");
const runtimeDir = path.join(stageDir, "runtime");
const desktopStage = path.join(stageDir, "desktop");

const SENSITIVE_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
]);

/**
 * Walk dir; return relative paths that look sensitive.
 * @param {string} dir
 * @param {string} [base]
 * @returns {string[]}
 */
export function findSensitivePaths(dir, base = dir) {
  /** @type {string[]} */
  const hits = [];
  if (!fs.existsSync(dir)) return hits;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(base, full);
    if (ent.isDirectory()) {
      if (
        ent.name === "data" &&
        fs.existsSync(path.join(full, "knowledge"))
      ) {
        hits.push(path.join(rel, "knowledge"));
      }
      if (ent.name === "evidence" && rel.includes(".ship")) {
        hits.push(rel);
      }
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      hits.push(...findSensitivePaths(full, base));
      continue;
    }
    if (SENSITIVE_BASENAMES.has(ent.name) || ent.name.startsWith(".env")) {
      hits.push(rel);
    }
    // content scan small text files for key material patterns in package root only
    if (ent.name === ".env.local" || ent.name.endsWith(".env")) {
      hits.push(rel);
    }
  }
  return hits;
}

/**
 * Assert staging has no secrets / user data / evidence.
 * @param {string} dir
 */
export function assertStagingClean(dir) {
  const hits = findSensitivePaths(dir);
  // also scan file contents for LLM_API_KEY= in any file under stage (text only)
  const contentHits = scanForSecretMarkers(dir);
  const all = [...new Set([...hits, ...contentHits])];
  if (all.length > 0) {
    throw new Error(
      `staging contains sensitive paths/markers:\n${all.slice(0, 20).join("\n")}`,
    );
  }
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
export function scanForSecretMarkers(dir) {
  /** @type {string[]} */
  const hits = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".next") {
          // still walk .next but skip huge binary; only check package.json-like
          if (ent.name === "node_modules") continue;
        }
        walk(full);
        continue;
      }
      if (ent.name.startsWith(".env")) {
        hits.push(path.relative(dir, full));
        continue;
      }
      if (!/\.(js|cjs|mjs|json|md|txt|html|map)?$/i.test(ent.name) && !ent.name.endsWith(".env.local")) {
        continue;
      }
      if (ent.size > 2_000_000) continue;
      let text = "";
      try {
        text = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      if (/LLM_API_KEY\s*=\s*\S+/.test(text) && !full.includes("test")) {
        // allow test source mentioning the pattern as string in assertions
        if (!full.includes("desktop-") && !full.includes("prepare-desktop")) {
          hits.push(path.relative(dir, full) + " (LLM_API_KEY=)");
        }
      }
    }
  };
  walk(dir);
  return hits;
}

/**
 * @param {string} src
 * @param {string} dest
 */
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`missing source: ${src}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

/**
 * @param {string} runtimeRoot
 */
export function assertParcelWatcherPresent(runtimeRoot) {
  const nm = path.join(runtimeRoot, "node_modules", "@parcel");
  if (!fs.existsSync(nm)) {
    throw new Error(
      "@parcel/* missing from standalone runtime (tracing failed)",
    );
  }
  const watcher = path.join(nm, "watcher");
  if (!fs.existsSync(watcher)) {
    throw new Error("@parcel/watcher missing from standalone runtime");
  }
  // Platform optional package — at least one darwin/linux/win binary dir or nested
  const entries = fs.readdirSync(nm);
  const hasPlatform = entries.some(
    (n) =>
      n.startsWith("watcher-darwin") ||
      n.startsWith("watcher-linux") ||
      n.startsWith("watcher-win32"),
  );
  // Also check inside watcher/node_modules
  let nestedPlatform = false;
  const nested = path.join(watcher, "node_modules", "@parcel");
  if (fs.existsSync(nested)) {
    nestedPlatform = fs.readdirSync(nested).some((n) => n.startsWith("watcher-"));
  }
  if (!hasPlatform && !nestedPlatform) {
    // soft check: package.json optionalDependencies may still load from host at pack time
    // Fail hard: competition requires native watcher in bundle
    const pkgPath = path.join(watcher, "package.json");
    if (!fs.existsSync(pkgPath)) {
      throw new Error("@parcel/watcher package.json missing");
    }
    // On mac arm64, require darwin-arm64 somewhere under runtime
    const found = findDirName(runtimeRoot, "watcher-darwin-arm64");
    if (!found) {
      throw new Error(
        "@parcel/watcher-darwin-arm64 not found under standalone runtime",
      );
    }
  }
}

/**
 * @param {string} dir
 * @param {string} name
 */
function findDirName(dir, name) {
  if (!fs.existsSync(dir)) return false;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === name && ent.isDirectory()) return true;
    if (ent.isDirectory() && ent.name !== ".git") {
      if (findDirName(path.join(dir, ent.name), name)) return true;
    }
  }
  return false;
}

/**
 * @param {string} stage
 */
export function assertStagingStructure(stage) {
  const required = [
    path.join(stage, "runtime", "server.js"),
    path.join(stage, "runtime", ".next", "static"),
    path.join(stage, "runtime", "public"),
    path.join(stage, "desktop", "main.cjs"),
    path.join(stage, "desktop", "preload.cjs"),
    path.join(stage, "desktop", "runtime.cjs"),
    path.join(stage, "package.json"),
  ];
  for (const p of required) {
    if (!fs.existsSync(p)) {
      throw new Error(`staging missing: ${path.relative(stage, p)}`);
    }
  }
  const staticDir = path.join(stage, "runtime", ".next", "static");
  if (fs.readdirSync(staticDir).length === 0) {
    throw new Error("runtime/.next/static is empty");
  }
  const publicDir = path.join(stage, "runtime", "public");
  if (fs.readdirSync(publicDir).length === 0) {
    throw new Error("runtime/public is empty");
  }
  const pkg = JSON.parse(
    fs.readFileSync(path.join(stage, "package.json"), "utf8"),
  );
  if (pkg.main !== "desktop/main.cjs") {
    throw new Error("staging package.json main must be desktop/main.cjs");
  }
  if (pkg.name !== "fc-opc-ibot-desktop") {
    throw new Error("staging package name mismatch");
  }
}

/**
 * Next NFT sometimes traces the whole monorepo root into standalone.
 * Strip secrets, user data, evidence, tests, and desktop sources from runtime.
 * @param {string} runtimeRoot
 */
/**
 * Remove broken symlinks (Next NFT sometimes leaves dangling links that break packager).
 * @param {string} dir
 */
export function removeBrokenSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    try {
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) {
        try {
          fs.statSync(full); // throws if target missing
        } catch {
          fs.rmSync(full, { force: true });
        }
        continue;
      }
      if (st.isDirectory()) {
        removeBrokenSymlinks(full);
      }
    } catch {
      // ignore race
    }
  }
}

/**
 * Next NFT may emit absolute links from `.next/node_modules` back into the
 * build directory. Materialize only links whose targets are inside the
 * standalone node_modules trees so the packaged app stays self-contained.
 * @param {string} runtimeRoot
 * @param {string} sourceStandaloneRoot
 */
export function materializeNextNodeModuleSymlinks(
  runtimeRoot,
  sourceStandaloneRoot,
) {
  const nextModules = path.join(runtimeRoot, ".next", "node_modules");
  if (!fs.existsSync(nextModules)) return;

  const allowedRoots = [
    path.join(runtimeRoot, "node_modules"),
    path.join(sourceStandaloneRoot, "node_modules"),
    path.join(sourceStandaloneRoot, ".next", "node_modules"),
  ]
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => fs.realpathSync(candidate));

  const isWithinAllowedRoot = (candidate) =>
    allowedRoots.some((root) => {
      const relative = path.relative(root, candidate);
      return (
        relative === "" ||
        (!relative.startsWith(`..${path.sep}`) &&
          relative !== ".." &&
          !path.isAbsolute(relative))
      );
    });

  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        const target = fs.realpathSync(full);
        if (!isWithinAllowedRoot(target)) {
          throw new Error(
            `standalone node_modules link escapes allowed roots: ${path.relative(runtimeRoot, full)}`,
          );
        }
        const targetStat = fs.statSync(target);
        fs.rmSync(full, { recursive: true, force: true });
        fs.cpSync(target, full, {
          recursive: targetStat.isDirectory(),
          force: true,
          dereference: true,
        });
        continue;
      }
      if (stat.isDirectory()) walk(full);
    }
  };

  walk(nextModules);
}

export function pruneStandaloneRuntime(runtimeRoot) {
  const dropNames = [
    "data",
    ".ship",
    "tmp",
    "tests",
    "test-results",
    "playwright-report",
    "coverage",
    ".git",
    ".desktop-stage",
    "out",
    "desktop", // desktop lives at stage root, not inside runtime
    "docs",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
  ];
  for (const name of dropNames) {
    const p = path.join(runtimeRoot, name);
    fs.rmSync(p, { recursive: true, force: true });
  }
  // Any nested .env*
  const walkDropEnv = (d) => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules") continue;
        walkDropEnv(full);
      } else if (ent.name.startsWith(".env")) {
        fs.rmSync(full, { force: true });
      }
    }
  };
  walkDropEnv(runtimeRoot);
  removeBrokenSymlinks(runtimeRoot);
}

export function prepareDesktopBundle() {
  const standalone = path.join(root, ".next", "standalone");
  const staticSrc = path.join(root, ".next", "static");
  const publicSrc = path.join(root, "public");
  const desktopSrc = path.join(root, "desktop");

  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    throw new Error(
      "missing .next/standalone/server.js — run npm run build first (output: standalone)",
    );
  }
  if (!fs.existsSync(staticSrc)) {
    throw new Error("missing .next/static");
  }
  if (!fs.existsSync(publicSrc)) {
    throw new Error("missing public/");
  }
  if (!fs.existsSync(desktopSrc)) {
    throw new Error("missing desktop/");
  }

  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  // Next standalone root may be repo root contents under .next/standalone
  copyRecursive(standalone, runtimeDir);
  materializeNextNodeModuleSymlinks(runtimeDir, standalone);
  pruneStandaloneRuntime(runtimeDir);

  // Explicit static + public (not always in standalone)
  const staticDest = path.join(runtimeDir, ".next", "static");
  fs.rmSync(staticDest, { recursive: true, force: true });
  copyRecursive(staticSrc, staticDest);

  // standalone may already nest .next — ensure server can find static
  const nestedNext = path.join(runtimeDir, ".next");
  fs.mkdirSync(nestedNext, { recursive: true });

  const publicDest = path.join(runtimeDir, "public");
  fs.rmSync(publicDest, { recursive: true, force: true });
  copyRecursive(publicSrc, publicDest);

  fs.rmSync(desktopStage, { recursive: true, force: true });
  copyRecursive(desktopSrc, desktopStage);

  const stagePkg = {
    name: "fc-opc-ibot-desktop",
    productName: "FC-OPC iBot",
    version: "0.1.0",
    private: true,
    main: "desktop/main.cjs",
  };
  fs.writeFileSync(
    path.join(stageDir, "package.json"),
    JSON.stringify(stagePkg, null, 2) + "\n",
    "utf8",
  );

  assertParcelWatcherPresent(runtimeDir);
  assertStagingStructure(stageDir);
  assertStagingClean(stageDir);

  console.log("[desktop:prepare] staging ready:", stageDir);
  return stageDir;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    prepareDesktopBundle();
  } catch (e) {
    console.error("[desktop:prepare] FAIL:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
