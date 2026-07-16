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

  it("custom dedupeKey is namespaced by project+grant; p2 never gets p1 event", async () => {
    store.upsertGrant({
      id: "g2",
      projectId: "p2",
      kind: "local_folder",
      rootPath: "/tmp/other",
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    const bytes = new TextEncoder().encode("ns-content");
    const p1 = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "shared-name.txt",
      content: bytes,
      observedAt: "2026-07-16T18:00:00.000Z",
      dedupeKey: "caller-raw-key-identical",
    });
    const p2 = await store.ingest({
      projectId: "p2",
      grantId: "g2",
      kind: "added",
      relativePath: "shared-name.txt",
      content: bytes,
      observedAt: "2026-07-16T18:00:01.000Z",
      dedupeKey: "caller-raw-key-identical",
    });
    expect(p1.event).toBeTruthy();
    expect(p2.event).toBeTruthy();
    expect(p1.event!.id).not.toBe(p2.event!.id);
    expect(p1.event!.projectId).toBe("p1");
    expect(p2.event!.projectId).toBe("p2");
    expect(p1.event!.dedupeKey).toContain("p1|g1|");
    expect(p2.event!.dedupeKey).toContain("p2|g2|");
    expect(p1.event!.dedupeKey).not.toBe(p2.event!.dedupeKey);
    // p2 must not reuse p1 event/revision identity
    expect(p2.revision!.id).not.toBe(p1.revision!.id);
  });

  it("resolveCandidate is at most once: retry returns same accepted, no second head move", async () => {
    const v1 = new TextEncoder().encode("once only");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "once.md",
      content: v1,
      observedAt: "2026-07-16T19:00:00.000Z",
    });
    const cand = await store.saveCandidate(
      {
        id: "run-once",
        projectId: "p1",
        matterId: "m1",
        trigger: "retry",
        eventIds: [add.event!.id],
        status: "queued",
        attempt: 1,
        createdAt: "2026-07-16T19:01:00.000Z",
        updatedAt: "2026-07-16T19:01:00.000Z",
      },
      bodyFor(add.revision!.id, "once.md", "once only"),
    );
    const first = await store.resolveCandidate({
      id: "res-once-1",
      candidateRevisionId: cand.id,
      decision: "accept",
      actor: "owner",
      createdAt: "2026-07-16T19:02:00.000Z",
    });
    expect(first.accepted?.id).toBeTruthy();
    const acceptedId = first.accepted!.id;
    const headAfterFirst = first.head.acceptedRevisionId;

    const second = await store.resolveCandidate({
      id: "res-once-2",
      candidateRevisionId: cand.id,
      decision: "accept",
      actor: "owner",
      createdAt: "2026-07-16T19:03:00.000Z",
    });
    expect(second.resolution.id).toBe(first.resolution.id);
    expect(second.accepted?.id).toBe(acceptedId);
    expect(second.head.acceptedRevisionId).toBe(headAfterFirst);

    const state = await store.getMatterState("p1", "m1");
    expect(state.head.acceptedRevisionId).toBe(acceptedId);
    // Only one accepted understanding for this matter from this candidate
    // (no second accepted insert)
    expect(state.accepted?.id).toBe(acceptedId);
  });

  it("ingest rejects missing, foreign, and revoked grants", async () => {
    const bytes = new TextEncoder().encode("x");
    await expect(
      store.ingest({
        projectId: "p1",
        grantId: "no-such-grant",
        kind: "added",
        relativePath: "x.md",
        content: bytes,
        observedAt: "2026-07-16T20:00:00.000Z",
      }),
    ).rejects.toThrow(/grant missing/i);

    store.upsertGrant({
      id: "g-foreign",
      projectId: "p-other",
      kind: "local_folder",
      rootPath: "/tmp/other",
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    await expect(
      store.ingest({
        projectId: "p1",
        grantId: "g-foreign",
        kind: "added",
        relativePath: "x.md",
        content: bytes,
        observedAt: "2026-07-16T20:00:01.000Z",
      }),
    ).rejects.toThrow(/foreign/i);

    store.upsertGrant({
      id: "g-revoked",
      projectId: "p1",
      kind: "local_folder",
      rootPath: "/tmp/rev",
      status: "revoked",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    await expect(
      store.ingest({
        projectId: "p1",
        grantId: "g-revoked",
        kind: "added",
        relativePath: "x.md",
        content: bytes,
        observedAt: "2026-07-16T20:00:02.000Z",
      }),
    ).rejects.toThrow(/revoked/i);
  });

  it("saveCandidate rejects missing/foreign matter and foreign eventIds", async () => {
    const bytes = new TextEncoder().encode("body");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "ri.md",
      content: bytes,
      observedAt: "2026-07-16T21:00:00.000Z",
    });

    await expect(
      store.saveCandidate(
        {
          id: "run-miss",
          projectId: "p1",
          matterId: "no-matter",
          trigger: "retry",
          eventIds: [add.event!.id],
          status: "queued",
          attempt: 1,
          createdAt: "2026-07-16T21:01:00.000Z",
          updatedAt: "2026-07-16T21:01:00.000Z",
        },
        bodyFor(add.revision!.id, "ri.md", "body"),
      ),
    ).rejects.toThrow(/matter missing/i);

    store.upsertMatter({
      id: "m-other",
      projectId: "p-other",
      title: "other",
      goal: "g",
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    await expect(
      store.saveCandidate(
        {
          id: "run-foreign-m",
          projectId: "p1",
          matterId: "m-other",
          trigger: "retry",
          eventIds: [add.event!.id],
          status: "queued",
          attempt: 1,
          createdAt: "2026-07-16T21:02:00.000Z",
          updatedAt: "2026-07-16T21:02:00.000Z",
        },
        bodyFor(add.revision!.id, "ri.md", "body"),
      ),
    ).rejects.toThrow(/matter foreign/i);

    await expect(
      store.saveCandidate(
        {
          id: "run-foreign-e",
          projectId: "p1",
          matterId: "m1",
          trigger: "retry",
          eventIds: ["evt-does-not-exist"],
          status: "queued",
          attempt: 1,
          createdAt: "2026-07-16T21:03:00.000Z",
          updatedAt: "2026-07-16T21:03:00.000Z",
        },
        bodyFor(add.revision!.id, "ri.md", "body"),
      ),
    ).rejects.toThrow(/event missing/i);

    // event under other project
    store.upsertGrant({
      id: "g-p2",
      projectId: "p2",
      kind: "local_folder",
      rootPath: "/tmp/p2",
      status: "active",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    const foreign = await store.ingest({
      projectId: "p2",
      grantId: "g-p2",
      kind: "added",
      relativePath: "f.md",
      content: new TextEncoder().encode("foreign"),
      observedAt: "2026-07-16T21:04:00.000Z",
    });
    await expect(
      store.saveCandidate(
        {
          id: "run-xproj",
          projectId: "p1",
          matterId: "m1",
          trigger: "retry",
          eventIds: [foreign.event!.id],
          status: "queued",
          attempt: 1,
          createdAt: "2026-07-16T21:05:00.000Z",
          updatedAt: "2026-07-16T21:05:00.000Z",
        },
        bodyFor(add.revision!.id, "ri.md", "body"),
      ),
    ).rejects.toThrow(/event foreign/i);
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

  it("legacy analysis_runs row remains readable after additive columns", async () => {
    // Simulate pre-Wave-A insert (only original columns populated).
    const db = (
      store as unknown as {
        db: {
          prepare: (sql: string) => {
            run: (
              ...args: Array<string | number | null>
            ) => unknown;
          };
        };
      }
    ).db;
    db.prepare(
      `INSERT INTO analysis_runs
       (id, project_id, matter_id, trigger, event_ids_json, status, attempt, created_at, updated_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "legacy-run",
      "p1",
      "m1",
      "source_change",
      "[]",
      "completed",
      1,
      "2026-07-16T10:00:00.000Z",
      "2026-07-16T10:00:00.000Z",
      null,
    );
    const run = await store.getRun("p1", "legacy-run");
    expect(run).toMatchObject({
      id: "legacy-run",
      projectId: "p1",
      matterId: "m1",
      status: "completed",
      interruptRequested: false,
    });
    expect(run?.stopReason).toBeUndefined();
    expect(run?.modelReceipt).toBeUndefined();
  });

  it("agent run reopen + append-only tool receipts + interrupt flag", async () => {
    const created = await store.createRun({
      id: "run-trace-1",
      projectId: "p1",
      matterId: "m1",
      grantId: "g1",
      trigger: "owner_question",
      eventIds: [],
      status: "queued",
      attempt: 1,
      createdAt: "2026-07-16T18:00:00.000Z",
      updatedAt: "2026-07-16T18:00:00.000Z",
    });
    expect(created.status).toBe("queued");

    await store.updateRun({
      ...created,
      status: "running",
      updatedAt: "2026-07-16T18:00:01.000Z",
      progressSummary: "turn 1",
    });

    await store.appendToolReceipt({
      id: "tr-1",
      runId: "run-trace-1",
      sequence: 1,
      tool: "project_map",
      projectId: "p1",
      grantId: "g1",
      scope: { mode: "initial_root", relativePaths: ["."] },
      outcome: "ok",
      summary: "mapped 3 paths",
      pins: [],
      startedAt: "2026-07-16T18:00:01.000Z",
      finishedAt: "2026-07-16T18:00:02.000Z",
    });
    await store.appendToolReceipt({
      id: "tr-2",
      runId: "run-trace-1",
      sequence: 2,
      tool: "read_revision",
      projectId: "p1",
      grantId: "g1",
      scope: { mode: "matter", relativePaths: ["docs/a.md"] },
      outcome: "ok",
      summary: "read orev",
      pins: [
        {
          revisionId: "orev:x",
          relativePath: "docs/a.md",
          quote: "q",
          lastVerifiedAt: "2026-07-16T18:00:02.000Z",
        },
      ],
      startedAt: "2026-07-16T18:00:02.000Z",
      finishedAt: "2026-07-16T18:00:03.000Z",
    });

    await expect(
      store.appendToolReceipt({
        id: "tr-dup",
        runId: "run-trace-1",
        sequence: 1,
        tool: "git_status",
        projectId: "p1",
        grantId: "g1",
        scope: { mode: "initial_root", relativePaths: [] },
        outcome: "ok",
        summary: "dup",
        pins: [],
        startedAt: "2026-07-16T18:00:04.000Z",
        finishedAt: "2026-07-16T18:00:04.000Z",
      }),
    ).rejects.toThrow(/sequence 1 already exists/i);

    const receipts = await store.listToolReceipts("run-trace-1");
    expect(receipts.map((r) => r.sequence)).toEqual([1, 2]);
    expect(receipts[1]?.tool).toBe("read_revision");

    const interrupted = await store.requestInterrupt("p1", "run-trace-1");
    expect(interrupted.interruptRequested).toBe(true);
    expect(interrupted.status).toBe("interrupted");
    expect(interrupted.stopReason).toBe("owner_interrupt");

    const reopened = await store.getRunView("p1", "run-trace-1");
    expect(reopened?.run.interruptRequested).toBe(true);
    expect(reopened?.toolReceipts).toHaveLength(2);

    const listed = await store.listRuns("p1", "m1");
    expect(listed.some((r) => r.id === "run-trace-1")).toBe(true);
  });

  it("lists current revisions and git-blob capture does not move tip or emit events", async () => {
    const live = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "docs/SPEC.md",
      content: new TextEncoder().encode("live tip v1"),
      observedAt: "2026-07-16T19:00:00.000Z",
    });
    expect(live.event).toBeTruthy();
    const eventsBefore = (await store.listEvents("p1")).length;

    const blob = new TextEncoder().encode("historical blob at commit");
    const captured = await store.captureGitBlob({
      projectId: "p1",
      grantId: "g1",
      relativePath: "docs/SPEC.md",
      commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      blobOid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      content: blob,
      observedAt: "2026-07-16T19:05:00.000Z",
    });
    expect(captured.sourceVersion).toBe(
      "git:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    expect(captured.sha256).toBe(sha256Hex(blob));

    const again = await store.captureGitBlob({
      projectId: "p1",
      grantId: "g1",
      relativePath: "docs/SPEC.md",
      commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      blobOid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      content: blob,
    });
    expect(again.id).toBe(captured.id);

    const eventsAfter = (await store.listEvents("p1")).length;
    expect(eventsAfter).toBe(eventsBefore);

    const tips = await store.listCurrentRevisions("p1", "g1");
    const specTip = tips.find((r) => r.relativePath === "docs/SPEC.md");
    expect(specTip?.id).toBe(live.revision!.id);
    expect(specTip?.sourceVersion).toBeUndefined();

    const bytes = await store.readRevision(captured.id);
    expect(bytes && new TextDecoder().decode(bytes)).toBe("historical blob at commit");
  });
});
