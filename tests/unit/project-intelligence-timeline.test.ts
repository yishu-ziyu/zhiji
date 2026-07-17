import { describe, expect, it } from "vitest";
import {
  buildProjectIntelligenceTimeline,
  selectNewIncrementalChanges,
} from "@/app/track/knowledge/lib/project-intelligence-timeline";
import type { ChangeEventView } from "@/app/track/knowledge/lib/folder-connection-api";

const added: ChangeEventView = {
  id: "event-added",
  projectId: "project-1",
  grantId: "grant-1",
  kind: "added",
  relativePath: "与本项目无关的旅行清单.md",
  afterRevisionId: "orev:travel",
  observedAt: "2026-07-17T08:00:00.000Z",
  dedupeKey: "watch:grant-1:added:travel",
  matched: true,
};

describe("project intelligence timeline", () => {
  it("selects only unseen incremental changes", () => {
    const reconciled: ChangeEventView = {
      ...added,
      id: "event-reconciled",
      kind: "reconciled",
    };
    const seen: ChangeEventView = { ...added, id: "event-seen" };

    expect(
      selectNewIncrementalChanges(
        [reconciled, seen, added],
        new Set(["event-seen"]),
      ),
    ).toEqual([added]);
  });

  it("archives the complete change → Agent → Owner chain after every Claim is resolved", () => {
    const events = buildProjectIntelligenceTimeline({
      projectId: "project-1",
      changes: [added],
      candidate: {
        id: "candidate-1",
        projectId: "project-1",
        matterId: "matter-1",
        kind: "candidate",
        body: {
          now: {
            text: "这份旅行清单与当前项目目标无关，建议移出项目夹。",
            evidence: [],
            gaps: [],
            conflicts: [],
          },
          then: {
            text: "此前项目材料与目标一致。",
            at: "2026-07-17T07:50:00.000Z",
            evidence: [],
            gaps: [],
            conflicts: [],
          },
          changed: [],
          why: [],
          depends: [],
          evidenceRevisionIds: ["orev:travel"],
          nextDecision: "是否把旅行清单移出项目夹？",
        },
        basedOnEventIds: [added.id],
        proposedBy: "agent",
        createdAt: "2026-07-17T08:00:10.000Z",
      },
      run: {
        id: "run-1",
        status: "awaiting_owner",
        eventIds: [added.id],
        candidateRevisionId: "candidate-1",
        createdAt: "2026-07-17T08:00:01.000Z",
        updatedAt: "2026-07-17T08:00:10.000Z",
      },
      claims: [
        {
          id: "claim-1",
          projectId: "project-1",
          text: "旅行清单与项目无关",
          status: "supported",
          linkIds: [],
          createdAt: "2026-07-17T08:00:10.000Z",
        },
      ],
      resolutions: [
        {
          id: "resolution-1",
          projectId: "project-1",
          claimId: "claim-1",
          decision: "defer",
          resolvedAt: "2026-07-17T08:00:20.000Z",
        },
      ],
    });

    expect(events.map((event) => event.body)).toEqual([
      "发现新材料：与本项目无关的旅行清单.md",
      "这份旅行清单与当前项目目标无关，建议移出项目夹。",
      "已暂缓：旅行清单与项目无关",
    ]);
    expect(events.every((event) => event.ref.id === "project-1")).toBe(true);
    expect(events.every((event) => event.phase === "history")).toBe(true);
  });

  it("keeps the chain in current work until every Claim has an Owner decision", () => {
    const events = buildProjectIntelligenceTimeline({
      projectId: "project-1",
      changes: [added],
      candidate: {
        id: "candidate-1",
        projectId: "project-1",
        matterId: "matter-1",
        kind: "candidate",
        body: {
          now: {
            text: "旅行清单仍待 Owner 判断。",
            evidence: [],
            gaps: [],
            conflicts: [],
          },
          then: {
            text: "此前项目材料与目标一致。",
            at: "2026-07-17T07:50:00.000Z",
            evidence: [],
            gaps: [],
            conflicts: [],
          },
          changed: [],
          why: [],
          depends: [],
          evidenceRevisionIds: ["orev:travel"],
          nextDecision: "是否把旅行清单移出项目夹？",
        },
        basedOnEventIds: [added.id],
        proposedBy: "agent",
        createdAt: "2026-07-17T08:00:10.000Z",
      },
      run: {
        id: "run-1",
        status: "awaiting_owner",
        eventIds: [added.id],
        candidateRevisionId: "candidate-1",
        createdAt: "2026-07-17T08:00:01.000Z",
        updatedAt: "2026-07-17T08:00:10.000Z",
      },
      claims: [
        {
          id: "claim-1",
          projectId: "project-1",
          text: "旅行清单与项目无关",
          status: "supported",
          linkIds: [],
          createdAt: "2026-07-17T08:00:10.000Z",
        },
        {
          id: "claim-2",
          projectId: "project-1",
          text: "建议移出项目夹",
          status: "unknown",
          linkIds: [],
          createdAt: "2026-07-17T08:00:10.000Z",
        },
      ],
      resolutions: [
        {
          id: "resolution-1",
          projectId: "project-1",
          claimId: "claim-1",
          decision: "defer",
          resolvedAt: "2026-07-17T08:00:20.000Z",
        },
      ],
    });

    expect(events.every((event) => event.phase === "now")).toBe(true);
  });

  it("does not project a failed run as an Agent result", () => {
    const events = buildProjectIntelligenceTimeline({
      projectId: "project-1",
      changes: [added],
      candidate: {
        id: "stale-candidate",
        projectId: "project-1",
        matterId: "matter-1",
        kind: "candidate",
        body: {
          now: { text: "旧判断", evidence: [], gaps: [], conflicts: [] },
          then: {
            text: "旧判断",
            at: "2026-07-17T07:00:00.000Z",
            evidence: [],
            gaps: [],
            conflicts: [],
          },
          changed: [],
          why: [],
          depends: [],
          evidenceRevisionIds: [],
          nextDecision: "旧建议",
        },
        basedOnEventIds: ["old-event"],
        proposedBy: "agent",
        createdAt: "2026-07-17T07:00:00.000Z",
      },
      run: {
        id: "run-failed",
        status: "failed",
        eventIds: [added.id],
        createdAt: "2026-07-17T08:00:01.000Z",
        updatedAt: "2026-07-17T08:00:10.000Z",
      },
      claims: [],
      resolutions: [],
    });

    expect(events.map((event) => event.body)).toEqual([
      "发现新材料：与本项目无关的旅行清单.md",
    ]);
  });
});
