import type { ChangeEventView, MemoryResponse } from "./api";

type EventRevisionFields = Pick<
  ChangeEventView,
  "kind" | "beforeRevisionId" | "afterRevisionId"
>;

/**
 * Which exact revision to open for a change event.
 * Deleted events open the pre-delete `beforeRevisionId` (not tombstone after).
 * Other kinds prefer after, then before.
 */
export function revisionIdToOpenForEvent(
  event: EventRevisionFields,
): string | undefined {
  if (event.kind === "deleted") {
    return event.beforeRevisionId || event.afterRevisionId;
  }
  return event.afterRevisionId || event.beforeRevisionId;
}

/** Analysis must use matched matter events, never filtered (non-matching) trace. */
export function eventIdsForMatterAnalysis(
  memory: Pick<MemoryResponse, "events">,
): string[] {
  return memory.events.map((event) => event.id);
}
