#!/usr/bin/env node
/**
 * Developer machine only: seed per-provider vault + optional active connection.
 *
 * Sources (never printed):
 *  - PX: ~/Library/Application Support/知几/.env.local (if px_proxy)
 *  - MiniMax: ~/.claude/backups/settings.json.minimax.* ANTHROPIC_AUTH_TOKEN
 *  - Stepfun: $STEPFUN_API_KEY or $STEP_API_KEY
 *
 * Usage:
 *   node scripts/dev-seed-llm-vault.mjs
 *   node scripts/dev-seed-llm-vault.mjs --activate px_proxy
 *   node scripts/dev-seed-llm-vault.mjs --activate minimax_token_plan
 *   node scripts/dev-seed-llm-vault.mjs --activate stepfun_step_plan
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// Register ts path for dynamic import of shared modules via compiled? Use node with tsx?
// Prefer calling pure vault via dynamic import of .ts through next/tsx if available.
// Fallback: write vault JSON directly (schema matches provider-vault.ts).

const userData = path.join(os.homedir(), "Library", "Application Support", "知几");
const vaultPath = path.join(userData, "llm-provider-vault.json");
const envPath = path.join(userData, ".env.local");

function parseArgs(argv) {
  /** @type {{ activate?: string }} */
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--activate" && argv[i + 1]) out.activate = argv[++i];
  }
  return out;
}

function readEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function findMinimaxKey() {
  const dir = path.join(os.homedir(), ".claude", "backups");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.includes("minimax") && f.endsWith(".json"))
    .sort()
    .reverse();
  for (const f of files) {
    try {
      const env = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).env || {};
      const key = String(env.ANTHROPIC_AUTH_TOKEN || "").trim();
      if (key.length > 20) return key;
    } catch {
      /* next */
    }
  }
  return null;
}

async function probeAndActivate({ provider, model, baseUrl, authMode, apiKey }) {
  // Use project's compiled path via node --import tsx if present, else raw fetch probe + write env.
  const { verifyAndActivate } = await import(
    pathToFileURL(path.join(root, "shared/llm/activate.ts")).href
  ).catch(async () => {
    // tsx loader
    await import("tsx/esm");
    return import(pathToFileURL(path.join(root, "shared/llm/activate.ts")).href);
  });

  process.env.FC_OPC_DESKTOP_ENV_FILE = envPath;
  process.env.KNOWLEDGE_DATA_DIR = path.join(userData, "knowledge");

  const result = await verifyAndActivate(
    { provider, model, apiKey },
    {
      processEnv: process.env,
      envFilePath: envPath,
    },
  );
  return result;
}

function writeVault(providers) {
  fs.mkdirSync(userData, { recursive: true });
  const body = {
    version: 1,
    providers,
  };
  fs.writeFileSync(vaultPath, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(vaultPath, 0o600);
  } catch {
    /* ignore */
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const desktop = readEnvFile(envPath);
  const providers = {};

  // PX
  if (
    desktop.LLM_PROVIDER === "px_proxy" &&
    desktop.LLM_API_KEY &&
    desktop.LLM_API_KEY.length > 8
  ) {
    providers.px_proxy = {
      apiKey: desktop.LLM_API_KEY,
      lastModel: desktop.LLM_MODEL || "gpt-5.6-sol",
      updatedAt: new Date().toISOString(),
    };
    console.log("[seed] vaulted px_proxy (from desktop .env.local)");
  } else if (desktop.LLM_API_KEY && desktop.LLM_BASE_URL?.includes("127.0.0.1:8317")) {
    providers.px_proxy = {
      apiKey: desktop.LLM_API_KEY,
      lastModel: "gpt-5.6-sol",
      updatedAt: new Date().toISOString(),
    };
    console.log("[seed] vaulted px_proxy (desktop key + loopback base)");
  } else {
    console.log("[seed] skip px_proxy (no desktop key)");
  }

  // MiniMax
  const mm = findMinimaxKey();
  if (mm) {
    providers.minimax_token_plan = {
      apiKey: mm,
      lastModel: "MiniMax-M3",
      updatedAt: new Date().toISOString(),
    };
    console.log("[seed] vaulted minimax_token_plan (from claude minimax backup)");
  } else {
    console.log("[seed] skip minimax_token_plan (no backup key)");
  }

  // Stepfun
  const step =
    process.env.STEPFUN_API_KEY?.trim() || process.env.STEP_API_KEY?.trim();
  if (step) {
    providers.stepfun_step_plan = {
      apiKey: step,
      lastModel: "step-3.7-flash",
      updatedAt: new Date().toISOString(),
    };
    console.log("[seed] vaulted stepfun_step_plan (from shell env)");
  } else {
    console.log("[seed] skip stepfun_step_plan (no STEPFUN_API_KEY)");
  }

  writeVault(providers);
  console.log("[seed] wrote vault:", vaultPath);
  console.log(
    "[seed] providers:",
    Object.keys(providers).join(", ") || "(none)",
  );

  if (args.activate) {
    const map = {
      px_proxy: {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: providers.px_proxy?.apiKey,
      },
      minimax_token_plan: {
        provider: "minimax_token_plan",
        model: "MiniMax-M3",
        apiKey: providers.minimax_token_plan?.apiKey,
      },
      stepfun_step_plan: {
        provider: "stepfun_step_plan",
        model: "step-3.7-flash",
        apiKey: providers.stepfun_step_plan?.apiKey,
      },
    };
    const target = map[args.activate];
    if (!target?.apiKey) {
      console.error("[seed] cannot activate", args.activate, "- missing key");
      process.exit(1);
    }
    console.log("[seed] activating", args.activate, "→", target.model, "…");
    try {
      const result = await probeAndActivate(target);
      if (result.ok) {
        console.log("[seed] active:", result.status.provider, result.status.model);
      } else {
        console.error("[seed] activate failed:", result.errorCode, result.error);
        process.exit(1);
      }
    } catch (err) {
      console.error("[seed] activate error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  console.log("[seed] done. Quit and reopen 知几.app to pick up vault/active.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
