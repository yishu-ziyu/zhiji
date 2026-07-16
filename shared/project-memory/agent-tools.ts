/**
 * Real tool executors for ProjectAgentRuntime (grant-bounded).
 * Never reads outside grant.rootPath.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  EvidenceAnchor,
  ProjectAgentToolCall,
  SourceGrant,
  ToolReceipt,
} from "./types";
import type { ProjectMemoryReader } from "./types";
import { executeSetCanvasView } from "@/shared/knowledge/set-canvas-view";

const execFileAsync = promisify(execFile);

export type ToolExecContext = {
  projectId: string;
  grant: SourceGrant;
  reader: ProjectMemoryReader;
  /** Optional: resolve revisionId → relativePath when reading. */
  pathByRevisionId?: Map<string, string>;
  maxResultChars?: number;
};

export type ToolExecResult = {
  outcome: ToolReceipt["outcome"];
  summary: string;
  pins: EvidenceAnchor[];
  relativePaths: string[];
  /** Raw payload for model context (truncated). */
  detail: string;
  errorClass?: string;
};

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function resolveUnderRoot(rootPath: string, relativePath: string): string | null {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + path.sep)) {
    return null;
  }
  return target;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…(truncated)`;
}

function walkDir(
  absRoot: string,
  rel: string,
  maxDepth: number,
  depth: number,
  out: string[],
  limit: number,
): void {
  if (out.length >= limit || depth > maxDepth) return;
  const abs = rel ? path.join(absRoot, rel) : absRoot;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  const skip = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".turbo",
    "coverage",
  ]);
  for (const ent of entries) {
    if (out.length >= limit) break;
    if (ent.name.startsWith(".") && ent.name !== ".env.example") continue;
    if (skip.has(ent.name)) continue;
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      out.push(childRel + "/");
      walkDir(absRoot, childRel, maxDepth, depth + 1, out, limit);
    } else if (ent.isFile()) {
      out.push(childRel);
    }
  }
}

async function toolProjectMap(
  call: Extract<ProjectAgentToolCall, { name: "project_map" }>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  const maxDepth = Math.min(call.input.maxDepth ?? 3, 6);
  const root = path.resolve(ctx.grant.rootPath);
  if (!fs.existsSync(root)) {
    return {
      outcome: "error",
      summary: "授权根路径不存在",
      pins: [],
      relativePaths: [],
      detail: root,
      errorClass: "missing_root",
    };
  }
  const files: string[] = [];
  walkDir(root, "", maxDepth, 0, files, 200);
  const summary = `项目地图 depth≤${maxDepth}：${files.length} 项（目录带 /）`;
  return {
    outcome: "ok",
    summary,
    pins: [],
    relativePaths: files.filter((f) => !f.endsWith("/")).slice(0, 80),
    detail: truncate(files.join("\n"), ctx.maxResultChars ?? 12_000),
  };
}

function sliceLines(
  text: string,
  startLine?: number,
  endLine?: number,
): { slice: string; start: number; end: number } {
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, startLine ?? 1);
  const end = Math.min(
    lines.length,
    endLine ?? Math.min(lines.length, start + 80),
  );
  return {
    slice: lines.slice(start - 1, end).join("\n"),
    start,
    end,
  };
}

async function toolReadRevision(
  call: Extract<ProjectAgentToolCall, { name: "read_revision" }>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  const bytes = await ctx.reader.readRevision(call.input.revisionId);
  if (!bytes) {
    return {
      outcome: "error",
      summary: `revision 不可读: ${call.input.revisionId.slice(0, 24)}…`,
      pins: [],
      relativePaths: [],
      detail: "",
      errorClass: "missing_revision",
    };
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const { slice, start, end } = sliceLines(
    text,
    call.input.startLine,
    call.input.endLine,
  );
  const lineCount = text.split(/\r?\n/).length;
  const rel =
    ctx.pathByRevisionId?.get(call.input.revisionId) ??
    `(revision ${call.input.revisionId.slice(0, 12)})`;
  const quote = slice.trim().slice(0, 400);
  const pins: EvidenceAnchor[] = quote
    ? [
        {
          revisionId: call.input.revisionId,
          relativePath: rel.replace(/\\/g, "/"),
          quote: quote.slice(0, 240),
          lastVerifiedAt: new Date().toISOString(),
        },
      ]
    : [];
  return {
    outcome: "ok",
    summary: `已读 ${rel} L${start}-${end}（共 ${lineCount} 行）`,
    pins,
    relativePaths: rel.startsWith("(") ? [] : [rel.replace(/\\/g, "/")],
    detail: truncate(slice, ctx.maxResultChars ?? 16_000),
  };
}

/**
 * Read a file by relative path under the grant root.
 * Used when map/search found a path but CAS revision id is missing.
 */
async function toolReadPath(
  call: Extract<ProjectAgentToolCall, { name: "read_path" }>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  const rel = normalizeRel(call.input.relativePath || "");
  if (!rel || rel.endsWith("/")) {
    return {
      outcome: "error",
      summary: "read_path 需要有效文件相对路径",
      pins: [],
      relativePaths: [],
      detail: "",
      errorClass: "invalid_input",
    };
  }
  const full = resolveUnderRoot(ctx.grant.rootPath, rel);
  if (!full) {
    return {
      outcome: "error",
      summary: `路径越权或无效: ${rel}`,
      pins: [],
      relativePaths: [],
      detail: "",
      errorClass: "outside_grant",
    };
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return {
      outcome: "error",
      summary: `文件不存在: ${rel}`,
      pins: [],
      relativePaths: [rel],
      detail: "",
      errorClass: "missing_file",
    };
  }
  let buf: Buffer;
  try {
    buf = fs.readFileSync(full);
  } catch (e) {
    return {
      outcome: "error",
      summary: `读失败: ${rel}`,
      pins: [],
      relativePaths: [rel],
      detail: e instanceof Error ? e.message : String(e),
      errorClass: "io_error",
    };
  }
  if (buf.byteLength > 512_000) {
    return {
      outcome: "error",
      summary: `文件过大: ${rel}`,
      pins: [],
      relativePaths: [rel],
      detail: `${buf.byteLength} bytes`,
      errorClass: "too_large",
    };
  }
  if (buf.includes(0)) {
    return {
      outcome: "error",
      summary: `二进制文件跳过: ${rel}`,
      pins: [],
      relativePaths: [rel],
      detail: "",
      errorClass: "binary",
    };
  }
  const text = buf.toString("utf8");
  const { slice, start, end } = sliceLines(
    text,
    call.input.startLine,
    call.input.endLine,
  );
  const lineCount = text.split(/\r?\n/).length;
  const quote = slice.trim().slice(0, 400);
  // Prefer real revision id when reconcile already indexed this path.
  let revisionId = `path:${rel}`;
  if (ctx.pathByRevisionId) {
    for (const [revId, p] of ctx.pathByRevisionId) {
      if (p.replace(/\\/g, "/") === rel) {
        revisionId = revId;
        break;
      }
    }
  }
  const pins: EvidenceAnchor[] = quote
    ? [
        {
          revisionId,
          relativePath: rel,
          quote: quote.slice(0, 240),
          lastVerifiedAt: new Date().toISOString(),
        },
      ]
    : [];
  return {
    outcome: "ok",
    summary: `已读 ${rel} L${start}-${end}（共 ${lineCount} 行）`,
    pins,
    relativePaths: [rel],
    detail: truncate(slice, ctx.maxResultChars ?? 16_000),
  };
}

async function toolSearchText(
  call: Extract<ProjectAgentToolCall, { name: "search_text" }>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  const q = call.input.query?.trim();
  if (!q) {
    return {
      outcome: "error",
      summary: "search_text 需要 query",
      pins: [],
      relativePaths: [],
      detail: "",
      errorClass: "invalid_input",
    };
  }
  const limit = Math.min(call.input.limit ?? 20, 50);
  const root = path.resolve(ctx.grant.rootPath);
  const prefix = call.input.pathPrefix
    ? normalizeRel(call.input.pathPrefix)
    : "";
  const hits: string[] = [];
  const relPaths = new Set<string>();

  const walk = (rel: string, depth: number) => {
    if (hits.length >= limit || depth > 8) return;
    const abs = rel ? path.join(root, rel) : root;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (hits.length >= limit) break;
      if (
        ent.name === "node_modules" ||
        ent.name === ".git" ||
        ent.name === ".next"
      ) {
        continue;
      }
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (prefix && !childRel.startsWith(prefix) && !prefix.startsWith(childRel)) {
        if (!childRel.startsWith(prefix.split("/")[0] ?? "")) {
          /* still may need to descend if prefix deeper */
        }
      }
      if (ent.isDirectory()) {
        walk(childRel, depth + 1);
      } else if (ent.isFile()) {
        if (prefix && !childRel.startsWith(prefix)) continue;
        if (!/\.(md|txt|ts|tsx|js|jsx|json|py|rs|go|css|html|yml|yaml)$/i.test(ent.name)) {
          continue;
        }
        const full = resolveUnderRoot(root, childRel);
        if (!full) continue;
        let content: string;
        try {
          const buf = fs.readFileSync(full);
          if (buf.byteLength > 512_000) continue;
          content = buf.toString("utf8");
        } catch {
          continue;
        }
        const idx = content.toLowerCase().indexOf(q.toLowerCase());
        if (idx < 0) continue;
        const line = content.slice(0, idx).split(/\r?\n/).length;
        const snip = content
          .slice(Math.max(0, idx - 40), idx + q.length + 80)
          .replace(/\s+/g, " ")
          .trim();
        hits.push(`${childRel}:${line}: ${snip}`);
        relPaths.add(childRel);
      }
    }
  };
  walk("", 0);

  return {
    outcome: "ok",
    summary:
      hits.length === 0
        ? `搜索「${q}」无命中`
        : `搜索「${q}」命中 ${hits.length} 处`,
    pins: [],
    relativePaths: [...relPaths],
    detail: truncate(hits.join("\n"), ctx.maxResultChars ?? 12_000),
  };
}

async function toolQueryMemory(
  call: Extract<ProjectAgentToolCall, { name: "query_project_memory" }>,
  ctx: ToolExecContext,
  matterId: string,
): Promise<ToolExecResult> {
  const state = await ctx.reader.getMatterState(ctx.projectId, matterId);
  const events = await ctx.reader.listEvents(ctx.projectId);
  const include = call.input.include;
  const limit = Math.min(call.input.limit ?? 12, 40);
  const parts: string[] = [];
  if (include === "accepted" || include === "both") {
    parts.push(
      `accepted=${JSON.stringify(state.accepted?.body?.now?.text ?? null)}`,
    );
  }
  if (include === "events" || include === "both") {
    parts.push(
      `events=${JSON.stringify(
        events.slice(0, limit).map((e) => ({
          id: e.id,
          kind: e.kind,
          path: e.relativePath,
          after: e.afterRevisionId,
        })),
      )}`,
    );
  }
  return {
    outcome: "ok",
    summary: `已查项目记忆 include=${include}`,
    pins: [],
    relativePaths: [],
    detail: truncate(parts.join("\n"), ctx.maxResultChars ?? 12_000),
  };
}

async function toolGit(
  name: ProjectAgentToolCall["name"],
  args: string[],
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: ctx.grant.rootPath,
      timeout: 15_000,
      maxBuffer: 512 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    const text = (stdout || stderr || "").trim();
    return {
      outcome: "ok",
      summary: `git ${name} ok (${text.split("\n").length} lines)`,
      pins: [],
      relativePaths: [],
      detail: truncate(text || "(empty)", ctx.maxResultChars ?? 12_000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      outcome: "error",
      summary: `git ${name} 失败`,
      pins: [],
      relativePaths: [],
      detail: truncate(msg, 2000),
      errorClass: "git_error",
    };
  }
}

/**
 * Execute one tool call inside grant boundary.
 * matterId required for query_project_memory.
 */
export async function executeProjectAgentTool(
  call: ProjectAgentToolCall,
  ctx: ToolExecContext,
  options?: { matterId?: string },
): Promise<ToolExecResult> {
  switch (call.name) {
    case "project_map":
      return toolProjectMap(call, ctx);
    case "read_revision":
      return toolReadRevision(call, ctx);
    case "read_path":
      return toolReadPath(call, ctx);
    case "search_text":
      return toolSearchText(call, ctx);
    case "set_canvas_view": {
      const result = executeSetCanvasView(call.input);
      return {
        outcome: result.outcome,
        summary: result.summary,
        pins: [],
        relativePaths: [],
        detail: result.detail,
        errorClass:
          result.outcome === "error" ? result.errorClass : undefined,
      };
    }
    case "query_project_memory":
      if (!options?.matterId) {
        return {
          outcome: "error",
          summary: "query_project_memory 需要 matterId",
          pins: [],
          relativePaths: [],
          detail: "",
          errorClass: "invalid_input",
        };
      }
      return toolQueryMemory(call, ctx, options.matterId);
    case "git_status":
      return toolGit("git_status", ["status", "--short", "--branch"], ctx);
    case "git_log":
      return toolGit(
        "git_log",
        [
          "log",
          `--max-count=${Math.min(call.input.limit ?? 10, 30)}`,
          "--oneline",
          ...(call.input.relativePath
            ? ["--", call.input.relativePath]
            : []),
        ],
        ctx,
      );
    case "git_diff":
      return toolGit(
        "git_diff",
        [
          "diff",
          call.input.base,
          ...(call.input.head ? [call.input.head] : []),
          ...(call.input.relativePath
            ? ["--", call.input.relativePath]
            : []),
        ],
        ctx,
      );
    case "git_show":
      return toolGit(
        "git_show",
        [
          "show",
          "--stat",
          call.input.commit,
          ...(call.input.relativePath
            ? ["--", call.input.relativePath]
            : []),
        ],
        ctx,
      );
    case "git_blame":
      return toolGit(
        "git_blame",
        [
          "blame",
          "-L",
          `${call.input.startLine ?? 1},${call.input.endLine ?? 40}`,
          ...(call.input.commit ? [call.input.commit] : []),
          "--",
          call.input.relativePath,
        ],
        ctx,
      );
    case "search_symbols":
    case "search_relations":
    case "compare_history":
      return {
        outcome: "error",
        summary: `${call.name} 尚未启用（先用 search_text / read_revision）`,
        pins: [],
        relativePaths: [],
        detail: "",
        errorClass: "not_implemented",
      };
    default:
      return {
        outcome: "error",
        summary: "unknown tool",
        pins: [],
        relativePaths: [],
        detail: "",
        errorClass: "unknown_tool",
      };
  }
}

function scoreDocPath(p: string): number {
  const n = p.replace(/\\/g, "/").toLowerCase();
  const base = n.split("/").pop() || n;
  // Skip hidden / fixture seed noise (same spirit as materialize).
  if (base.startsWith(".") || /fixture[-_]?seed/i.test(base)) return 99;
  if (/(^|\/)readme(\.|$)/i.test(n)) return 0;
  if (/(^|\/)todo(\.|$)/i.test(n)) return 1;
  if (/(^|\/)notes?(\.|$)/i.test(n)) return 2;
  if (/(^|\/)decisions?(\.|$)/i.test(n) || /decision/i.test(n)) return 3;
  if (n.endsWith(".md")) return 10;
  if (n.endsWith(".txt")) return 15;
  return 40;
}

/** Deterministic first-wave: map → high-signal reads → light search. */
export function planBootstrapToolCalls(input: {
  eventRevisionIds: Array<{ revisionId: string; relativePath: string }>;
  folderHints?: string[];
}): ProjectAgentToolCall[] {
  const calls: ProjectAgentToolCall[] = [
    {
      id: "t-map-1",
      name: "project_map",
      input: { scope: "initial_root", maxDepth: 3 },
    },
  ];
  // Reads before mass search so budget is not spent on empty queries.
  const seen = new Set<string>();
  let i = 0;
  const ranked = [...input.eventRevisionIds].sort(
    (a, b) =>
      scoreDocPath(a.relativePath) - scoreDocPath(b.relativePath) ||
      a.relativePath.localeCompare(b.relativePath),
  );
  for (const tip of ranked) {
    if (!tip.revisionId || seen.has(tip.revisionId)) continue;
    if (scoreDocPath(tip.relativePath) > 15) continue;
    seen.add(tip.revisionId);
    i += 1;
    if (i > 6) break;
    calls.push({
      id: `t-read-${i}`,
      name: "read_revision",
      input: { revisionId: tip.revisionId, startLine: 1, endLine: 80 },
    });
  }
  // Few high-value searches only (map→search→follow-up read).
  for (const q of ["TODO", "README", "下一步"]) {
    calls.push({
      id: `t-search-${q}`,
      name: "search_text",
      input: { query: q, limit: 8 },
    });
  }
  return calls;
}

/**
 * After map, force-read high-signal files even when no event tip / revision id.
 * Prefer read_revision when CAS maps the path; otherwise read_path.
 */
export function planForceReadsFromMap(input: {
  mapRelativePaths: string[];
  pathByRevisionId: Map<string, string>;
  alreadyReadRevisionIds: Set<string>;
  alreadyReadPaths: Set<string>;
  maxReads?: number;
}): ProjectAgentToolCall[] {
  const maxReads = input.maxReads ?? 6;
  const revByPath = new Map<string, string>();
  for (const [revId, rel] of input.pathByRevisionId) {
    revByPath.set(rel.replace(/\\/g, "/"), revId);
  }
  const ranked = [...input.mapRelativePaths]
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => p && !p.endsWith("/"))
    .filter((p) => scoreDocPath(p) <= 15)
    .sort(
      (a, b) => scoreDocPath(a) - scoreDocPath(b) || a.localeCompare(b),
    );
  const calls: ProjectAgentToolCall[] = [];
  let i = 0;
  for (const rel of ranked) {
    if (input.alreadyReadPaths.has(rel)) continue;
    const revId = revByPath.get(rel);
    if (revId && input.alreadyReadRevisionIds.has(revId)) continue;
    i += 1;
    input.alreadyReadPaths.add(rel);
    if (revId) {
      input.alreadyReadRevisionIds.add(revId);
      calls.push({
        id: `t-map-read-${i}`,
        name: "read_revision",
        input: { revisionId: revId, startLine: 1, endLine: 80 },
      });
    } else {
      calls.push({
        id: `t-map-path-${i}`,
        name: "read_path",
        input: { relativePath: rel, startLine: 1, endLine: 80 },
      });
    }
    if (calls.length >= maxReads) break;
  }
  return calls;
}

/**
 * After search_text receipts, plan precise reads on hit paths.
 * Uses read_revision when CAS tip exists, else read_path.
 */
export function planReadFollowupsFromSearch(input: {
  searchRelativePaths: string[];
  pathByRevisionId: Map<string, string>;
  alreadyReadRevisionIds: Set<string>;
  alreadyReadPaths?: Set<string>;
  maxReads?: number;
}): ProjectAgentToolCall[] {
  const maxReads = input.maxReads ?? 6;
  const alreadyPaths = input.alreadyReadPaths ?? new Set<string>();
  const revByPath = new Map<string, string>();
  for (const [revId, rel] of input.pathByRevisionId) {
    const key = rel.replace(/\\/g, "/");
    revByPath.set(key, revId);
  }
  const calls: ProjectAgentToolCall[] = [];
  const seenPath = new Set<string>();
  let i = 0;
  for (const raw of input.searchRelativePaths) {
    const rel = raw.replace(/\\/g, "/");
    if (!rel || seenPath.has(rel) || alreadyPaths.has(rel)) continue;
    seenPath.add(rel);
    alreadyPaths.add(rel);
    const revId = revByPath.get(rel);
    i += 1;
    if (revId && !input.alreadyReadRevisionIds.has(revId)) {
      input.alreadyReadRevisionIds.add(revId);
      calls.push({
        id: `t-follow-read-${i}`,
        name: "read_revision",
        input: { revisionId: revId, startLine: 1, endLine: 80 },
      });
    } else if (!revId) {
      calls.push({
        id: `t-follow-path-${i}`,
        name: "read_path",
        input: { relativePath: rel, startLine: 1, endLine: 80 },
      });
    }
    if (calls.length >= maxReads) break;
  }
  return calls;
}
