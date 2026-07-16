/**
 * Pure desktop runtime helpers (CommonJS) — unit-testable without Electron.
 * Competition shell: loopback-only, sandboxed window defaults, safe env parse.
 */
"use strict";

const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

/** Allowlisted keys that may enter utilityProcess env (never full process.env). */
const ALLOWED_ENV_KEYS = Object.freeze([
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "AGENT_RUN_MODE",
  "AGENT_ALLOW_DETERMINISTIC_FALLBACK",
  "ANYSEARCH_API_KEY",
]);

/** Sentinel keys used in tests — must never appear in utility env. */
const FORBIDDEN_PARENT_ENV_HINTS = Object.freeze([
  "ANTHROPIC_AUTH_TOKEN",
  "OPENAI_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "GH_TOKEN",
  "GITHUB_TOKEN",
]);

/**
 * @param {{ userDataDir: string, appPath: string }} input
 */
function resolveDesktopPaths(input) {
  const userDataDir = path.resolve(String(input.userDataDir || ""));
  const appPath = path.resolve(String(input.appPath || ""));
  if (!userDataDir || userDataDir === path.sep) {
    throw new Error("userDataDir required");
  }
  if (!appPath || appPath === path.sep) {
    throw new Error("appPath required");
  }
  const runtimeDir = path.join(appPath, "runtime");
  return {
    knowledgeDir: path.join(userDataDir, "knowledge"),
    envFile: path.join(userDataDir, ".env.local"),
    logFile: path.join(userDataDir, "logs", "desktop.log"),
    serverEntry: path.join(runtimeDir, "server.js"),
    runtimeDir,
  };
}

/**
 * @param {string} preloadPath
 */
function createWindowOptions(preloadPath) {
  return {
    show: false,
    width: 1280,
    height: 840,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  };
}

/**
 * Only http://127.0.0.1:<port>/… — never localhost, 0.0.0.0, other ports, file/https.
 * @param {string} candidate
 * @param {number} port
 */
function isAllowedAppUrl(candidate, port) {
  if (!candidate || typeof candidate !== "string") return false;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== "http:") return false;
  if (url.hostname !== "127.0.0.1") return false;
  if (Number(url.port) !== Number(port)) return false;
  // pathname must stay under product surface or Next assets/API
  const p = url.pathname || "/";
  if (
    p === "/track/knowledge" ||
    p.startsWith("/track/knowledge/") ||
    p.startsWith("/api/") ||
    p.startsWith("/_next/") ||
    p === "/favicon.ico" ||
    p.startsWith("/public/")
  ) {
    return true;
  }
  // allow root only if it would redirect — production loads knowledge directly
  return false;
}

/**
 * Parse allowlisted KEY=value lines. Later keys win. Process env is applied by caller.
 * @param {string} raw
 * @returns {Record<string, string>}
 */
