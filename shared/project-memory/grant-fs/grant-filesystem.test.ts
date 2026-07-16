import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GrantFileSystem, GrantFsError } from "./grant-filesystem";

describe("GrantFileSystem (PR-04)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "gfs-"));
    fs.writeFileSync(path.join(root, "README.md"), "hello project\n");
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export const a = 1;\n");
    fs.writeFileSync(path.join(root, ".env"), "SECRET=1\n");
    fs.mkdirSync(path.join(root, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "x", "index.js"), "x");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("reads allowed files and blocks secrets", async () => {
    const gfs = new GrantFileSystem({ rootPath: root });
    const text = await gfs.readText("README.md");
    expect(text.text).toContain("hello");
    await expect(gfs.readText(".env")).rejects.toMatchObject({
      code: "policy_denied",
    });
    await expect(gfs.readText("node_modules/x/index.js")).rejects.toMatchObject({
      code: "policy_denied",
    });
  });

  it("rejects symlink escape outside grant", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "gfs-out-"));
    fs.writeFileSync(path.join(outside, "secret.txt"), "ssh-key\n");
    try {
      fs.symlinkSync(
        path.join(outside, "secret.txt"),
        path.join(root, "link-out.txt"),
      );
    } catch {
      // Some CI FS may disallow symlinks
      return;
    }
    const gfs = new GrantFileSystem({ rootPath: root });
    await expect(gfs.readText("link-out.txt")).rejects.toBeInstanceOf(
      GrantFsError,
    );
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it("rejects path traversal", async () => {
    const gfs = new GrantFileSystem({ rootPath: root });
    await expect(gfs.readText("../outside.md")).rejects.toMatchObject({
      code: "outside_root",
    });
  });

  it("listRelative skips node_modules and .env", async () => {
    const gfs = new GrantFileSystem({ rootPath: root });
    const list = await gfs.listRelative({ maxDepth: 4, limit: 50 });
    expect(list.some((p) => p.includes("node_modules"))).toBe(false);
    expect(list.some((p) => p === ".env" || p.endsWith("/.env"))).toBe(false);
    expect(list.some((p) => p === "README.md")).toBe(true);
  });
});
