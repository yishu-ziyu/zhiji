import { NextRequest, NextResponse } from "next/server";
import { readByokEnvFile, resolveByokEnvFilePath } from "@/shared/llm/byok";
import { getPreset, defaultModelFor } from "@/shared/llm/presets";
import { testLlmConnection } from "@/shared/llm/test-connection";
import {
  isCompetitionProvider,
  isLlmAuthMode,
  isLlmProtocol,
  isLlmProvider,
} from "@/shared/llm/types";
import { enforcePresetBaseUrl } from "@/shared/llm/url-policy";
import { redactSecrets } from "@/shared/llm/redact";

/**
 * Preview probe only. Returns testedAt — NOT a save credential.
 * Does not write verifiedAt / connected.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      provider?: string;
      protocol?: string;
      authMode?: string;
      baseUrl?: string;
      model?: string;
      apiKey?: string;
    };

    if (!isLlmProvider(body.provider)) {
      return NextResponse.json({ error: "无效的连接" }, { status: 400 });
    }

    const provider = body.provider;
    const preset = getPreset(provider);
    const protocol = isCompetitionProvider(provider)
      ? preset.protocol
      : isLlmProtocol(body.protocol)
        ? body.protocol
        : preset.protocol;
    const authMode = isCompetitionProvider(provider)
      ? preset.authMode
      : isLlmAuthMode(body.authMode)
        ? body.authMode
        : preset.authMode;

    const urlOk = enforcePresetBaseUrl(
      provider,
      isCompetitionProvider(provider) ? preset.baseUrl : body.baseUrl,
    );
    if (!urlOk.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: urlOk.message,
          errorCode: "url_policy",
        },
        { status: 400 },
      );
    }

    let apiKey = String(body.apiKey ?? "").trim();
    if (!apiKey) {
      const existing = readByokEnvFile(resolveByokEnvFilePath());
      // Same-provider active key first.
      if (existing.LLM_PROVIDER === provider && existing.LLM_API_KEY) {
        apiKey = existing.LLM_API_KEY;
      }
    }
    if (!apiKey) {
      try {
        const { getVaultApiKey } = await import("@/shared/llm/provider-vault");
        apiKey = getVaultApiKey(provider) ?? "";
      } catch {
        /* vault optional */
      }
    }
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            existingProviderMismatch(body.provider)
              ? "切换供应商必须重新输入对应密钥"
              : "请填写 API Key 后再测试连接",
          errorCode: "missing_fields",
        },
        { status: 400 },
      );
    }

    const model =
      String(body.model ?? "").trim() || defaultModelFor(provider);

    const result = await testLlmConnection({
      provider,
      protocol,
      baseUrl: urlOk.normalized,
      apiKey,
      model,
      authMode,
    });

    const payload = JSON.parse(
      redactSecrets(JSON.stringify(result), { secrets: [apiKey] }),
    ) as typeof result;

    // Never return verifiedAt — only testedAt on success.
    if (payload.ok) {
      return NextResponse.json({
        ok: true,
        testedAt: payload.testedAt,
        models: payload.models,
        modelsSource: payload.modelsSource,
        latencyMs: payload.latencyMs,
        diagnostic: payload.diagnostic,
        modelsNote:
          payload.modelsSource === "recommended"
            ? "预置模型，保存时会再次验证"
            : undefined,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "测试连接失败";
    return NextResponse.json(
      {
        ok: false,
        error: redactSecrets(msg),
        errorCode: "network",
      },
      { status: 500 },
    );
  }
}

function existingProviderMismatch(provider: string | undefined): boolean {
  try {
    const existing = readByokEnvFile(resolveByokEnvFilePath());
    return Boolean(
      existing.LLM_API_KEY &&
        existing.LLM_PROVIDER &&
        existing.LLM_PROVIDER !== provider,
    );
  } catch {
    return false;
  }
}
