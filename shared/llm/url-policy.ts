/**
 * Strict Base URL policy for competition presets.
 * Uses new URL() exact compare — never string includes for host trust.
 */
import type { LlmProvider } from "./types";
import { isCompetitionProvider } from "./types";
import { getPreset } from "./presets";

export type UrlPolicyError = {
  ok: false;
  code:
    | "invalid_url"
    | "credentials_forbidden"
    | "query_forbidden"
    | "fragment_forbidden"
    | "protocol_mismatch"
    | "host_mismatch"
    | "port_mismatch"
    | "path_mismatch"
    | "http_non_loopback"
    | "remote_http";
  message: string;
};

export type UrlPolicyOk = { ok: true; normalized: string; url: URL };

export type UrlPolicyResult = UrlPolicyOk | UrlPolicyError;

function fail(
  code: UrlPolicyError["code"],
  message: string,
): UrlPolicyError {
  return { ok: false, code, message };
}

/**
 * Parse and reject credentials / query / fragment universally.
 */
export function parseStrictBaseUrl(raw: string): UrlPolicyResult {
  const trimmed = String(raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return fail("invalid_url", "Base URL 不能为空");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return fail("invalid_url", "Base URL 无法解析");
  }
  if (url.username || url.password) {
    return fail("credentials_forbidden", "Base URL 不得包含用户名或密码");
  }
  if (url.search && url.search !== "") {
    return fail("query_forbidden", "Base URL 不得包含 query");
  }
  if (url.hash && url.hash !== "") {
    return fail("fragment_forbidden", "Base URL 不得包含 fragment");
  }
  return { ok: true, normalized: `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`, url };
}

/**
 * Enforce competition preset URLs from server presets only.
 * Client cannot override base for competition providers.
 */
export function enforcePresetBaseUrl(
  provider: LlmProvider,
  clientBaseUrl?: string | null,
): UrlPolicyResult {
  if (isCompetitionProvider(provider)) {
    const preset = getPreset(provider);
    // Always use server preset base — ignore client override for competition.
    return validateCompetitionUrl(provider, preset.baseUrl);
  }

  // Non-competition / custom: if client provided, parse strictly.
  if (clientBaseUrl && clientBaseUrl.trim()) {
    const parsed = parseStrictBaseUrl(clientBaseUrl);
    if (!parsed.ok) return parsed;
    // Remote HTTP forbidden except explicit loopback.
    if (parsed.url.protocol === "http:") {
      if (parsed.url.hostname !== "127.0.0.1") {
        return fail(
          "http_non_loopback",
          "非本机 HTTP 仅允许 127.0.0.1；远程必须使用 HTTPS",
        );
      }
    } else if (parsed.url.protocol !== "https:") {
      return fail("protocol_mismatch", "仅支持 http: 或 https:");
    }
    return parsed;
  }
  return fail("invalid_url", "缺少 Base URL");
}

export function validateCompetitionUrl(
  provider: LlmProvider,
  baseUrl: string,
): UrlPolicyResult {
  const parsed = parseStrictBaseUrl(baseUrl);
  if (!parsed.ok) return parsed;
  const { url } = parsed;

  if (provider === "px_proxy") {
    if (url.protocol !== "http:") {
      return fail("protocol_mismatch", "PX Proxy 必须使用 http:");
    }
    if (url.hostname !== "127.0.0.1") {
      return fail(
        "host_mismatch",
        "PX Proxy 主机必须精确为 127.0.0.1（不接受 localhost 或其他地址）",
      );
    }
    if (url.port !== "8317") {
      return fail("port_mismatch", "PX Proxy 端口必须精确为 8317");
    }
    // path must be empty or /
    if (url.pathname && url.pathname !== "/") {
      return fail("path_mismatch", "PX Proxy Base URL 不得带额外路径");
    }
    return {
      ok: true,
      normalized: "http://127.0.0.1:8317",
      url: new URL("http://127.0.0.1:8317"),
    };
  }

  if (provider === "minimax_token_plan") {
    if (url.protocol !== "https:") {
      return fail("protocol_mismatch", "MiniMax Token Plan 必须使用 https:");
    }
    if (url.hostname !== "api.minimaxi.com") {
      return fail("host_mismatch", "MiniMax 主机必须精确为 api.minimaxi.com");
    }
    const path = url.pathname.replace(/\/+$/, "") || "";
    if (path !== "/anthropic") {
      return fail(
        "path_mismatch",
        "MiniMax Token Plan 路径必须为 /anthropic",
      );
    }
    return {
      ok: true,
      normalized: "https://api.minimaxi.com/anthropic",
      url: new URL("https://api.minimaxi.com/anthropic"),
    };
  }

  if (provider === "stepfun_step_plan") {
    if (url.protocol !== "https:") {
      return fail("protocol_mismatch", "Step Plan 必须使用 https:");
    }
    if (url.hostname !== "api.stepfun.com") {
      return fail("host_mismatch", "StepFun 主机必须精确为 api.stepfun.com");
    }
    const path = url.pathname.replace(/\/+$/, "") || "";
    if (path !== "/step_plan") {
      return fail(
        "path_mismatch",
        "Step Plan 路径必须为 /step_plan（不得使用普通 /v1 开放平台）",
      );
    }
    return {
      ok: true,
      normalized: "https://api.stepfun.com/step_plan",
      url: new URL("https://api.stepfun.com/step_plan"),
    };
  }

  return parsed;
}

/** Reject request URLs that embed credentials in the request URL itself. */
export function assertSafeRequestUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("请求 URL 无效");
  }
  if (u.username || u.password) {
    throw new Error("请求 URL 不得包含用户名或密码");
  }
  // token-like query keys
  if (u.search) {
    const params = u.searchParams;
    for (const [k, v] of params.entries()) {
      if (/token|key|secret|password|auth/i.test(k) || /token|sk-/i.test(v)) {
        throw new Error("请求 URL 不得在 query 中携带令牌");
      }
    }
  }
}
