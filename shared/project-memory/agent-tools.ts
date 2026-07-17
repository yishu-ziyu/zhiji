/**
 * Real tool executors for ProjectAgentRuntime (grant-bounded).
 * Never reads outside grant.rootPath.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  EvidenceAnchor,
  ProjectAgentToolCall,
  SourceGrant,
  ToolReceipt,
} from "./types";
import type { ProjectMemoryReader } from "./types";
import { executeSetCanvasView } from "@/shared/knowledge/set-canvas-view";
import { createGrantFileSystem, GrantFsError } from "./grant-fs/grant-filesystem";
import {
  createSafeGitReader,
  SafeGitError,
} from "./safe-git/safe-git-reader";
import { assertToolExecutable } from "./tool-registry";
import { mayReadFileBody } from "./grant-policy";

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
  try {
    const gfs = createGrantFileSystem(ctx.grant.rootPath);
    const files = await gfs.listRelative({ maxDepth, limit: 200 });
    const summary = `项目地图 depth≤${maxDepth}：${files.length} 项（目录带 /）`;
    return {
      outcome: "ok",
      summary,
      pins: [],
      relativePaths: files.filter((f) => !f.endsWith("/")).slice(0, 80),
      detail: truncate(files.join("\n"), ctx.maxResultChars ?? 12_000),
    };
  } catch (e) {
    return {
      outcome: "error",
      summary: "授权根路径不可用",
      pins: [],
      relativePaths: [],
      detail: e instanceof Error ? e.message : String(e),
      errorClass: "missing_root",
    };
  }
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
  const gfs = createGrantFileSystem(ctx.grant.rootPath);
  let text: string;
  let resolvedRel = rel;
  try {
    const read = await gfs.readText(rel);
    text = read.text;
    resolvedRel = read.relativePath;
  } catch (e) {
    if (e instanceof GrantFsError) {
      const map: Record<GrantFsError["code"], string> = {
        outside_root: "outside_grant",
        symlink_escape: "outside_grant",
        policy_denied: "policy_denied",
        not_found: "missing_file",
        not_file: "missing_file",
        too_large: "too_large",
      };
      return {
        outcome: "error",
        summary: `读失败: ${rel} (${e.code})`,
        pins: [],
        relativePaths: [rel],
        detail: e.message,
        errorClass: map[e.code] ?? "io_error",
      };
    }
    return {
      outcome: "error",
      summary: `读失败: ${rel}`,
      pins: [],
      relativePaths: [rel],
      detail: e instanceof Error ? e.message : String(e),
      errorClass: "io_error",
    };
  }
  if (text.includes("\0")) {
    return {
      outcome: "error",
      summary: `二进制文件跳过: ${resolvedRel}`,
      pins: [],
      relativePaths: [resolvedRel],
      detail: "",
      errorClass: "binary",
    };
  }
  const { slice, start, end } = sliceLines(
    text,
    call.input.startLine,
    call.input.endLine,
  );
  const lineCount = text.split(/\r?\n/).length;
  const quote = slice.trim().slice(0, 400);
  // Prefer real revision id when reconcile already indexed this path.
  let revisionId = `path:${resolvedRel}`;
  if (ctx.pathByRevisionId) {
    for (const [revId, p] of ctx.pathByRevisionId) {
      if (p.replace(/\\/g, "/") === resolvedRel) {
        revisionId = revId;
        break;
      }
    }
  }
  const pins: EvidenceAnchor[] = quote
    ? [
        {
          revisionId,
          relativePath: resolvedRel,
          quote: quote.slice(0, 240),
          lastVerifiedAt: new Date().toISOString(),
        },
      ]
    : [];
  return {
    outcome: "ok",
    summary: `已读 ${resolvedRel} L${start}-${end}（共 ${lineCount} 行）`,
    pins,
    relativePaths: [resolvedRel],
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
  const prefix = call.input.pathPrefix
    ? normalizeRel(call.input.pathPrefix)
    : "";
  const hits: string[] = [];
  const relPaths = new Set<string>();
  const gfs = createGrantFileSystem(ctx.grant.rootPath);

  let listed: string[];
  try {
    listed = await gfs.listRelative({ maxDepth: 8, limit: 400 });
  } catch (e) {
    return {
      outcome: "error",
      summary: "search_text 无法列出授权夹",
      pins: [],
      relativePaths: [],
      detail: e instanceof Error ? e.message : String(e),
      errorClass: "missing_root",
    };
  }

  for (const childRel of listed) {
    if (hits.length >= limit) break;
    if (childRel.endsWith("/")) continue;
    if (prefix && !childRel.startsWith(prefix)) continue;
    let content: string;
    try {
      const read = await gfs.readText(childRel);
      content = read.text;
    } catch {
      // policy_denied / symlink_escape / too_large → skip, never raw fs
      continue;
    }
    if (content.includes("\0")) continue;
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

async function toolGitSafe(
  name: ProjectAgentToolCall["name"],
  run: (git: ReturnType<typeof createSafeGitReader>) => Promise<string>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  try {
    const git = createSafeGitReader(ctx.grant.rootPath);
    const text = await run(git);
    return {
      outcome: "ok",
      summary: `git ${name} ok (${text.split("\n").length} lines)`,
      pins: [],
      relativePaths: [],
      detail: truncate(text || "(empty)", ctx.maxResultChars ?? 12_000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorClass =
      e instanceof SafeGitError && e.code === "invalid_ref"
        ? "invalid_git_ref"
        : e instanceof SafeGitError && e.code === "invalid_path"
          ? "invalid_input"
          : "git_error";
    return {
      outcome: "error",
      summary: `git ${name} 失败`,
      pins: [],
      relativePaths: [],
      detail: truncate(msg, 2000),
      errorClass,
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
  const reg = assertToolExecutable(call.name);
  if (!reg.ok) {
    return {
      outcome: "error",
      summary: reg.error,
      pins: [],
      relativePaths: [],
      detail: "",
      errorClass: "unknown_tool",
    };
  }
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
      return toolGitSafe("git_status", (git) => git.statusShort(), ctx);
    case "git_log":
      return toolGitSafe(
        "git_log",
        (git) =>
          git.logOneline(call.input.limit ?? 10, call.input.relativePath),
        ctx,
      );
    case "git_diff":
      return toolGitSafe(
        "git_diff",
        (git) =>
          git.diff(call.input.base, call.input.head, call.input.relativePath),
        ctx,
      );
    case "git_show":
      return toolGitSafe(
        "git_show",
        (git) => git.showStat(call.input.commit, call.input.relativePath),
        ctx,
      );
    case "git_blame":
      return toolGitSafe(
        "git_blame",
        (git) =>
          git.blame(call.input.relativePath, {
            startLine: call.input.startLine,
            endLine: call.input.endLine,
            commit: call.input.commit,
          }),
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
  const parts = n.split("/");
  const depth = Math.max(0, parts.length - 1);
  // Skip hidden / fixture seed noise (same spirit as materialize).
  if (
    parts.some((part) => part.startsWith(".")) ||
    /fixture[-_]?seed/i.test(base)
  ) {
    return 99;
  }
  // Root project entry files beat README files buried in examples/datasets.
  if (/(^|\/)readme(\.|$)/i.test(n)) return depth === 0 ? 0 : 12 + depth;
  if (/(^|\/)todo(\.|$)/i.test(n)) return depth === 0 ? 1 : 11 + depth;
  if (/(^|\/)notes?(\.|$)/i.test(n)) return depth === 0 ? 2 : 11 + depth;
  if (/(^|\/)decisions?(\.|$)/i.test(n) || /decision/i.test(n)) return 3;
  if (n.endsWith(".md")) return 10 + Math.min(depth, 8);
  if (n.endsWith(".txt")) return 15 + Math.min(depth, 8);
  return 40;
}

/** Deterministic first-wave: map → high-signal reads → light search. */
export function planBootstrapToolCalls(input: {
  eventRevisionIds: Array<{ revisionId: string; relativePath: string }>;
  folderHints?: string[];
  ownerUtterance?: string;
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
    if (i > 4) break;
    calls.push({
      id: `t-read-${i}`,
      name: "read_revision",
      input: { revisionId: tip.revisionId, startLine: 1, endLine: 80 },
    });
  }
  // Few high-value searches only (map→search→follow-up read). Owner
  // questions must influence retrieval; otherwise a follow-up about evaluation
  // can accidentally be answered from README alone.
  const utterance = input.ownerUtterance?.trim() ?? "";
  const queries: string[] = [];
  const addQuery = (query: string) => {
    if (query && !queries.includes(query) && queries.length < 4) {
      queries.push(query);
    }
  };
  if (/数据集|dataset/i.test(utterance)) addQuery("数据集");
  if (/评测|测验|测试|验证|evaluation|benchmark/i.test(utterance)) {
    addQuery("评测");
    addQuery("evaluation");
  }
  if (/业务逻辑|业务流程|业务闭环/i.test(utterance)) {
    addQuery("业务流程");
  }
  if (/证据|evidence/i.test(utterance)) addQuery("证据");
  for (const fallback of ["README", "Demo", "下一步", "路演"]) {
    addQuery(fallback);
  }
  for (const q of queries) {
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
  const rankedPaths = [...input.searchRelativePaths]
    .map((path) => path.replace(/\\/g, "/"))
    .filter((path) => scoreDocPath(path) < 99)
    .sort(
      (a, b) => scoreDocPath(a) - scoreDocPath(b) || a.localeCompare(b),
    );
  for (const raw of rankedPaths) {
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
