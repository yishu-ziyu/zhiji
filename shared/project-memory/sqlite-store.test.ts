import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContentAddressedStore, sha256Hex } from "./cas";
import { SqliteProjectMemoryStore } from "./sqlite-store";
import type { AnalysisRun, UnderstandingBody } from "./types";

describe("project-memory sqlite-store + CAS", () => {
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
    expect(first.revision).toBeTruthy();
    expect(first.event?.kind).toBe("added");
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
    expect(second.revision!.id).not.toBe(first.revision!.id);
    expect(second.event!.beforeRevisionId).toBe(first.revision!.id);

    const again = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "README.md",
      content: v2,
      observedAt: "2026-07-16T10:02:00.000Z",
    });
    // same bytes → no second event
    expect(again.event?.id ?? again.revision?.id).toBeTruthy();
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
    expect(del.event?.kind).toBe("deleted");
    expect(del.revision?.tombstone).toBe(true);
    expect(del.event?.beforeRevisionId).toBe(add.revision!.id);

    // Live tip is tombstone but prior content still readable via before id and tombstone sha field.
    const prior = await store.readRevision(add.revision!.id);
    expect(prior).not.toBeNull();
    expect(new TextDecoder().decode(prior!)).toBe("delete-me content");

    const viaTombstone = await store.readRevision(del.revision!.id);
    expect(viaTombstone).not.toBeNull();
    expect(new TextDecoder().decode(viaTombstone!)).toBe("delete-me content");

    // Restart store on same dataDir
    store.close();
    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    const again = await store.readRevision(add.revision!.id);
    expect(new TextDecoder().decode(again!)).toBe("delete-me content");
  });

  it("CAS write failure leaves no orphan revision/event in SQLite", async () => {
    const brokenCas = new ContentAddressedStore(path.join(tmp, "cas-broken"));
    // Override put to fail after computing would-be path
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

    // Fresh store with real CAS/db path - no events for fail.txt
    store.close();
    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    const events = await store.listEvents("p1");
    expect(events.some((e) => e.relativePath === "fail.txt")).toBe(false);
  });

  it("accepted understanding marks review_needed when evidence file changes; does not overwrite body", async () => {
    const v1 = new TextEncoder().encode("spec v1");
    const add = await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "added",
      relativePath: "SPEC.md",
      content: v1,
      observedAt: "2026-07-16T13:00:00.000Z",
    });

    const body: UnderstandingBody = {
      now: "we understand v1",
      then: "empty",
      changed: ["SPEC.md added"],
      why: "file content states scope",
      depends: [],
      evidenceRevisionIds: [add.revision!.id],
      nextDecision: "confirm",
    };
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
    const cand = await store.saveCandidate(run, body);
    const accepted = await store.resolve({
      id: "res1",
      understandingRevisionId: cand.id,
      decision: "accept",
      actor: "owner",
      createdAt: "2026-07-16T13:02:00.000Z",
    });
    expect(accepted.status).toBe("accepted");

    const v2 = new TextEncoder().encode("spec v2 changed");
    await store.ingest({
      projectId: "p1",
      grantId: "g1",
      kind: "modified",
      relativePath: "SPEC.md",
      content: v2,
      observedAt: "2026-07-16T13:03:00.000Z",
    });

    const state = await store.getMatterState("p1", "m1");
    expect(state.accepted).toBeUndefined();
    expect(state.reviewNeeded.some((u) => u.id === accepted.id)).toBe(true);
    const reviewed = state.reviewNeeded.find((u) => u.id === accepted.id)!;
    expect(reviewed.body.now).toBe("we understand v1");
    expect(reviewed.body.evidenceRevisionIds).toEqual([add.revision!.id]);

    // Old revision bytes still open
    const oldBytes = await store.readRevision(add.revision!.id);
    expect(new TextDecoder().decode(oldBytes!)).toBe("spec v1");
  });

  it("agent cannot resolve as owner — store rejects non-owner actor", async () => {
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
        id: "run2",
        projectId: "p1",
        matterId: "m1",
        trigger: "retry",
        eventIds: [add.event!.id],
        status: "queued",
        attempt: 1,
        createdAt: "2026-07-16T14:01:00.000Z",
        updatedAt: "2026-07-16T14:01:00.000Z",
      },
      {
        now: "n",
        then: "t",
        changed: [],
        why: "w",
        depends: [],
        evidenceRevisionIds: [add.revision!.id],
        nextDecision: "d",
      },
    );
    await expect(
      store.resolve({
        id: "bad",
        understandingRevisionId: cand.id,
        decision: "accept",
        // force bad actor through cast
        actor: "agent" as "owner",
        createdAt: "2026-07-16T14:02:00.000Z",
      }),
    ).rejects.toThrow(/owner/i);
  });
});
