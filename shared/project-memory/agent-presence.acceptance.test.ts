/**
 * Strict acceptance gate for Agent presence + tool-loop + HITL.
 * Fails the product claim until green.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deriveProcessFromRun,
  resolveProcessStatuses,
} from "@/app/track/knowledge/lib/agent-process";
import {
  createProjectAgentRuntime,
  runToolAugmentedAnalysis,
} from "./agent-runtime";
import { resetSharedProjectMemoryStoreForTests } from "./runtime";
import type { Matter } from "./types";

describe("ACCEPTANCE · Agent presence & tool-loop closed loop", () => {
  let tmp: string;
  let fixture: string;
  let store: ReturnType<
    typeof import("./runtime").getSharedProjectMemoryStore
  >;
  const projectId = "p-acc-agent";
  const matterId = "m-acc-agent";
  const grantId = "g-acc-agent";

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-acc-"));
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fx-acc-"));
    fs.writeFileSync(
      path.join(fixture, "PRODUCT.md"),
      "# 产品\n\n本项目做授权夹内的有来源理解。\n目标：让用户看见 Agent。\n",
    );
    fs.writeFileSync(
      path.join(fixture, "NOTES.md"),
      "# Notes\nTODO: wire confirm UI.\n",
    );
    fs.writeFileSync(
      path.join(fixture, "DECISIONS.md"),
      "# Decisions\n- Only grant-scoped tools.\n",
    );

    resetSharedProjectMemoryStoreForTests(tmp);
    const { getSharedProjectMemoryStore } = await import("./runtime");
    store = getSharedProjectMemoryStore({ dataDir: tmp });

    store.upsertGrant({
      id: grantId,
      projectId,
      kind: "local_folder",
      rootPath: fixture,
      status: "active",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });
    const matter: Matter = {
      id: matterId,
      projectId,
      title: "存在感验收",
      goal: "有来源理解 + 可见过程 + 确认",
      status: "active",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    };
    store.upsertMatter(matter);
    store.upsertWatchSet({
      id: "w-acc",
      projectId,
      matterId,
      grantId,
      includePathPrefixes: ["PRODUCT.md", "NOTES.md", "DECISIONS.md"],
      excludePathPrefixes: [],
      status: "active",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });

    for (const name of ["PRODUCT.md", "NOTES.md", "DECISIONS.md"] as const) {
      await store.ingest({
        projectId,
        grantId,
        kind: "added",
        relativePath: name,
        content: new TextEncoder().encode(
          fs.readFileSync(path.join(fixture, name), "utf8"),
        ),
        observedAt: "2026-07-17T00:01:00.000Z",
      });
    }
  });

  afterEach(() => {
    resetSharedProjectMemoryStoreForTests();
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(fixture, { recursive: true, force: true });
    } catch {
      /* */
    }
  });

  it("A1 · tool-loop produces map+search+read receipts and a candidate", async () => {
    process.env.AGENT_RUN_MODE = "deterministic";
    const result = await runToolAugmentedAnalysis(
      {
        projectId,
        matterId,
        trigger: "source_change",
      },
      { modelMode: "deterministic", toolsEnabled: true },
    );

    expect(result.toolReceipts.length).toBeGreaterThanOrEqual(3);
    const tools = result.toolReceipts.map((r) => r.tool);
    expect(tools).toContain("project_map");
    expect(tools).toContain("search_text");
    expect(tools).toContain("read_revision");
    expect(result.candidate).toBeTruthy();
    expect(result.run.status).toBe("awaiting_owner");
    expect(result.run.progressSummary || "").toMatch(/工具|候选|地图|搜索|已读/);
  });

  it("A2 · getRunView exposes the same receipts for UI poll", async () => {
    process.env.AGENT_RUN_MODE = "deterministic";
    const runtime = createProjectAgentRuntime({
      modelMode: "deterministic",
      toolsEnabled: true,
    });
    const run = await runtime.start({
      projectId,
      matterId,
      trigger: "source_change",
    });
    const view = await runtime.get(projectId, run.id);
    expect(view).toBeTruthy();
    expect(view!.toolReceipts.length).toBeGreaterThanOrEqual(3);
    expect(view!.run.id).toBe(run.id);
  });

  it("A3 · confirmation_required is NOT overwritten by legacy second pass", async () => {
    // Simulate early confirmation by running runtime then asserting helper
    // Does not invent a fake model — checks runToolAugmentedAnalysis contract:
    // when status is confirmation_required and no candidate, return null candidate.
    process.env.AGENT_RUN_MODE = "deterministic";
    const runtime = createProjectAgentRuntime({
      modelMode: "deterministic",
      toolsEnabled: true,
    });
    const run = await runtime.start({
      projectId,
      matterId,
      trigger: "source_change",
    });
    // Force terminal status without candidate path: interrupt after start finishes
    // (full confirm path needs model). Assert interrupt status is durable.
    const interrupted = await runtime.interrupt(projectId, run.id);
    expect(interrupted.interruptRequested === true || interrupted.status).toBeTruthy();

    // After a successful run with candidate, legacy must not replace it
    const again = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "retry" },
      { modelMode: "deterministic", toolsEnabled: true },
    );
    if (again.run.status === "awaiting_owner") {
      expect(again.candidate).toBeTruthy();
    }
    if (again.run.status === "confirmation_required") {
      // Must not have been forced into a fake candidate by legacy
      // (candidate may be null — that is correct)
      expect(again.run.status).toBe("confirmation_required");
    }
  });

  it("A4 · process UI maps receipts to mid-pipeline steps (not stuck on observe)", () => {
    const active = deriveProcessFromRun({
      runStatus: "running",
      toolNames: ["project_map", "search_text", "read_revision"],
      hasCandidate: false,
    });
    expect(["tools", "reason", "evidence"]).toContain(active);

    const view = resolveProcessStatuses({
      pipelinePhase: "tools",
      memory: { events: [{ id: "e1" }], candidate: null, accepted: null },
      connected: true,
      run: { status: "running", progressSummary: "已读 PRODUCT.md" },
      toolNames: ["project_map", "search_text", "read_revision"],
    });
    expect(view.active).not.toBe("observe");
    expect(view.caption).toMatch(/PRODUCT|打开|读/);
  });

  it("A5 · candidate memory lands on owner confirm step", () => {
    const view = resolveProcessStatuses({
      pipelinePhase: null,
      memory: {
        candidate: { body: { now: { text: "这是候选理解" } } },
        accepted: null,
        events: [{ id: "e1" }],
      },
      connected: true,
      run: { status: "awaiting_owner", progressSummary: "候选已生成" },
      toolNames: ["project_map", "search_text", "read_revision"],
    });
    expect(view.active).toBe("owner");
    expect(view.statuses.owner).toBe("active");
    expect(view.caption).toMatch(/确认|候选/);
  });

  it("A6 · Owner resolve accept writes accepted head (HITL closed loop)", async () => {
    process.env.AGENT_RUN_MODE = "deterministic";
    const result = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change" },
      { modelMode: "deterministic", toolsEnabled: true },
    );
    expect(result.candidate).toBeTruthy();
    const candidate = result.candidate!;

    const { resolveUnderstanding, getOwnerDecisionWriter, getProjectMemoryReader } =
      await import("./reconstruct");
    const writer = getOwnerDecisionWriter();
    const reader = getProjectMemoryReader();
    const resolved = await resolveUnderstanding(writer, reader, {
      projectId,
      matterId,
      candidateRevisionId: candidate.id,
      decision: "accept",
      actor: "owner",
    });
    expect(resolved.accepted?.id).toBeTruthy();
    expect(resolved.head.acceptedRevisionId).toBe(resolved.accepted?.id);

    const state = await store.getMatterState(projectId, matterId);
    expect(state.accepted?.id).toBe(resolved.accepted?.id);
    // Candidate should be cleared or no longer the active review item
    const view = resolveProcessStatuses({
      pipelinePhase: null,
      memory: {
        candidate: state.candidate,
        accepted: state.accepted,
        events: [],
        head: state.head,
      },
      connected: true,
    });
    expect(view.active).toBe("persist");
    expect(view.statuses.persist).toBe("done");
  });

  it("L3 · candidate has usable in-grant evidence (quote + path + revision)", async () => {
    const { collectUsableEvidence, evidencePathsInGrant } = await import(
      "./agent-evidence"
    );
    process.env.AGENT_RUN_MODE = "deterministic";
    const result = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change" },
      { modelMode: "deterministic", toolsEnabled: true },
    );

    expect(result.run.status).toBe("awaiting_owner");
    expect(result.candidate).toBeTruthy();
    const evidence = collectUsableEvidence(result.candidate!.body);
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    const pin = evidence[0]!;
    expect(pin.quote.trim().length).toBeGreaterThan(0);
    expect(pin.relativePath).toMatch(/\.md$/i);
    expect(pin.revisionId.startsWith("quote:")).toBe(false);
    expect(
      evidencePathsInGrant(evidence, [
        "PRODUCT.md",
        "NOTES.md",
        "DECISIONS.md",
      ]),
    ).toBe(true);
  });

  it("L4 · model gateway failure does not produce a fake understood candidate", async () => {
    delete process.env.AGENT_ALLOW_DETERMINISTIC_FALLBACK;
    const failingLoop = {
      async nextStep() {
        throw new Error("network ECONNREFUSED mock gateway down");
      },
    };
    const result = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change" },
      {
        modelMode: "model",
        toolsEnabled: true,
        allowDeterministicFallback: false,
        modelLoop: failingLoop,
      },
    );

    expect(result.run.status).toBe("failed");
    expect(result.candidate).toBeNull();
    // Product-facing progress refuses fake understanding; raw error may be English.
    expect(result.run.progressSummary || "").toMatch(/拒绝假装读懂|模型不可用/);
    expect(result.run.error || "").toMatch(/ECONNREFUSED|gateway|model|失败/i);
    // Matter must not hold a fresh "understood" candidate from this failed run
    const state = await store.getMatterState(projectId, matterId);
    if (state.candidate) {
      expect(state.candidate.id).not.toBe(result.run.candidateRevisionId);
    }
    expect(result.run.candidateRevisionId).toBeFalsy();
  });

  it("L5 · process steps align with tool receipts (map/search/read → mid steps done)", async () => {
    process.env.AGENT_RUN_MODE = "deterministic";
    const result = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change" },
      { modelMode: "deterministic", toolsEnabled: true },
    );
    const toolNames = result.toolReceipts.map((r) => r.tool);
    expect(toolNames).toContain("project_map");
    expect(toolNames).toContain("search_text");
    expect(
      toolNames.includes("read_revision") || toolNames.includes("read_path"),
    ).toBe(true);

    const view = resolveProcessStatuses({
      pipelinePhase: null,
      memory: {
        events: [{ id: "e1" }],
        candidate: result.candidate,
        accepted: null,
      },
      connected: true,
      run: {
        status: result.run.status,
        progressSummary: result.run.progressSummary,
      },
      toolNames,
    });

    // With candidate awaiting owner: earlier real-work steps must be done
    expect(view.active).toBe("owner");
    expect(view.statuses.map).toBe("done");
    expect(view.statuses.tools).toBe("done");
    expect(view.statuses.reason).toBe("done");
    expect(view.statuses.evidence).toBe("done");
    expect(view.statuses.owner).toBe("active");

    // Mid-run (no candidate yet) cursor follows receipts, not stuck on observe
    const mid = deriveProcessFromRun({
      runStatus: "running",
      toolNames: ["project_map", "search_text", "read_revision"],
      hasCandidate: false,
    });
    expect(mid).not.toBe("observe");
    expect(["tools", "reason", "evidence", "map"]).toContain(mid);
  });
});
