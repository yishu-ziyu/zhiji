import { describe, expect, it } from "vitest";
import {
  eventIdsForMatterAnalysis,
  revisionIdToOpenForEvent,
} from "@/app/track/knowledge/mvp/lib/event-revision-open";

describe("revisionIdToOpenForEvent", () => {
  it("opens beforeRevisionId for deleted (not tombstone after)", () => {
    expect(
      revisionIdToOpenForEvent({
        kind: "deleted",
        beforeRevisionId: "rev-before-content",
        afterRevisionId: "rev-tombstone-after",
      }),
    ).toBe("rev-before-content");
  });

  it("falls back to after when deleted has no before", () => {
    expect(
      revisionIdToOpenForEvent({
        kind: "deleted",
        afterRevisionId: "rev-only-after",
      }),
    ).toBe("rev-only-after");
  });

  it("prefers after for modified/added/renamed", () => {
    expect(
      revisionIdToOpenForEvent({
        kind: "modified",
        beforeRevisionId: "rev-b",
        afterRevisionId: "rev-a",
      }),
    ).toBe("rev-a");
    expect(
      revisionIdToOpenForEvent({
        kind: "added",
        afterRevisionId: "rev-new",
      }),
    ).toBe("rev-new");
    expect(
      revisionIdToOpenForEvent({
        kind: "renamed",
        beforeRevisionId: "rev-old-path",
        afterRevisionId: "rev-new-path",
      }),
    ).toBe("rev-new-path");
  });
});

describe("eventIdsForMatterAnalysis", () => {
  it("uses matched events, not filteredEvents", () => {
    const memory = {
      events: [{ id: "matched-1" }, { id: "matched-2" }],
      filteredEvents: [{ id: "noise-1" }],
    };
    expect(eventIdsForMatterAnalysis(memory)).toEqual([
      "matched-1",
      "matched-2",
    ]);
    expect(eventIdsForMatterAnalysis(memory)).not.toContain("noise-1");
  });
});
