/**
 * Pure out-dir resolution for desktop package.
 * Never overwrite fallback out/ when a ready-for-owner-recording .app exists.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * @param {{ root: string, packageOutEnv?: string | undefined, fallbackAppRel?: string }} opts
 * @returns {string} absolute out directory
 */
export function resolveDesktopPackageOutDir(opts) {
  const root = path.resolve(opts.root);
  const defaultOutDir = path.resolve(root, "out");
  const fallbackRel =
    opts.fallbackAppRel ||
    path.join("知几-darwin-arm64", "知几.app");
  const fallbackApp = path.join(defaultOutDir, fallbackRel);

  const raw = opts.packageOutEnv;
  let outDir;
  if (raw && String(raw).trim()) {
    // Absolute env path resolves as-is; relative resolves against root.
    outDir = path.isAbsolute(String(raw).trim())
      ? path.resolve(String(raw).trim())
      : path.resolve(root, String(raw).trim());
  } else {
    outDir = defaultOutDir;
  }

  // realpath when possible (handles ./out, out, /abs/.../out)
  let outNorm = outDir;
  let defaultNorm = defaultOutDir;
  try {
    if (fs.existsSync(outDir)) outNorm = fs.realpathSync(outDir);
  } catch {
    outNorm = path.resolve(outDir);
  }
  try {
    if (fs.existsSync(defaultOutDir)) defaultNorm = fs.realpathSync(defaultOutDir);
  } catch {
    defaultNorm = path.resolve(defaultOutDir);
  }

  if (fs.existsSync(fallbackApp) && outNorm === defaultNorm) {
    throw new Error(
      "Refusing to overwrite existing fallback .app at out/知几-darwin-arm64. " +
        "Set DESKTOP_PACKAGE_OUT to a subdirectory (e.g. out/model-connector-trust-candidate).",
    );
  }

  return outDir;
}
