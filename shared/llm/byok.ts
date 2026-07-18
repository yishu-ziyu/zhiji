/**
 * BYOK persistence — single active profile.
 * verifiedAt is only set by server after probe (activate.ts).
 * Legacy env: needs reverify, never auto-connected from old LLM_VERIFIED_AT.
 */
import fs from "node:fs";
import path from "node:path";
import { getPreset } from "./presets";
import {
  computeCredentialFingerprint,
  computeProfileFingerprint,
  isCompetitionProvider,
  isLlmAuthMode,
  isLlmProtocol,
  isLlmProvider,
  type LlmAuthMode,
  type LlmConnectionKind,
  type LlmConnectionProfile,
  type LlmProtocol,
  type LlmProvider,
} from "./types";

export const BYOK_ENV_KEYS = Object.freeze([
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_PROVIDER",
  "LLM_PROTOCOL",
  "LLM_AUTH_MODE",
  "LLM_VERIFIED_AT",
  "LLM_CONNECTION_KIND",
  "LLM_PROFILE_FINGERPRINT",
  "AGENT_RUN_MODE",
  "AGENT_ALLOW_DETERMINISTIC_FALLBACK",
  "ANYSEARCH_API_KEY",
] as const);

export type ByokEnvKey = (typeof BYOK_ENV_KEYS)[number];

export type ByokSecretsInput = {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  provider: LlmProvider;
  protocol: LlmProtocol;
  authMode: LlmAuthMode;
  connectionKind: LlmConnectionKind;
  /** Server-only. */
  verifiedAt: string;
  profileFingerprint: string;
  anysearchApiKey?: string;
};

export type ByokStatus = {
  configured: boolean;
  connected: boolean;
  needsReverify: boolean;
  hasBaseUrl: boolean;
  hasApiKey: boolean;
  hasModel: boolean;
  baseUrl: string | null;
  model: string | null;
  provider: LlmProvider | null;
  protocol: LlmProtocol | null;
  authMode: LlmAuthMode | null;
  connectionKind: LlmConnectionKind | null;
  verifiedAt: string | null;
  profileFingerprint: string | null;
  profile: LlmConnectionProfile | null;
  envFilePath: string;
  source: "process-env" | "file" | "none";
  legacyLabel?: string;
};

export type ByokProcessEnv = Record<string, string | undefined>;

export function resolveByokEnvFilePath(env: ByokProcessEnv = process.env): string {
  const explicit = (env.FC_OPC_DESKTOP_ENV_FILE || "").trim();
  if (explicit) return path.resolve(explicit);
  const knowledgeDir = (env.KNOWLEDGE_DATA_DIR || "").trim();
  if (knowledgeDir) {
    return path.resolve(knowledgeDir, "..", ".env.local");
  }
  return path.resolve(process.cwd(), ".env.local");
}

