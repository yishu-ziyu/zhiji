"use client";

/**
 * PR-14 thin hook: projectId selection with AbortController + epoch.
 * Does not own snapshot/cards loading — page keeps those; use token to guard applies.
 */
import { useCallback, useRef, useState } from "react";
import {
  bumpSelectionEpoch,
  createSelectionToken,
  selectionTokenMatches,
  shouldApplyProjectFetch,
  type SelectionToken,
} from "./project-selection";

export type SelectProjectResult = {
  token: SelectionToken;
  signal: AbortSignal;
};

export function useProjectSelection(initialProjectId = "") {
  const [projectId, setProjectId] = useState(initialProjectId);
  const epochRef = useRef(0);
  const projectIdRef = useRef(initialProjectId);
  const abortRef = useRef<AbortController | null>(null);

  const activeToken = useCallback((): SelectionToken => {
    return createSelectionToken(projectIdRef.current, epochRef.current);
  }, []);

  const selectProject = useCallback((nextId: string): SelectProjectResult => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    epochRef.current = bumpSelectionEpoch(epochRef.current);
    projectIdRef.current = nextId;
    setProjectId(nextId);
    return {
      token: createSelectionToken(nextId, epochRef.current),
      signal: controller.signal,
    };
  }, []);

  /**
   * Guard a completed fetch before writing React state.
   */
  const shouldApply = useCallback(
    (token: SelectionToken, options?: { aborted?: boolean }) => {
      const active = activeToken();
      if (!selectionTokenMatches(token, active)) return false;
      return shouldApplyProjectFetch({
        requestedProjectId: token.projectId,
        activeProjectId: active.projectId,
        requestEpoch: token.epoch,
        activeEpoch: active.epoch,
        aborted: options?.aborted ?? false,
      });
    },
    [activeToken],
  );

  return {
    projectId,
    selectProject,
    activeToken,
    shouldApply,
    /** Expose for tests / debugging */
    getEpoch: () => epochRef.current,
  };
}
