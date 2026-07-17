/**
 * Model connector vocabulary — competition demo connections.
 * Product: docs/product/模型连接器产品说明.md §6–§9
 */

import { createHmac } from "node:crypto";

export const LLM_PROTOCOLS = [
  "anthropic_messages",
  "openai_chat",
  "openai_responses",
] as const;

export type LlmProtocol = (typeof LLM_PROTOCOLS)[number];

/** Competition + architecture-retained providers. */
export const LLM_PROVIDERS = [
  "px_proxy",
  "minimax_token_plan",
  "stepfun_step_plan",
  /** Hidden from competition UI until live-verified. */
  "openai",
  "minimax",
  "deepseek",
  "stepfun",
  "custom_anthropic",
  /** Migrated legacy env without trusted provider. */
  "legacy_custom",
] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const COMPETITION_PROVIDERS = [
  "px_proxy",
  "minimax_token_plan",
  "stepfun_step_plan",
] as const satisfies readonly LlmProvider[];

export type CompetitionProvider = (typeof COMPETITION_PROVIDERS)[number];

export const LLM_AUTH_MODES = ["bearer", "x-api-key"] as const;
export type LlmAuthMode = (typeof LLM_AUTH_MODES)[number];

export type LlmConnectionKind = "proxy" | "official" | "legacy";

/** Frozen per Agent Run — never re-read process.env mid-run. */
export type LlmConnectionSnapshot = {
  provider: LlmProvider;
  connectionKind: LlmConnectionKind;
  protocol: LlmProtocol;
  authMode: LlmAuthMode;
  baseUrl: string;
  model: string;
  /** Secret material — never put in receipts/logs. */
  apiKey: string;
  verifiedAt: string | null;
  profileFingerprint: string;
};

/** Public profile (no apiKey). */
export type LlmConnectionProfile = {
  id: string;
  provider: LlmProvider;
  connectionKind: LlmConnectionKind;
  protocol: LlmProtocol;
  baseUrl: string;
  model: string;
  authMode: LlmAuthMode;
  verifiedAt: string | null;
  profileFingerprint: string | null;
  /** True only after server-side probe + atomic save. */
  connected: boolean;
  /** Legacy env needs re-verify. */
  needsReverify: boolean;
  legacyLabel?: string;
};

export type LlmModelOption = {
  id: string;
  /** UI label */
  label: string;
  /** Logo asset under /llm-logos */
  logoSrc: string;
  /** e.g. "PX 代理" | "官方" */
  badge: "proxy" | "official" | "preset";
  badgeLabel: string;
};

export type LlmPreset = {
  provider: LlmProvider;
  displayName: string;
  shortName: string;
  connectionKind: LlmConnectionKind;
  protocol: LlmProtocol;
  authMode: LlmAuthMode;
  /** Canonical base URL (server-enforced for competition presets). */
  baseUrl: string;
  models: LlmModelOption[];
  logoSrc: string;
  /** Show in competition primary UI. */
  competitionPrimary: boolean;
};

export type BuiltLlmRequest = {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body?: string;
};

export type LlmTextExtractionResult = {
  text: string;
  rawShape: "anthropic_content" | "openai_chat" | "openai_responses" | "unknown";
  /** Non-empty thinking blocks detected but excluded from text. */
  hadThinkingBlocks?: boolean;
};

export function isLlmProtocol(value: unknown): value is LlmProtocol {
  return (
    typeof value === "string" &&
    (LLM_PROTOCOLS as readonly string[]).includes(value)
  );
}

export function isLlmProvider(value: unknown): value is LlmProvider {
  return (
    typeof value === "string" &&
    (LLM_PROVIDERS as readonly string[]).includes(value)
  );
}

export function isLlmAuthMode(value: unknown): value is LlmAuthMode {
  return (
    typeof value === "string" &&
    (LLM_AUTH_MODES as readonly string[]).includes(value)
  );
}

export function isCompetitionProvider(
  value: unknown,
): value is CompetitionProvider {
  return (
    typeof value === "string" &&
    (COMPETITION_PROVIDERS as readonly string[]).includes(value)
  );
}

/** Hostname:port only — safe for receipts. */
export function baseUrlHost(baseUrl: string): string {
  try {
    const u = new URL(baseUrl.includes("://") ? baseUrl : `https://${baseUrl}`);
    return u.host;
  } catch {
    return "invalid-host";
  }
}

/**
 * Credential binding fingerprint (server-side only).
 * HMAC-SHA256 with domain salt — detects key rotation; not for password storage.
 * Never put this value on UI or modelReceipt (use profileFingerprint / revision ids only).
 */
export function computeCredentialFingerprint(apiKey: string): string {
  const key = String(apiKey || "");
  const digest = createHmac("sha256", "fc-opc-llm-cred:v1")
    .update(key, "utf8")
    .digest("hex");
  return `cf_${digest}`;
}

/**
 * Profile identity fingerprint (no secret plaintext).
 * Includes credential fingerprint so Key rotation invalidates connected.
 */
export function computeProfileFingerprint(input: {
  provider: string;
  protocol: string;
  authMode: string;
  baseUrl: string;
  model: string;
  /** Irreversible credential fingerprint — required for verified profiles. */
  credentialFingerprint: string;
}): string {
  const base = [
    input.provider,
    input.protocol,
    input.authMode,
    input.baseUrl.replace(/\/+$/, ""),
    input.model,
    input.credentialFingerprint || "cf_missing",
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fp_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/** User-facing error when Agent refuses unverified connection. */
export const UNVERIFIED_CONNECTION_MESSAGE =
  "当前模型连接尚未验证，请先测试并保存模型连接。";
