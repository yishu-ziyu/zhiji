import { captureLlmSnapshot, getLlmReceiptFields } from "@/shared/llm/adapter";
import { testLlmConnection } from "@/shared/llm/test-connection";
import { redactSecrets } from "@/shared/llm/redact";

export async function GET() {
  const snap = captureLlmSnapshot();
  const meta = getLlmReceiptFields(snap);
  if (!snap.apiKey?.trim()) {
    return Response.json(
      {
        ok: false,
        error: "API key missing",
        provider: meta.provider,
        protocol: meta.protocol,
        model: meta.model,
      },
      { status: 503 },
    );
  }
  try {
    const result = await testLlmConnection({
      provider: snap.provider,
      protocol: snap.protocol,
      baseUrl: snap.baseUrl,
      apiKey: snap.apiKey,
      model: snap.model,
      authMode: snap.authMode,
      timeoutMs: 8_000,
    });
    if (result.ok) {
      return Response.json({
        ok: true,
        latency: result.latencyMs,
        provider: meta.provider,
        protocol: meta.protocol,
        model: meta.model,
        connectionKind: meta.connectionKind,
      });
    }
    return Response.json(
      {
        ok: false,
        error: redactSecrets(result.error, { secrets: [snap.apiKey] }),
        provider: meta.provider,
        protocol: meta.protocol,
        model: meta.model,
      },
      { status: 503 },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: redactSecrets(
          error instanceof Error ? error.message : "Connection failed",
          { secrets: [snap.apiKey] },
        ),
        provider: meta.provider,
        protocol: meta.protocol,
      },
      { status: 503 },
    );
  }
}
