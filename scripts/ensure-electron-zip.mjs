#!/usr/bin/env node
/**
 * Ensure a verified electron-v{version}-darwin-arm64.zip exists under .electron-zip/
 * for offline/stable @electron/packager runs (electronZipDir).
 *
 * Does NOT disable checksums. Uses node_modules/electron/checksums.json.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export const ELECTRON_VERSION = "43.1.1";
export const ELECTRON_PLATFORM = "darwin";
export const ELECTRON_ARCH = "arm64";
export const ZIP_NAME = `electron-v${ELECTRON_VERSION}-${ELECTRON_PLATFORM}-${ELECTRON_ARCH}.zip`;

/**
 * @param {string} filePath
 * @returns {string} hex sha256
 */
export function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

/**
 * @returns {{ expectedSha256: string, zipName: string }}
 */
export function readExpectedChecksum() {
  const checksumsPath = path.join(
    root,
    "node_modules",
    "electron",
    "checksums.json",
  );
  if (!fs.existsSync(checksumsPath)) {
    throw new Error(
      "missing node_modules/electron/checksums.json — install electron@43.1.1 first",
    );
  }
  const checksums = JSON.parse(fs.readFileSync(checksumsPath, "utf8"));
  const expected = checksums[ZIP_NAME];
  if (!expected || typeof expected !== "string") {
    throw new Error(`checksums.json missing entry for ${ZIP_NAME}`);
  }
  return { expectedSha256: expected, zipName: ZIP_NAME };
}

/**
 * Candidate directories that may already hold the zip (local cache / prior install).
 * @returns {string[]}
 */
export function candidateZipDirs() {
  const dirs = [];
  const cacheRoot =
    process.env.ELECTRON_CACHE ||
    path.join(process.env.HOME || "", "Library", "Caches", "electron");
  if (cacheRoot && fs.existsSync(cacheRoot)) {
    dirs.push(cacheRoot);
    try {
      for (const ent of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
        if (ent.isDirectory()) {
          dirs.push(path.join(cacheRoot, ent.name));
        }
      }
    } catch {
      // ignore
    }
  }
  dirs.push(path.join(root, ".electron-zip"));
  return dirs;
}

/**
 * Find an existing zip that matches expected sha256.
 * @param {string} expectedSha256
 * @returns {string | null} absolute path
 */
export function findVerifiedZip(expectedSha256) {
  for (const dir of candidateZipDirs()) {
    const candidate = path.join(dir, ZIP_NAME);
    if (!fs.existsSync(candidate)) continue;
    const actual = sha256File(candidate);
    if (actual === expectedSha256) {
      return candidate;
    }
    console.warn(
      `[ensure-electron-zip] checksum mismatch at ${candidate} (ignored)`,
    );
  }
  return null;
}

/**
 * Copy verified zip into project .electron-zip/ for packager electronZipDir.
 * @returns {string} electronZipDir
 */
export function ensureElectronZipDir() {
  const { expectedSha256 } = readExpectedChecksum();
  const destDir = path.join(root, ".electron-zip");
  fs.mkdirSync(destDir, { recursive: true });
  const destZip = path.join(destDir, ZIP_NAME);

  if (fs.existsSync(destZip)) {
    const actual = sha256File(destZip);
    if (actual === expectedSha256) {
      console.log("[ensure-electron-zip] ok (project cache):", destZip);
      return destDir;
    }
    console.warn(
      "[ensure-electron-zip] project cache checksum mismatch; replacing",
    );
    fs.rmSync(destZip, { force: true });
  }

  const found = findVerifiedZip(expectedSha256);
  if (found) {
    fs.copyFileSync(found, destZip);
    const actual = sha256File(destZip);
    if (actual !== expectedSha256) {
      throw new Error("copy verification failed for electron zip");
    }
    console.log("[ensure-electron-zip] ok (copied local):", found);
    return destDir;
  }

  // Controlled one-time download via @electron/get (still verifies checksum).
  let download;
  try {
    download = require("@electron/get").download;
  } catch {
    throw new Error(
      `No verified ${ZIP_NAME} found under cache or .electron-zip. ` +
        `Install electron@${ELECTRON_VERSION} (runs install.js) or place the zip at ${destZip}. ` +
        `Expected sha256=${expectedSha256}`,
    );
  }

  console.log(
    `[ensure-electron-zip] downloading electron ${ELECTRON_VERSION} ${ELECTRON_PLATFORM}/${ELECTRON_ARCH} (checksum enforced by @electron/get)…`,
  );
  // download returns path to extracted or zip depending on version — use getArtifact
  return download(ELECTRON_VERSION, {
    platform: ELECTRON_PLATFORM,
    arch: ELECTRON_ARCH,
    artifactName: "electron",
  }).then((artifactPath) => {
    // artifactPath may be unzipped Electron.app dir or a zip; packager wants the zip
    if (artifactPath.endsWith(".zip") && fs.existsSync(artifactPath)) {
      const actual = sha256File(artifactPath);
      if (actual !== expectedSha256) {
        throw new Error(
          `downloaded zip checksum mismatch: got ${actual}, expected ${expectedSha256}`,
        );
      }
      fs.copyFileSync(artifactPath, destZip);
      console.log("[ensure-electron-zip] ok (downloaded):", destZip);
      return destDir;
    }
    // If only extracted path returned, search cache again
    const again = findVerifiedZip(expectedSha256);
    if (again) {
      fs.copyFileSync(again, destZip);
      console.log("[ensure-electron-zip] ok (post-download cache):", again);
      return destDir;
    }
    throw new Error(
      `download completed but verified zip still missing. Place ${ZIP_NAME} (sha256 ${expectedSha256}) in ${destDir}`,
    );
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  Promise.resolve()
    .then(() => ensureElectronZipDir())
    .then((dir) => {
      console.log("[ensure-electron-zip] electronZipDir=", dir);
    })
    .catch((e) => {
      console.error(
        "[ensure-electron-zip] FAIL:",
        e instanceof Error ? e.message : e,
      );
      process.exit(1);
    });
}
