/**
 * Protocol → endpoint / headers / body + response text extraction.
 * Anthropic: system is top-level; messages only user/assistant.
 */
import type {
  BuiltLlmRequest,
  LlmAuthMode,
  LlmProtocol,
  LlmTextExtractionResult,
} from "./types";
import { assertSafeRequestUrl } from "./url-policy";

export function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");
}

/** Join base + path without doubling /v1. */
export function joinApiPath(baseUrl: string, apiPath: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (base.endsWith("/v1") && path.startsWith("/v1/")) {
    return `${base}${path.slice(3)}`;
  }
  return `${base}${path}`;
}

export function buildAuthHeaders(
  authMode: LlmAuthMode,
  apiKey: string,
): Record<string, string> {
  const key = apiKey.trim();
  if (authMode === "bearer") {
    return {
      Authorization: `Bearer ${key}`,
      "anthropic-version": "2023-06-01",
    };
  }
  return {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  };
}

export type CompleteRequestInput = {
  protocol: LlmProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  authMode: LlmAuthMode;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
};

/**
 * Build completion request. Anthropic uses top-level `system`, never system role in messages.
 */
export function buildCompleteRequest(input: CompleteRequestInput): BuiltLlmRequest {
  const maxTokens = input.maxTokens ?? 2048;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...buildAuthHeaders(input.authMode, input.apiKey),
  };

  if (input.protocol === "anthropic_messages") {
    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: input.prompt }],
    };
    if (input.systemPrompt && input.systemPrompt.trim()) {
      body.system = input.systemPrompt;
    }
    const url = joinApiPath(input.baseUrl, "/v1/messages");
    assertSafeRequestUrl(url);
    return {
      url,
      method: "POST",
      headers,
      body: JSON.stringify(body),
    };
  }

  if (input.protocol === "openai_chat") {
    const messages: Array<{ role: string; content: string }> = [];
    if (input.systemPrompt) {
      messages.push({ role: "system", content: input.systemPrompt });
    }
    messages.push({ role: "user", content: input.prompt });
    const url = joinApiPath(input.baseUrl, "/v1/chat/completions");
    assertSafeRequestUrl(url);
    return {
      url,
      method: "POST",
      headers,
      body: JSON.stringify({
        model: input.model,
        max_tokens: maxTokens,
        messages,
      }),
    };
  }

  const inputItems: Array<Record<string, unknown>> = [];
  if (input.systemPrompt) {
    inputItems.push({
      role: "system",
      content: [{ type: "input_text", text: input.systemPrompt }],
    });
  }
  inputItems.push({
    role: "user",
    content: [{ type: "input_text", text: input.prompt }],
  });
  const url = joinApiPath(input.baseUrl, "/v1/responses");
  assertSafeRequestUrl(url);
  return {
    url,
    method: "POST",
    headers,
    body: JSON.stringify({
      model: input.model,
      max_output_tokens: maxTokens,
      input: inputItems,
    }),
  };
}

export function buildProbeRequest(input: {
  protocol: LlmProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  authMode: LlmAuthMode;
}): BuiltLlmRequest {
  return buildCompleteRequest({
    ...input,
    prompt: "ping",
    systemPrompt: "Reply with the single word ok.",
    maxTokens: 32,
  });
}

export function buildModelsListRequest(input: {
  baseUrl: string;
  apiKey: string;
  authMode: LlmAuthMode;
}): BuiltLlmRequest {
  const url = joinApiPath(input.baseUrl, "/v1/models");
  assertSafeRequestUrl(url);
  return {
    url,
    method: "GET",
    headers: { ...buildAuthHeaders(input.authMode, input.apiKey) },
  };
}

/**
 * Extract business text. Anthropic: only type=text blocks; skip thinking.
 */
export function extractTextFromResponse(
  protocol: LlmProtocol,
  data: unknown,
): LlmTextExtractionResult {
  if (!data || typeof data !== "object") {
    return { text: "", rawShape: "unknown" };
  }
  const obj = data as Record<string, unknown>;

  if (protocol === "anthropic_messages") {
    const content = obj.content;
    let hadThinking = false;
    if (Array.isArray(content)) {
      const texts: string[] = [];
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const b = block as { type?: string; text?: string };
        if (b.type === "thinking" || b.type === "reasoning") {
          hadThinking = true;
          continue;
        }
        if (b.type === "text" && typeof b.text === "string") {
          texts.push(b.text);
        }
      }
      const text = texts.join("\n").trim();
      return {
        text,
        rawShape: "anthropic_content",
        hadThinkingBlocks: hadThinking,
      };
    }
  }

  if (protocol === "openai_chat") {
    const choices = obj.choices;
    if (Array.isArray(choices) && choices[0]) {
      const msg = (choices[0] as { message?: { content?: unknown } }).message;
      const content = msg?.content;
      if (typeof content === "string") {
        return { text: content.trim(), rawShape: "openai_chat" };
      }
    }
  }

  if (protocol === "openai_responses") {
    if (typeof obj.output_text === "string" && obj.output_text.trim()) {
      return { text: obj.output_text.trim(), rawShape: "openai_responses" };
    }
    const output = obj.output;
    if (Array.isArray(output)) {
      const parts: string[] = [];
      for (const item of output) {
        if (!item || typeof item !== "object") continue;
        const content = (item as { content?: unknown }).content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          if (!c || typeof c !== "object") continue;
          const t = c as { type?: string; text?: string };
          if (
            (t.type === "output_text" || t.type === "text") &&
            typeof t.text === "string"
          ) {
            parts.push(t.text);
          }
        }
      }
      const text = parts.join("\n").trim();
      if (text) return { text, rawShape: "openai_responses" };
    }
  }

  return { text: "", rawShape: "unknown" };
}

export function extractModelIds(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const list = (data as { data?: unknown }).data;
  if (!Array.isArray(list)) return [];
  const ids: string[] = [];
  for (const item of list) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { id?: unknown }).id === "string"
    ) {
      ids.push((item as { id: string }).id);
    }
  }
  return ids;
}

/** Non-empty text required for successful probe. */
export function isNonEmptyProbeText(text: string): boolean {
  return typeof text === "string" && text.trim().length > 0;
}
