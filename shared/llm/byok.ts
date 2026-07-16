/**
 * Bring Your Own Key — persist allowlisted LLM secrets for local desktop/web.
 * Never returns raw API key values in status payloads.
 */
import fs from "node:fs";
import path from "node:path";

export const BYOK_ENV_KEYS = Object.freeze([
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "AGENT_RUN_MODE",
  "AGENT_ALLOW_DETERMINISTIC_FALLBACK",
  "ANYSEARCH_API_KEY",
] as const);

export type ByokEnvKey = (typeof BYOK_ENV_KEYS)[number];

export type ByokSecretsInput = {
  llmBaseUrl: string;
  /** Empty string means "keep existing" when a key is already configured. */
  llmApiKey: string;
  llmModel: string;
  anysearchApiKey?: string;
};

export type ByokStatus = {
  /** All three LLM fields present and non-empty. */
  configured: boolean;
  hasBaseUrl: boolean;
  hasApiKey: boolean;
  hasModel: boolean;
  /** Safe to show in UI (not secret). */
  baseUrl: string | null;
  /** Safe to show in UI (not secret). */
  model: string | null;
  /** Absolute path used for persistence (for support copy). */
  envFilePath: string;
  source: "process-env" | "file" | "none";
};

export type ByokProcessEnv = Record<string, string | undefined>;

/**
 * Resolve where user-filled secrets live.
 * Desktop: sibling of KNOWLEDGE_DATA_DIR → userData/.env.local
 * Override: FC_OPC_DESKTOP_ENV_FILE
 * Dev fallback: cwd/.env.local
 */
export function resolveByokEnvFilePath(env: ByokProcessEnv = process.env): string {
  const explicit = (env.FC_OPC_DESKTOP_ENV_FILE || "").trim();
  if (explicit) return path.resolve(explicit);

  const knowledgeDir = (env.KNOWLEDGE_DATA_DIR || "").trim();
  if (knowledgeDir) {
    return path.resolve(knowledgeDir, "..", ".env.local");
  }
  return path.resolve(process.cwd(), ".env.local");
}

/**
 * Parse allowlisted KEY=value lines. Empty values are skipped (BYOK template).
 */
export function parseByokEnvFile(raw: string): Record<string, string> {
  const allow = new Set<string>(BYOK_ENV_KEYS);
  /** @type {Record<string, string>} */
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

/**
 * Merge process env + file for status. Process wins for runtime truth after apply.
 */
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

  let source: ByokStatus["source"] = "none";
  if (configured) {
    if (processEnv.LLM_API_KEY?.trim()) source = "process-env";
    else if (fileMap.LLM_API_KEY) source = "file";
    else source = "process-env";
  } else if (fileMap.LLM_API_KEY || fileMap.LLM_BASE_URL) {
    source = "file";
  }

  return {
    configured,
    hasBaseUrl,
    hasApiKey,
    hasModel,
    baseUrl,
    model,
    envFilePath,
    source,
  };
}

/**
 * Build .env.local body. Merges with existing allowlisted keys.
 * Empty llmApiKey keeps previous key when keepExistingApiKey is true.
 */
export function buildByokEnvFileBody(
  input: ByokSecretsInput,
  existing: Record<string, string> = {},
): string {
  const baseUrl = input.llmBaseUrl.trim();
  const model = input.llmModel.trim();
  let apiKey = input.llmApiKey.trim();
  if (!apiKey && existing.LLM_API_KEY) {
    apiKey = existing.LLM_API_KEY;
  }

  if (!baseUrl) throw new Error("请填写模型网关地址（LLM_BASE_URL）");
  if (!apiKey) throw new Error("请填写模型密钥（LLM_API_KEY）");
  if (!model) throw new Error("请填写模型名称（LLM_MODEL）");

  const merged: Record<string, string> = { ...existing };
  merged.LLM_BASE_URL = baseUrl;
  merged.LLM_API_KEY = apiKey;
  merged.LLM_MODEL = model;
  if (typeof input.anysearchApiKey === "string") {
    const a = input.anysearchApiKey.trim();
    if (a) merged.ANYSEARCH_API_KEY = a;
    else delete merged.ANYSEARCH_API_KEY;
  }

  const lines = [
    "# FC-OPC iBot · Bring Your Own Key (BYOK)",
    "# Filled from the in-app model settings panel.",
    "# Permissions should be 0600 (owner read/write only).",
    "",
    `LLM_BASE_URL=${merged.LLM_BASE_URL}`,
    `LLM_API_KEY=${merged.LLM_API_KEY}`,
    `LLM_MODEL=${merged.LLM_MODEL}`,
    "",
  ];
  for (const key of BYOK_ENV_KEYS) {
    if (
      key === "LLM_BASE_URL" ||
      key === "LLM_API_KEY" ||
      key === "LLM_MODEL"
    ) {
      continue;
    }
    if (merged[key]) {
      lines.push(`${key}=${merged[key]}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

/** Apply secrets to current Node process so getLLMConfig works without restart. */
export function applyByokToProcessEnv(
  secrets: Record<string, string>,
  processEnv: ByokProcessEnv = process.env,
): void {
  for (const key of BYOK_ENV_KEYS) {
    const v = secrets[key];
    if (typeof v === "string" && v.trim().length > 0) {
      processEnv[key] = v.trim();
    }
  }
}

export function saveByokSecrets(
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
  const body = buildByokEnvFileBody(input, existing);
  const parsed = parseByokEnvFile(body);

  fs.mkdirSync(path.dirname(envFilePath), { recursive: true });
  fs.writeFileSync(envFilePath, body, { mode: 0o600 });
  try {
    fs.chmodSync(envFilePath, 0o600);
  } catch {
    // best-effort on platforms without chmod
  }

  applyByokToProcessEnv(parsed, processEnv);
  return getByokStatus(processEnv);
}
