/**
 * Fetch for LLM: never follow redirects with auth headers.
 */
import { redactSecrets, type RedactContext } from "./redact";

export type SafeFetchOptions = RequestInit & {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  redact?: RedactContext;
};

export class SafeFetchError extends Error {
  readonly code: "timeout" | "redirect_blocked" | "network" | "http";
  readonly status?: number;

  constructor(
    message: string,
    code: SafeFetchError["code"],
    status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
    this.status = status;
  }
}

function hasAuthHeader(headers: HeadersInit | undefined): boolean {
  if (!headers) return false;
  const h = new Headers(headers);
  return Boolean(h.get("authorization") || h.get("x-api-key"));
}

/**
 * Auth requests: redirect "manual", any 3xx fails closed (same or cross origin).
 */
export async function safeLlmFetch(
  url: string,
  init: SafeFetchOptions = {},
): Promise<Response> {
  const fetchImpl = init.fetchImpl ?? globalThis.fetch;
  const timeoutMs = init.timeoutMs ?? 15_000;
  const redact = init.redact ?? {};
  const { fetchImpl: _f, timeoutMs: _t, redact: _r, ...rest } = init;

  const auth = hasAuthHeader(rest.headers);
  const controller = new AbortController();
  const outerSignal = rest.signal;
  const onAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...rest,
      redirect: auth ? "manual" : (rest.redirect ?? "follow"),
      signal: controller.signal,
    });

    if (
      auth &&
      (response.type === "opaqueredirect" ||
        (response.status >= 300 && response.status < 400))
    ) {
      throw new SafeFetchError(
        `连接被重定向拒绝（HTTP ${response.status}）：鉴权请求不会跟随任何 3xx`,
        "redirect_blocked",
        response.status,
      );
    }

    return response;
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort|timeout/i.test(msg)) {
      throw new SafeFetchError("连接超时", "timeout");
    }
    throw new SafeFetchError(
      `网络错误：${redactSecrets(msg, redact)}`,
      "network",
    );
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener("abort", onAbort);
  }
}

export { redactSecrets } from "./redact";
