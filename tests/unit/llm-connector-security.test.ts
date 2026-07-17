/**
 * Model connector security + authenticity (RED→GREEN contract).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAndActivate } from "@/shared/llm/activate";
import {
  getByokStatus,
  rejectClientVerifiedAt,
  saveByokSecrets,
  saveByokSecretsAtomic,
} from "@/shared/llm/byok";
import {
  buildAuthHeaders,
  buildCompleteRequest,
  extractTextFromResponse,
  isNonEmptyProbeText,
} from "@/shared/llm/protocol";
import { redactSecrets } from "@/shared/llm/redact";
import { safeLlmFetch, SafeFetchError } from "@/shared/llm/safe-fetch";
import { testLlmConnection } from "@/shared/llm/test-connection";
import {
  captureLlmSnapshot,
  complete,
  getLlmReceiptFields,
} from "@/shared/llm/adapter";
import {
  computeCredentialFingerprint,
  computeProfileFingerprint,
  type LlmConnectionSnapshot,
} from "@/shared/llm/types";
import {
  enforcePresetBaseUrl,
  parseStrictBaseUrl,
  validateCompetitionUrl,
} from "@/shared/llm/url-policy";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-llm-sec-"));
  tmpDirs.push(d);
  return d;
}

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const okAnthropic = () =>
  jsonRes(200, { content: [{ type: "text", text: "ok" }] });

describe("1. client forged verifiedAt cannot produce connected", () => {
  it("rejectClientVerifiedAt blocks body", () => {
    expect(rejectClientVerifiedAt({ verifiedAt: "2026-01-01T00:00:00Z" })).toMatch(
      /verifiedAt/,
    );
  });

  it("legacy verifiedAt without fingerprint → not connected", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    fs.writeFileSync(
      path.join(root, ".env.local"),
      [
        "LLM_BASE_URL=http://127.0.0.1:15721",
        "LLM_API_KEY=legacy-key",
        "LLM_MODEL=step-3.7-flash",
        "LLM_VERIFIED_AT=2026-07-01T00:00:00.000Z",
        "",
      ].join("\n"),
    );
    const status = getByokStatus({ KNOWLEDGE_DATA_DIR: knowledge });
    expect(status.connected).toBe(false);
    expect(status.needsReverify).toBe(true);
    expect(status.legacyLabel || status.provider).toBeTruthy();
  });
});

describe("2. PUT-style activate requires server probe", () => {
  it("activate without successful probe does not connect", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const fetchImpl = vi.fn(async () => jsonRes(401, { error: "nope" }));
    const result = await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "plain-secret-key-xyz",
        verifiedAt: "2026-07-17T99:99:99Z", // client forge ignored
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.ok).toBe(false);
    expect(getByokStatus(env).connected).toBe(false);
  });

  it("activate succeeds only after probe + atomic write", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const fetchImpl = vi.fn(async () => okAnthropic());
    const result = await verifyAndActivate(
      {
        provider: "minimax_token_plan",
        model: "MiniMax-M2.7",
        apiKey: "mm-token-plan-key",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status.connected).toBe(true);
      expect(result.status.provider).toBe("minimax_token_plan");
      expect(result.status.verifiedAt).toBeTruthy();
      expect(env.LLM_PROVIDER).toBe("minimax_token_plan");
      expect(env.LLM_PROFILE_FINGERPRINT).toBeTruthy();
    }
  });
});

describe("3. official domain suffix spoofing", () => {
  it("rejects evil suffix hosts", () => {
    expect(
      validateCompetitionUrl(
        "minimax_token_plan",
        "https://api.minimax.io.evil.example/anthropic",
      ).ok,
    ).toBe(false);
    expect(
      validateCompetitionUrl(
        "stepfun_step_plan",
        "https://api.stepfun.com.evil.example/step_plan",
      ).ok,
    ).toBe(false);
    expect(parseStrictBaseUrl("https://api.stepfun.com@evil.example").ok).toBe(
      false,
    );
  });

  it("rejects credentials, query, wrong protocol, localhost, metadata IP", () => {
    expect(
      parseStrictBaseUrl("https://user:secret@api.stepfun.com/step_plan").ok,
    ).toBe(false);
    expect(
      validateCompetitionUrl("minimax_token_plan", "http://api.minimax.io/anthropic")
        .ok,
    ).toBe(false);
    expect(parseStrictBaseUrl("http://169.254.169.254").ok).toBe(true); // parses
    // but custom/http non-loopback:
    expect(
      enforcePresetBaseUrl("custom_anthropic", "http://169.254.169.254").ok,
    ).toBe(false);
    expect(
      enforcePresetBaseUrl("custom_anthropic", "http://0.0.0.0").ok,
    ).toBe(false);
    expect(
      validateCompetitionUrl("px_proxy", "http://localhost:8317").ok,
    ).toBe(false);
    expect(
      validateCompetitionUrl("px_proxy", "http://127.0.0.1:8317").ok,
    ).toBe(true);
  });
});

describe("4. cross-provider key reuse", () => {
  it("cannot reuse PX key when activating MiniMax", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    // Seed PX
    const fetchOk = vi.fn(async () => okAnthropic());
    await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "px-only-key-111",
      },
      { processEnv: env, fetchImpl: fetchOk as unknown as typeof fetch },
    );
    // Switch to minimax without key
    const result = await verifyAndActivate(
      {
        provider: "minimax_token_plan",
        model: "MiniMax-M2.7",
        apiKey: "",
      },
      { processEnv: env, fetchImpl: fetchOk as unknown as typeof fetch },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/切换供应商|密钥/);
    }
    // Still on PX if previous was connected
    expect(env.LLM_PROVIDER).toBe("px_proxy");
  });
});

describe("5. plain-string key redaction when vendor echoes", () => {
  it("redacts exact plain key from diagnostics", async () => {
    const secret = "plain-token-value-XYZ-999";
    const fetchImpl = vi.fn(async () =>
      jsonRes(401, { error: `invalid key ${secret}` }),
    );
    const r = await testLlmConnection({
      provider: "stepfun_step_plan",
      protocol: "anthropic_messages",
      baseUrl: "https://api.stepfun.com/step_plan",
      apiKey: secret,
      model: "step-3.5-flash",
      authMode: "bearer",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(JSON.stringify(r)).not.toContain(secret);
      expect(r.diagnostic).not.toContain(secret);
    }
    expect(redactSecrets(`got ${secret} back`, { secrets: [secret] })).not.toContain(
      secret,
    );
  });
});

describe("6. Anthropic system is top-level not message role", () => {
  it("puts system field and only user messages", () => {
    const req = buildCompleteRequest({
      protocol: "anthropic_messages",
      baseUrl: "http://127.0.0.1:8317",
      apiKey: "k",
      model: "gpt-5.6-sol",
      authMode: "bearer",
      prompt: "hi",
      systemPrompt: "you are helpful",
    });
    const body = JSON.parse(req.body!);
    expect(body.system).toBe("you are helpful");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.messages.every((m: { role: string }) => m.role !== "system")).toBe(
      true,
    );
    expect(req.url).toBe("http://127.0.0.1:8317/v1/messages");
  });

  it("auth headers: bearer vs x-api-key with anthropic-version", () => {
    const b = buildAuthHeaders("bearer", "px-key");
    expect(b.Authorization).toBe("Bearer px-key");
    expect(b["anthropic-version"]).toBe("2023-06-01");
    const x = buildAuthHeaders("x-api-key", "mm-key");
    expect(x["x-api-key"]).toBe("mm-key");
    expect(x.Authorization).toBeUndefined();
  });

  it("MiniMax path joins to /anthropic/v1/messages", () => {
    const req = buildCompleteRequest({
      protocol: "anthropic_messages",
      baseUrl: "https://api.minimax.io/anthropic",
      apiKey: "k",
      model: "MiniMax-M2.7",
      authMode: "x-api-key",
      prompt: "p",
    });
    expect(req.url).toBe("https://api.minimax.io/anthropic/v1/messages");
  });

  it("Step Plan path joins to /step_plan/v1/messages", () => {
    const req = buildCompleteRequest({
      protocol: "anthropic_messages",
      baseUrl: "https://api.stepfun.com/step_plan",
      apiKey: "k",
      model: "step-3.5-flash",
      authMode: "bearer",
      prompt: "p",
    });
    expect(req.url).toBe("https://api.stepfun.com/step_plan/v1/messages");
  });
});

describe("7. HTTP 200 empty / thinking-only fails probe", () => {
  it("empty content fails", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes(200, { content: [] }),
    );
    const r = await testLlmConnection({
      provider: "px_proxy",
      protocol: "anthropic_messages",
      baseUrl: "http://127.0.0.1:8317",
      apiKey: "k",
      model: "gpt-5.6-sol",
      authMode: "bearer",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe("invalid_response");
  });

  it("thinking-only blocks fail; text extracted without thinking", () => {
    const thinkingOnly = extractTextFromResponse("anthropic_messages", {
      content: [{ type: "thinking", text: "secret chain" }],
    });
    expect(thinkingOnly.text).toBe("");
    expect(thinkingOnly.hadThinkingBlocks).toBe(true);
    expect(isNonEmptyProbeText(thinkingOnly.text)).toBe(false);

    const mixed = extractTextFromResponse("anthropic_messages", {
      content: [
        { type: "thinking", text: "internal" },
        { type: "text", text: "  answer  " },
      ],
    });
    expect(mixed.text).toBe("answer");
  });
});

describe("8. Run freezes snapshot — mid-switch does not drift", () => {
  it("complete uses frozen snapshot not process.env", async () => {
    const cred = computeCredentialFingerprint("px-key-A");
    const fp = computeProfileFingerprint({
      provider: "px_proxy",
      protocol: "anthropic_messages",
      authMode: "bearer",
      baseUrl: "http://127.0.0.1:8317",
      model: "gpt-5.6-sol",
      credentialFingerprint: cred,
    });
    const snapA: LlmConnectionSnapshot = {
      provider: "px_proxy",
      connectionKind: "proxy",
      protocol: "anthropic_messages",
      authMode: "bearer",
      baseUrl: "http://127.0.0.1:8317",
      model: "gpt-5.6-sol",
      apiKey: "px-key-A",
      verifiedAt: "2026-07-17T00:00:00.000Z",
      profileFingerprint: fp,
    };
    // Poison process env to MiniMax
    const keys = [
      "LLM_PROVIDER",
      "LLM_MODEL",
      "LLM_BASE_URL",
      "LLM_API_KEY",
      "LLM_PROTOCOL",
      "LLM_AUTH_MODE",
    ] as const;
    const prev: Record<string, string | undefined> = {};
    for (const k of keys) prev[k] = process.env[k];
    process.env.LLM_PROVIDER = "minimax_token_plan";
    process.env.LLM_MODEL = "MiniMax-M2.7";
    process.env.LLM_BASE_URL = "https://api.minimax.io/anthropic";
    process.env.LLM_API_KEY = "mm-key-B";
    process.env.LLM_PROTOCOL = "anthropic_messages";
    process.env.LLM_AUTH_MODE = "x-api-key";

    try {
      const calls: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        calls.push(String(url));
        return okAnthropic();
      });

      await complete("hi", "sys", {
        snapshot: snapA,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        maxRetries: 1,
      });
      expect(calls[0]).toContain("127.0.0.1:8317");
      expect(calls[0]).not.toContain("minimax");

      const receipt = getLlmReceiptFields(snapA);
      expect(receipt.provider).toBe("px_proxy");
      expect(receipt.requestedModel).toBe("gpt-5.6-sol");
      expect(receipt.baseHost).toBe("127.0.0.1:8317");
      expect(receipt.connectionKind).toBe("proxy");
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });
});

describe("9. package script refuses default overwrite", () => {
  it("package-desktop source contains refuse guard", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../scripts/desktop-package-out.mjs"),
      "utf8",
    );
    expect(src).toMatch(/Refusing to overwrite existing fallback/);
    expect(src).toMatch(/DESKTOP_PACKAGE_OUT|packageOutEnv/);
  });
});

describe("10. legacy env not auto official", () => {
  it("127.0.0.1:15721 + step-3.7-flash is legacy reverify not Step Plan", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    fs.writeFileSync(
      path.join(root, ".env.local"),
      [
        "LLM_BASE_URL=http://127.0.0.1:15721",
        "LLM_API_KEY=old",
        "LLM_MODEL=step-3.7-flash",
        "LLM_PROVIDER=stepfun",
        "LLM_VERIFIED_AT=2026-07-16T00:00:00.000Z",
        "",
      ].join("\n"),
    );
    const status = getByokStatus({ KNOWLEDGE_DATA_DIR: knowledge });
    expect(status.connected).toBe(false);
    expect(status.provider).not.toBe("stepfun_step_plan");
    expect(status.needsReverify).toBe(true);
  });
});

describe("redirect gate blocks all 3xx with auth", () => {
  it("302 same and cross origin", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1:8317/v1/messages" },
      }),
    );
    await expect(
      safeLlmFetch("http://127.0.0.1:8317/v1/messages", {
        headers: { Authorization: "Bearer x" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "redirect_blocked" });
  });
});

describe("changing model invalidates fingerprint", () => {
  it("fingerprint changes when model changes", () => {
    const a = computeProfileFingerprint({
      provider: "px_proxy",
      protocol: "anthropic_messages",
      authMode: "bearer",
      baseUrl: "http://127.0.0.1:8317",
      model: "gpt-5.6-sol",
      credentialFingerprint: "cf_same",
    });
    const b = computeProfileFingerprint({
      provider: "px_proxy",
      protocol: "anthropic_messages",
      authMode: "bearer",
      baseUrl: "http://127.0.0.1:8317",
      model: "grok-4.5",
      credentialFingerprint: "cf_same",
    });
    expect(a).not.toBe(b);
  });
});

describe("activate fail preserves previous connected profile", () => {
  it("failed second activate keeps first", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) return okAnthropic();
      return jsonRes(401, { error: "bad" });
    });
    const first = await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "key-one",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(first.ok).toBe(true);
    const second = await verifyAndActivate(
      {
        provider: "stepfun_step_plan",
        model: "step-3.5-flash",
        apiKey: "key-two",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(second.ok).toBe(false);
    expect(env.LLM_PROVIDER).toBe("px_proxy");
    expect(env.LLM_MODEL).toBe("gpt-5.6-sol");
    expect(getByokStatus(env).connected).toBe(true);
  });
});
