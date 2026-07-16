import { describe, expect, it } from "vitest";
import { runViewEventFingerprint } from "./agent-run-events";
import type { AgentRunView } from "./types";

function view(): AgentRunView {
  return {
    run: {
      id: "r1",
      projectId: "p1",
      matterId: "m1",
      trigger: "owner_question",
      eventIds: [],
      status: "running",
      attempt: 1,
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
      progressSummary: "正在搜索",
    },
    toolReceipts: [],
  };
}

describe("run SSE event fingerprint", () => {
  it("changes when a real tool receipt arrives even if run status stays running", () => {
    const before = view();
    const after = view();
    after.toolReceipts.push({
      id: "tr1",
      runId: "r1",
      sequence: 1,
      tool: "search_text",
      projectId: "p1",
      grantId: "g1",
      scope: { mode: "matter", relativePaths: [], reason: "Owner question" },
      outcome: "ok",
      summary: "找到 2 处",
      pins: [],
      startedAt: "2026-07-17T00:00:01.000Z",
      finishedAt: "2026-07-17T00:00:02.000Z",
    });

    expect(after.run.status).toBe(before.run.status);
    expect(runViewEventFingerprint(after)).not.toBe(
      runViewEventFingerprint(before),
    );
  });
});
