/**
 * Unified grant-scoped filesystem access (PR-04).
 * All agent tools and observers should read through this layer.
 */
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_GRANT_POLICY,
  mayReadFileBody,
  type GrantPolicy,
} from "../grant-policy";

export class GrantFsError extends Error {
  readonly code:
    | "outside_root"
    | "symlink_escape"
    | "policy_denied"
    | "not_found"
    | "not_file"
    | "too_large";

  constructor(
    code: GrantFsError["code"],
    message: string,
  ) {
    super(message);
    this.name = "GrantFsError";
    this.code = code;
  }
}

export type GrantFileSystemOptions = {
  rootPath: string;
  policy?: GrantPolicy;
  maxReadBytes?: number;
};

function normalizeRel(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.?\//, "");
}

export class GrantFileSystem {
  readonly rootPath: string;
  readonly policy: GrantPolicy;
  readonly maxReadBytes: number;
  private realRoot: string | null = null;

  constructor(options: GrantFileSystemOptions) {
    this.rootPath = path.resolve(options.rootPath);
    this.policy = options.policy ?? DEFAULT_GRANT_POLICY;
    this.maxReadBytes = options.maxReadBytes ?? this.policy.maxFileBytes;
  }

  async ensureRealRoot(): Promise<string> {
    if (this.realRoot) return this.realRoot;
    this.realRoot = await fs.promises.realpath(this.rootPath);
    return this.realRoot;
  }

  /**
   * Resolve a relative path to a real absolute path inside the grant.
   * Rejects lexical escape and symlink escape outside root.
   */
  async resolveInside(relativePath: string): Promise<{
    relativePath: string;
    absolutePath: string;
    realPath: string;
  }> {
    const rel = normalizeRel(relativePath);
    if (
      !rel ||
      rel === "." ||
      path.isAbsolute(rel) ||
      rel.split("/").some((p) => p === ".." || p === "")
    ) {
      throw new GrantFsError("outside_root", `invalid relative path: ${relativePath}`);
    }

    const realRoot = await this.ensureRealRoot();
    const absolutePath = path.resolve(this.rootPath, rel);

    // Lexical check before any IO that follows links carelessly
    const lexRel = path.relative(path.resolve(this.rootPath), absolutePath);
    if (
      lexRel.startsWith("..") ||
      path.isAbsolute(lexRel)
    ) {
      throw new GrantFsError("outside_root", `path outside grant: ${relativePath}`);
    }

    let realPath: string;
    try {
      realPath = await fs.promises.realpath(absolutePath);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        // Resolve parent chain for missing leaf
        throw new GrantFsError("not_found", `path not found: ${relativePath}`);
      }
      throw e;
    }

    const inside =
      realPath === realRoot ||
      realPath.startsWith(realRoot + path.sep);
    if (!inside) {
      throw new GrantFsError(
        "symlink_escape",
        `symlink escapes grant root: ${relativePath}`,
      );
    }

    const boundedRel = path.relative(realRoot, realPath).split(path.sep).join("/");
    return { relativePath: boundedRel || rel, absolutePath, realPath };
  }

  async readText(relativePath: string): Promise<{
    relativePath: string;
    text: string;
    bytes: number;
  }> {
    if (!mayReadFileBody(relativePath, this.policy)) {
      throw new GrantFsError(
        "policy_denied",
        `policy forbids reading body: ${relativePath}`,
      );
    }
    const resolved = await this.resolveInside(relativePath);
    if (!mayReadFileBody(resolved.relativePath, this.policy)) {
      throw new GrantFsError(
        "policy_denied",
        `policy forbids reading body: ${resolved.relativePath}`,
      );
    }
    const stat = await fs.promises.stat(resolved.realPath);
    if (!stat.isFile()) {
      throw new GrantFsError("not_file", `not a file: ${relativePath}`);
    }
    if (stat.size > this.maxReadBytes) {
      throw new GrantFsError(
        "too_large",
        `file exceeds maxReadBytes (${this.maxReadBytes})`,
      );
    }
    // Re-check policy with size
    if (!mayReadFileBody(resolved.relativePath, this.policy, { sizeBytes: stat.size })) {
      throw new GrantFsError(
        "policy_denied",
        `policy forbids reading body: ${resolved.relativePath}`,
      );
    }
    const buf = await fs.promises.readFile(resolved.realPath);
    return {
      relativePath: resolved.relativePath,
      text: buf.toString("utf8"),
      bytes: buf.byteLength,
    };
  }

  async listRelative(
    options?: { maxDepth?: number; limit?: number },
  ): Promise<string[]> {
    const maxDepth = Math.min(options?.maxDepth ?? 3, 8);
    const limit = options?.limit ?? 200;
    const realRoot = await this.ensureRealRoot();
    const out: string[] = [];

    const walk = async (rel: string, depth: number) => {
      if (out.length >= limit || depth > maxDepth) return;
      const abs = rel ? path.join(realRoot, rel) : realRoot;
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(abs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        if (out.length >= limit) break;
        const childRel = rel ? `${rel}/${ent.name}` : ent.name;
        // Directory names still filtered by policy skip/block on path
        if (ent.isDirectory()) {
          const d = mayReadFileBody(`${childRel}/.keep`, this.policy);
          // Use decidePath via mayRead on a synthetic? better check parent skip
          const { decidePath } = await import("../grant-policy");
          const decision = decidePath(childRel, this.policy).decision;
          if (decision === "skip" || decision === "block") continue;
          void d;
          out.push(`${childRel}/`);
          await walk(childRel, depth + 1);
        } else if (ent.isFile()) {
          const { decidePath } = await import("../grant-policy");
          const decision = decidePath(childRel, this.policy).decision;
          if (decision === "skip" || decision === "block") continue;
          out.push(childRel);
        }
      }
    };

    await walk("", 0);
    return out;
  }
}

export function createGrantFileSystem(
  rootPath: string,
  policy?: GrantPolicy,
): GrantFileSystem {
  return new GrantFileSystem({ rootPath, policy });
}
