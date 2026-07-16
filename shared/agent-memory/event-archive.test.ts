import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Event archive / compress", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "event-arch-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    const a = await import("./event-archive");
    a.resetEventArchivesForTests();
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("archives older events, keeps recent, preserves evidence ids", async () => {
    const arch = await import("./event-archive");
    arch.resetEventArchivesForTests();
    const events = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      projectId: "p1",
      observedAt: `2026-07-0${i + 1}T10:00:00.000Z`,
      relativePath: i < 4 ? "old/a.md" : "new/b.md",
      kind: "modified" as const,
    }));

    const plan = arch.planEventArchive(events, { retainCount: 3 });
    expect(plan.retain).toHaveLength(3);
    expect(plan.archive).toHaveLength(5);
    expect(plan.summary.archivedEventIds).toEqual([
      "e0",
      "e1",
      "e2",
      "e3",
      "e4",
    ]);
    expect(plan.summary.text).toMatch(/归档/);

    const record = arch.applyEventArchive({
      projectId: "p1",
      events,
      plan,
    });
    expect(record).toBeTruthy();
    expect(record!.eventIds).toContain("e0");

    const active = arch.filterActiveEvents("p1", events);
    expect(active.map((e) => e.id)).toEqual(["e5", "e6", "e7"]);

    const recovered = arch.findArchivedEventPayload("p1", "e2");
    expect(recovered?.relativePath).toBe("old/a.md");
    expect(arch.findArchivedEventPayload("p1", "e7")).toBeNull();
  });
});
