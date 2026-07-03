import { getLLMConfig } from "@/shared/llm/adapter";

export async function GET() {
  const config = getLLMConfig();
  try {
    const start = Date.now();
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    if (response.ok) {
      return Response.json({ ok: true, latency, model: config.model });
    }
    return Response.json({ ok: false, latency, error: `HTTP ${response.status}` }, { status: 503 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Connection failed" }, { status: 503 });
  }
}
