/**
 * Protocol builders + response text extraction.
 */
import { describe, expect, it } from "vitest";
import {
  buildAuthHeaders,
  buildCompleteRequest,
  extractTextFromResponse,
  joinApiPath,
} from "@/shared/llm/protocol";

describe("joinApiPath", () => {
  it("avoids double /v1", () => {
    expect(joinApiPath("https://api.openai.com/v1", "/v1/models")).toBe(
      "https://api.openai.com/v1/models",
    );
  });
});

describe("anthropic_messages", () => {
  it("top-level system + user only", () => {
    const req = buildCompleteRequest({
      protocol: "anthropic_messages",
      baseUrl: "https://api.minimax.io/anthropic",
      apiKey: "k",
      model: "MiniMax-M2.7",
      authMode: "x-api-key",
      prompt: "hi",
      systemPrompt: "sys",
    });
    expect(req.url).toBe("https://api.minimax.io/anthropic/v1/messages");
    const body = JSON.parse(req.body!);
    expect(body.system).toBe("sys");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("skips thinking blocks", () => {
    const r = extractTextFromResponse("anthropic_messages", {
      content: [
        { type: "thinking", text: "nope" },
        { type: "text", text: "yes" },
      ],
    });
    expect(r.text).toBe("yes");
    expect(r.hadThinkingBlocks).toBe(true);
  });
});

describe("auth headers", () => {
  it("bearer and x-api-key", () => {
    expect(buildAuthHeaders("bearer", "a").Authorization).toBe("Bearer a");
    expect(buildAuthHeaders("x-api-key", "b")["x-api-key"]).toBe("b");
  });
});
