/**
 * Bridge folder-Agent tool receipts → canvas node phases + Live Feed rows.
 * Canvasight-style: center graph lights up as Agent maps/searches/reads.
 */

export type AgentToolReceiptLike = {
  sequence: number;
  tool: string;
  outcome: string;
  summary: string;
};

export type AgentNodePhase =
  | "idle"
  | "mapped"
  | "searched"
  | "reading"
  | "done";

export type LiveFeedRow = {
  id: string;
  source: "tool" | "activity";
  tool?: string;
  title: string;
  body: string;
  outcome?: string;
  /** ISO or empty */
  at?: string;
  live?: boolean;
};

const TOOL_TITLE: Record<string, string> = {
  project_map: "摸清结构",
  search_text: "搜索材料",
  search_symbols: "搜符号",
  read_revision: "精读文件",
  read_path: "打开文件",
  query_project_memory: "查项目记忆",
  set_canvas_view: "调整画布",
  git_status: "git 状态",
  git_log: "git 日志",
};

export function toolTitle(tool: string): string {
  return TOOL_TITLE[tool] ?? tool;
}

/** Basename-ish tokens from a receipt summary for matching canvas labels. */
export function pathHintsFromSummary(summary: string): string[] {
  const text = summary || "";
  const hints = new Set<string>();
  // Paths with extensions
  for (const m of text.matchAll(
    /([A-Za-z0-9_.\-\u4e00-\u9fff]+\/)*[A-Za-z0-9_.\-\u4e00-\u9fff]+\.[A-Za-z0-9]{1,8}/g,
  )) {
    const full = m[0]!.replace(/\\/g, "/");
    hints.add(full.toLowerCase());
    const base = full.split("/").pop();
    if (base) hints.add(base.toLowerCase());
  }
  // Chinese or plain tokens after 已读 / 打开
  for (const m of text.matchAll(
    /(?:已读|打开|读到|命中)\s*[「『"]?([^\s」』"'，。,.]{2,48})/g,
  )) {
    const t = m[1]!.toLowerCase();
    hints.add(t);
    const base = t.split("/").pop();
    if (base) hints.add(base);
  }
  return [...hints];
}

function nodeMatchTokens(label: string): string[] {
  const raw = (label || "").trim().toLowerCase();
  if (!raw) return [];
  const base = (raw.split(/[/\\]/).pop() ?? raw).trim();
  const out = new Set<string>([raw, base]);
  // strip extension for soft match
  const noExt = base.replace(/\.[a-z0-9]{1,8}$/i, "");
  if (noExt) out.add(noExt);
  return [...out];
}

export function receiptTouchesNode(
  receipt: AgentToolReceiptLike,
  nodeLabel: string,
): boolean {
  const hints = pathHintsFromSummary(receipt.summary);
  if (hints.length === 0) return false;
  const tokens = nodeMatchTokens(nodeLabel);
  return tokens.some((t) => hints.some((h) => h.includes(t) || t.includes(h)));
}

/**
 * Phase for a canvas node given live tool receipts.
 * Project center reflects map; material nodes reflect search/read.
 */
export function deriveNodeAgentPhase(input: {
  nodeKind: string;
  nodeLabel: string;
  toolReceipts: AgentToolReceiptLike[];
  runStatus?: string | null;
}): AgentNodePhase {
  const receipts = input.toolReceipts ?? [];
  const running =
    input.runStatus === "running" || input.runStatus === "queued";
  const finished =
    input.runStatus === "awaiting_owner" ||
    input.runStatus === "completed" ||
    input.runStatus === "failed";

  if (input.nodeKind === "agent") {
    if (running) return "reading";
    if (finished) return "done";
    return receipts.length > 0 ? "done" : "idle";
  }

  if (input.nodeKind === "project") {
    const hasMap = receipts.some(
      (r) => r.tool === "project_map" && r.outcome === "ok",
    );
    if (!hasMap) return "idle";
    if (running) return "mapped";
    return finished ? "done" : "mapped";
  }

  const touching = receipts.filter((r) =>
    receiptTouchesNode(r, input.nodeLabel),
  );
  if (touching.length === 0) return "idle";

  const hasRead = touching.some(
    (r) =>
      (r.tool === "read_revision" || r.tool === "read_path") &&
      r.outcome === "ok",
  );
  if (hasRead) return running ? "reading" : "done";

  const hasSearch = touching.some(
    (r) =>
      (r.tool === "search_text" || r.tool === "search_symbols") &&
      r.outcome === "ok",
  );
  if (hasSearch) return running ? "searched" : "searched";

  return "idle";
}

export function buildLiveFeedFromReceipts(
  receipts: AgentToolReceiptLike[],
  options?: { runStatus?: string | null; progressSummary?: string | null },
): LiveFeedRow[] {
  const sorted = [...receipts].sort((a, b) => a.sequence - b.sequence);
  const running =
    options?.runStatus === "running" || options?.runStatus === "queued";
  const rows: LiveFeedRow[] = sorted.map((r, index) => {
    const isLast = index === sorted.length - 1;
    return {
      id: `tool:${r.sequence}:${r.tool}`,
      source: "tool",
      tool: r.tool,
      title: toolTitle(r.tool),
      body: r.summary,
      outcome: r.outcome,
      live: running && isLast,
    };
  });
  if (options?.progressSummary?.trim() && running) {
    rows.push({
      id: "run:progress",
      source: "tool",
      title: "进度",
      body: options.progressSummary.trim(),
      live: true,
    });
  }
  return rows.slice(-16);
}

export function mergeLiveFeed(input: {
  toolReceipts: AgentToolReceiptLike[];
  runStatus?: string | null;
  progressSummary?: string | null;
  activityFeed?: Array<{
    id: string;
    actorLabel: string;
    body: string;
    createdAt: string;
    kind?: string;
  }>;
}): LiveFeedRow[] {
  const fromTools = buildLiveFeedFromReceipts(input.toolReceipts, {
    runStatus: input.runStatus,
    progressSummary: input.progressSummary,
  });
  const fromActivity = (input.activityFeed ?? []).map((item) => ({
    id: `activity:${item.id}`,
    source: "activity" as const,
    title: item.actorLabel,
    body: item.body,
    at: item.createdAt,
  }));
  // Tools first (most recent agent work), then historical activity.
  const merged = [...fromTools, ...fromActivity];
  const seen = new Set<string>();
  return merged.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/** Highlight node ids (ref keys) currently touched by Agent reads/searches. */
export function highlightIdsFromReceipts(
  nodes: Array<{ ref: { kind: string; id: string }; label: string }>,
  toolReceipts: AgentToolReceiptLike[],
  runStatus?: string | null,
): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    const phase = deriveNodeAgentPhase({
      nodeKind: node.ref.kind,
      nodeLabel: node.label,
      toolReceipts,
      runStatus,
    });
    if (phase !== "idle") {
      out.push(`${node.ref.kind}:${node.ref.id}`);
    }
  }
  return out;
}
