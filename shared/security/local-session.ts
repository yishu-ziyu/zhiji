/**
 * Local single-user trust boundary (PR-08 / P0 CSRF fix).
 * Loopback-only product: session cookie + CSRF *header* double-submit.
 * CSRF cookie alone never authorizes writes.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SESSION_COOKIE = "fc_opc_local_session";
export const CSRF_HEADER = "x-csrf-token";
/** Readable cookie for UI bootstrap only — not accepted as CSRF proof. */
export const CSRF_COOKIE = "fc_opc_csrf";

type SessionFile = {
  sessionId: string;
  csrfToken: string;
  createdAt: string;
};

function stateDir(): string {
  if (process.env.KNOWLEDGE_DATA_DIR) {
    return path.join(path.resolve(process.env.KNOWLEDGE_DATA_DIR), ".local-trust");
  }
  return path.join(process.cwd(), "data", "knowledge", ".local-trust");
}

function sessionPath(): string {
  return path.join(stateDir(), "session.json");
}

function readSessionFile(): SessionFile | null {
  try {
    const p = sessionPath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as SessionFile;
  } catch {
    return null;
  }
}

function writeSessionFile(s: SessionFile): void {
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(sessionPath(), JSON.stringify(s, null, 2), "utf8");
}

export function ensureLocalSession(): SessionFile {
  const existing = readSessionFile();
  if (existing?.sessionId && existing?.csrfToken) return existing;
  const next: SessionFile = {
    sessionId: randomBytes(24).toString("hex"),
    csrfToken: randomBytes(24).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  writeSessionFile(next);
  return next;
}

export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  // bare ipv6 without brackets rare in Host; still handle
  if (h === "127.0.0.1" || h === "localhost" || h === "[::1]" || h === "::1") {
    return true;
  }
  if (host.startsWith("[::1]")) return true;
  return false;
}

/**
 * Origin must be same-origin with Host (hostname + port).
 * Arbitrary loopback ports (e.g. :3331 → :3000) are rejected.
 * Missing Origin is allowed only for non-browser / same-origin navigations
 * (still constrained by loopback Host).
 */
export function isAllowedOrigin(
  origin: string | null,
  host: string | null,
): boolean {
  if (!host || !isLoopbackHost(host)) return false;
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!isLoopbackHost(u.host) && !isLoopbackHost(u.hostname)) return false;
    // Exact host:port match (URL.host includes non-default port).
    return u.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export type LocalTrustCheck =
  | { ok: true; session: SessionFile }
  | { ok: false; status: number; error: string };

/**
 * Validate local session for mutating knowledge APIs.
 * Mutating methods require session cookie AND x-csrf-token header
 * (true double-submit; CSRF cookie must not substitute for header).
 */
export function checkLocalTrust(input: {
  method: string;
  host: string | null;
  origin: string | null;
  cookieHeader: string | null;
  csrfHeader: string | null;
}): LocalTrustCheck {
  if (!isLoopbackHost(input.host)) {
    return {
      ok: false,
      status: 403,
      error: "本服务仅允许本机 loopback 访问",
    };
  }
  if (!isAllowedOrigin(input.origin, input.host)) {
    return {
      ok: false,
      status: 403,
      error: "拒绝非同源 Origin（含端口）",
    };
  }

  const session = ensureLocalSession();
  const cookies = parseCookies(input.cookieHeader);
  const cookieSession = cookies[SESSION_COOKIE];
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(
    input.method.toUpperCase(),
  );

  // First local visit: no cookie yet — allow establishing session on safe methods.
  if (!cookieSession) {
    if (mutating) {
      return {
        ok: false,
        status: 401,
        error: "缺少本机会话，请先打开工作台建立会话",
      };
    }
    return { ok: true, session };
  }

  if (!safeEqual(cookieSession, session.sessionId)) {
    return { ok: false, status: 401, error: "本机会话无效" };
  }

  if (mutating) {
    // True double-submit: header required. Cookie alone is not enough.
    const csrfHeader = (input.csrfHeader ?? "").trim();
    if (!csrfHeader) {
      return {
        ok: false,
        status: 403,
        error: "缺少 x-csrf-token header（禁止仅用 CSRF cookie）",
      };
    }
    if (!safeEqual(csrfHeader, session.csrfToken)) {
      return { ok: false, status: 403, error: "CSRF 校验失败" };
    }
  }

  return { ok: true, session };
}

/** Convenience for Next route handlers. */
export function checkLocalTrustFromRequest(req: {
  method: string;
  headers: { get(name: string): string | null };
}): LocalTrustCheck {
  return checkLocalTrust({
    method: req.method,
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    cookieHeader: req.headers.get("cookie"),
    csrfHeader: req.headers.get(CSRF_HEADER),
  });
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookieHeader(session: SessionFile): string[] {
  const secure = ""; // localhost http
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(session.sessionId)}; Path=/; HttpOnly; SameSite=Strict${secure}`,
    `${CSRF_COOKIE}=${encodeURIComponent(session.csrfToken)}; Path=/; SameSite=Strict${secure}`,
  ];
}
