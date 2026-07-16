/**
 * Single entry for dual-truth readiness: knowledge project + materials + dialogue.
 * Does not invent canvas nodes; only reports counts/flags.
 */
import { listProjectMaterials } from "@/shared/knowledge/materials";
import {
  getProject,
  listActions,
  listWorkEventsForProject,
} from "@/shared/knowledge/repository";
import { isAgentActor } from "@/shared/knowledge/agent-activity";
import { listDialogueSessions } from "./dialogue-store";
import type { WorkbenchBundle } from "./types";

export function loadWorkbenchBundle(projectId: string): WorkbenchBundle {
  const id = projectId?.trim() ?? "";
  if (!id) {
    return {
      projectId: "",
      projectName: null,
      projectExists: false,
      materialCount: 0,
      workItemCount: 0,
      openWorkItemCount: 0,
      agentEventCount: 0,
      knowledgeReady: false,
      canvasReady: false,
      openDialogueSessions: 0,
    };
  }

  const project = getProject(id);
  const materials = listProjectMaterials(id);
  const actions = listActions({ projectId: id });
  const openWorkItemCount = actions.filter(
    (a) => a.status !== "done" && a.status !== "cancelled",
  ).length;
  let agentEventCount = 0;
  try {
    const events = listWorkEventsForProject(id);
    agentEventCount = events.filter((e) => isAgentActor(e.actor)).length;
  } catch {
    agentEventCount = 0;
  }
  const openDialogueSessions = listDialogueSessions(id).filter(
    (s) => s.status === "open",
  ).length;

  const materialCount = materials.length;
  const workItemCount = actions.length;
  const knowledgeReady = Boolean(project);
  const canvasReady =
    knowledgeReady && (materialCount > 0 || workItemCount > 0);

  return {
    projectId: id,
    projectName: project?.name ?? null,
    projectExists: knowledgeReady,
    materialCount,
    workItemCount,
    openWorkItemCount,
    agentEventCount,
    knowledgeReady,
    canvasReady,
    openDialogueSessions,
  };
}
