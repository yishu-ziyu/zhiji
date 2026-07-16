"use client";

/**
 * In-app Bring Your Own Key form.
 * User fills model gateway + key + model name; never prefilled from package.
 */
import { KeyRound, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import styles from "../project-canvas.module.css";

export type ByokStatusView = {
  configured: boolean;
  hasBaseUrl: boolean;
  hasApiKey: boolean;
  hasModel: boolean;
  baseUrl: string | null;
  model: string | null;
  envFileHint?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after successful save with latest status. */
  onSaved?: (status: ByokStatusView) => void;
  /** Parent can pass last known status for initial form values. */
  initialStatus?: ByokStatusView | null;
  /** Optional: inject fetch for tests. */
  requestJson?: <T>(url: string, init?: RequestInit) => Promise<T>;
};

type ApiError = { error?: string };

async function defaultRequestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrf =
      typeof window !== "undefined"
        ? (window as Window & { __FC_OPC_CSRF?: string }).__FC_OPC_CSRF
        : undefined;
    if (csrf && !headers.has("x-csrf-token")) {
      headers.set("x-csrf-token", csrf);
    }
  }
  if (!headers.has("Content-Type") && method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...init, headers });
  const data = (await response.json()) as T & ApiError;
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

export function ByokSettingsPanel({
  open,
  onClose,
  onSaved,
  initialStatus,
  requestJson = defaultRequestJson,
}: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const hydrate = useCallback(async () => {
    setError(null);
    try {
      const data = await requestJson<{ status: ByokStatusView }>(
        "/api/llm/byok",
      );
      const s = data.status;
      setBaseUrl(s.baseUrl ?? "");
      setModel(s.model ?? "");
      setHasApiKey(s.hasApiKey);
      setApiKey("");
      setHint(s.envFileHint ?? null);
    } catch (err) {
      if (initialStatus) {
        setBaseUrl(initialStatus.baseUrl ?? "");
        setModel(initialStatus.model ?? "");
        setHasApiKey(initialStatus.hasApiKey);
        setHint(initialStatus.envFileHint ?? null);
      }
      setError(err instanceof Error ? err.message : "无法读取配置状态");
    }
  }, [initialStatus, requestJson]);

  useEffect(() => {
    if (!open) return;
    void hydrate();
  }, [open, hydrate]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<{
        status: ByokStatusView;
        message?: string;
      }>("/api/llm/byok", {
        method: "PUT",
        body: JSON.stringify({
          llmBaseUrl: baseUrl.trim(),
          llmApiKey: apiKey.trim(),
          llmModel: model.trim(),
        }),
      });
      setHasApiKey(data.status.hasApiKey);
      setApiKey("");
      setHint(data.status.envFileHint ?? null);
      onSaved?.(data.status);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      data-testid="byok-settings-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form
        className={styles.createModal}
        data-testid="byok-settings-panel"
        onSubmit={(e) => void handleSubmit(e)}
        style={{ width: "min(460px, calc(100vw - 40px))" }}
      >
        <header>
          <div>
            <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <KeyRound size={18} aria-hidden />
              模型密钥（自己的 Key）
            </strong>
            <small style={{ color: "var(--pc-muted, #74777d)" }}>
              不会预装进应用。只存在你这台机器上，由你填写。
            </small>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="关闭"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <label style={{ display: "grid", gap: 6 }}>
          <span>模型网关地址</span>
          <input
            data-testid="byok-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例如 https://api.example.com"
            autoComplete="off"
            required
            disabled={busy}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>模型密钥</span>
          <input
            data-testid="byok-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              hasApiKey
                ? "已配置 · 留空则保持原密钥不变"
                : "粘贴你的 API Key"
            }
            autoComplete="off"
            disabled={busy}
            required={!hasApiKey}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>模型名称</span>
          <input
            data-testid="byok-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如 step-3.7-flash"
            autoComplete="off"
            required
            disabled={busy}
          />
        </label>

        {hint ? (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--pc-muted, #74777d)",
              lineHeight: 1.5,
            }}
          >
            本机文件：{hint}
          </p>
        ) : null}

        {error ? (
          <p
            data-testid="byok-error"
            role="alert"
            style={{ margin: 0, color: "#c0392b", fontSize: 13 }}
          >
            {error}
          </p>
        ) : null}

        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            className={styles.newButton}
            data-testid="byok-save"
            disabled={busy}
          >
            {busy ? "保存中…" : "保存并生效"}
          </button>
        </footer>
      </form>
    </div>
  );
}

/** Compact banner when model key is missing — click opens panel. */
export function ByokMissingBanner({
  visible,
  onOpen,
}: {
  visible: boolean;
  onOpen: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      data-testid="byok-missing-banner"
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        margin: 0,
        padding: "8px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255, 149, 0, 0.35)",
        background: "rgba(255, 149, 0, 0.08)",
        color: "#1d1d1f",
        fontSize: 12,
      }}
    >
      <span>
        <strong>还没有模型密钥。</strong>
        {" "}
        自己填网关、Key 和模型名后，才能真读懂项目（应用不会预装）。
      </span>
      <button
        type="button"
        data-testid="byok-banner-open"
        onClick={onOpen}
        style={{
          flexShrink: 0,
          height: 34,
          padding: "0 12px",
          borderRadius: 8,
          border: "1px solid #151618",
          background: "#151618",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        去填写
      </button>
    </div>
  );
}
