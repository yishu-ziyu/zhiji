import type { LLMConfig } from "@/shared/types/common";
import { getByokStatus, type ByokProcessEnv } from "./byok";
import {
  buildCompleteRequest,
  extractTextFromResponse,
  isNonEmptyProbeText,
} from "./protocol";
import { getPreset } from "./presets";
import { redactSecrets, SafeFetchError, safeLlmFetch } from "./safe-fetch";
import {
  baseUrlHost,
  computeCredentialFingerprint,
  computeProfileFingerprint,
  isLlmAuthMode,
  isLlmProtocol,
  isLlmProvider,
  UNVERIFIED_CONNECTION_MESSAGE,
  type LlmAuthMode,
  type LlmConnectionKind,
  type LlmConnectionSnapshot,
  type LlmProtocol,
  type LlmProvider,
} from "./types";
import { enforcePresetBaseUrl } from "./url-policy";

export type {
  LlmConnectionSnapshot,
  LlmProtocol,
  LlmProvider,
  LlmAuthMode,
};

export { UNVERIFIED_CONNECTION_MESSAGE };

export class UnverifiedConnectionError extends Error {
  readonly code = "unverified_connection" as const;
  constructor(message = UNVERIFIED_CONNECTION_MESSAGE) {
    super(message);
    this.name = "UnverifiedConnectionError";
  }
}

export class InvalidLlmResponseError extends Error {
  readonly code = "invalid_response" as const;
  constructor(message = "LLM API error (invalid_response): empty or unusable model text") {
    super(message);
    this.name = "InvalidLlmResponseError";
  }
}

