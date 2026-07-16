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
