import { describe, expect, it } from "vitest";
import {
  assertSafeGitRef,
  assertSafeRelativePath,
  SafeGitError,
} from "./safe-git-reader";

describe("SafeGitReader guards (PR-05)", () => {
  it("rejects option-like refs", () => {
    expect(() => assertSafeGitRef("--output=/tmp/x")).toThrow(SafeGitError);
    expect(() => assertSafeGitRef("-c")).toThrow(SafeGitError);
    expect(() => assertSafeGitRef("")).toThrow(SafeGitError);
    expect(assertSafeGitRef("HEAD")).toBe("HEAD");
    expect(assertSafeGitRef("abc1234")).toBe("abc1234");
    expect(assertSafeGitRef("main")).toBe("main");
  });

  it("rejects unsafe paths", () => {
    expect(() => assertSafeRelativePath("../etc/passwd")).toThrow(SafeGitError);
    expect(() => assertSafeRelativePath("-o")).toThrow(SafeGitError);
    expect(assertSafeRelativePath("src/a.ts")).toBe("src/a.ts");
  });
});
