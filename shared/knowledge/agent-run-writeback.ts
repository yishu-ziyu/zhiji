/**
 * After folder Agent finishes an analysis run, mirror a durable footprint into
 * the knowledge workbench (work item + timeline event) so the product surface
 * is not "only process panel, zero agent artifacts".
 *
 * Also writes Canvasight-style numbered task cards (01 / 02 …) onto the canvas.
 */
import { createHash } from "node:crypto";
import {
  buildAgentTaskDrafts,
  writeAgentTaskCardsToKnowledge,
} from "@/shared/knowledge/agent-task-cards";
import {
  addAction,
  addWorkEvent,
  getAction,
  getProject,
  listActions,
  patchWorkItem,
} from "@/shared/knowledge/repository";
import { seedWorkItemsFromMaterials } from "@/shared/knowledge/seed-work-items-from-materials";

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
  workItemId: string;
  eventId: string;
  seededWorkItems: number;
  /** Numbered Agent task cards created/updated for the canvas. */
  taskCardsCreated: number;
  taskCardsUpdated: number;
  taskWorkItemIds: string[];
};

function understandingWorkItemId(projectId: string): string {
  const digest = createHash("sha256")
    .update(`agent-understanding\0${projectId}`)
    .digest("hex")
    .slice(0, 20);
  return `agent-u-${digest}`;
}

/**
 * Idempotent: ensures a project-level "Agent 项目理解" work item and appends
 * a result event for this run. Also re-seeds material work items (policy A).
 */
export function writeAgentRunToKnowledge(
  input: AgentRunWritebackInput,
): AgentRunWritebackResult | null {
  const projectId = input.projectId?.trim();
  if (!projectId || !getProject(projectId)) return null;

  const seeded = seedWorkItemsFromMaterials(projectId);

  const workItemId = understandingWorkItemId(projectId);
  const nowText =
    input.nowText?.trim() ||
    "Agent 已读授权夹并整理理解草稿，请在过程面板确认。";
  const nextText =
    input.nextDecisionText?.trim() || "打开过程面板，确认或改写这段理解";

  if (!getAction(workItemId)) {
    try {
      addAction({
        id: workItemId,
        projectId,
        title: "核对 Agent 对项目的理解",
        description: nowText.slice(0, 400),
        nextStep: nextText.slice(0, 200),
        status: "todo",
        assignee: "自己",
        deadline: "待确认",
        verificationCriteria: "确认后，下次打开能看到已接受的理解",
        evidenceIds: [],
      });
    } catch {
      // Race or validation — fall through if another open item exists.
    }
  }

  let targetId = getAction(workItemId)?.id;
  if (!targetId) {
    const open = listActions({ projectId }).find(
      (a) => a.status !== "done" && a.status !== "cancelled",
    );
    targetId = open?.id;
  }
  if (!targetId) return null;

  const toolLine =
    input.toolCalls != null
      ? `工具 ${input.toolCalls} 次` +
        (input.filesRead != null ? ` · 读文件 ${input.filesRead}` : "")
      : "";
  const tools =
    input.toolSummaries && input.toolSummaries.length > 0
      ? `\n工具摘要：\n- ${input.toolSummaries.slice(0, 6).join("\n- ")}`
      : "";

  // Keep legacy understanding work item body fresh for timeline links.
  try {
    if (getAction(workItemId)) {
      patchWorkItem(
        workItemId,
        {
          title: "核对 Agent 对项目的理解",
          description: nowText.slice(0, 500),
          nextStep: nextText.slice(0, 200),
        },
        "agent:folder-reader",
        { projectId },
      );
    }
  } catch {
    /* */
  }

  const event = addWorkEvent(targetId, {
    type: "result",
    actor: "agent:folder-reader",
    body: [
      `当前判断：${nowText}`,
      `建议下一步：${nextText}`,
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
    },
  });

  // Canvasight-style 01/02 task cards from this understanding run.
  const drafts = buildAgentTaskDrafts({
    nowText,
    nextDecisionText: nextText,
    toolSummaries: input.toolSummaries,
    filesRead: input.filesRead,
  });
  const tasks = writeAgentTaskCardsToKnowledge({ projectId, drafts });

  return {
    workItemId: targetId,
    eventId: event.id,
    seededWorkItems: seeded.created,
    taskCardsCreated: tasks.created,
    taskCardsUpdated: tasks.updated,
    taskWorkItemIds: tasks.workItemIds,
  };
}
