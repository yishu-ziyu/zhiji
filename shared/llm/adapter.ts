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
  // 1. 去除 ```json ... ``` 或 ``` ... ``` 围栏
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1] : text;

  // 2. 找首个 { 到末个 } 的子串
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No valid JSON found in response");
  }
  const jsonStr = cleaned.slice(start, end + 1);

  return JSON.parse(jsonStr);
}

export async function complete(prompt: string, systemPrompt?: string): Promise<string> {
  const config = getLLMConfig();
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
        // 4xx 错误（配置问题）不重试，直接 throw
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`LLM API error (${response.status}): ${errorText}`);
        }
        // 5xx 错误重试
        throw new Error(`LLM API 5xx error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      const textBlocks = data.content
        .filter((block) => block.type === "text" && block.text)
        .map((block) => block.text!);
      const result = textBlocks.join("\n") || "AI 暂时无法回应，请稍后再试。";
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));
      // 4xx 错误（配置问题）不重试，直接 throw
      if (lastError.message.startsWith("LLM API error (")) {
        throw lastError;
      }
      // 最后一次尝试不再等
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
      console.warn(`LLM attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);
    }
  }

  console.error(`LLM all ${MAX_RETRIES} attempts failed:`, lastError);
  throw new Error("AI 服务暂时不可用（已重试 3 次），请检查网络连接后重试。");
}
