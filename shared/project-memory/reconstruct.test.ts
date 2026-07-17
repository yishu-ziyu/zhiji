import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildDeterministicUnderstandingBody,
  buildModelPrompt,
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

  it("对用户的默认理解不泄漏英文工程词", () => {
    const body = buildDeterministicUnderstandingBody({
      projectId,
      matterId,
      events: [],
      evidenceSnippets: [],
    });
    const visibleCopy = [
      body.now.text,
      ...body.now.gaps,
      body.then.text,
      ...body.then.gaps,
      ...body.changed.flatMap((change) => [change.before, change.after]),
      ...body.why.map((claim) => claim.text),
      ...body.depends.map((item) => item.reason),
      body.nextDecision,
    ].join("\n");

    expect(visibleCopy).not.toMatch(
      /\b(?:Owner|evidence|prior|candidate|accepted|revision|unknown|matter)\b/i,
    );
    expect(body.now.text).toBe("目前还没有可核对的文件变化。");
    expect(body.nextDecision).toBe(
      "还没有足够依据。请补充材料，或直接修改这段理解。",
    );
  });

  it("变化描述使用中文且不暴露版本编号", () => {
    const body = buildDeterministicUnderstandingBody({
      projectId,
      matterId,
      events: [
        {
          id: "event-1",
          projectId,
          grantId,
          kind: "modified",
          relativePath: "方案.pdf",
          beforeRevisionId: "revision-before-secret",
          afterRevisionId: "revision-after-secret",
          observedAt: "2026-07-16T10:01:00.000Z",
          dedupeKey: "event-1",
        },
      ],
      evidenceSnippets: [],
    });

    expect(body.changed[0]).toMatchObject({
      before: "修改前",
      after: "已更新 方案.pdf",
    });
    // 用户可见文案不带版本号；evidence 锚点可保留 revisionId 供点进原文。
    expect(`${body.changed[0]?.before}${body.changed[0]?.after}`).not.toContain(
      "revision-",
    );
  });

  it("模型提示要求解释用中文且保留原文引用", () => {
    const prompt = buildModelPrompt({
      projectId,
      matterId,
      events: [],
      evidenceSnippets: [],
    });

    expect(prompt).toContain("面向用户的内容使用简体中文");
    expect(prompt).toContain("原文引用保留来源语言");
  });

  it("0 事件重建输出中文空结果且不沿用英文 prior", async () => {
    // 先写入一段英文空候选并 accept，模拟历史脏数据。
    const dirty = await runStateReconstruction(
      agent(),
      {
        async propose() {
          return {
            now: {
              text: "No current state information is available because no events have been recorded for this project matter.",
              evidence: [],
              gaps: ["No events have been provided"],
              conflicts: [],
            },
            then: {
              text: "No prior state",
              at: "unknown",
              evidence: [],
              gaps: [],
              conflicts: [],
            },
            changed: [
              {
                before: "",
                after: "无明显文件变化",
                eventIds: [],
                evidence: [],
              },
            ],
            why: [{ text: "原因尚无可核对依据", status: "unknown", evidence: [] }],
            depends: [],
            evidenceRevisionIds: [],
            nextDecision: "Cannot determine next action",
          };
        },
      },
      { projectId, matterId, eventIds: [] },
    );
    // 0 事件路径应跳过 model，直接中文；即使传入假 model 也不应英文。
    expect(dirty.candidate).not.toBeNull();
    expect(dirty.candidate!.body.now.text).toBe("目前还没有可核对的文件变化。");
    expect(dirty.candidate!.body.then.text).toBe("还没有已确认的先前理解");
    expect(dirty.candidate!.body.nextDecision).toMatch(/再读一遍变化/);
    expect(JSON.stringify(dirty.candidate!.body)).not.toMatch(/No current state/i);
  });

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
    expect(candidate).not.toBeNull();
    expect(candidate!.kind).toBe("candidate");
    expect(candidate!.body.evidenceRevisionIds).toEqual([rev!.id]);
    expect(candidate!.body.why[0]?.status).toBe("unknown");
    expect(candidate!.body.why[0]?.text).toBe(WHY_UNKNOWN);
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
    expect(candidate).not.toBeNull();
    const w = candidate!.body.why[0]!;
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
    expect(bad).not.toBeNull();
    expect(bad!.kind).toBe("candidate");
    expect(bad!.body.why[0]?.status).toBe("unknown");
  });

  it("model failure fail-closed: failed + null candidate + no save", async () => {
    await seedChange("src/g.md", "content-g");
    let saveCalls = 0;
    const base = agent();
    const counting = {
      ...base,
      saveCandidate: async (
        ...args: Parameters<typeof base.saveCandidate>
      ) => {
        saveCalls += 1;
        return base.saveCandidate(...args);
      },
    };
    const model = createAgentModelLoop({
      mode: "model",
      allowDeterministicFallback: false,
      complete: async () => {
        throw new Error("upstream timeout");
      },
    });
    const { candidate, run } = await runStateReconstruction(
      counting,
      model,
      { projectId, matterId },
    );
    expect(candidate).toBeNull();
    expect(run.status).toBe("failed");
    expect(run.candidateRevisionId).toBeUndefined();
    expect(run.modelReceipt?.fallback).toMatchObject({
      used: true,
      kind: "deterministic",
      errorClass: "timeout",
    });
    expect(saveCalls).toBe(0);
  });

  it("explicit allowDeterministicFallback still yields candidate shell", async () => {
    const { revision: rev } = await seedChange("src/g2.md", "content-g2");
    const model = createAgentModelLoop({
      mode: "model",
      allowDeterministicFallback: true,
      complete: async () => {
        throw new Error("upstream timeout");
      },
    });
    const { candidate, run } = await runStateReconstruction(agent(), model, {
      projectId,
      matterId,
    });
    expect(candidate).not.toBeNull();
    expect(candidate!.body.evidenceRevisionIds).toContain(rev!.id);
    expect(candidate!.body.now.text).toContain("暂时无法进一步分析");
    expect(run.status).toBe("awaiting_owner");
  });

  it("non-owner 403; edit_accept without body 400; wrong projectId 400", async () => {
    await seedChange("src/d.md", "content-d");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    expect(candidate).not.toBeNull();
    await expect(
      resolveArgs(candidate!.id, "accept", { actor: "agent" }),
    ).rejects.toBeInstanceOf(OwnerOnlyResolutionError);

    await expect(
      resolveArgs(candidate!.id, "edit_accept"),
    ).rejects.toBeInstanceOf(ResolveValidationError);

    await expect(
      resolveArgs(candidate!.id, "accept", { projectId: "other" }),
    ).rejects.toBeInstanceOf(ResolveValidationError);
  });

  it("owner accept inserts new accepted; repeat resolve is idempotent", async () => {
    await seedChange("src/e.md", "content-e");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    expect(candidate).not.toBeNull();
    const first = await resolveArgs(candidate!.id, "accept");
    expect(first.accepted?.id).not.toBe(candidate!.id);
    expect(first.accepted?.kind).toBe("accepted");

    const second = await resolveArgs(candidate!.id, "accept");
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
    expect(candidate).not.toBeNull();
    const edited: UnderstandingBody = {
      ...candidate!.body,
      now: { ...candidate!.body.now, text: "Owner 编辑后的当前理解" },
      evidenceRevisionIds: [rev!.id],
    };
    const result = await resolveArgs(candidate!.id, "edit_accept", {
      editedBody: edited,
    });
    expect(result.accepted?.body.now.text).toBe("Owner 编辑后的当前理解");
    expect(result.accepted?.id).not.toBe(candidate!.id);
  });

  it("memory view excludes resolved candidates", async () => {
    await seedChange("src/m.md", "mem");
    const { candidate } = await runStateReconstruction(
      agent(),
      createAgentModelLoop({ mode: "deterministic" }),
      { projectId, matterId },
    );
    expect(candidate).not.toBeNull();
    await resolveArgs(candidate!.id, "accept");

    const view = await getMemoryView(store, projectId, matterId, {
      isCandidateResolved: (id) => store.isCandidateResolved(id),
    });
    expect(view?.accepted).toBeTruthy();
    expect(view?.candidate).toBeNull();
    // raw truth row remains immutable candidate
    const raw = await store.getMatterState(projectId, matterId);
    expect(raw.candidate?.id).toBe(candidate!.id);
  });
});
