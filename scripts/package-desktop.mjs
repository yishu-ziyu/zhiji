#!/usr/bin/env node
/**
 * Package .desktop-stage into macOS arm64 .app via @electron/packager 20.0.3
 * Uses local verified electron zip (electronZipDir) — no flaky re-fetch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { ensureElectronZipDir, ZIP_NAME } from "./ensure-electron-zip.mjs";
import { resolveDesktopPackageOutDir } from "./desktop-package-out.mjs";

const require = createRequire(import.meta.url);
const { packager } = require("@electron/packager");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const stageDir = path.join(root, ".desktop-stage");
/** Resolved via resolveDesktopPackageOutDir — refuses out/ when fallback exists. */
const outDir = resolveDesktopPackageOutDir({
  root,
  packageOutEnv: process.env.DESKTOP_PACKAGE_OUT,
});

const ELECTRON_VERSION = "43.1.1";

function assertNoEnvInTree(dir, label) {
  const hits = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" && full.includes("Electron")) continue;
        walk(full);
        continue;
      }
      if (ent.name.startsWith(".env") || ent.name === ".env.local") {
        hits.push(path.relative(dir, full));
      }
    }
  };
  walk(dir);
  if (hits.length) {
    throw new Error(`${label} contains env files: ${hits.join(", ")}`);
  }
}

function assertMainSandbox(appRoot) {
  const mainPath = path.join(appRoot, "desktop", "main.cjs");
  const runtimePath = path.join(appRoot, "desktop", "runtime.cjs");
  if (!fs.existsSync(mainPath) || !fs.existsSync(runtimePath)) {
    throw new Error("packaged app missing desktop main/runtime");
  }
  const runtimeSrc = fs.readFileSync(runtimePath, "utf8");
  if (!runtimeSrc.includes("nodeIntegration: false")) {
    throw new Error("packaged runtime missing nodeIntegration: false");
  }
  if (!runtimeSrc.includes("contextIsolation: true")) {
    throw new Error("packaged runtime missing contextIsolation: true");
  }
  if (!runtimeSrc.includes("sandbox: true")) {
    throw new Error("packaged runtime missing sandbox: true");
  }
  const mainSrc = fs.readFileSync(mainPath, "utf8");
  if (!mainSrc.includes("app.isPackaged")) {
    throw new Error("main.cjs must gate FC_OPC_DESKTOP_DEV_URL on !isPackaged");
  }
  if (mainSrc.includes("...process.env")) {
    throw new Error("main.cjs must not spread process.env into utilityProcess");
  }
  if (!mainSrc.includes("buildUtilityProcessEnv")) {
    throw new Error("main.cjs must use buildUtilityProcessEnv");
  }
  if (!mainSrc.includes('action: "deny"') && !mainSrc.includes("action: 'deny'")) {
    throw new Error("main.cjs must deny window open");
  }
}

/**
 * Packaged app resources must match current staging critical files.
 * @param {string} resourcesApp
 */
function assertMatchesStaging(resourcesApp) {
  const pairs = [
    ["desktop/main.cjs", "desktop/main.cjs"],
    ["desktop/runtime.cjs", "desktop/runtime.cjs"],
    ["runtime/server.js", "runtime/server.js"],
  ];
  for (const [stageRel, appRel] of pairs) {
    const a = path.join(stageDir, stageRel);
    const b = path.join(resourcesApp, appRel);
    if (!fs.existsSync(a) || !fs.existsSync(b)) {
      throw new Error(`missing pair for staging compare: ${stageRel}`);
    }
    const ha = fs.readFileSync(a);
    const hb = fs.readFileSync(b);
    if (!ha.equals(hb)) {
      throw new Error(`packaged ${appRel} differs from staging ${stageRel}`);
    }
  }
  // BUILD_ID when present
  const stageBuild = path.join(stageDir, "runtime", ".next", "BUILD_ID");
  const appBuild = path.join(resourcesApp, "runtime", ".next", "BUILD_ID");
  if (fs.existsSync(stageBuild)) {
    if (!fs.existsSync(appBuild)) {
      throw new Error("packaged app missing runtime/.next/BUILD_ID");
    }
    if (fs.readFileSync(stageBuild, "utf8") !== fs.readFileSync(appBuild, "utf8")) {
      throw new Error("packaged BUILD_ID differs from staging");
    }
  }
}

async function main() {
  if (!fs.existsSync(path.join(stageDir, "package.json"))) {
    throw new Error("missing .desktop-stage — run desktop:prepare first");
  }
  assertNoEnvInTree(stageDir, "staging");

  // outDir already validated by resolveDesktopPackageOutDir (throws if out/ would overwrite fallback).

  const electronZipDir = await Promise.resolve(ensureElectronZipDir());
  const zipPath = path.join(electronZipDir, ZIP_NAME);
  if (!fs.existsSync(zipPath)) {
    throw new Error(`electron zip missing after ensure: ${zipPath}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const paths = await packager({
    dir: stageDir,
    name: "知几",
    platform: "darwin",
    arch: "arm64",
    electronVersion: ELECTRON_VERSION,
    out: outDir,
    icon: path.join(root, "build", "zhiji.icns"),
    overwrite: true,
    prune: false,
    asar: false,
    // Local verified zip only — packager will not re-download when present
    electronZipDir,
  });

  console.log("[desktop:package] packager out:", paths);
  for (const p of paths) {
    const appBundle = fs.readdirSync(p).find((n) => n.endsWith(".app"));
    if (!appBundle) {
      throw new Error(`no .app under ${p}`);
    }
    const appPath = path.join(p, appBundle);
    const resourcesApp = path.join(appPath, "Contents", "Resources", "app");
    if (!fs.existsSync(resourcesApp)) {
      throw new Error(`missing Resources/app under ${appPath}`);
    }
    assertNoEnvInTree(resourcesApp, ".app Resources/app");
    assertMainSandbox(resourcesApp);
    assertMatchesStaging(resourcesApp);
    console.log("[desktop:package] app:", appPath);
  }
}

main().catch((e) => {
  console.error("[desktop:package] FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
