/**
 * Mirror meaningful dialogue milestones into knowledge work events (feed).
 * Does not touch Project Memory understanding heads.
 *
 * Competition contract: never auto-create formal Work Items (todo).
 * Only appends events when an existing open work item is already present.
 */
import {
  addWorkEvent,
  getProject,
  listActions,
} from "@/shared/knowledge/repository";
import type { DialogueMessage } from "./types";

export type DialogueWritebackResult = {
  workItemId: string;
  eventId: string;
  createdWorkItem: false;
};

/**
 * Write an agent milestone message into an *existing* knowledge work item feed.
 * Returns null when no suitable work item exists (does not create todos).
 */
export function writeDialogueMilestoneToKnowledge(
  message: DialogueMessage,
): DialogueWritebackResult | null {
  if (message.role !== "agent") return null;
  if (message.milestone !== true) return null;
  const projectId = message.projectId?.trim();
  if (!projectId || !getProject(projectId)) return null;

  const body = message.content.trim().slice(0, 800);
  if (!body) return null;

  // Prefer any existing open work item — never addAction.
  const open = listActions({ projectId }).find(
    (a) => a.status !== "done" && a.status !== "cancelled",
  );
  if (!open) return null;

  const event = addWorkEvent(open.id, {
    type: "result",
    actor: "agent:dialogue",
    body,
    meta: {
      dialogueMessageId: message.id,
      sessionId: message.sessionId,
      analysisRunId: message.analysisRunId,
      suggestionOnly: true,
    },
  });

  return { workItemId: open.id, eventId: event.id, createdWorkItem: false };
}
