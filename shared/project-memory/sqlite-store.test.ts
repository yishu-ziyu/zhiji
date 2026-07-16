import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContentAddressedStore, sha256Hex } from "./cas";
import { assertAgentServiceShape } from "./reducer";
import { SqliteProjectMemoryStore } from "./sqlite-store";
import type { AnalysisRun, UnderstandingBody } from "./types";

function bodyFor(
  revisionId: string,
  relativePath = "SPEC.md",
  quote = "spec v1",
): UnderstandingBody {
  return {
    now: {
      text: "we understand",
      evidence: [
        {
          revisionId,
          relativePath,
          quote,
          lastVerifiedAt: "2026-07-16T13:00:00.000Z",
        },
      ],
      gaps: [],
      conflicts: [],
    },
    then: {
      text: "empty",
      at: "2026-07-01T00:00:00.000Z",
      evidence: [],
      gaps: ["no prior"],
      conflicts: [],
    },
    changed: [
      {
        before: "",
        after: "file present",
        eventIds: [],
        evidence: [
          {
            revisionId,
            relativePath,
            quote,
            lastVerifiedAt: "2026-07-16T13:00:00.000Z",
          },
        ],
      },
    ],
    why: [
      {
        text: "file content states scope",
        status: "supported",
        evidence: [
          {
            revisionId,
            relativePath,
            quote,
            lastVerifiedAt: "2026-07-16T13:00:00.000Z",
          },
        ],
      },
    ],
    depends: [],
    evidenceRevisionIds: [revisionId],
    nextDecision: "confirm",
  };
}