async function readResponseBodyWithTimeout<T>(
  response: Response,
  read: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          void response.body?.cancel().catch(() => undefined);
          reject(new SafeFetchError("连接超时", "timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Build snapshot from env (may be unverified). Prefer requireVerifiedLlmSnapshot for Agent.
 */
export function captureLlmSnapshot(
  processEnv: NodeJS.ProcessEnv = process.env,
): LlmConnectionSnapshot {
  const baseUrl = (processEnv.LLM_BASE_URL || "").trim();
  const apiKey = (processEnv.LLM_API_KEY || "").trim();
  const model = (processEnv.LLM_MODEL || "").trim();
  const providerRaw = (processEnv.LLM_PROVIDER || "").trim();
  const provider: LlmProvider = isLlmProvider(providerRaw)
    ? providerRaw
    : "legacy_custom";
  const preset = getPreset(provider);
  const protocol: LlmProtocol = isLlmProtocol(processEnv.LLM_PROTOCOL)
    ? (processEnv.LLM_PROTOCOL as LlmProtocol)
    : preset.protocol;
  const authMode: LlmAuthMode = isLlmAuthMode(processEnv.LLM_AUTH_MODE)
    ? (processEnv.LLM_AUTH_MODE as LlmAuthMode)
    : preset.authMode;
  const connectionKind = (processEnv.LLM_CONNECTION_KIND?.trim() ||
    preset.connectionKind) as LlmConnectionKind;
  const verifiedAt = (processEnv.LLM_VERIFIED_AT || "").trim() || null;
  const credFp = computeCredentialFingerprint(apiKey);
  const profileFingerprint =
    processEnv.LLM_PROFILE_FINGERPRINT?.trim() ||
    computeProfileFingerprint({
      provider,
      protocol,
      authMode,
      baseUrl,
      model,
      credentialFingerprint: credFp,
    });

  return {
    provider,
    connectionKind,
    protocol,
    authMode,
    baseUrl,
    model,
    apiKey,
    verifiedAt,
    profileFingerprint,
  };
}

/**
 * Snapshot is self-consistent and was server-verified (fingerprint binds key).
 * Used for frozen Run snapshots — does not re-read process.env identity.
 */
export function isFrozenSnapshotValid(snapshot: LlmConnectionSnapshot): boolean {
  if (!snapshot.apiKey?.trim() || !snapshot.verifiedAt) return false;
  if (!snapshot.provider || !snapshot.model || !snapshot.baseUrl) return false;
  if (!snapshot.protocol || !snapshot.authMode) return false;
  const credFp = computeCredentialFingerprint(snapshot.apiKey);
  const expectedFp = computeProfileFingerprint({
    provider: snapshot.provider,
    protocol: snapshot.protocol,
    authMode: snapshot.authMode,
    baseUrl: snapshot.baseUrl,
    model: snapshot.model,
    credentialFingerprint: credFp,
  });
  return snapshot.profileFingerprint === expectedFp;
}

/**
 * True when snapshot matches the *current* server-side verified profile.
 * Used at Run start before freezing.
 */
export function isSnapshotVerified(
  snapshot: LlmConnectionSnapshot,
  processEnv: ByokProcessEnv = process.env,
): boolean {
  if (!isFrozenSnapshotValid(snapshot)) return false;
  const status = getByokStatus(processEnv);
  if (!status.configured || !status.connected || !status.verifiedAt) {
    return false;
  }
  if (status.provider !== snapshot.provider) return false;
  if (status.protocol !== snapshot.protocol) return false;
  if (status.authMode !== snapshot.authMode) return false;
  if (
    (status.baseUrl || "").replace(/\/+$/, "") !==
    snapshot.baseUrl.replace(/\/+$/, "")
  ) {
    return false;
  }
  if (status.model !== snapshot.model) return false;
  if (status.verifiedAt !== snapshot.verifiedAt) return false;
  if (status.profileFingerprint !== snapshot.profileFingerprint) return false;
  return true;
}

/**
 * Capture once at Run start. Throws UnverifiedConnectionError if not server-verified.
 */
export function requireVerifiedLlmSnapshot(
  processEnv: NodeJS.ProcessEnv = process.env,
): LlmConnectionSnapshot {
  const snap = captureLlmSnapshot(processEnv);
  // Align verifiedAt from status (source of truth) when fingerprint matches.
  const status = getByokStatus(processEnv);
  if (
    status.connected &&
    status.verifiedAt &&
    status.profileFingerprint
  ) {
    const aligned: LlmConnectionSnapshot = {
      ...snap,
      verifiedAt: status.verifiedAt,
      profileFingerprint: status.profileFingerprint,
      provider: status.provider ?? snap.provider,
      protocol: (status.protocol as LlmProtocol) ?? snap.protocol,
      authMode: (status.authMode as LlmAuthMode) ?? snap.authMode,
      baseUrl: status.baseUrl ?? snap.baseUrl,
      model: status.model ?? snap.model,
      connectionKind:
        (status.connectionKind as LlmConnectionKind) ?? snap.connectionKind,
    };
    if (isSnapshotVerified(aligned, processEnv)) {
      return aligned;
    }
  }
  throw new UnverifiedConnectionError();
}

export function getLLMConfig(
  snapshot?: LlmConnectionSnapshot,
): LLMConfig {
  const snap = snapshot ?? captureLlmSnapshot();
  if (!snap.apiKey) {
    console.warn("LLM_API_KEY not configured");
  }
  return {
    baseUrl: snap.baseUrl,
    apiKey: snap.apiKey,
    model: snap.model,
    timeout: 30_000,
    provider: snap.provider,
    protocol: snap.protocol,
    authMode: snap.authMode,
    verifiedAt: snap.verifiedAt,
    connectionKind: snap.connectionKind,
    profileFingerprint: snap.profileFingerprint,
  };
}

export function extractJson(text: string): Record<string, unknown> {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1] : text;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No valid JSON found in response");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * complete(prompt, system?, options?)
 * Requires verified snapshot (or options.snapshot that is verified against process env).
 * Empty HTTP 200 body throws InvalidLlmResponseError — never a soft success string.
 */
export async function complete(
  prompt: string,
  systemPrompt?: string,
  options?: {
    timeout?: number;
    maxRetries?: number;
    snapshot?: LlmConnectionSnapshot;
    fetchImpl?: typeof fetch;
    /** Test-only: skip verified gate (never use in product Agent paths). */
    allowUnverified?: boolean;
  },
): Promise<string> {
  const snap = options?.snapshot ?? captureLlmSnapshot();
  const redact = { secrets: [snap.apiKey] };

  if (!options?.allowUnverified) {
    // Explicit frozen snapshot: self-consistent fingerprint only (mid-run env switch OK).
    // Live path without snapshot: must match current process verified status.
    if (options?.snapshot) {
      if (!isFrozenSnapshotValid(options.snapshot)) {
        throw new UnverifiedConnectionError();
      }
    } else if (!isSnapshotVerified(snap)) {
      throw new UnverifiedConnectionError();
    }
  }

  if (!snap.apiKey?.trim()) {
    throw new Error("LLM API error (401): API key missing");
  }

  const urlOk = enforcePresetBaseUrl(snap.provider, snap.baseUrl);
  if (!urlOk.ok) {
    throw new Error(`LLM API error (400): ${urlOk.message}`);
  }

  const MAX_RETRIES = options?.maxRetries ?? 3;
  const RETRY_DELAY_MS = 500;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const req = buildCompleteRequest({
        protocol: snap.protocol,
        baseUrl: urlOk.normalized,
        apiKey: snap.apiKey,
        model: snap.model,
        authMode: snap.authMode,
        prompt,
        systemPrompt,
        maxTokens: 2048,
      });

      const response = await safeLlmFetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        timeoutMs: options?.timeout ?? 30_000,
        fetchImpl: options?.fetchImpl,
        redact,
      });

      if (!response.ok) {
        const errorText = redactSecrets(
          await readResponseBodyWithTimeout(
            response,
            () => response.text(),
            options?.timeout ?? 30_000,
          ),
          redact,
        );
        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `LLM API error (${response.status}): ${errorText.slice(0, 400)}`,
          );
        }
        throw new Error(
          `LLM API 5xx error (${response.status}): ${errorText.slice(0, 400)}`,
        );
      }

      const data = (await readResponseBodyWithTimeout(
        response,
        () => response.json(),
        options?.timeout ?? 30_000,
      )) as unknown;
      const extracted = extractTextFromResponse(snap.protocol, data);
      if (!isNonEmptyProbeText(extracted.text)) {
        throw new InvalidLlmResponseError();
      }
      return extracted.text;
    } catch (error) {
      if (
        error instanceof UnverifiedConnectionError ||
        error instanceof InvalidLlmResponseError
      ) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      lastError = new Error(redactSecrets(lastError.message, redact));
      if (lastError.message.startsWith("LLM API error (")) {
        throw lastError;
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
      console.warn(
        `LLM attempt ${attempt}/${MAX_RETRIES} failed:`,
        redactSecrets(lastError.message, redact),
      );
    }
  }

  console.error(
    `LLM all ${MAX_RETRIES} attempts failed:`,
    lastError ? redactSecrets(lastError.message, { secrets: [snap.apiKey] }) : "",
  );
  // Preserve provider status classes (5xx/timeout/network) for modelReceipt.errorClass.
  if (
    lastError &&
    (/5xx|5\d\d|timeout|超时|abort|network|ECONN|fetch/i.test(lastError.message) ||
      lastError.name === "SafeFetchError" ||
      lastError.name === "InvalidLlmResponseError")
  ) {
    throw lastError;
  }
  throw new Error(
    `AI 服务暂时不可用（已尝试 ${MAX_RETRIES} 次），请检查网络连接后重试。`,
  );
}

export function getLlmReceiptFields(snapshot?: LlmConnectionSnapshot): {
  provider: string;
  connectionKind: LlmConnectionKind;
  protocol: LlmProtocol;
  model: string;
  requestedModel: string;
  baseHost: string;
  profileFingerprint: string;
} {
  const snap = snapshot ?? captureLlmSnapshot();
  return {
    provider: snap.provider,
    connectionKind: snap.connectionKind,
    protocol: snap.protocol,
    model: snap.model,
    requestedModel: snap.model,
    baseHost: baseUrlHost(snap.baseUrl),
    profileFingerprint: snap.profileFingerprint,
  };
}
