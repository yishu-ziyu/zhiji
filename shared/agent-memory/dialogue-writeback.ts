/**
 * Mirror meaningful dialogue milestones into knowledge work events (feed).
 * Does not touch Project Memory understanding heads.
 */
import { createHash } from "node:crypto";
import {
  addAction,
  addWorkEvent,
  getAction,
  getProject,
} from "@/shared/knowledge/repository";
import type { DialogueMessage } from "./types";

export type DialogueWritebackResult = {
  workItemId: string;
  eventId: string;
};

function dialogueWorkItemId(projectId: string): string {
  const digest = createHash("sha256")
    .update(`agent-dialogue\0${projectId}`)
    .digest("hex")
    .slice(0, 20);
  return `agent-d-${digest}`;
}

/**
 * Write an agent milestone message into the knowledge feed.
 * No-op when project missing or message is not an agent milestone.
 */
export function writeDialogueMilestoneToKnowledge(
  message: DialogueMessage,
): DialogueWritebackResult | null {
  if (message.role !== "agent") return null;
  if (message.milestone !== true) return null;
  const projectId = message.projectId?.trim();
  if (!projectId || !getProject(projectId)) return null;

  const workItemId = dialogueWorkItemId(projectId);
  const body = message.content.trim().slice(0, 800);
  if (!body) return null;

  if (!getAction(workItemId)) {
    try {
      addAction({
        id: workItemId,
        projectId,
        title: "与 Agent 的对话纪要",
        description: body.slice(0, 400),
        nextStep: "继续在工作台对话或确认项目理解",
        status: "todo",
        assignee: "自己",
        deadline: "进行中",
        verificationCriteria: "对话要点出现在右侧 Agent 动态",
        evidenceIds: [],
      });
    } catch {
      // Only the fixed dialogue work item may receive feed events.
      return null;
    }
  }

  const target = getAction(workItemId);
  if (!target || target.projectId !== projectId) return null;

  const event = addWorkEvent(workItemId, {
    type: "result",
    actor: "agent:dialogue",
    body,
    meta: {
      dialogueMessageId: message.id,
      sessionId: message.sessionId,
      analysisRunId: message.analysisRunId,
    },
  });

  return { workItemId, eventId: event.id };
}
