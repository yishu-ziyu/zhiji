import { describe, expect, it } from "vitest";
import {
  buildPreflightReport,
  decidePath,
  mayReadFileBody,
  matchPolicyPattern,
} from "./grant-policy";

describe("grant-policy preflight (PR-03)", () => {
  it("matches common exclude globs", () => {
    expect(matchPolicyPattern("node_modules/x/y.js", "node_modules/**")).toBe(
      true,
    );
    expect(matchPolicyPattern(".git/objects/aa", ".git/**")).toBe(true);
    expect(matchPolicyPattern("README.md", "node_modules/**")).toBe(false);
  });

  it("blocks secrets and skips heavy dirs before body read", () => {
    expect(decidePath(".env").decision).toBe("block");
    expect(decidePath("config/.env.local").decision).toBe("block");
    expect(decidePath("secrets/app.pem").decision).toBe("block");
    expect(decidePath("node_modules/lodash/index.js").decision).toBe("skip");
    expect(decidePath(".next/server/app.js").decision).toBe("skip");
    expect(mayReadFileBody("README.md")).toBe(true);
    expect(mayReadFileBody(".env")).toBe(false);
    expect(mayReadFileBody("node_modules/x.js")).toBe(false);
  });

  it("preflight never needs file content and reports blocked secrets", () => {
    const report = buildPreflightReport([
      { relativePath: "README.md", sizeBytes: 100, isFile: true },
      { relativePath: ".env", sizeBytes: 40, isFile: true },
      { relativePath: "node_modules/a/index.js", sizeBytes: 9999, isFile: true },
      { relativePath: "src", sizeBytes: 0, isFile: false },
    ]);
    expect(report.eligibleFiles).toBe(1);
    expect(report.blockedFiles).toBe(1);
    expect(report.blocked[0]?.relativePath).toBe(".env");
    expect(report.warnings.some((w) => /敏感/.test(w))).toBe(true);
  });
});
