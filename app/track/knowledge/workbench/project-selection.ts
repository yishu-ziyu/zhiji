/**
 * PR-14: project selection + fetch staleness seams (pure).
 * Switching projectId must drop late responses for the previous project.
 */

export type ProjectResource =
  | "snapshot"
  | "cards"
  | "materials"
  | "work"
  | "footprint"
  | "search";

/** TanStack-style query key (usable even without QueryClient yet). */
export function projectResourceQueryKey(
  projectId: string,
  resource: ProjectResource,
): readonly ["knowledge", "project", string, ProjectResource] {
  return ["knowledge", "project", projectId, resource] as const;
}

export type ProjectFetchGuardInput = {
  requestedProjectId: string;
  activeProjectId: string;
  /** Monotonic epoch captured when the request started */
  requestEpoch: number;
  /** Latest epoch for this resource (or selection) */
  activeEpoch: number;
  /** AbortController signal aborted? */
  aborted?: boolean;
};

/**
 * True only when this response still belongs to the active project & epoch.
 * Late arrivals after project switch → false (do not overwrite UI state).
 */
export function shouldApplyProjectFetch(
  input: ProjectFetchGuardInput,
): boolean {
  if (input.aborted) return false;
  if (!input.requestedProjectId || !input.activeProjectId) return false;
  if (input.requestedProjectId !== input.activeProjectId) return false;
  if (input.requestEpoch !== input.activeEpoch) return false;
  return true;
}

export function bumpSelectionEpoch(prev: number): number {
  return prev + 1;
}

/**
 * After select(projectId), pair epoch + project for in-flight guards.
 */
export type SelectionToken = {
  projectId: string;
  epoch: number;
};

export function createSelectionToken(
  projectId: string,
  epoch: number,
): SelectionToken {
  return { projectId, epoch };
}

export function selectionTokenMatches(
  token: SelectionToken,
  active: SelectionToken,
): boolean {
  return (
    token.projectId === active.projectId && token.epoch === active.epoch
  );
}
