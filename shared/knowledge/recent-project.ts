import type { ActionItem, Project, WorkEvent } from "@/shared/types/knowledge";

/** Max ISO timestamp among candidates (lexicographic works for ISO-8601). */
export function maxIso(...values: Array<string | undefined | null>): string {
  let best = "";
  for (const value of values) {
    if (value && value > best) best = value;
  }
  return best;
}

/**
 * Activity clock for a project: last open, project update, work item update, or event time.
 * Higher ISO string = more recent.
 */
export function projectActivityAt(
  project: Project & { lastOpenedAt?: string },
  workItems: ActionItem[],
  events: WorkEvent[],
): string {
  const itemIds = new Set(
    workItems.filter((item) => item.projectId === project.id).map((item) => item.id),
  );
  const latestItem = workItems
    .filter((item) => item.projectId === project.id)
    .reduce((acc, item) => maxIso(acc, item.updatedAt), "");
  const latestEvent = events
    .filter((event) => itemIds.has(event.workItemId))
    .reduce((acc, event) => maxIso(acc, event.createdAt), "");
  return maxIso(
    project.lastOpenedAt,
    project.updatedAt,
    latestItem,
    latestEvent,
  );
}

/** Most recently active project first. Stable for equal clocks by id. */
export function rankProjectsByActivity(
  projects: Array<Project & { lastOpenedAt?: string }>,
  workItems: ActionItem[],
  events: WorkEvent[],
): Array<Project & { lastOpenedAt?: string }> {
  return [...projects].sort((a, b) => {
    const aAt = projectActivityAt(a, workItems, events);
    const bAt = projectActivityAt(b, workItems, events);
    if (aAt !== bAt) return bAt.localeCompare(aAt);
    return a.id.localeCompare(b.id);
  });
}

export function pickMostRecentProjectId(
  projects: Array<Project & { lastOpenedAt?: string }>,
  workItems: ActionItem[],
  events: WorkEvent[],
): string | null {
  if (projects.length === 0) return null;
  return rankProjectsByActivity(projects, workItems, events)[0]?.id ?? null;
}
