#!/usr/bin/env node
/**
 * Install exactly one 知几.app on this Mac: /Applications/知几.app
 *
 * - Overwrites that path (no pre-demo / previous backups left behind)
 * - Removes sibling 知几.app.* and .知几.app.* clutter under /Applications
 * - Source: DESKTOP_APP_SRC, else DESKTOP_PACKAGE_OUT, else newest out/release-v* / 知几.app
 *
 * GitHub Release is for other people. This is for the owner machine only.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const INSTALL_DIR = "/Applications";
const INSTALL_NAME = "知几.app";
const INSTALL_PATH = path.join(INSTALL_DIR, INSTALL_NAME);

function isAppBundle(p) {
  return (
    fs.existsSync(p) &&
    fs.existsSync(path.join(p, "Contents", "Info.plist")) &&
    fs.existsSync(path.join(p, "Contents", "MacOS"))
  );
}

function readVersion(appPath) {
  try {
    const out = execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", "Print :CFBundleShortVersionString", path.join(appPath, "Contents", "Info.plist")],
      { encoding: "utf8" },
    ).trim();
    return out || "?";
  } catch {
    return "?";
  }
}

/**
 * @returns {string} absolute path to source .app
 */
function resolveSourceApp() {
  const fromEnv = process.env.DESKTOP_APP_SRC?.trim();
  if (fromEnv) {
    const abs = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(root, fromEnv);
    if (!isAppBundle(abs)) {
      throw new Error(`DESKTOP_APP_SRC is not a valid .app: ${abs}`);
    }
    return abs;
  }

  const packageOut = process.env.DESKTOP_PACKAGE_OUT?.trim();
  if (packageOut) {
    const base = path.isAbsolute(packageOut)
      ? packageOut
      : path.resolve(root, packageOut);
    const candidate = path.join(base, "知几-darwin-arm64", "知几.app");
    if (isAppBundle(candidate)) return candidate;
  }

  const releaseRoot = path.join(root, "out");
  if (!fs.existsSync(releaseRoot)) {
    throw new Error("no out/ — run desktop:package first");
  }

  /** @type {{ app: string, key: string }[]} */
  const found = [];
  for (const ent of fs.readdirSync(releaseRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const app = path.join(releaseRoot, ent.name, "知几-darwin-arm64", "知几.app");
    if (isAppBundle(app)) {
      found.push({ app, key: ent.name });
    }
  }
  // also bare out/知几-darwin-arm64/知几.app
  const bare = path.join(releaseRoot, "知几-darwin-arm64", "知几.app");
  if (isAppBundle(bare)) found.push({ app: bare, key: "out" });

  if (!found.length) {
    throw new Error("no packaged 知几.app under out/ — run desktop:package first");
  }

  // Prefer highest semver-looking release-vX.Y.Z, else lexicographic key
  found.sort((a, b) => {
    const va = a.key.match(/release-v(\d+)\.(\d+)\.(\d+)/);
    const vb = b.key.match(/release-v(\d+)\.(\d+)\.(\d+)/);
    if (va && vb) {
      for (let i = 1; i <= 3; i++) {
        const d = Number(vb[i]) - Number(va[i]);
        if (d) return d;
      }
      return 0;
    }
    if (va) return -1;
    if (vb) return 1;
    return b.key.localeCompare(a.key);
  });

  return found[0].app;
}

/**
 * Remove every 知几-related bundle under /Applications except we will reinstall INSTALL_PATH.
 * User asked for exactly one copy on this machine.
 */
function removeZhijiClutter() {
  const names = fs.readdirSync(INSTALL_DIR, { withFileTypes: true });
  const removed = [];
  for (const ent of names) {
    const name = ent.name;
    const isZhiji =
      name === INSTALL_NAME ||
      name.startsWith("知几.app.") ||
      name.startsWith(".知几.app.") ||
      name === "Zhiji.app" ||
      name.startsWith("Zhiji.app.");
    if (!isZhiji) continue;
    const full = path.join(INSTALL_DIR, name);
    // Only remove app-like dirs (avoid nuking random files)
    if (!ent.isDirectory()) continue;
    fs.rmSync(full, { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}

function installWithDitto(src, dest) {
  // Atomic-ish: stage then replace
  const staging = path.join(
    INSTALL_DIR,
    `.知几.app.installing-${process.pid}`,
  );
  fs.rmSync(staging, { recursive: true, force: true });
  execFileSync("ditto", [src, staging], { stdio: "inherit" });
  // Clear quarantine so Gatekeeper is less noisy for local owner builds
  try {
    execFileSync("xattr", ["-cr", staging], { stdio: "ignore" });
  } catch {
    // non-fatal
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(staging, dest);
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("install-desktop-local only supports macOS");
  }
  if (!fs.existsSync(INSTALL_DIR)) {
    throw new Error(`/Applications missing`);
  }

  const src = resolveSourceApp();
  const srcVersion = readVersion(src);
  console.log(`[desktop:install-local] source: ${src} (v${srcVersion})`);

  const removed = removeZhijiClutter();
  if (removed.length) {
    console.log(
      `[desktop:install-local] removed ${removed.length} old copy(ies):`,
      removed.join(", "),
    );
  }

  installWithDitto(src, INSTALL_PATH);
  const installedVersion = readVersion(INSTALL_PATH);
  if (!isAppBundle(INSTALL_PATH)) {
    throw new Error("install finished but /Applications/知几.app is invalid");
  }

  // Ensure Desktop shortcut is a symlink to the single install (not a second copy)
  const desktopLink = path.join(
    process.env.HOME || "",
    "Desktop",
    INSTALL_NAME,
  );
  if (process.env.HOME && fs.existsSync(path.dirname(desktopLink))) {
    try {
      const st = fs.lstatSync(desktopLink);
      if (st.isSymbolicLink() || st.isDirectory() || st.isFile()) {
        fs.rmSync(desktopLink, { recursive: true, force: true });
      }
      fs.symlinkSync(INSTALL_PATH, desktopLink);
      console.log(`[desktop:install-local] Desktop → ${INSTALL_PATH}`);
    } catch (e) {
      console.warn(
        "[desktop:install-local] Desktop link skipped:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(
    `[desktop:install-local] OK → ${INSTALL_PATH} (v${installedVersion})`,
  );
  console.log(
    "[desktop:install-local] This Mac keeps one app. Others download from GitHub Releases.",
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main();
  } catch (e) {
    console.error(
      "[desktop:install-local] FAIL:",
      e instanceof Error ? e.message : e,
    );
    process.exit(1);
  }
}

export { main as installDesktopLocal, resolveSourceApp, INSTALL_PATH };