export function parseByokEnvFile(raw: string): Record<string, string> {
  const allow = new Set<string>(BYOK_ENV_KEYS);
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "string") return out;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!allow.has(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

export function readByokEnvFile(filePath: string): Record<string, string> {
  try {
    if (!fs.existsSync(filePath)) return {};
    return parseByokEnvFile(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function resolveByokRuntimeSecrets(
  processEnv: ByokProcessEnv = process.env,
  fileContents?: string,
): Record<string, string> {
  const fromFile =
    fileContents !== undefined
      ? parseByokEnvFile(fileContents)
      : readByokEnvFile(resolveByokEnvFilePath(processEnv));
  const out: Record<string, string> = { ...fromFile };
  for (const key of BYOK_ENV_KEYS) {
    const v = processEnv[key];
    if (typeof v === "string" && v.trim().length > 0) {
      out[key] = v.trim();
    }
  }
  return out;
}

function classifyLegacy(runtime: Record<string, string>): {
  provider: LlmProvider | null;
  needsReverify: boolean;
  legacyLabel?: string;
  connectedEligible: boolean;
} {
  const rawProvider = runtime.LLM_PROVIDER?.trim();
  const hasCore =
    Boolean(runtime.LLM_BASE_URL?.trim()) &&
    Boolean(runtime.LLM_API_KEY?.trim()) &&
    Boolean(runtime.LLM_MODEL?.trim());

  if (!hasCore) {
    return { provider: null, needsReverify: false, connectedEligible: false };
  }

  // Trusted competition provider + full fingerprint match (includes credential).
  if (isLlmProvider(rawProvider) && isCompetitionProvider(rawProvider)) {
    const protocol = isLlmProtocol(runtime.LLM_PROTOCOL)
      ? runtime.LLM_PROTOCOL
      : getPreset(rawProvider).protocol;
    const authMode = isLlmAuthMode(runtime.LLM_AUTH_MODE)
      ? runtime.LLM_AUTH_MODE
      : getPreset(rawProvider).authMode;
    const apiKey = runtime.LLM_API_KEY?.trim() || "";
    const credFp = computeCredentialFingerprint(apiKey);
    const fp = computeProfileFingerprint({
      provider: rawProvider,
      protocol,
      authMode,
      baseUrl: runtime.LLM_BASE_URL!,
      model: runtime.LLM_MODEL!,
      credentialFingerprint: credFp,
    });
    const storedFp = runtime.LLM_PROFILE_FINGERPRINT?.trim();
    const verifiedAt = runtime.LLM_VERIFIED_AT?.trim();
    if (storedFp && storedFp === fp && verifiedAt && apiKey) {
      return {
        provider: rawProvider,
        needsReverify: false,
        connectedEligible: true,
      };
    }
    return {
      provider: rawProvider,
      needsReverify: true,
      connectedEligible: false,
    };
  }

  // Old stepfun / bare env / unverified providers → legacy custom.
  if (
    !rawProvider ||
    rawProvider === "stepfun" ||
    rawProvider === "minimax" ||
    rawProvider === "openai" ||
    rawProvider === "deepseek" ||
    rawProvider === "custom_anthropic" ||
    rawProvider === "legacy_custom"
  ) {
    return {
      provider: "legacy_custom",
      needsReverify: true,
      legacyLabel: "历史自定义连接",
      connectedEligible: false,
    };
  }

  if (isLlmProvider(rawProvider)) {
    return {
      provider: rawProvider,
      needsReverify: true,
      connectedEligible: false,
    };
  }

  return {
    provider: "legacy_custom",
    needsReverify: true,
    legacyLabel: "历史自定义连接",
    connectedEligible: false,
  };
}

export function getByokStatus(
  processEnv: ByokProcessEnv = process.env,
): ByokStatus {
  const envFilePath = resolveByokEnvFilePath(processEnv);
  const fileMap = readByokEnvFile(envFilePath);
  const runtime = resolveByokRuntimeSecrets(
    processEnv,
    Object.keys(fileMap).length
      ? Object.entries(fileMap)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : "",
  );

  const baseUrl = runtime.LLM_BASE_URL?.trim() || null;
  const model = runtime.LLM_MODEL?.trim() || null;
  const hasApiKey = Boolean(runtime.LLM_API_KEY?.trim());
  const hasBaseUrl = Boolean(baseUrl);
  const hasModel = Boolean(model);
  const configured = hasBaseUrl && hasApiKey && hasModel;

  const legacy = classifyLegacy(runtime);
  const protocol = isLlmProtocol(runtime.LLM_PROTOCOL)
    ? runtime.LLM_PROTOCOL
    : legacy.provider && legacy.provider !== "legacy_custom"
      ? getPreset(legacy.provider).protocol
      : null;
  const authMode = isLlmAuthMode(runtime.LLM_AUTH_MODE)
    ? runtime.LLM_AUTH_MODE
    : legacy.provider && legacy.provider !== "legacy_custom"
      ? getPreset(legacy.provider).authMode
      : null;

  const connectionKind = (runtime.LLM_CONNECTION_KIND?.trim() ||
    (legacy.provider && isCompetitionProvider(legacy.provider)
      ? getPreset(legacy.provider).connectionKind
      : "legacy")) as LlmConnectionKind;

  // Never trust old LLM_VERIFIED_AT without fingerprint eligibility.
  const verifiedAt = legacy.connectedEligible
    ? runtime.LLM_VERIFIED_AT?.trim() || null
    : null;
  const connected = configured && legacy.connectedEligible && Boolean(verifiedAt);
  const fingerprint = runtime.LLM_PROFILE_FINGERPRINT?.trim() || null;

  let source: ByokStatus["source"] = "none";
  if (configured) {
    if (processEnv.LLM_API_KEY?.trim()) source = "process-env";
    else if (fileMap.LLM_API_KEY) source = "file";
    else source = "process-env";
  } else if (fileMap.LLM_API_KEY || fileMap.LLM_BASE_URL) {
    source = "file";
  }

  const profile: LlmConnectionProfile | null =
    configured && legacy.provider && protocol && authMode
      ? {
          id: "active",
          provider: legacy.provider,
          connectionKind,
          protocol,
          baseUrl: baseUrl!,
          model: model!,
          authMode,
          verifiedAt,
          profileFingerprint: fingerprint,
          connected,
          needsReverify: legacy.needsReverify,
          legacyLabel: legacy.legacyLabel,
        }
      : null;

  return {
    configured,
    connected,
    needsReverify: legacy.needsReverify,
    hasBaseUrl,
    hasApiKey,
    hasModel,
    baseUrl,
    model,
    provider: legacy.provider,
    protocol,
    authMode,
    connectionKind,
    verifiedAt,
    profileFingerprint: fingerprint,
    profile,
    envFilePath,
    source,
    legacyLabel: legacy.legacyLabel,
  };
}

function buildEnvBody(
  input: ByokSecretsInput,
  existing: Record<string, string>,
): string {
  const merged: Record<string, string> = { ...existing };
  merged.LLM_BASE_URL = input.llmBaseUrl.trim();
  merged.LLM_API_KEY = input.llmApiKey.trim();
  merged.LLM_MODEL = input.llmModel.trim();
  merged.LLM_PROVIDER = input.provider;
  merged.LLM_PROTOCOL = input.protocol;
  merged.LLM_AUTH_MODE = input.authMode;
  merged.LLM_CONNECTION_KIND = input.connectionKind;
  merged.LLM_VERIFIED_AT = input.verifiedAt;
  merged.LLM_PROFILE_FINGERPRINT = input.profileFingerprint;

  if (typeof input.anysearchApiKey === "string") {
    const a = input.anysearchApiKey.trim();
    if (a) merged.ANYSEARCH_API_KEY = a;
    else delete merged.ANYSEARCH_API_KEY;
  }

  const primary = [
    "LLM_BASE_URL",
    "LLM_API_KEY",
    "LLM_MODEL",
    "LLM_PROVIDER",
    "LLM_PROTOCOL",
    "LLM_AUTH_MODE",
    "LLM_CONNECTION_KIND",
    "LLM_VERIFIED_AT",
    "LLM_PROFILE_FINGERPRINT",
  ] as const;

  const lines = [
    "# 知几 · BYOK + model connector (server-verified)",
    "# verifiedAt set only after server probe. Permissions 0600.",
    "",
  ];
  for (const key of primary) {
    if (merged[key]) lines.push(`${key}=${merged[key]}`);
  }
  lines.push("");
  for (const key of BYOK_ENV_KEYS) {
    if ((primary as readonly string[]).includes(key)) continue;
    if (merged[key]) lines.push(`${key}=${merged[key]}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Atomic write: temp file + fsync + rename. On failure leaves old file intact.
 */
export function saveByokSecretsAtomic(
  input: ByokSecretsInput,
  options?: {
    processEnv?: ByokProcessEnv;
    envFilePath?: string;
  },
): ByokStatus {
  const processEnv = options?.processEnv ?? process.env;
  const envFilePath =
    options?.envFilePath ?? resolveByokEnvFilePath(processEnv);
  const existing = readByokEnvFile(envFilePath);
  const body = buildEnvBody(input, existing);
  const parsed = parseByokEnvFile(body);

  fs.mkdirSync(path.dirname(envFilePath), { recursive: true });
  const tmp = `${envFilePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, body, { mode: 0o600 });
    const fd = fs.openSync(tmp, "r+");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, envFilePath);
    try {
      fs.chmodSync(envFilePath, 0o600);
    } catch {
      /* best-effort */
    }
  } catch (err) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* */
    }
    throw err;
  }

  applyByokToProcessEnv(parsed, processEnv);
  return getByokStatus(processEnv);
}

export function applyByokToProcessEnv(
  secrets: Record<string, string>,
  processEnv: ByokProcessEnv = process.env,
): void {
  for (const key of BYOK_ENV_KEYS) {
    const v = secrets[key];
    if (typeof v === "string" && v.trim().length > 0) {
      processEnv[key] = v.trim();
    } else if (
      key === "LLM_VERIFIED_AT" ||
      key === "LLM_PROFILE_FINGERPRINT"
    ) {
      if (!secrets[key]) delete processEnv[key];
    }
  }
}

/**
 * Save profile fields only — never marks connected.
 * verifiedAt / fingerprint are always cleared (probe path is verifyAndActivate).
 * Client-supplied verifiedAt is ignored if present.
 */
export function saveByokSecrets(
  input: {
    llmBaseUrl: string;
    llmApiKey: string;
    llmModel: string;
    provider?: LlmProvider;
    protocol?: LlmProtocol;
    authMode?: LlmAuthMode;
    /** Ignored — cannot produce connected without server probe. */
    verifiedAt?: string | null;
    anysearchApiKey?: string;
  },
  options?: {
    processEnv?: ByokProcessEnv;
    envFilePath?: string;
  },
): ByokStatus {
  const processEnv = options?.processEnv ?? process.env;
  const envFilePath =
    options?.envFilePath ?? resolveByokEnvFilePath(processEnv);
  const existing = readByokEnvFile(envFilePath);
  let apiKey = input.llmApiKey.trim();
  if (!apiKey && existing.LLM_API_KEY) apiKey = existing.LLM_API_KEY;
  if (!input.llmBaseUrl.trim()) throw new Error("请填写模型网关地址（LLM_BASE_URL）");
  if (!apiKey) throw new Error("请填写模型密钥（LLM_API_KEY）");
  if (!input.llmModel.trim()) throw new Error("请填写模型名称（LLM_MODEL）");

  const provider: LlmProvider = input.provider ?? "legacy_custom";
  const protocol = input.protocol ?? "anthropic_messages";
  const authMode = input.authMode ?? "x-api-key";

  // Always unverified on this path — ignore any verifiedAt.
  const bodyLines = [
    "# 知几 · BYOK (unverified — use verifyAndActivate to connect)",
    "",
    `LLM_BASE_URL=${input.llmBaseUrl.trim()}`,
    `LLM_API_KEY=${apiKey}`,
    `LLM_MODEL=${input.llmModel.trim()}`,
    `LLM_PROVIDER=${provider}`,
    `LLM_PROTOCOL=${protocol}`,
    `LLM_AUTH_MODE=${authMode}`,
    `LLM_CONNECTION_KIND=${isCompetitionProvider(provider) ? getPreset(provider).connectionKind : "legacy"}`,
    "",
  ];
  fs.mkdirSync(path.dirname(envFilePath), { recursive: true });
  const body = bodyLines.join("\n");
  const tmp = `${envFilePath}.${process.pid}.unverified.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o600 });
  fs.renameSync(tmp, envFilePath);
  try {
    fs.chmodSync(envFilePath, 0o600);
  } catch {
    /* */
  }
  const parsed = parseByokEnvFile(body);
  delete processEnv.LLM_VERIFIED_AT;
  delete processEnv.LLM_PROFILE_FINGERPRINT;
  applyByokToProcessEnv(parsed, processEnv);
  return getByokStatus(processEnv);
}

export function toPublicByokStatus(status: ByokStatus) {
  let vaultedProviders: string[] = [];
  try {
    // Lazy: vault is optional and must not break status when file missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { listVaultedProviders } = require("./provider-vault") as typeof import("./provider-vault");
    vaultedProviders = listVaultedProviders();
  } catch {
    vaultedProviders = [];
  }
  return {
    configured: status.configured,
    connected: status.connected,
    needsReverify: status.needsReverify,
    hasBaseUrl: status.hasBaseUrl,
    hasApiKey: status.hasApiKey,
    hasModel: status.hasModel,
    baseUrl: status.baseUrl,
    model: status.model,
    provider: status.provider,
    protocol: status.protocol,
    authMode: status.authMode,
    connectionKind: status.connectionKind,
    verifiedAt: status.verifiedAt,
    profileFingerprint: status.profileFingerprint,
    profile: status.profile,
    legacyLabel: status.legacyLabel,
    /** Competition providers with a saved key on this machine (no secrets). */
    vaultedProviders,
    envFileHint: status.envFilePath.includes("Application Support")
      ? "~/Library/Application Support/知几/.env.local"
      : pathBasenameHint(status.envFilePath),
  };
}

function pathBasenameHint(p: string): string {
  const parts = p.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return p;
  return `…/${parts.slice(-2).join("/")}`;
}

/** Reject client verifiedAt on plain PUT. */
export function rejectClientVerifiedAt(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  if ("verifiedAt" in body && (body as { verifiedAt?: unknown }).verifiedAt) {
    return "verifiedAt 只能由服务端在探测成功后写入，客户端提交将被拒绝";
  }
  return null;
}