describe("project-memory sqlite-store + CAS (amended contract)", () => {
  let tmp: string;
  let store: SqliteProjectMemoryStore;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-mvp-"));
    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    store.upsertGrant({
      id: "g1",
      projectId: "p1",
      kind: "local_folder",
      rootPath: "/tmp/fixture-project",
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    store.upsertMatter({
      id: "m1",
      projectId: "p1",
      title: "MVP matter",
      goal: "remember state",
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    store.upsertWatchSet({
      id: "w1",
      projectId: "p1",
      matterId: "m1",
      grantId: "g1",
      includePathPrefixes: ["docs/"],
      excludePathPrefixes: [],
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("modify creates new revision/event; same bytes are idempotent", async () => {
    const v1 = new TextEncoder().encode("hello v1");
    const first = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "README.md",
      content: v1,
      observedAt: "2026-07-16T10:00:00.000Z",
    });
    expect(first.revision!.sha256).toBe(sha256Hex(v1));

    const v2 = new TextEncoder().encode("hello v2");
    const second = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "README.md",
      content: v2,
      observedAt: "2026-07-16T10:01:00.000Z",
    });
    expect(second.event?.kind).toBe("modified");
    expect(second.event!.beforeRevisionId).toBe(first.revision!.id);

    const again = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "README.md",
      content: v2,
      observedAt: "2026-07-16T10:02:00.000Z",
    });
    if (again.event) {
      expect(again.event.id).toBe(second.event!.id);
    } else {
      expect(again.revision!.id).toBe(second.revision!.id);
    }
    const events = await store.listEvents("p1");
    expect(events.filter((e) => e.relativePath === "README.md")).toHaveLength(2);
  });

  it("delete keeps last blob + tombstone; restart can still read prior bytes", async () => {
    const bytes = new TextEncoder().encode("delete-me content");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "notes.txt",
      content: bytes,
      observedAt: "2026-07-16T11:00:00.000Z",
    });
    const del = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "deleted",
      relativePath: "notes.txt",
      observedAt: "2026-07-16T11:01:00.000Z",
    });
    expect(del.revision?.tombstone).toBe(true);
    const prior = await store.readRevision(add.revision!.id);
    expect(new TextDecoder().decode(prior!)).toBe("delete-me content");

    store.close();
    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    const again = await store.readRevision(add.revision!.id);
    expect(new TextDecoder().decode(again!)).toBe("delete-me content");
  });

  it("CAS write failure leaves no orphan revision/event in SQLite", async () => {
    const brokenCas = new ContentAddressedStore(path.join(tmp, "cas-broken"));
    brokenCas.put = () => {
      throw new Error("simulated CAS disk full");
    };
    store.close();
    store = new SqliteProjectMemoryStore({ dataDir: tmp, cas: brokenCas });
    store.upsertGrant({
      id: "g1",
      projectId: "p1",
      kind: "local_folder",
      rootPath: "/tmp/fixture-project",
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });

    await expect(
      store.ingest({
        projectId: "p1",
        grantId: "g1",
        kind: "added",
        relativePath: "fail.txt",
        content: new TextEncoder().encode("x"),
        observedAt: "2026-07-16T12:00:00.000Z",
      }),
    ).rejects.toThrow(/CAS disk full/);

    store.close();
    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    const events = await store.listEvents("p1");
    expect(events.some((e) => e.relativePath === "fail.txt")).toBe(false);
  });

  it("accept inserts new accepted revision; candidate row never UPDATEd", async () => {
    const v1 = new TextEncoder().encode("spec v1");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "SPEC.md",
      content: v1,
      observedAt: "2026-07-16T13:00:00.000Z",
    });

    const run: AnalysisRun = {
      id: "run1",
      projectId: "p1",
      matterId: "m1",
      trigger: "source_change",
      eventIds: [add.event!.id],
      status: "queued",
      attempt: 1,
      createdAt: "2026-07-16T13:01:00.000Z",
      updatedAt: "2026-07-16T13:01:00.000Z",
    };
    const cand = await store.saveCandidate(run, bodyFor(add.revision!.id));
    expect(cand.kind).toBe("candidate");
    const candBodySnap = JSON.stringify(cand.body);

    const result = await store.resolveCandidate({
      id: "res1",
      candidateRevisionId: cand.id,
      decision: "accept",
      actor: "owner",
      createdAt: "2026-07-16T13:02:00.000Z",
    });

    expect(result.accepted?.kind).toBe("accepted");
    expect(result.accepted?.id).not.toBe(cand.id);
    expect(result.head.acceptedRevisionId).toBe(result.accepted!.id);
    expect(result.head.reviewState).toBe("current");
    expect(result.resolution.acceptedRevisionId).toBe(result.accepted!.id);

    const state = await store.getMatterState("p1", "m1");
    expect(state.candidate?.id).toBe(cand.id);
    expect(state.candidate?.kind).toBe("candidate");
    expect(JSON.stringify(state.candidate!.body)).toBe(candBodySnap);
    expect(state.accepted?.id).toBe(result.accepted!.id);
  });

  it("evidence change marks head review_needed only; accepted revision immutable", async () => {
    const v1 = new TextEncoder().encode("spec v1");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "SPEC.md",
      content: v1,
      observedAt: "2026-07-16T13:00:00.000Z",
    });
    const cand = await store.saveCandidate(
      {
        id: "run2",
        projectId: "p1",
        matterId: "m1",
        trigger: "source_change",
        eventIds: [add.event!.id],
        status: "queued",
        attempt: 1,
        createdAt: "2026-07-16T13:01:00.000Z",
        updatedAt: "2026-07-16T13:01:00.000Z",
      },
      bodyFor(add.revision!.id),
    );
    const { accepted } = await store.resolveCandidate({
      id: "res2",
      candidateRevisionId: cand.id,
      decision: "accept",
      actor: "owner",
      createdAt: "2026-07-16T13:02:00.000Z",
    });
    const acceptedBody = JSON.stringify(accepted!.body);

    await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "SPEC.md",
      content: new TextEncoder().encode("spec v2"),
      observedAt: "2026-07-16T13:03:00.000Z",
    });

    const state = await store.getMatterState("p1", "m1");
    expect(state.head.reviewState).toBe("review_needed");
    expect(state.head.acceptedRevisionId).toBe(accepted!.id);
    expect(state.accepted?.id).toBe(accepted!.id);
    expect(JSON.stringify(state.accepted!.body)).toBe(acceptedBody);
    expect(state.accepted!.kind).toBe("accepted");

    const oldBytes = await store.readRevision(add.revision!.id);
    expect(new TextDecoder().decode(oldBytes!)).toBe("spec v1");
  });

  it("Agent service has Reader+CandidateWriter only; cannot resolve", async () => {
    const agent = store.asAgentMemoryService();
    assertAgentServiceShape(agent);
    expect("resolveCandidate" in agent).toBe(false);
    expect("resolve" in agent).toBe(false);
    expect(typeof agent.saveCandidate).toBe("function");
    expect(typeof agent.readRevision).toBe("function");
    // Type-level: agent is not OwnerDecisionWriter
    expect(store.asAgentMemoryService()).not.toHaveProperty("resolveCandidate");
  });

  it("non-owner actor cannot resolveCandidate", async () => {
    const v1 = new TextEncoder().encode("x");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "a.md",
      content: v1,
      observedAt: "2026-07-16T14:00:00.000Z",
    });
    const cand = await store.saveCandidate(
      {
        id: "run3",
        projectId: "p1",
        matterId: "m1",
        trigger: "retry",
        eventIds: [add.event!.id],
        status: "queued",
        attempt: 1,
        createdAt: "2026-07-16T14:01:00.000Z",
        updatedAt: "2026-07-16T14:01:00.000Z",
      },
      bodyFor(add.revision!.id, "a.md", "x"),
    );
    await expect(
      store.resolveCandidate({
        id: "bad",
        candidateRevisionId: cand.id,
        decision: "accept",
        actor: "agent" as "owner",
        createdAt: "2026-07-16T14:02:00.000Z",
      }),
    ).rejects.toThrow(/owner/i);
  });

  it("two paths with identical bytes get distinct revision ids and same sha256", async () => {
    const bytes = new TextEncoder().encode("same-bytes-payload");
    const a = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "dir/a.txt",
      content: bytes,
      observedAt: "2026-07-16T15:00:00.000Z",
    });
    const b = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "dir/b.txt",
      content: bytes,
      observedAt: "2026-07-16T15:00:01.000Z",
    });
    expect(a.revision).toBeTruthy();
    expect(b.revision).toBeTruthy();
    expect(a.revision!.id).not.toBe(b.revision!.id);
    expect(a.revision!.sha256).toBe(b.revision!.sha256);
    expect(a.revision!.sha256).toBe(sha256Hex(bytes));
    expect(a.revision!.id.startsWith("orev:")).toBe(true);
    const ra = await store.readRevision(a.revision!.id);
    const rb = await store.readRevision(b.revision!.id);
    expect(new TextDecoder().decode(ra!)).toBe("same-bytes-payload");
    expect(new TextDecoder().decode(rb!)).toBe("same-bytes-payload");
  });

  it("A→B→A creates return event/revision; re-observe A at tip is idempotent", async () => {
    const aBytes = new TextEncoder().encode("content-A");
    const bBytes = new TextEncoder().encode("content-B");
    const a1 = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "cycle.md",
      content: aBytes,
      observedAt: "2026-07-16T16:00:00.000Z",
    });
    const b1 = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "cycle.md",
      content: bBytes,
      observedAt: "2026-07-16T16:01:00.000Z",
    });
    const a2 = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "cycle.md",
      content: aBytes,
      observedAt: "2026-07-16T16:02:00.000Z",
    });
    expect(a2.event).toBeTruthy();
    expect(a2.revision).toBeTruthy();
    expect(a2.revision!.id).not.toBe(a1.revision!.id);
    expect(a2.revision!.sha256).toBe(a1.revision!.sha256);
    expect(a2.event!.beforeRevisionId).toBe(b1.revision!.id);
    expect(a2.revision!.previousRevisionId).toBe(b1.revision!.id);

    const events = (await store.listEvents("p1")).filter(
      (e) => e.relativePath === "cycle.md",
    );
    expect(events).toHaveLength(3);

    // Duplicate observation of current tip A: idempotent, no new event
    const again = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "cycle.md",
      content: aBytes,
      observedAt: "2026-07-16T16:03:00.000Z",
    });
    expect(again.event).toBeUndefined();
    expect(again.revision!.id).toBe(a2.revision!.id);
    const events2 = (await store.listEvents("p1")).filter(
      (e) => e.relativePath === "cycle.md",
    );
    expect(events2).toHaveLength(3);
  });

  it("rejects supported WhyClaim when quote not in revision bytes", async () => {
    const v1 = new TextEncoder().encode("hello world");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "why.md",
      content: v1,
      observedAt: "2026-07-16T17:00:00.000Z",
    });
    const bad = bodyFor(add.revision!.id, "why.md", "not-in-file");
    await expect(
      store.saveCandidate(
        {
          id: "run-why",
          projectId: "p1",
          matterId: "m1",
          trigger: "retry",
          eventIds: [add.event!.id],
          status: "queued",
          attempt: 1,
          createdAt: "2026-07-16T17:01:00.000Z",
          updatedAt: "2026-07-16T17:01:00.000Z",
        },
        bad,
      ),
    ).rejects.toThrow(/quote not found/i);
  });
});
