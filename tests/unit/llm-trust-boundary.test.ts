/**
 * Trust boundary: unverified never calls LLM; credential binding; empty body fails.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  complete,
  InvalidLlmResponseError,
  isSnapshotVerified,
  requireVerifiedLlmSnapshot,
  UnverifiedConnectionError,
  UNVERIFIED_CONNECTION_MESSAGE,
} from "@/shared/llm/adapter";
import { verifyAndActivate } from "@/shared/llm/activate";
import { getByokStatus, saveByokSecrets } from "@/shared/llm/byok";
import {
  computeCredentialFingerprint,
  computeProfileFingerprint,
} from "@/shared/llm/types";
import { resolveDesktopPackageOutDir } from "../../scripts/desktop-package-out.mjs";
import { createProjectAgentRuntime } from "@/shared/project-memory/agent-runtime";
import {
  getSharedProjectMemoryStore,
  resetSharedProjectMemoryStoreForTests,
} from "@/shared/project-memory/runtime";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  resetSharedProjectMemoryStoreForTests();
});

function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-trust-"));
  tmpDirs.push(d);
  return d;
}

function okAnthropic() {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text: "ok" }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("P0 unverified connection never reaches LLM", () => {
  it("requireVerifiedLlmSnapshot throws for legacy needsReverify", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    fs.writeFileSync(
      path.join(root, ".env.local"),
      [
        "LLM_BASE_URL=http://127.0.0.1:15721",
        "LLM_API_KEY=legacy-key",
        "LLM_MODEL=step-3.7-flash",
        "LLM_PROVIDER=legacy_custom",
        "LLM_VERIFIED_AT=2026-07-01T00:00:00.000Z",
        "",
      ].join("\n"),
    );
    const env = {
      KNOWLEDGE_DATA_DIR: knowledge,
      LLM_BASE_URL: "http://127.0.0.1:15721",
      LLM_API_KEY: "legacy-key",
      LLM_MODEL: "step-3.7-flash",
      LLM_PROVIDER: "legacy_custom",
      LLM_VERIFIED_AT: "2026-07-01T00:00:00.000Z",
    };
    // Apply to process for requireVerified
    Object.assign(process.env, env);
    try {
      expect(() =>
        requireVerifiedLlmSnapshot(env as unknown as NodeJS.ProcessEnv),
      ).toThrow(UnverifiedConnectionError);
      expect(getByokStatus(env).connected).toBe(false);
    } finally {
      for (const k of Object.keys(env)) delete process.env[k];
    }
  });

  it("Agent Run with unverified env: status failed, fetch count 0, no candidate", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    const pm = path.join(root, "pm");
    fs.mkdirSync(knowledge, { recursive: true });
    fs.mkdirSync(pm, { recursive: true });
    process.env.KNOWLEDGE_DATA_DIR = knowledge;
    process.env.PROJECT_MEMORY_DATA_DIR = pm;
    process.env.LLM_BASE_URL = "http://127.0.0.1:15721";
    process.env.LLM_API_KEY = "unverified-legacy";
    process.env.LLM_MODEL = "step-3.7-flash";
    process.env.LLM_PROVIDER = "legacy_custom";
    delete process.env.LLM_VERIFIED_AT;
    delete process.env.LLM_PROFILE_FINGERPRINT;

    const fetchImpl = vi.fn(async () => okAnthropic());
    const origFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    try {
      resetSharedProjectMemoryStoreForTests(pm);
      // Fail before matter lookup when model mode + unverified.
      const runtime = createProjectAgentRuntime({ modelMode: "model" });
      const run = await runtime.start({
        projectId: "p-trust",
        matterId: "m-trust",
        trigger: "source_change",
        eventIds: [],
      });
      expect(run.status).toBe("failed");
      expect(run.error).toBe(UNVERIFIED_CONNECTION_MESSAGE);
      expect(run.candidateRevisionId).toBeUndefined();
      expect(fetchImpl).toHaveBeenCalledTimes(0);
    } finally {
      globalThis.fetch = origFetch;
      delete process.env.KNOWLEDGE_DATA_DIR;
      delete process.env.PROJECT_MEMORY_DATA_DIR;
      delete process.env.LLM_BASE_URL;
      delete process.env.LLM_API_KEY;
      delete process.env.LLM_MODEL;
      delete process.env.LLM_PROVIDER;
    }
  });
});

describe("P0 credential fingerprint binding", () => {
  it("replacing Key only clears connected", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const fetchImpl = vi.fn(async () => okAnthropic());
    const first = await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "key-AAA-original",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.status.connected).toBe(true);
    const fp1 = first.status.profileFingerprint!;

    // Same profile fields, different key — write unverified overwrite of key only
    // Simulate key rotation in env file while keeping old verifiedAt/fp (attack/stale).
    env.LLM_API_KEY = "key-BBB-rotated";
    // Keep old fingerprint + verifiedAt in env (stale)
    // getByokStatus should recompute and invalidate
    const status = getByokStatus(env);
    expect(status.connected).toBe(false);
    expect(status.needsReverify).toBe(true);
    // Recomputed identity for new key differs from stored verified fingerprint.
    const newFp = computeProfileFingerprint({
      provider: "px_proxy",
      protocol: "anthropic_messages",
      authMode: "bearer",
      baseUrl: "http://127.0.0.1:8317",
      model: "gpt-5.6-sol",
      credentialFingerprint: computeCredentialFingerprint("key-BBB-rotated"),
    });
    expect(newFp).not.toBe(fp1);
    expect(status.profileFingerprint).toBe(fp1); // stale stored
    // Live status must not treat stale fp as connected
    expect(status.connected).toBe(false);
  });

  it("saveByokSecrets with verifiedAt cannot produce connected", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const status = saveByokSecrets(
      {
        llmBaseUrl: "http://127.0.0.1:8317",
        llmApiKey: "k",
        llmModel: "gpt-5.6-sol",
        provider: "px_proxy",
        protocol: "anthropic_messages",
        authMode: "bearer",
        verifiedAt: "2026-07-17T00:00:00.000Z",
      },
      { processEnv: env },
    );
    expect(status.connected).toBe(false);
    expect(status.verifiedAt).toBeNull();
  });
});

describe("P1 empty response throws invalid_response", () => {
  it("HTTP 200 empty text throws, not soft string", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const fetchOk = vi.fn(async () => okAnthropic());
    await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "key-for-empty",
      },
      { processEnv: env, fetchImpl: fetchOk as unknown as typeof fetch },
    );
    Object.assign(process.env, env);
    try {
      const snap = requireVerifiedLlmSnapshot(
        env as unknown as NodeJS.ProcessEnv,
      );
      const emptyFetch = vi.fn(async () =>
        new Response(JSON.stringify({ content: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await expect(
        complete("hi", undefined, {
          snapshot: snap,
          fetchImpl: emptyFetch as unknown as typeof fetch,
          maxRetries: 1,
        }),
      ).rejects.toBeInstanceOf(InvalidLlmResponseError);
      expect(emptyFetch).toHaveBeenCalled();
    } finally {
      for (const k of Object.keys(env)) {
        if (env[k] !== undefined) delete process.env[k];
      }
    }
  });

  it("response body that never finishes obeys the same timeout", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "key-for-stalled-body",
      },
      {
        processEnv: env,
        fetchImpl: vi.fn(async () => okAnthropic()) as unknown as typeof fetch,
      },
    );
    const snap = requireVerifiedLlmSnapshot(env as NodeJS.ProcessEnv);
    const stalledFetch = vi.fn(async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"content":['));
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      complete("hi", undefined, {
        snapshot: snap,
        fetchImpl: stalledFetch as unknown as typeof fetch,
        timeout: 30,
        maxRetries: 1,
      }),
    ).rejects.toThrow(/timeout|超时/i);
  }, 500);
});

describe("P1 package out refuses out / ./out / absolute out", () => {
  it("normalizes and rejects fallback root", () => {
    const root = tmpDir();
    // Fake fallback app
    const fallback = path.join(
      root,
      "out",
      "知几-darwin-arm64",
      "知几.app",
    );
    fs.mkdirSync(fallback, { recursive: true });
    fs.writeFileSync(path.join(fallback, "Contents"), "x");

    expect(() =>
      resolveDesktopPackageOutDir({ root, packageOutEnv: undefined }),
    ).toThrow(/Refusing to overwrite/);
    expect(() =>
      resolveDesktopPackageOutDir({ root, packageOutEnv: "out" }),
    ).toThrow(/Refusing to overwrite/);
    expect(() =>
      resolveDesktopPackageOutDir({ root, packageOutEnv: "./out" }),
    ).toThrow(/Refusing to overwrite/);
    expect(() =>
      resolveDesktopPackageOutDir({
        root,
        packageOutEnv: path.join(root, "out"),
      }),
    ).toThrow(/Refusing to overwrite/);

    const ok = resolveDesktopPackageOutDir({
      root,
      packageOutEnv: "out/model-connector-trust-candidate",
    });
    expect(ok).toContain("model-connector-trust-candidate");
  });
});

describe("P1 model-level connected status", () => {
  it("UI source: sibling alias not 已连接", () => {
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../app/track/knowledge/components/ModelConnector.tsx",
      ),
      "utf8",
    );
    expect(src).toMatch(/切换后需测试/);
    expect(src).toMatch(/isExactConnected/);
    // Must not green other models of same provider without exact model id
    expect(src).not.toMatch(
      /status\?\.provider === row\.provider\s*\)\s*\{\s*statusText = "已连接"/,
    );
  });
});

describe("P1 snapshot freeze after env change", () => {
  it("complete keeps frozen snapshot when process.env changes mid-flight", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const fetchImpl = vi.fn(async (url: string) => {
      // Record host from URL
      (fetchImpl as unknown as { urls: string[] }).urls =
        (fetchImpl as unknown as { urls: string[] }).urls || [];
      (fetchImpl as unknown as { urls: string[] }).urls.push(String(url));
      return okAnthropic();
    });
    await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "freeze-key",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    Object.assign(process.env, env);
    try {
      const snap = requireVerifiedLlmSnapshot(
        env as unknown as NodeJS.ProcessEnv,
      );
      expect(isSnapshotVerified(snap, env)).toBe(true);

      // Poison env mid-run
      process.env.LLM_MODEL = "grok-4.5";
      process.env.LLM_PROVIDER = "minimax_token_plan";
      process.env.LLM_BASE_URL = "https://api.minimax.io/anthropic";
      process.env.LLM_API_KEY = "other-key";

      await complete("ping", undefined, {
        snapshot: snap,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        maxRetries: 1,
      });
      const urls = (fetchImpl as unknown as { urls: string[] }).urls;
      expect(urls.some((u) => u.includes("127.0.0.1:8317"))).toBe(true);
      expect(urls.every((u) => !u.includes("minimax"))).toBe(true);
    } finally {
      for (const k of [
        "KNOWLEDGE_DATA_DIR",
        "LLM_BASE_URL",
        "LLM_API_KEY",
        "LLM_MODEL",
        "LLM_PROVIDER",
        "LLM_PROTOCOL",
        "LLM_AUTH_MODE",
        "LLM_VERIFIED_AT",
        "LLM_PROFILE_FINGERPRINT",
        "LLM_CONNECTION_KIND",
      ]) {
        delete process.env[k];
      }
    }
  });
});

describe("P2 competition list minimal", () => {
  it("presets drop step-3.5-flash-2603", async () => {
    const { competitionPresets } = await import("@/shared/llm/presets");
    const step = competitionPresets().find(
      (p) => p.provider === "stepfun_step_plan",
    );
    expect(step?.models.map((m) => m.id)).toEqual(["step-3.5-flash"]);
  });
});
