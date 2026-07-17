/**
 * Real connection probe. Used for UI preview and server-side activate.
 * Empty text / whitespace / unknown shape = failure even on HTTP 200.
 */
import {
  buildProbeRequest,
  extractTextFromResponse,
  isNonEmptyProbeText,
} from "./protocol";
import { redactSecrets, safeLlmFetch, SafeFetchError } from "./safe-fetch";
import type { LlmAuthMode, LlmProtocol, LlmProvider } from "./types";
import { recommendedModelsFor } from "./presets";
import { enforcePresetBaseUrl } from "./url-policy";

export type TestConnectionInput = {
  provider: LlmProvider;
  protocol: LlmProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  authMode: LlmAuthMode;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type TestConnectionSuccess = {
  ok: true;
  /** Preview timestamp — NOT a save credential. */
  testedAt: string;
  models: string[];
  modelsSource: "recommended" | "provider";
  latencyMs: number;
  diagnostic: string;
};

export type TestConnectionFailure = {
  ok: false;
  error: string;
  errorCode:
    | "missing_fields"
    | "auth"
    | "quota"
    | "rate_limit"
    | "http"
    | "timeout"
    | "redirect_blocked"
    | "network"
    | "invalid_response"
    | "url_policy"
    | "proxy_unreachable";
  status?: number;
  diagnostic: string;
  recommendedModels: string[];
};

export type TestConnectionResult = TestConnectionSuccess | TestConnectionFailure;

function mapHttpError(
  status: number,
  provider: LlmProvider,
  body: string,
): Pick<TestConnectionFailure, "error" | "errorCode"> {
  if (status === 401 || status === 403) {
    return {
      errorCode: "auth",
      error: "密钥无效或无此模型权限",
    };
  }
  if (status === 402) {
    return {
      errorCode: "quota",
      error: "套餐额度不足或订阅不可用",
    };
  }
  if (status === 429) {
    return {
      errorCode: "rate_limit",
      error: "当前套餐限流，请稍后重试",
    };
  }
  if (provider === "px_proxy" && (status === 0 || status >= 500)) {
    return {
      errorCode: "proxy_unreachable",
      error: "PX Proxy 未启动或 127.0.0.1:8317 不可达",
    };
  }
  return {
    errorCode: "http",
    error:
      status >= 500
        ? `供应商服务异常（HTTP ${status}）`
        : `连接失败（HTTP ${status}）`,
  };
}

export async function testLlmConnection(
  input: TestConnectionInput,
): Promise<TestConnectionResult> {
  const recommended = recommendedModelsFor(input.provider);
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();

  if (!apiKey || !model) {
    return {
      ok: false,
      error: "请填写密钥和模型后再测试",
      errorCode: "missing_fields",
      diagnostic: "missing apiKey/model",
      recommendedModels: recommended,
    };
  }

  const urlOk = enforcePresetBaseUrl(input.provider, input.baseUrl);
  if (!urlOk.ok) {
    return {
      ok: false,
      error: urlOk.message,
      errorCode: "url_policy",
      diagnostic: urlOk.code,
      recommendedModels: recommended,
    };
  }
  const baseUrl = urlOk.normalized;
  const redact = { secrets: [apiKey] };
  const timeoutMs = input.timeoutMs ?? 12_000;
  const started = Date.now();

  try {
    const req = buildProbeRequest({
      protocol: input.protocol,
      baseUrl,
      apiKey,
      model,
      authMode: input.authMode,
    });
    const res = await safeLlmFetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      timeoutMs,
      fetchImpl: input.fetchImpl,
      redact,
    });
    const rawText = await res.text().catch(() => "");
    const safeBody = redactSecrets(rawText, redact).slice(0, 240);

    if (!res.ok) {
      if (
        input.provider === "px_proxy" &&
        (res.status >= 500 || res.status === 502 || res.status === 503)
      ) {
        return {
          ok: false,
          error: "PX Proxy 未启动或 127.0.0.1:8317 不可达",
          errorCode: "proxy_unreachable",
          status: res.status,
          diagnostic: `HTTP ${res.status}: ${safeBody}`,
          recommendedModels: recommended,
        };
      }
      const mapped = mapHttpError(res.status, input.provider, safeBody);
      return {
        ok: false,
        error: mapped.error,
        errorCode: mapped.errorCode,
        status: res.status,
        diagnostic: `HTTP ${res.status}: ${safeBody}`,
        recommendedModels: recommended,
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        ok: false,
        error: "供应商返回了无法识别的响应",
        errorCode: "invalid_response",
        diagnostic: `non-json: ${safeBody}`,
        recommendedModels: recommended,
      };
    }

    const extracted = extractTextFromResponse(input.protocol, data);
    if (
      extracted.rawShape === "unknown" ||
      !isNonEmptyProbeText(extracted.text)
    ) {
      return {
        ok: false,
        error: "连接返回空正文或未知结构（HTTP 200 不算成功）",
        errorCode: "invalid_response",
        diagnostic: redactSecrets(
          `empty_or_unknown shape=${extracted.rawShape} thinking=${extracted.hadThinkingBlocks ?? false}`,
          redact,
        ),
        recommendedModels: recommended,
      };
    }

    return {
      ok: true,
      testedAt: new Date().toISOString(),
      models: recommended,
      modelsSource: "recommended",
      latencyMs: Date.now() - started,
      diagnostic: redactSecrets(
        `probe ok text_len=${extracted.text.trim().length}; ${Date.now() - started}ms`,
        redact,
      ),
    };
  } catch (err) {
    if (err instanceof SafeFetchError) {
      if (err.code === "redirect_blocked") {
        return {
          ok: false,
          error: "连接被重定向拦截：鉴权请求不会跟随任何 3xx",
          errorCode: "redirect_blocked",
          status: err.status,
          diagnostic: redactSecrets(err.message, redact),
          recommendedModels: recommended,
        };
      }
      if (err.code === "timeout") {
        if (input.provider === "px_proxy") {
          return {
            ok: false,
            error: "PX Proxy 未启动或 127.0.0.1:8317 不可达",
            errorCode: "proxy_unreachable",
            diagnostic: "timeout",
            recommendedModels: recommended,
          };
        }
        return {
          ok: false,
          error: "连接超时。请检查网络、Base URL 是否可达",
          errorCode: "timeout",
          diagnostic: "timeout",
          recommendedModels: recommended,
        };
      }
      if (input.provider === "px_proxy") {
        return {
          ok: false,
          error: "PX Proxy 未启动或 127.0.0.1:8317 不可达",
          errorCode: "proxy_unreachable",
          diagnostic: redactSecrets(err.message, redact),
          recommendedModels: recommended,
        };
      }
      return {
        ok: false,
        error: `无法连接供应商：${redactSecrets(err.message, redact)}`,
        errorCode: "network",
        diagnostic: redactSecrets(err.message, redact),
        recommendedModels: recommended,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: redactSecrets(msg, redact),
      errorCode: "network",
      diagnostic: redactSecrets(msg, redact),
      recommendedModels: recommended,
    };
  }
}
