/**
 * Per-provider API key vault (userData).
 * Lets Owner switch competition providers without re-typing keys.
 * Never logs secrets. File mode 0600.
 */
import fs from "node:fs";
import path from "node:path";
import {
  isCompetitionProvider,
  type CompetitionProvider,
  type LlmProvider,
} from "./types";
import { resolveByokEnvFilePath, type ByokProcessEnv } from "./byok";

export type ProviderVaultEntry = {
  apiKey: string;
  lastModel?: string;
  updatedAt: string;
};

export type ProviderVaultFile = {
  version: 1;
  providers: Partial<Record<CompetitionProvider, ProviderVaultEntry>>;
};

export function resolveProviderVaultPath(
  processEnv: ByokProcessEnv = process.env,
): string {
  const envFile = resolveByokEnvFilePath(processEnv);
  return path.join(path.dirname(envFile), "llm-provider-vault.json");
}

export function readProviderVault(
  processEnv: ByokProcessEnv = process.env,
): ProviderVaultFile {
  const filePath = resolveProviderVaultPath(processEnv);
  try {
    if (!fs.existsSync(filePath)) {
      return { version: 1, providers: {} };
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as ProviderVaultFile;
    if (!raw || raw.version !== 1 || typeof raw.providers !== "object") {
      return { version: 1, providers: {} };
    }
    const providers: ProviderVaultFile["providers"] = {};
    for (const [k, v] of Object.entries(raw.providers ?? {})) {
      if (!isCompetitionProvider(k)) continue;
      if (!v || typeof v !== "object") continue;
      const apiKey = String((v as ProviderVaultEntry).apiKey || "").trim();
      if (!apiKey) continue;
      providers[k] = {
        apiKey,
        lastModel:
          typeof (v as ProviderVaultEntry).lastModel === "string"
            ? (v as ProviderVaultEntry).lastModel
            : undefined,
        updatedAt:
          typeof (v as ProviderVaultEntry).updatedAt === "string"
            ? (v as ProviderVaultEntry).updatedAt!
            : new Date().toISOString(),
      };
    }
    return { version: 1, providers };
  } catch {
    return { version: 1, providers: {} };
  }
}

export function listVaultedProviders(
  processEnv: ByokProcessEnv = process.env,
): CompetitionProvider[] {
  const vault = readProviderVault(processEnv);
  return (Object.keys(vault.providers) as CompetitionProvider[]).filter(
    (p) => Boolean(vault.providers[p]?.apiKey?.trim()),
  );
}

export function getVaultApiKey(
  provider: LlmProvider,
  processEnv: ByokProcessEnv = process.env,
): string | null {
  if (!isCompetitionProvider(provider)) return null;
  const entry = readProviderVault(processEnv).providers[provider];
  const key = entry?.apiKey?.trim();
  return key || null;
}

/**
 * Upsert one provider key. Atomic write (tmp + rename).
 */
export function upsertProviderVaultKey(
  provider: CompetitionProvider,
  apiKey: string,
  options?: {
    processEnv?: ByokProcessEnv;
    lastModel?: string;
  },
): void {
  const key = apiKey.trim();
  if (!key) return;
  const processEnv = options?.processEnv ?? process.env;
  const filePath = resolveProviderVaultPath(processEnv);
  const current = readProviderVault(processEnv);
  current.providers[provider] = {
    apiKey: key,
    lastModel: options?.lastModel?.trim() || current.providers[provider]?.lastModel,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const body = `${JSON.stringify(current, null, 2)}\n`;
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o600 });
  try {
    const fd = fs.openSync(tmp, "r+");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, filePath);
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      /* best-effort */
    }
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}
