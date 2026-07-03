import { LLMConfig } from "@/shared/types/common";

export function getLLMConfig(): LLMConfig {
  const baseUrl = process.env.LLM_BASE_URL || "http://127.0.0.1:15721";
  const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || "";
  const model = process.env.LLM_MODEL || "step-3.7-flash";

  if (!apiKey) {
    console.warn("LLM_API_KEY or ANTHROPIC_AUTH_TOKEN not configured");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    model,
    timeout: 30000,
  };
}

export function extractJson(text: string): Record<string, unknown> {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      try {
        return JSON.parse(text.slice(i));
      } catch {
        // try next {
      }
    }
  }
  throw new Error("No valid JSON found in response");
}

export async function complete(prompt: string, systemPrompt?: string): Promise<string> {
  const config = getLLMConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: 2048,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        { role: "user" as const, content: prompt },
      ],
    };

    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlocks = data.content
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!);
    return textBlocks.join("\n") || "AI 暂时无法回应，请稍后再试。";
  } catch (error) {
    console.error("LLM call failed:", error);
    throw new Error("AI 服务暂时不可用，请检查网络连接后重试。");
  } finally {
    clearTimeout(timeoutId);
  }
}
