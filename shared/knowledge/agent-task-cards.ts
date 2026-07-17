/**
 * Agent → numbered work cards (Canvasight-style "01 / 02" task nodes).
 * Pure builders + renumber helpers used by seed + agent-run writeback.
 */
import { createHash } from "node:crypto";
import type { ActionItem } from "@/shared/types/knowledge";
import { listActions, patchWorkItem } from "@/shared/knowledge/repository";

export type AgentTaskDraft = {
  /** Stable key within project (not full id). */
  key: string;
  title: string;
  description: string;
  nextStep: string;
  evidenceIds?: string[];
};

/** Strip leading "01 " style prefixes for re-numbering. */
export function stripTaskNumberPrefix(title: string): string {
  return title.replace(/^\s*\d{1,2}[\s.、.．:：\-–—]+/, "").trim();
}

/** Canvasight-style "01 任务标题". */
export function numberedTaskTitle(index: number, title: string): string {
  const bare = stripTaskNumberPrefix(title) || "未命名任务";
  const n = String(Math.max(1, index)).padStart(2, "0");
  return `${n} ${bare}`;
}

export function agentTaskWorkItemId(projectId: string, key: string): string {
  const digest = createHash("sha256")
    .update(`agent-task\0${projectId}\0${key}`)
    .digest("hex")
    .slice(0, 20);
  return `agent-t-${digest}`;
}

/**
 * From Agent understanding text, build 1–5 task drafts for the canvas.
 * Always includes a primary "核对理解" card.
 */
export function buildAgentTaskDrafts(input: {
  nowText?: string;
  nextDecisionText?: string;
  toolSummaries?: string[];
  filesRead?: number;
}): AgentTaskDraft[] {
  const nowText =
    input.nowText?.trim() ||
    "Agent 已读授权夹并整理理解草稿，请确认。";
  const nextText =
    input.nextDecisionText?.trim() || "打开过程面板，确认或改写这段理解";

  const drafts: AgentTaskDraft[] = [
    {
      key: "understanding",
      title: "核对 Agent 对项目的理解",
      description: nowText.slice(0, 500),
      nextStep: nextText.slice(0, 200),
    },
  ];

  // Next-decision lines that look like actions.
  const nextLines = nextText
    .split(/[\n;；。]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6 && s.length <= 80)
    .filter((s) => /确认|核对|推进|完成|阅读|打开|决定|下一步|TODO|要做/i.test(s));

  for (const line of nextLines.slice(0, 2)) {
    drafts.push({
      key: `next:${line.slice(0, 40)}`,
      title: stripTaskNumberPrefix(line).slice(0, 48),
      description: `来自 Agent 建议下一步：${line}`,
      nextStep: line.slice(0, 200),
    });
  }

  // Files read → review tasks (from tool summaries).
  const fileNames = new Set<string>();
  for (const summary of input.toolSummaries ?? []) {
    for (const m of summary.matchAll(
      /(?:已读|打开)\s*([A-Za-z0-9_.\-\u4e00-\u9fff/]+\.[A-Za-z0-9]{1,8})/g,
    )) {
      const base = m[1]!.split(/[/\\]/).pop();
      if (base && !/package-lock|pnpm-lock|\.map$/i.test(base)) {
        fileNames.add(base);
      }
    }
  }
  let fileIdx = 0;
  for (const name of fileNames) {
    if (drafts.length >= 5) break;
    fileIdx += 1;
    drafts.push({
      key: `file:${name}`,
      title: `跟进「${name}」中的关键结论`,
      description: `Agent 已精读 ${name}；把与当前局面相关的结论标成下一步。`,
      nextStep: `打开 ${name}，写下是否影响当前重点`,
    });
    if (fileIdx >= 2) break;
  }

  // Deduplicate by bare title
  const seen = new Set<string>();
  return drafts.filter((d) => {
    const k = stripTaskNumberPrefix(d.title).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Renumber open (non-terminal) work items as 01, 02, … for canvas display.
 * Stable sort: agent-t / agent-u first, then seed-, then others by updatedAt.
 */
export function renumberOpenWorkTitles(projectId: string): ActionItem[] {
  const open = listActions({ projectId }).filter(
    (a) => a.status !== "done" && a.status !== "cancelled",
  );
  const rank = (a: ActionItem) => {
    if (a.id.startsWith("agent-t-") || a.id.startsWith("agent-u-")) return 0;
    if (a.id.startsWith("seed-")) return 1;
    return 2;
  };
  open.sort((a, b) => {
    const ra = rank(a) - rank(b);
    if (ra !== 0) return ra;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const updated: ActionItem[] = [];
  open.forEach((item, index) => {
    const nextTitle = numberedTaskTitle(index + 1, item.title);
    if (nextTitle === item.title) {
      updated.push(item);
      return;
    }
    try {
      const patched = patchWorkItem(item.id, { title: nextTitle }, "system", {
        projectId,
      });
      updated.push(patched);
    } catch {
      updated.push(item);
    }
  });
  return updated;
}

/**
 * Competition contract: do NOT auto-create formal Work Items from Agent drafts.
 * Drafts remain pure builders for future explicit Owner adopt.
 * Existing agent-t-* items are not deleted; no new addAction.
 */
export function writeAgentTaskCardsToKnowledge(input: {
  projectId: string;
  drafts: AgentTaskDraft[];
}): { workItemIds: string[]; created: number; updated: number } {
  const projectId = input.projectId?.trim();
  if (!projectId) return { workItemIds: [], created: 0, updated: 0 };

  // Stable ids for observability only — never materialize as todo.
  const workItemIds = input.drafts
    .slice(0, 5)
    .map((draft) => agentTaskWorkItemId(projectId, draft.key));

  return { workItemIds, created: 0, updated: 0 };
}
