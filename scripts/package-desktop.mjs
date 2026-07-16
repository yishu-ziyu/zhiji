#!/usr/bin/env node
/**
 * Package .desktop-stage into macOS arm64 .app via @electron/packager 20.0.3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { packager } = require("@electron/packager");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const stageDir = path.join(root, ".desktop-stage");
const outDir = path.join(root, "out");

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
  // Production must not honor dev URL when packaged — check guard exists
  if (!mainSrc.includes("app.isPackaged")) {
    throw new Error("main.cjs must gate FC_OPC_DESKTOP_DEV_URL on !isPackaged");
  }
}

async function main() {
  if (!fs.existsSync(path.join(stageDir, "package.json"))) {
    throw new Error("missing .desktop-stage — run desktop:prepare first");
  }
  assertNoEnvInTree(stageDir, "staging");

  fs.mkdirSync(outDir, { recursive: true });

  const paths = await packager({
    dir: stageDir,
    name: "FC-OPC iBot",
    platform: "darwin",
    arch: "arm64",
    electronVersion: ELECTRON_VERSION,
    out: outDir,
    overwrite: true,
    prune: false,
    asar: false,
    // Reuse electron zip cache from electron install (avoid re-fetch flake)
    download: {
      cacheRoot:
        process.env.ELECTRON_CACHE ||
        path.join(
          process.env.HOME || "",
          "Library",
          "Caches",
          "electron",
        ),
    },
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
    console.log("[desktop:package] app:", appPath);
  }
}

main().catch((e) => {
  console.error("[desktop:package] FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
