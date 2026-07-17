/**
 * After folder Agent finishes an analysis run.
 *
 * Competition contract: WorkSuggestion / nextDecision must NOT auto-create
 * formal Work Items (status=todo). Suggestions live in Brief only until Owner
 * explicitly adopts (adopt button not in this slice — no create path).
 *
 * Still may append a timeline event on an *existing* open work item if one
 * already exists; never seeds materials or agent task cards as new todos.
 */
import {
  addWorkEvent,
  getProject,
  listActions,
} from "@/shared/knowledge/repository";

export type AgentRunWritebackInput = {
  projectId: string;
  runId: string;
  /** Understanding body now / nextDecision text from candidate. */
  nowText?: string;
  nextDecisionText?: string;
  toolSummaries?: string[];
  filesRead?: number;
  toolCalls?: number;
};

export type AgentRunWritebackResult = {
  /** Existing open work item that received a timeline event, if any. */
  workItemId: string | null;
  eventId: string | null;
  /** Always 0 — no auto seed from Agent run. */
  seededWorkItems: number;
  /** Always 0 — nextDecision stays suggestion-only. */
  taskCardsCreated: number;
  taskCardsUpdated: number;
  taskWorkItemIds: string[];
  /** nextDecision kept for Brief consumers; not materialized. */
  suggestionOnly: string | null;
};

/**
 * Idempotent footprint without formal todos:
 * - does not call seedWorkItemsFromMaterials
 * - does not addAction / writeAgentTaskCardsToKnowledge
 * - may attach a result event to an existing non-terminal work item
 */
export function writeAgentRunToKnowledge(
  input: AgentRunWritebackInput,
): AgentRunWritebackResult | null {
  const projectId = input.projectId?.trim();
  if (!projectId || !getProject(projectId)) return null;

  const nowText =
    input.nowText?.trim() ||
    "Agent 已读授权夹并整理理解草稿，请在过程面板确认。";
  const nextText =
    input.nextDecisionText?.trim() || "";
  const suggestionOnly = nextText || null;

  const toolLine =
    input.toolCalls != null
      ? `工具 ${input.toolCalls} 次` +
        (input.filesRead != null ? ` · 读文件 ${input.filesRead}` : "")
      : "";
  const tools =
    input.toolSummaries && input.toolSummaries.length > 0
      ? `\n工具摘要：\n- ${input.toolSummaries.slice(0, 6).join("\n- ")}`
      : "";

  // Prefer existing open user work item for timeline only — never create.
  const open = listActions({ projectId }).find(
    (a) => a.status !== "done" && a.status !== "cancelled",
  );
  let workItemId: string | null = open?.id ?? null;
  let eventId: string | null = null;

  if (workItemId) {
    try {
      const event = addWorkEvent(workItemId, {
        type: "result",
        actor: "agent:folder-reader",
        body: [
          `当前判断：${nowText}`,
          suggestionOnly
            ? `建议下一步（非正式任务）：${suggestionOnly}`
            : "",
          toolLine ? `（${toolLine}）` : "",
          tools,
        ]
          .filter(Boolean)
          .join("\n"),
        meta: {
          runId: input.runId,
          agent: "folder-reader",
          toolCalls: input.toolCalls,
          filesRead: input.filesRead,
          suggestionOnly: true,
        },
      });
      eventId = event.id;
    } catch {
      workItemId = null;
      eventId = null;
    }
  }

  return {
    workItemId,
    eventId,
    seededWorkItems: 0,
    taskCardsCreated: 0,
    taskCardsUpdated: 0,
    taskWorkItemIds: [],
    suggestionOnly,
  };
}
