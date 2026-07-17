/**
 * Connection probe outcomes.
 */
import { describe, expect, it, vi } from "vitest";
import { testLlmConnection } from "@/shared/llm/test-connection";

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("testLlmConnection", () => {
  it("success returns testedAt not verifiedAt", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes(200, { content: [{ type: "text", text: "ok" }] }),
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
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.testedAt).toMatch(/^\d{4}/);
      expect(r).not.toHaveProperty("verifiedAt");
    }
  });

  it("401 auth message", async () => {
    const fetchImpl = vi.fn(async () => jsonRes(401, { error: "no" }));
    const r = await testLlmConnection({
      provider: "minimax_token_plan",
      protocol: "anthropic_messages",
      baseUrl: "https://api.minimax.io/anthropic",
      apiKey: "k",
      model: "MiniMax-M2.7",
      authMode: "x-api-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/密钥无效/);
      expect(r.errorCode).toBe("auth");
    }
  });

  it("px unreachable on timeout", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
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
    if (!r.ok) {
      expect(r.errorCode).toBe("proxy_unreachable");
      expect(r.error).toMatch(/8317/);
    }
  });
});
