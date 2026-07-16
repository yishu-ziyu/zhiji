import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAgentModelLoop,
  isFullySupportedAnchor,
  WHY_UNKNOWN,
} from "./agent-model-loop";
import { assertAgentServiceShape } from "./reducer";
import {
  filterEventsForMatter,
  getMemoryView,
  OwnerOnlyResolutionError,
  ResolveValidationError,
  resolveUnderstanding,
  runStateReconstruction,
} from "./reconstruct";
import { SqliteProjectMemoryStore } from "./sqlite-store";
import type { Matter, UnderstandingBody } from "./types";

describe("MVP Task4 follow-up (runtime + relevance + resolve rules)", () => {
  let tmp: string;
  let store: SqliteProjectMemoryStore;
  const projectId = "p1";
  const matterId = "m1";
  const grantId = "g1";

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-t4-"));
    store = new SqliteProjectMemoryStore({ dataDir: tmp });
    store.upsertGrant({
      id: grantId,
      projectId,
      kind: "local_folder",
      rootPath: "/tmp/fixture-t4",
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    const matter: Matter = {
      id: matterId,
      projectId,
      title: "首要事项",
      goal: "能回到决策",
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    };
    store.upsertMatter(matter);
    store.upsertWatchSet({
      id: "w1",
      projectId,
      matterId,
      grantId,
      includePathPrefixes: ["src"],
      excludePathPrefixes: [],
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function seedChange(relativePath: string, content: string) {
    return store.ingest({
      projectId,
      grantId,
      kind: "added",
      relativePath,
      content: new TextEncoder().encode(content),
      observedAt: "2026-07-16T10:01:00.000Z",
    });
  }

  function agent() {
    return store.asAgentMemoryService();
  }

  function resolveArgs(
    candidateId: string,
    decision: "accept" | "edit_accept" | "reject",
    extra: Partial<{
      editedBody: UnderstandingBody;
      actor: string;
      projectId: string;
      matterId: string;
    }> = {},
  ) {
    return resolveUnderstanding(store, store, {
      projectId: extra.projectId ?? projectId,
      matterId: extra.matterId ?? matterId,
      candidateRevisionId: candidateId,
      decision,
      editedBody: extra.editedBody,
      actor: extra.actor ?? "owner",
    });
  }

  it("agent service is Reader+CandidateWriter only (no resolve)", () => {
    assertAgentServiceShape(agent());
    expect(agent()).not.toHaveProperty("resolveCandidate");
  });

  it("filters implicit and explicit events by matter watch relevance", async () => {
    const watched = await seedChange("src/in.md", "in-watch");
    const outside = await seedChange("other/out.md", "out-of-watch");
    const state = await store.getMatterState(projectId, matterId);
    const all = await store.listEvents(projectId);

    const implicit = filterEventsForMatter(all, state);
    expect(implicit.map((e) => e.id)).toContain(watched.event!.id);
    expect(implicit.map((e) => e.id)).not.toContain(outside.event!.id);

    const explicit = filterEventsForMatter(all, state, [
      watched.event!.id,
      outside.event!.id,
    ]);
    expect(explicit.map((e) => e.id)).toEqual([watched.event!.id]);
  });

  it("pins evidence from watch-relevant events only", async () => {
    const { revision: rev } = await seedChange("src/a.md", "content-a");
    await seedChange("noise/x.md", "ignore-me");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    expect(candidate.kind).toBe("candidate");
    expect(candidate.body.evidenceRevisionIds).toEqual([rev!.id]);
    expect(candidate.body.why[0]?.status).toBe("unknown");
    expect(candidate.body.why[0]?.text).toBe(WHY_UNKNOWN);
  });

  it("supported why needs path+quote bytes; false quote downgrades without failing run", async () => {
    const quote = "fix: align timeout with SLA";
    const { revision: rev } = await seedChange(
      "src/c.md",
      `header\n${quote}\nfooter`,
    );
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId, whySourceQuotes: [`  ${quote}  `] },
    );
    const w = candidate.body.why[0]!;
    expect(w.status).toBe("supported");
    expect(isFullySupportedAnchor(w)).toBe(true);
    expect(w.evidence[0]?.revisionId).toBe(rev!.id);
    expect(w.evidence[0]?.relativePath).toBe("src/c.md");

    const { candidate: bad, run } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      {
        projectId,
        matterId,
        whySourceQuotes: ["arbitrary string not in file"],
      },
    );
    expect(run.status).toBe("awaiting_owner");
    expect(bad.kind).toBe("candidate");
    expect(bad.body.why[0]?.status).toBe("unknown");
  });

  it("model failure falls back to deterministic changed/evidence", async () => {
    const { revision: rev } = await seedChange("src/g.md", "content-g");
    const model = createAgentModelLoop({
      mode: "model",
      complete: async () => {
        throw new Error("upstream timeout");
      },
    });
    const { candidate, run } = await runStateReconstruction(agent(), model, {
      projectId,
      matterId,
    });
    expect(candidate.body.evidenceRevisionIds).toContain(rev!.id);
    expect(candidate.body.now.text).toMatch(/模型不可用|确定性/);
    expect(run.status).toBe("awaiting_owner");
  });

  it("non-owner 403; edit_accept without body 400; wrong projectId 400", async () => {
    await seedChange("src/d.md", "content-d");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    await expect(
      resolveArgs(candidate.id, "accept", { actor: "agent" }),
    ).rejects.toBeInstanceOf(OwnerOnlyResolutionError);

    await expect(
      resolveArgs(candidate.id, "edit_accept"),
    ).rejects.toBeInstanceOf(ResolveValidationError);

    await expect(
      resolveArgs(candidate.id, "accept", { projectId: "other" }),
    ).rejects.toBeInstanceOf(ResolveValidationError);
  });

  it("owner accept inserts new accepted; repeat resolve is idempotent", async () => {
    await seedChange("src/e.md", "content-e");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    const first = await resolveArgs(candidate.id, "accept");
    expect(first.accepted?.id).not.toBe(candidate.id);
    expect(first.accepted?.kind).toBe("accepted");

    const second = await resolveArgs(candidate.id, "accept");
    expect(second.resolution.id).toBe(first.resolution.id);
    expect(second.accepted?.id).toBe(first.accepted?.id);
    expect(second.head.acceptedRevisionId).toBe(first.head.acceptedRevisionId);
  });

  it("edit_accept requires editedBody and creates new accepted revision", async () => {
    const { revision: rev } = await seedChange("src/f.md", "content-f");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    const edited: UnderstandingBody = {
      ...candidate.body,
      now: { ...candidate.body.now, text: "Owner 编辑后的当前理解" },
      evidenceRevisionIds: [rev!.id],
    };
    const result = await resolveArgs(candidate.id, "edit_accept", {
      editedBody: edited,
    });
    expect(result.accepted?.body.now.text).toBe("Owner 编辑后的当前理解");
    expect(result.accepted?.id).not.toBe(candidate.id);
  });

  it("memory view excludes resolved candidates", async () => {
    await seedChange("src/m.md", "mem");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    await resolveArgs(candidate.id, "accept");

    const view = await getMemoryView(store, projectId, matterId, {
      isCandidateResolved: (id) => store.isCandidateResolved(id),
    });
    expect(view?.accepted).toBeTruthy();
    expect(view?.candidate).toBeNull();
    // raw truth row remains immutable candidate
    const raw = await store.getMatterState(projectId, matterId);
    expect(raw.candidate?.id).toBe(candidate.id);
  });
});
