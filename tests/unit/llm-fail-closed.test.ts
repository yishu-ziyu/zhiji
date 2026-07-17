/**
 * Product model mode: LLM auth/network/timeout/5xx must not mint Candidate.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireVerifiedLlmSnapshot } from "@/shared/llm/adapter";
import { verifyAndActivate } from "@/shared/llm/activate";
import {
  computeCredentialFingerprint,
  computeProfileFingerprint,
} from "@/shared/llm/types";
import {
  createAgentModelLoop,
} from "@/shared/project-memory/agent-model-loop";
import {
  createProjectAgentRuntime,
  runToolAugmentedAnalysis,
} from "@/shared/project-memory/agent-runtime";
import { runStateReconstruction } from "@/shared/project-memory/reconstruct";
import {
  getSharedAgentMemoryService,
  getSharedProjectMemoryStore,
  resetSharedProjectMemoryStoreForTests,
} from "@/shared/project-memory/runtime";
import type { Matter } from "@/shared/project-memory/types";

const tmpDirs: string[] = [];
const envKeys = [
  "KNOWLEDGE_DATA_DIR",
  "PROJECT_MEMORY_DATA_DIR",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_PROVIDER",
  "LLM_PROTOCOL",
  "LLM_AUTH_MODE",
  "LLM_VERIFIED_AT",
  "LLM_PROFILE_FINGERPRINT",
  "LLM_CONNECTION_KIND",
  "AGENT_ALLOW_DETERMINISTIC_FALLBACK",
] as const;

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  resetSharedProjectMemoryStoreForTests();
  for (const k of envKeys) delete process.env[k];
  vi.restoreAllMocks();
});

function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-failclosed-"));
  tmpDirs.push(d);
  return d;
}

function okAnthropic(text = "ok") {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function seedVerifiedEnv(root: string, apiKey = "fail-closed-key") {
  const knowledge = path.join(root, "knowledge");
  fs.mkdirSync(knowledge, { recursive: true });
  const env: Record<string, string | undefined> = {
    KNOWLEDGE_DATA_DIR: knowledge,
  };
  const fetchOk = vi.fn(async () => okAnthropic());
  const result = await verifyAndActivate(
    {
      provider: "px_proxy",
      model: "gpt-5.6-sol",
      apiKey,
    },
    { processEnv: env, fetchImpl: fetchOk as unknown as typeof fetch },
  );
  expect(result.ok).toBe(true);
  Object.assign(process.env, env);
  const snap = requireVerifiedLlmSnapshot(
    env as unknown as NodeJS.ProcessEnv,
  );
  return { env, snap, fetchOk };
}

async function seedProject(
  pmDir: string,
  opts: { withGrant: boolean; grantMissing?: boolean } = { withGrant: true },
) {
  resetSharedProjectMemoryStoreForTests(pmDir);
  process.env.PROJECT_MEMORY_DATA_DIR = pmDir;
  const store = getSharedProjectMemoryStore({ dataDir: pmDir });
  const projectId = "p-fc";
  const matterId = "m-fc";
  const grantId = "g-fc";
  const fixture = path.join(pmDir, "fixture");
  fs.mkdirSync(fixture, { recursive: true });
  fs.writeFileSync(path.join(fixture, "NOTES.md"), "# Notes\nship fail-closed\n");

  const matter: Matter = {
    id: matterId,
    projectId,
    title: "fail-closed",
    goal: "no fake candidate",
    status: "active",
    createdAt: "2026-07-16T10:00:00.000Z",
    updatedAt: "2026-07-16T10:00:00.000Z",
  };
  store.upsertMatter(matter);

  if (opts.withGrant) {
    store.upsertGrant({
      id: grantId,
      projectId,
      kind: "local_folder",
      rootPath: fixture,
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    // grant-missing: watchSet points at a grant id that was never upserted → legacy path.
    const watchGrantId = opts.grantMissing ? "g-missing-no-row" : grantId;
    store.upsertWatchSet({
      id: "w-fc",
      projectId,
      matterId,
      grantId: watchGrantId,
      includePathPrefixes: ["NOTES.md"],
      excludePathPrefixes: [],
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    await store.ingest({
      projectId,
      grantId,
      kind: "added",
      relativePath: "NOTES.md",
      content: new TextEncoder().encode("# Notes\nship fail-closed\n"),
      observedAt: "2026-07-16T10:01:00.000Z",
    });
  }

  return { store, projectId, matterId, grantId, service: getSharedAgentMemoryService() };
}

describe("credential fingerprint uses crypto HMAC-SHA256", () => {
  it("is stable, key-sensitive, and not FNV-width", () => {
    const a = computeCredentialFingerprint("key-A");
    const b = computeCredentialFingerprint("key-A");
    const c = computeCredentialFingerprint("key-B");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("cf_")).toBe(true);
    // SHA-256 hex is 64 chars after prefix
    expect(a.length).toBe("cf_".length + 64);
    expect(a).toMatch(/^cf_[0-9a-f]{64}$/);
  });

  it("profile fingerprint still excludes raw key material from receipt shape", () => {
    const cred = computeCredentialFingerprint("secret-material");
    const fp = computeProfileFingerprint({
      provider: "px_proxy",
      protocol: "anthropic_messages",
      authMode: "bearer",
      baseUrl: "http://127.0.0.1:8317",
      model: "gpt-5.6-sol",
      credentialFingerprint: cred,
    });
    expect(fp.startsWith("fp_")).toBe(true);
    expect(fp).not.toContain("secret-material");
    expect(fp).not.toBe(cred);
  });
});

describe("product model fail-closed (no Candidate on LLM failure)", () => {
  it("verified + grant-missing + LLM 500 → failed, candidate null, saveCandidate 0", async () => {
    const root = tmpDir();
    const pm = path.join(root, "pm");
    fs.mkdirSync(pm, { recursive: true });
    const { snap } = await seedVerifiedEnv(root);
    const { store, projectId, matterId, service } = await seedProject(pm, {
      withGrant: true,
      grantMissing: true,
    });

    let saveCalls = 0;
    const origSave = store.saveCandidate.bind(store);
    store.saveCandidate = async (run, body) => {
      saveCalls += 1;
      return origSave(run, body);
    };

    const fetch500 = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "upstream boom" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const origFetch = globalThis.fetch;
    globalThis.fetch = fetch500 as unknown as typeof fetch;

    try {
      const runtime = createProjectAgentRuntime({
        modelMode: "model",
        allowDeterministicFallback: false,
        llmSnapshot: snap,
      });
      const run = await runtime.start({
        projectId,
        matterId,
        trigger: "source_change",
      });
      expect(run.status).toBe("failed");
      expect(run.candidateRevisionId).toBeUndefined();
      expect(run.modelReceipt?.provider).toBe("px_proxy");
      expect(run.modelReceipt?.model).toBe("gpt-5.6-sol");
      expect(run.modelReceipt?.calls).toBeGreaterThanOrEqual(1);
      expect(run.modelReceipt?.fallback).toMatchObject({
        used: true,
        errorClass: "provider_5xx",
      });
      // Receipt must not leak credential fingerprint
      expect(JSON.stringify(run.modelReceipt)).not.toMatch(/cf_[0-9a-f]{64}/);
      expect(saveCalls).toBe(0);
      const state = await service.getMatterState(projectId, matterId);
      expect(state.candidate ?? null).toBeNull();
      expect(fetch500).toHaveBeenCalled();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("verified + auth 401 → failed, candidate null", async () => {
    const root = tmpDir();
    const pm = path.join(root, "pm");
    fs.mkdirSync(pm, { recursive: true });
    const { snap } = await seedVerifiedEnv(root, "auth-401-key");
    const { projectId, matterId, service } = await seedProject(pm, {
      withGrant: true,
      grantMissing: true,
    });

    const fetch401 = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const origFetch = globalThis.fetch;
    globalThis.fetch = fetch401 as unknown as typeof fetch;

    try {
      const runtime = createProjectAgentRuntime({
        modelMode: "model",
        allowDeterministicFallback: false,
        llmSnapshot: snap,
      });
      const run = await runtime.start({
        projectId,
        matterId,
        trigger: "source_change",
      });
      expect(run.status).toBe("failed");
      expect(run.candidateRevisionId).toBeUndefined();
      expect(run.modelReceipt?.fallback).toMatchObject({
        used: true,
        errorClass: "auth",
      });
      const state = await service.getMatterState(projectId, matterId);
      expect(state.candidate ?? null).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("main tool path modelLoop 500: failed + no candidate (saveCandidate 0)", async () => {
    const root = tmpDir();
    const pm = path.join(root, "pm");
    fs.mkdirSync(pm, { recursive: true });
    const { snap } = await seedVerifiedEnv(root, "tool-path-key");
    const { store, projectId, matterId } = await seedProject(pm, {
      withGrant: true,
    });
    let saveCalls = 0;
    const origSave = store.saveCandidate.bind(store);
    store.saveCandidate = async (run, body) => {
      saveCalls += 1;
      return origSave(run, body);
    };

    const result = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change" },
      {
        modelMode: "model",
        allowDeterministicFallback: false,
        llmSnapshot: snap,
        modelLoop: {
          async nextStep() {
            throw new Error("LLM API error (500) provider boom");
          },
        },
      },
    );
    expect(result.run.status).toBe("failed");
    expect(result.candidate).toBeNull();
    expect(result.run.modelReceipt?.fallback).toMatchObject({
      used: true,
      errorClass: "provider_5xx",
    });
    expect(saveCalls).toBe(0);
  });

  it("after runtime ends, env model switch must not trigger a new model call on tail", async () => {
    const root = tmpDir();
    const pm = path.join(root, "pm");
    fs.mkdirSync(pm, { recursive: true });
    const { snap } = await seedVerifiedEnv(root, "tail-freeze-key");
    const { projectId, matterId } = await seedProject(pm, { withGrant: true });

    const completeSpy = vi.spyOn(
      await import("@/shared/llm/adapter"),
      "complete",
    );

    // First path: fail closed without candidate
    const result = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change" },
      {
        modelMode: "model",
        allowDeterministicFallback: false,
        llmSnapshot: snap,
        modelLoop: {
          async nextStep() {
            throw new Error("LLM API error (503) unavailable");
          },
        },
      },
    );
    expect(result.run.status).toBe("failed");
    expect(result.candidate).toBeNull();
    const callsAfter = completeSpy.mock.calls.length;

    // Poison process.env as if Owner switched model after Run ended
    process.env.LLM_MODEL = "grok-4.5";
    process.env.LLM_PROVIDER = "minimax_token_plan";
    process.env.LLM_BASE_URL = "https://api.minimax.io/anthropic";
    process.env.LLM_API_KEY = "switched-key";

    // Tail path re-entry: same failed run shape — must not re-call complete
    // (previous bug: toolReceipts.length===0 created a fresh model loop)
    const again = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change", runId: result.run.id },
      {
        modelMode: "model",
        allowDeterministicFallback: false,
        llmSnapshot: snap,
        modelLoop: {
          async nextStep() {
            throw new Error("should not be reached if reuse failed early");
          },
        },
      },
    );
    // Source guard: no second createAgentModelLoop without snapshot in tail
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../shared/project-memory/agent-runtime.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(
      /toolReceipts\.length\s*===\s*0[\s\S]{0,200}createAgentModelLoop/,
    );
    expect(completeSpy.mock.calls.length).toBe(callsAfter);
    expect(again.candidate).toBeNull();
  });

  it("deterministic explicit mode still produces candidate", async () => {
    const root = tmpDir();
    const pm = path.join(root, "pm");
    fs.mkdirSync(pm, { recursive: true });
    const { projectId, matterId, service } = await seedProject(pm, {
      withGrant: true,
    });
    const result = await runToolAugmentedAnalysis(
      { projectId, matterId, trigger: "source_change" },
      { modelMode: "deterministic", toolsEnabled: true },
    );
    expect(result.run.status).toBe("awaiting_owner");
    expect(result.candidate).not.toBeNull();
    expect(result.candidate!.kind).toBe("candidate");
    const state = await service.getMatterState(projectId, matterId);
    expect(state.candidate?.id).toBe(result.candidate!.id);
  });

  it("reconstruct propose 500: failed + null + modelReceipt errorClass", async () => {
    const root = tmpDir();
    const pm = path.join(root, "pm");
    fs.mkdirSync(pm, { recursive: true });
    const { snap } = await seedVerifiedEnv(root, "recon-500");
    const { projectId, matterId, service } = await seedProject(pm, {
      withGrant: true,
      grantMissing: true,
    });
    let saveCalls = 0;
    const base = service;
    const counting = {
      readRevision: base.readRevision.bind(base),
      listEvents: base.listEvents.bind(base),
      getMatterState: base.getMatterState.bind(base),
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
      llmSnapshot: snap,
      complete: async () => {
        throw new Error("LLM API error (500) boom");
      },
    });
    const { run, candidate } = await runStateReconstruction(
      counting,
      model,
      { projectId, matterId },
      { llmSnapshot: snap },
    );
    expect(candidate).toBeNull();
    expect(run.status).toBe("failed");
    expect(run.modelReceipt?.provider).toBe("px_proxy");
    expect(run.modelReceipt?.model).toBe("gpt-5.6-sol");
    expect(run.modelReceipt?.fallback).toMatchObject({
      used: true,
      errorClass: "provider_5xx",
    });
    expect(saveCalls).toBe(0);
  });
});

describe("allowDeterministicFallback explicit still soft-shells", () => {
  it("createAgentModelLoop with allow=true returns shell body", async () => {
    const loop = createAgentModelLoop({
      mode: "model",
      allowDeterministicFallback: true,
      complete: async () => {
        throw new Error("network ECONNREFUSED");
      },
    });
    const body = await loop.propose({
      projectId: "p",
      matterId: "m",
      events: [],
      evidenceSnippets: [],
    });
    expect(body.now.text).toContain("暂时无法进一步分析");
  });
});
