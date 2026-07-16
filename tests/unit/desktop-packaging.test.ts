/**
 * Desktop packaging / staging guards.
 * Pure checks + optional live .desktop-stage when present.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const {
  findSensitivePaths,
  assertStagingClean,
  assertStagingStructure,
  removeBrokenSymlinks,
} = await import("../../scripts/prepare-desktop-bundle.mjs");

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("findSensitivePaths / assertStagingClean", () => {
  it("fails when .env.local is present in staging tree", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desk-stage-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, ".env.local"), "LLM_API_KEY=sk-test\n");
    const hits = findSensitivePaths(dir);
    expect(hits.some((h) => h.includes(".env.local"))).toBe(true);
    expect(() => assertStagingClean(dir)).toThrow(/sensitive/i);
  });

  it("fails when data/knowledge user store is nested in stage", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desk-stage-"));
    tmpDirs.push(dir);
    fs.mkdirSync(path.join(dir, "data", "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(dir, "data", "knowledge", "x.json"), "{}");
    const hits = findSensitivePaths(dir);
    expect(hits.some((h) => h.includes("knowledge"))).toBe(true);
  });

  it("passes clean minimal stage fixture", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desk-clean-"));
    tmpDirs.push(dir);
    fs.mkdirSync(path.join(dir, "desktop"), { recursive: true });
    fs.writeFileSync(path.join(dir, "desktop", "main.cjs"), "/* main */");
    expect(() => assertStagingClean(dir)).not.toThrow();
  });
});

describe("live .desktop-stage (when prepared)", () => {
  const stage = path.resolve(__dirname, "../../.desktop-stage");

  it("if staging exists, structure and cleanliness hold", () => {
    if (!fs.existsSync(stage)) {
      // Not yet prepared in this run — not a failure for pure unit path
      expect(true).toBe(true);
      return;
    }
    expect(() => assertStagingStructure(stage)).not.toThrow();
    expect(() => assertStagingClean(stage)).not.toThrow();
    expect(
      fs.existsSync(path.join(stage, "runtime", "server.js")),
    ).toBe(true);
    const staticDir = path.join(stage, "runtime", ".next", "static");
    expect(fs.readdirSync(staticDir).length).toBeGreaterThan(0);
    const publicDir = path.join(stage, "runtime", "public");
    expect(fs.readdirSync(publicDir).length).toBeGreaterThan(0);
  });
});

describe("removeBrokenSymlinks", () => {
  it("removes dangling links without deleting valid links", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desk-links-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, "target.txt"), "ok");
    fs.symlinkSync("target.txt", path.join(dir, "valid-link"));
    fs.symlinkSync("missing.txt", path.join(dir, "broken-link"));

    removeBrokenSymlinks(dir);

    expect(fs.existsSync(path.join(dir, "valid-link"))).toBe(true);
    expect(fs.lstatSync(path.join(dir, "valid-link")).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(dir, "broken-link"))).toBe(false);
  });
});

describe("createWindowOptions still sandboxed in desktop/runtime.cjs", () => {
  it("source contains required security flags", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../desktop/runtime.cjs"),
      "utf8",
    );
    expect(src).toContain("nodeIntegration: false");
    expect(src).toContain("contextIsolation: true");
    expect(src).toContain("sandbox: true");
  });
});

describe("main.cjs credential + window policy (static audit)", () => {
  it("does not spread process.env; denies window open; uses buildUtilityProcessEnv", () => {
    const mainSrc = fs.readFileSync(
      path.resolve(__dirname, "../../desktop/main.cjs"),
      "utf8",
    );
    expect(mainSrc).not.toMatch(/\.\.\.\s*process\.env/);
    expect(mainSrc).toContain("buildUtilityProcessEnv");
    expect(mainSrc).toContain("loadDesktopSecrets");
    expect(mainSrc).toContain("decideWindowOpen");
    expect(mainSrc).toMatch(/action:\s*["']deny["']/);
    expect(mainSrc).not.toMatch(/action:\s*["']allow["']/);
  });

  it("install-desktop-env is BYOK template only (no process.env prefill)", () => {
    const installSrc = fs.readFileSync(
      path.resolve(__dirname, "../../scripts/install-desktop-env.mjs"),
      "utf8",
    );
    expect(installSrc).toContain("desktopEnvTemplateBody");
    expect(installSrc).toMatch(/BYOK|Bring Your Own Key/i);
    // Must write template only — never assign from process.env secrets
    expect(installSrc).not.toMatch(/process\.env\s*\[/);
    expect(installSrc).not.toMatch(/process\.env\.(LLM_|ANYSEARCH_)/);
    expect(installSrc).not.toMatch(/LLM_API_KEY\s*=\s*process\.env/);
    expect(installSrc).toMatch(/writeFileSync\s*\(\s*dest,\s*body/);
  });
});

describe("ensure-electron-zip checksum helpers", () => {
  it("reads expected sha256 for darwin-arm64 zip from electron package", async () => {
    const { readExpectedChecksum, ZIP_NAME, sha256File, findVerifiedZip } =
      await import("../../scripts/ensure-electron-zip.mjs");
    const { expectedSha256, zipName } = readExpectedChecksum();
    expect(zipName).toBe(ZIP_NAME);
    expect(expectedSha256).toMatch(/^[a-f0-9]{64}$/);
    // Local cache may already hold a verified zip after electron install
    const found = findVerifiedZip(expectedSha256);
    if (found) {
      expect(sha256File(found)).toBe(expectedSha256);
    }
  });
});
