/**
 * Server-side verify-and-activate: probe then atomic write.
 * Client verifiedAt is never trusted.
 */
import {
  getByokStatus,
  readByokEnvFile,
  resolveByokEnvFilePath,
  saveByokSecretsAtomic,
  type ByokProcessEnv,
  type ByokStatus,
} from "./byok";
import { getPreset, defaultModelFor } from "./presets";
import { testLlmConnection } from "./test-connection";
import {
  computeCredentialFingerprint,
  computeProfileFingerprint,
  isCompetitionProvider,
  isLlmAuthMode,
  isLlmProtocol,
  isLlmProvider,
  type LlmAuthMode,
  type LlmProtocol,
  type LlmProvider,
} from "./types";
import { enforcePresetBaseUrl } from "./url-policy";

export type ActivateInput = {
  provider: LlmProvider;
  model: string;
  /** Required when switching provider or no stored key for same provider. */
  apiKey?: string;
  protocol?: LlmProtocol;
  authMode?: LlmAuthMode;
  /** Ignored for competition providers (server preset wins). */
  baseUrl?: string;
  /** Client must not send verifiedAt; if present it is ignored. */
  verifiedAt?: unknown;
};

export type ActivateResult =
  | {
      ok: true;
      status: ByokStatus;
      verifiedAt: string;
      message: string;
    }
  | {
      ok: false;
      error: string;
      errorCode: string;
      status?: ByokStatus;
      diagnostic?: string;
    };

/**
 * Resolve API key: empty only reuses when same provider as stored.
 */
export function resolveApiKeyForActivate(
  input: ActivateInput,
  existing: Record<string, string>,
): { apiKey: string; error?: string } {
  const typed = (input.apiKey ?? "").trim();
  if (typed) return { apiKey: typed };

  const storedProvider = existing.LLM_PROVIDER?.trim();
  const storedKey = existing.LLM_API_KEY?.trim();
  if (
    storedKey &&
    storedProvider &&
    storedProvider === input.provider
  ) {
    return { apiKey: storedKey };
  }
  if (storedKey && storedProvider !== input.provider) {
    return {
      apiKey: "",
      error: "切换供应商必须重新输入对应密钥，不能复用其他连接的 Key",
    };
  }
  return { apiKey: "", error: "请填写 API Key" };
}

/**
 * Server probe + atomic activate. Never trusts client verifiedAt.
 */
export async function verifyAndActivate(
  input: ActivateInput,
  options?: {
    processEnv?: ByokProcessEnv;
    envFilePath?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<ActivateResult> {
  if (input.verifiedAt !== undefined && input.verifiedAt !== null) {
    // Explicitly ignore; optional hard reject for tests.
  }

  if (!isLlmProvider(input.provider)) {
    return { ok: false, error: "无效的连接", errorCode: "invalid_provider" };
  }

  const processEnv = options?.processEnv ?? process.env;
  const envFilePath =
    options?.envFilePath ?? resolveByokEnvFilePath(processEnv);
  const existing = readByokEnvFile(envFilePath);

  // Snapshot previous process env fields so we can restore on failure.
  const prevSnapshot = {
    LLM_BASE_URL: processEnv.LLM_BASE_URL,
    LLM_API_KEY: processEnv.LLM_API_KEY,
    LLM_MODEL: processEnv.LLM_MODEL,
    LLM_PROVIDER: processEnv.LLM_PROVIDER,
    LLM_PROTOCOL: processEnv.LLM_PROTOCOL,
    LLM_AUTH_MODE: processEnv.LLM_AUTH_MODE,
    LLM_VERIFIED_AT: processEnv.LLM_VERIFIED_AT,
    LLM_CONNECTION_KIND: processEnv.LLM_CONNECTION_KIND,
    LLM_PROFILE_FINGERPRINT: processEnv.LLM_PROFILE_FINGERPRINT,
  };

  const keyRes = resolveApiKeyForActivate(input, existing);
  if (!keyRes.apiKey) {
    return {
      ok: false,
      error: keyRes.error || "请填写 API Key",
      errorCode: "missing_key",
      status: getByokStatus(processEnv),
    };
  }

  const preset = getPreset(input.provider);
  const protocol: LlmProtocol =
    input.protocol && isLlmProtocol(input.protocol)
      ? input.protocol
      : preset.protocol;
  const authMode: LlmAuthMode =
    input.authMode && isLlmAuthMode(input.authMode)
      ? input.authMode
      : preset.authMode;

  // Competition: force protocol/auth from preset (no client override games).
  const finalProtocol = isCompetitionProvider(input.provider)
    ? preset.protocol
    : protocol;
  const finalAuth = isCompetitionProvider(input.provider)
    ? preset.authMode
    : authMode;

  const urlOk = enforcePresetBaseUrl(
    input.provider,
    isCompetitionProvider(input.provider) ? preset.baseUrl : input.baseUrl,
  );
  if (!urlOk.ok) {
    return {
      ok: false,
      error: urlOk.message,
      errorCode: "url_policy",
      status: getByokStatus(processEnv),
    };
  }

  const model = (input.model || defaultModelFor(input.provider)).trim();
  if (!model) {
    return {
      ok: false,
      error: "请选择模型",
      errorCode: "missing_model",
      status: getByokStatus(processEnv),
    };
  }

  const probe = await testLlmConnection({
    provider: input.provider,
    protocol: finalProtocol,
    baseUrl: urlOk.normalized,
    apiKey: keyRes.apiKey,
    model,
    authMode: finalAuth,
    fetchImpl: options?.fetchImpl,
  });

  if (!probe.ok) {
    return {
      ok: false,
      error: probe.error,
      errorCode: probe.errorCode,
      diagnostic: probe.diagnostic,
      status: getByokStatus(processEnv),
    };
  }

  // Server generates verifiedAt only after successful probe.
  const verifiedAt = new Date().toISOString();
  const credentialFingerprint = computeCredentialFingerprint(keyRes.apiKey);
  const fingerprint = computeProfileFingerprint({
    provider: input.provider,
    protocol: finalProtocol,
    authMode: finalAuth,
    baseUrl: urlOk.normalized,
    model,
    credentialFingerprint,
  });

  try {
    const status = saveByokSecretsAtomic(
      {
        llmBaseUrl: urlOk.normalized,
        llmApiKey: keyRes.apiKey,
        llmModel: model,
        provider: input.provider,
        protocol: finalProtocol,
        authMode: finalAuth,
        connectionKind: preset.connectionKind,
        verifiedAt,
        profileFingerprint: fingerprint,
      },
      { processEnv, envFilePath },
    );

    if (!status.connected) {
      // Roll back process env if write somehow didn't produce connected.
      restoreProcessEnv(processEnv, prevSnapshot);
      return {
        ok: false,
        error: "保存失败：配置未成为已连接状态",
        errorCode: "persist_failed",
        status: getByokStatus(processEnv),
      };
    }

    return {
      ok: true,
      status,
      verifiedAt,
      message: "已保存并使用。仅影响新的 Agent Run。",
    };
  } catch (err) {
    restoreProcessEnv(processEnv, prevSnapshot);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `持久化失败，已保留原配置：${msg}`,
      errorCode: "persist_failed",
      status: getByokStatus(processEnv),
    };
  }
}

function restoreProcessEnv(
  env: ByokProcessEnv,
  prev: Record<string, string | undefined>,
): void {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
}
