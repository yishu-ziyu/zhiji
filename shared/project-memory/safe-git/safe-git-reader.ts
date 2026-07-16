/**
 * Safe Git Reader (PR-05): fixed subcommands, validated refs as OIDs only.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export class SafeGitError extends Error {
  readonly code: "invalid_ref" | "invalid_path" | "git_error" | "timeout";
  constructor(code: SafeGitError["code"], message: string) {
    super(message);
    this.name = "SafeGitError";
    this.code = code;
  }
}

/** Reject option-like or empty refs; only allow safe git rev characters. */
export function assertSafeGitRef(value: string, label = "ref"): string {
  const v = value?.trim() ?? "";
  if (!v) throw new SafeGitError("invalid_ref", `${label} is empty`);
  if (v.startsWith("-")) {
    throw new SafeGitError("invalid_ref", `${label} must not start with -`);
  }
  // Disallow path-ish and option injection
  if (v.includes("..") || v.includes("\0") || /\s/.test(v)) {
    throw new SafeGitError("invalid_ref", `${label} contains forbidden characters`);
  }
  // Allow typical rev-parse inputs: hex, branch, tag, HEAD, name^{}
  if (!/^[A-Za-z0-9_./@^{}~+-]+$/.test(v)) {
    throw new SafeGitError("invalid_ref", `${label} has invalid characters`);
  }
  return v;
}

export function assertSafeRelativePath(rel: string): string {
  const v = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!v || v.startsWith("/") || v.split("/").some((p) => p === ".." || p === "")) {
    throw new SafeGitError("invalid_path", `unsafe path: ${rel}`);
  }
  if (v.startsWith("-")) {
    throw new SafeGitError("invalid_path", `path must not start with -`);
  }
  return v;
}

export type SafeGitReaderOptions = {
  cwd: string;
  timeoutMs?: number;
  maxBuffer?: number;
};

export class SafeGitReader {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly maxBuffer: number;

  constructor(options: SafeGitReaderOptions) {
    this.cwd = path.resolve(options.cwd);
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxBuffer = options.maxBuffer ?? 512 * 1024;
  }

  private async run(args: string[]): Promise<string> {
    try {
      const { stdout, stderr } = await execFileAsync("git", args, {
        cwd: this.cwd,
        timeout: this.timeoutMs,
        maxBuffer: this.maxBuffer,
        env: {
          ...process.env,
          PATH: process.env.PATH,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
          GIT_PAGER: "cat",
          PAGER: "cat",
          // Block external helpers that could write
          GIT_EXTERNAL_DIFF: "",
          GIT_DIFF_OPTS: "",
        },
      });
      return (stdout || stderr || "").trim();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/ETIMEDOUT|timed out/i.test(msg)) {
        throw new SafeGitError("timeout", msg);
      }
      throw new SafeGitError("git_error", msg);
    }
  }

  /** Resolve any safe ref to a full OID; never pass model text as options. */
  async resolveOid(ref: string): Promise<string> {
    const safe = assertSafeGitRef(ref);
    const out = await this.run([
      "rev-parse",
      "--verify",
      "--end-of-options",
      safe,
    ]);
    const oid = out.split("\n")[0]?.trim() ?? "";
    if (!/^[0-9a-f]{7,40}$/i.test(oid)) {
      throw new SafeGitError("invalid_ref", `rev-parse did not return oid for ${ref}`);
    }
    return oid;
  }

  async statusShort(): Promise<string> {
    return this.run(["status", "--short", "--branch"]);
  }

  async logOneline(limit = 10, relativePath?: string): Promise<string> {
    const n = Math.min(Math.max(1, limit), 30);
    const args = ["log", `--max-count=${n}`, "--oneline"];
    if (relativePath) {
      args.push("--", assertSafeRelativePath(relativePath));
    }
    return this.run(args);
  }

  async diff(base: string, head?: string, relativePath?: string): Promise<string> {
    const baseOid = await this.resolveOid(base);
    const args = ["diff", "--end-of-options", baseOid];
    if (head) {
      args.push(await this.resolveOid(head));
    }
    if (relativePath) {
      args.push("--", assertSafeRelativePath(relativePath));
    }
    return this.run(args);
  }

  async showStat(commit: string, relativePath?: string): Promise<string> {
    const oid = await this.resolveOid(commit);
    const args = ["show", "--stat", "--end-of-options", oid];
    if (relativePath) {
      args.push("--", assertSafeRelativePath(relativePath));
    }
    return this.run(args);
  }

  async blame(
    relativePath: string,
    options?: { startLine?: number; endLine?: number; commit?: string },
  ): Promise<string> {
    const rel = assertSafeRelativePath(relativePath);
    const start = Math.max(1, options?.startLine ?? 1);
    const end = Math.max(start, options?.endLine ?? start + 39);
    const args = ["blame", "-L", `${start},${end}`];
    if (options?.commit) {
      args.push(await this.resolveOid(options.commit));
    }
    args.push("--", rel);
    return this.run(args);
  }
}

export function createSafeGitReader(cwd: string): SafeGitReader {
  return new SafeGitReader({ cwd });
}
