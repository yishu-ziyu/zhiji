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
  OwnerOnlyResolutionError,
  resolveUnderstanding,
  runStateReconstruction,
} from "./reconstruct";
import { SqliteProjectMemoryStore } from "./sqlite-store";
import type { Matter, UnderstandingBody } from "./types";

describe("MVP Task4 reconstruct + owner resolve (amended contract)", () => {
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

  it("agent service is Reader+CandidateWriter only (no resolve)", () => {
    const agent = store.asAgentMemoryService();
    assertAgentServiceShape(agent);
    expect(agent).not.toHaveProperty("resolveCandidate");
    expect("resolve" in agent).toBe(false);
  });

  it("pins evidence revisions and six-question structured body", async () => {
    const { revision: rev, event } = await seedChange("a.md", "content-a");
    const agent = store.asAgentMemoryService();
    const { candidate } = await runStateReconstruction(
      agent,
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId, eventIds: [event!.id] },
    );
    expect(candidate.kind).toBe("candidate");
    expect(candidate.proposedBy).toBe("agent");
    expect(candidate.body.evidenceRevisionIds).toEqual([rev!.id]);
    expect(candidate.body.changed.some((c) => c.after.includes(rev!.id))).toBe(
      true,
    );
    expect(candidate.body.now.text).toBeTruthy();
    expect(candidate.body.then.text).toBeTruthy();
    expect(candidate.body.why[0]?.status).toBe("unknown");
    expect(candidate.body.why[0]?.text).toBe(WHY_UNKNOWN);
  });

  it("supported why requires quote+revision+path+lastVerifiedAt", async () => {
    const { revision: rev } = await seedChange("c.md", "quote body here");
    const agent = store.asAgentMemoryService();
    const { candidate } = await runStateReconstruction(
      agent,
      createAgentModelLoop(),
      {
        projectId,
        matterId,
        whySourceQuotes: ["  fix: align timeout with SLA  "],
      },
    );
    const w = candidate.body.why[0]!;
    expect(w.status).toBe("supported");
    expect(w.text).toBe("fix: align timeout with SLA");
    expect(isFullySupportedAnchor(w)).toBe(true);
    expect(w.evidence[0]?.revisionId).toBe(rev!.id);
    expect(w.evidence[0]?.relativePath).toBe("c.md");
    expect(w.evidence[0]?.quote).toBe("fix: align timeout with SLA");
    expect(w.evidence[0]?.lastVerifiedAt).toBeTruthy();
  });

  it("incomplete supported why is coerced to unknown", async () => {
    const { revision: rev } = await seedChange("bad.md", "x");
    const agent = store.asAgentMemoryService();
    const model = createAgentModelLoop({
      mode: "model",
      complete: async (): Promise<UnderstandingBody> => ({
        now: {
          text: "n",
          evidence: [],
          gaps: [],
          conflicts: [],
        },
        then: {
          text: "t",
          at: "2026-01-01T00:00:00.000Z",
          evidence: [],
          gaps: [],
          conflicts: [],
        },
        changed: [],
        why: [
          {
            text: "pretend supported",
            status: "supported",
            evidence: [
              {
                revisionId: rev!.id,
                relativePath: "bad.md",
                quote: "", // missing quote → cannot stay supported
                lastVerifiedAt: "2026-07-16T10:01:00.000Z",
              },
            ],
          },
        ],
        evidenceRevisionIds: [rev!.id],
        nextDecision: "n",
      }),
    });
    const { candidate } = await runStateReconstruction(agent, model, {
      projectId,
      matterId,
    });
    expect(candidate.body.why[0]?.status).toBe("unknown");
    expect(isFullySupportedAnchor(candidate.body.why[0]!)).toBe(false);
  });

  it("non-owner resolve → 403; agent path never receives OwnerDecisionWriter", async () => {
    await seedChange("d.md", "content-d");
    const agent = store.asAgentMemoryService();
    const { candidate } = await runStateReconstruction(
      agent,
      createAgentModelLoop(),
      { projectId, matterId },
    );
    await expect(
      resolveUnderstanding(store, {
        candidateRevisionId: candidate.id,
        decision: "accept",
        actor: "agent",
      }),
    ).rejects.toBeInstanceOf(OwnerOnlyResolutionError);
    await expect(
      resolveUnderstanding(store, {
        candidateRevisionId: candidate.id,
        decision: "accept",
        actor: "agent:project-reviewer",
      }),
    ).rejects.toMatchObject({ status: 403 });
    // agent surface still cannot resolve
    expect(() => assertAgentServiceShape(agent)).not.toThrow();
    expect(agent).not.toHaveProperty("resolveCandidate");
  });

  it("owner accept INSERTs new accepted revision; candidate immutable", async () => {
    await seedChange("e.md", "content-e");
    const agent = store.asAgentMemoryService();
    const { candidate } = await runStateReconstruction(
      agent,
      createAgentModelLoop(),
      { projectId, matterId },
    );
    const candSnap = JSON.stringify(candidate.body);
    const result = await resolveUnderstanding(store, {
      candidateRevisionId: candidate.id,
      decision: "accept",
      actor: "owner",
    });
    expect(result.accepted?.kind).toBe("accepted");
    expect(result.accepted?.id).not.toBe(candidate.id);
    expect(result.head.acceptedRevisionId).toBe(result.accepted!.id);
    expect(result.resolution.acceptedRevisionId).toBe(result.accepted!.id);

    const state = await store.getMatterState(projectId, matterId);
    expect(state.candidate?.id).toBe(candidate.id);
    expect(state.candidate?.kind).toBe("candidate");
    expect(JSON.stringify(state.candidate!.body)).toBe(candSnap);
    expect(state.accepted?.id).toBe(result.accepted!.id);
  });

  it("owner edit_accept stores edited body on NEW accepted revision", async () => {
    const { revision: rev } = await seedChange("f.md", "content-f");
    const agent = store.asAgentMemoryService();
    const { candidate } = await runStateReconstruction(
      agent,
      createAgentModelLoop(),
      { projectId, matterId },
    );
    const edited: UnderstandingBody = {
      ...candidate.body,
      now: {
        ...candidate.body.now,
        text: "Owner 编辑后的当前理解",
      },
      evidenceRevisionIds: [rev!.id],
    };
    const result = await resolveUnderstanding(store, {
      candidateRevisionId: candidate.id,
      decision: "edit_accept",
      actor: "owner",
      editedBody: edited,
    });
    expect(result.accepted?.id).not.toBe(candidate.id);
    expect(result.accepted?.body.now.text).toBe("Owner 编辑后的当前理解");
    expect(result.accepted?.proposedBy).toBe("owner");
    expect(result.accepted?.kind).toBe("accepted");
  });

  it("model failure still returns deterministic changed/evidence for Owner", async () => {
    const { revision: rev } = await seedChange("g.md", "content-g");
    const agent = store.asAgentMemoryService();
    const model = createAgentModelLoop({
      mode: "model",
      complete: async () => {
        throw new Error("upstream timeout");
      },
    });
    const { candidate, run } = await runStateReconstruction(agent, model, {
      projectId,
      matterId,
    });
    expect(candidate.body.evidenceRevisionIds).toContain(rev!.id);
    expect(
      candidate.body.changed.some((c) => c.after.includes(rev!.id)),
    ).toBe(true);
    expect(candidate.body.now.text).toMatch(/模型不可用|确定性/);
    expect(candidate.body.nextDecision).toMatch(/Owner/);
    expect(candidate.kind).toBe("candidate");
    expect(run.status).toBe("awaiting_owner");
  });

  it("strips model evidence pins not in project events", async () => {
    const { revision: rev } = await seedChange("h.md", "content-h");
    const agent = store.asAgentMemoryService();
    const model = createAgentModelLoop({
      mode: "model",
      complete: async () => ({
        now: {
          text: "x",
          evidence: [],
          gaps: [],
          conflicts: [],
        },
        then: {
          text: "y",
          at: "2026-01-01T00:00:00.000Z",
          evidence: [],
          gaps: [],
          conflicts: [],
        },
        changed: [],
        why: [{ text: WHY_UNKNOWN, status: "unknown", evidence: [] }],
        evidenceRevisionIds: [rev!.id, "sha256:foreign"],
        nextDecision: "n",
      }),
    });
    const { candidate } = await runStateReconstruction(agent, model, {
      projectId,
      matterId,
    });
    expect(candidate.body.evidenceRevisionIds).toEqual([rev!.id]);
    expect(candidate.body.evidenceRevisionIds).not.toContain("sha256:foreign");
  });

  it("evidence file change marks head review_needed; accepted body immutable", async () => {
    const { revision: rev } = await seedChange("i.md", "content-i-v1");
    const agent = store.asAgentMemoryService();
    const { candidate } = await runStateReconstruction(
      agent,
      createAgentModelLoop(),
      { projectId, matterId },
    );
    const { accepted } = await resolveUnderstanding(store, {
      candidateRevisionId: candidate.id,
      decision: "accept",
      actor: "owner",
    });
    const acceptedBody = JSON.stringify(accepted!.body);
    await store.ingest({
      projectId,
      grantId,
      kind: "modified",
      relativePath: "i.md",
      content: new TextEncoder().encode("content-i-v2"),
      observedAt: "2026-07-16T10:05:00.000Z",
    });
    const state = await store.getMatterState(projectId, matterId);
    expect(state.head.reviewState).toBe("review_needed");
    expect(state.head.acceptedRevisionId).toBe(accepted!.id);
    expect(JSON.stringify(state.accepted!.body)).toBe(acceptedBody);
    expect(await store.readRevision(rev!.id)).toBeTruthy();
  });
});