function parseDesktopEnv(raw) {
  const out = {};
  if (!raw || typeof raw !== "string") return out;
  const allow = new Set(ALLOWED_ENV_KEYS);
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
    // Empty KEY= lines (BYOK template) mean "not filled yet"
    if (value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Merge allowlisted keys. File values first; optional processEnv overrides.
 * BYOK: packaged app should pass empty processEnv so only userData file applies.
 * @param {Record<string, string | undefined>} processEnv
 * @param {string} [fileContents]
 */
function resolveAllowedEnvironment(processEnv, fileContents) {
  const fromFile = parseDesktopEnv(fileContents || "");
  /** @type {Record<string, string>} */
  const out = { ...fromFile };
  const env = processEnv || {};
  for (const key of ALLOWED_ENV_KEYS) {
    const v = env[key];
    if (typeof v === "string" && v.length > 0) {
      out[key] = v;
    }
  }
  return out;
}

/**
 * BYOK secret load policy for desktop Main.
 * - packaged: only userData .env.local (user-filled). Never inherit parent process secrets.
 * - unpackaged (dev): file first, then allowlisted process env for local convenience.
 * @param {{ isPackaged: boolean, processEnv?: Record<string, string | undefined>, fileContents?: string }} input
 */
function loadDesktopSecrets(input) {
  const fileContents = input.fileContents || "";
  if (input.isPackaged) {
    return resolveAllowedEnvironment({}, fileContents);
  }
  return resolveAllowedEnvironment(input.processEnv || {}, fileContents);
}

/**
 * Empty BYOK template body for userData .env.local (user fills values).
 * No secrets embedded.
 */
function desktopEnvTemplateBody() {
  return [
    "# FC-OPC iBot · Bring Your Own Key (BYOK)",
    "# Fill YOUR keys below. This file lives only under Electron userData.",
    "# Never commit. Never copy into the .app package.",
    "# Permissions should be 0600 (owner read/write only).",
    "",
    "# Required for live model understanding:",
    "LLM_BASE_URL=",
    "LLM_API_KEY=",
    "LLM_MODEL=",
    "",
    "# Optional:",
    "# AGENT_RUN_MODE=deterministic",
    "# AGENT_ALLOW_DETERMINISTIC_FALLBACK=0",
    "# ANYSEARCH_API_KEY=",
    "",
  ].join("\n");
}

/**
 * Minimal env for utilityProcess — NEVER spreads process.env.
 * @param {{
 *   allowedEnv: Record<string, string>,
 *   port: number,
 *   knowledgeDir: string,
 *   pathEnv?: string,
 *   homeEnv?: string,
 *   tmpDir?: string,
 *   lang?: string,
 * }} input
 * @returns {Record<string, string>}
 */
function buildUtilityProcessEnv(input) {
  const allowed = input.allowedEnv || {};
  /** @type {Record<string, string>} */
  const env = {
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    HOST: "127.0.0.1",
    PORT: String(input.port),
    KNOWLEDGE_DATA_DIR: String(input.knowledgeDir),
  };
  // PATH is required for native tooling / node resolution; never inherit secrets.
  const pathVal =
    typeof input.pathEnv === "string" && input.pathEnv.length > 0
      ? input.pathEnv
      : "/usr/bin:/bin:/usr/sbin:/sbin";
  env.PATH = pathVal;
  if (typeof input.homeEnv === "string" && input.homeEnv.length > 0) {
    env.HOME = input.homeEnv;
  }
  if (typeof input.tmpDir === "string" && input.tmpDir.length > 0) {
    env.TMPDIR = input.tmpDir;
  }
  if (typeof input.lang === "string" && input.lang.length > 0) {
    env.LANG = input.lang;
  }
  for (const key of ALLOWED_ENV_KEYS) {
    const v = allowed[key];
    if (typeof v === "string" && v.length > 0) {
      env[key] = v;
    }
  }
  return env;
}

/**
 * Log-safe status line for allowlisted config keys (never values).
 * @param {Record<string, string>} allowedEnv
 */
function formatConfigPresence(allowedEnv) {
  const parts = [];
  for (const key of ALLOWED_ENV_KEYS) {
    parts.push(`${key}=${allowedEnv[key] ? "configured" : "missing"}`);
  }
  return parts.join(" ");
}

/**
 * Window open policy: always deny new windows (competition shell).
 * @param {string} url
 * @returns {{ action: "deny", blockedUrlSafe: string }}
 */
function decideWindowOpen(url) {
  let blockedUrlSafe = "(invalid-url)";
  try {
    const u = new URL(String(url || ""));
    // Strip query/hash so logs never hold tokens
    blockedUrlSafe = `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    blockedUrlSafe = "(unparseable)";
  }
  return { action: "deny", blockedUrlSafe };
}

/**
 * Assert constructed env does not contain forbidden parent secrets.
 * @param {Record<string, string>} env
 * @param {string[]} [extraForbidden]
 */
function assertEnvHasNoForbiddenKeys(env, extraForbidden = []) {
  const forbidden = new Set([
    ...FORBIDDEN_PARENT_ENV_HINTS,
    ...extraForbidden,
  ]);
  for (const key of Object.keys(env)) {
    if (forbidden.has(key)) {
      throw new Error(`utility env must not contain ${key}`);
    }
  }
}

/**
 * Bind 127.0.0.1 only to claim an ephemeral port, then release.
 * @returns {Promise<number>}
 */
function chooseLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("failed to allocate loopback port"));
        return;
      }
      const port = addr.port;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

/**
 * Poll URL until 2xx or timeout.
 * @param {string} url
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 */
function waitForHttpOk(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const intervalMs = options.intervalMs ?? 200;
  const started = Date.now();

  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get(url, { timeout: Math.min(3000, timeoutMs) }, (res) => {
        res.resume();
        const status = res.statusCode || 0;
        if (status >= 200 && status < 300) {
          resolve({ ok: true, status });
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve({
            ok: false,
            reason: `non-2xx status ${status} until timeout`,
          });
          return;
        }
        setTimeout(attempt, intervalMs);
      });
      req.on("error", (err) => {
        if (Date.now() - started >= timeoutMs) {
          resolve({
            ok: false,
            reason: err && err.message ? err.message : "timeout",
          });
          return;
        }
        setTimeout(attempt, intervalMs);
      });
      req.on("timeout", () => {
        req.destroy();
      });
    };
    attempt();
  });
}

/**
 * Redact secrets from a log line.
 * @param {string} line
 */
function redactForLog(line) {
  if (!line) return "";
  let out = String(line);
  // Keep presence markers (configured/missing) for audit lines.
  out = out.replace(
    /(LLM_API_KEY|ANYSEARCH_API_KEY|API_KEY|api[_-]?key|Bearer)\s*[=:]\s*(?!configured\b|missing\b)\S+/gi,
    "$1=***REDACTED***",
  );
  out = out.replace(/sk-[A-Za-z0-9_-]{8,}/g, "***REDACTED***");
  return out;
}

/**
 * Read userData .env.local if present.
 * @param {string} envFile
 */
function readEnvFileIfExists(envFile) {
  try {
    if (fs.existsSync(envFile)) {
      return fs.readFileSync(envFile, "utf8");
    }
  } catch {
    // ignore
  }
  return "";
}

/**
 * Knowledge product entry URL for a private loopback port.
 * @param {number} port
 */
function knowledgeEntryUrl(port) {
  return `http://127.0.0.1:${Number(port)}/track/knowledge`;
}

/**
 * Health check URL.
 * @param {number} port
 */
function healthCheckUrl(port) {
  return `http://127.0.0.1:${Number(port)}/api/local-session`;
}

module.exports = {
  ALLOWED_ENV_KEYS,
  FORBIDDEN_PARENT_ENV_HINTS,
  assertEnvHasNoForbiddenKeys,
  buildUtilityProcessEnv,
  chooseLoopbackPort,
  createWindowOptions,
  decideWindowOpen,
  desktopEnvTemplateBody,
  formatConfigPresence,
  healthCheckUrl,
  isAllowedAppUrl,
  knowledgeEntryUrl,
  loadDesktopSecrets,
  parseDesktopEnv,
  readEnvFileIfExists,
  redactForLog,
  resolveAllowedEnvironment,
  resolveDesktopPaths,
  waitForHttpOk,
};
