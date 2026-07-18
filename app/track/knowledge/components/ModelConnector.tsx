"use client";

/**
 * Model connector — competition demo connections (PX / MiniMax Token Plan / Step Plan).
 * "已连接" only after server verify-and-activate; preview test ≠ connected.
 */
import { Check, ChevronDown, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "./model-connector.module.css";
import type { LlmAuthMode, LlmProtocol, LlmProvider } from "@/shared/llm/types";

export type ModelConnectorStatus = {
  configured: boolean;
  connected: boolean;
  needsReverify?: boolean;
  hasBaseUrl: boolean;
  hasApiKey: boolean;
  hasModel: boolean;
  baseUrl: string | null;
  model: string | null;
  provider: LlmProvider | null;
  protocol: LlmProtocol | null;
  authMode: LlmAuthMode | null;
  connectionKind?: string | null;
  verifiedAt: string | null;
  profileFingerprint?: string | null;
  legacyLabel?: string;
  envFileHint?: string;
  /** Competition providers with a saved local key (no secrets). */
  vaultedProviders?: string[];
};

export type ModelOptionView = {
  id: string;
  label: string;
  logoSrc: string;
  badge: "proxy" | "official" | "preset";
  badgeLabel: string;
};

export type ModelPresetView = {
  provider: LlmProvider;
  displayName: string;
  shortName: string;
  connectionKind: string;
  protocol: LlmProtocol;
  authMode: LlmAuthMode;
  baseUrl: string;
  logoSrc: string;
  models: ModelOptionView[];
  competitionPrimary?: boolean;
};

type Props = {
  status: ModelConnectorStatus | null;
  presets?: ModelPresetView[];
  onStatusChange?: (status: ModelConnectorStatus) => void;
  requestJson?: <T>(url: string, init?: RequestInit) => Promise<T>;
};

type TestState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "ok"; testedAt: string; diagnostic: string }
  | { kind: "fail"; error: string; diagnostic?: string };

const FALLBACK_PRESETS: ModelPresetView[] = [
  {
    provider: "px_proxy",
    displayName: "本机代理",
    shortName: "本机代理",
    connectionKind: "proxy",
    protocol: "anthropic_messages",
    authMode: "bearer",
    baseUrl: "http://127.0.0.1:8317",
    logoSrc: "/llm-logos/px-proxy.svg",
    models: [
      { id: "gpt-5.6-sol", label: "GPT 5.6 Sol", logoSrc: "/llm-logos/openai.svg", badge: "proxy", badgeLabel: "本机代理" },
      { id: "grok-4.5", label: "Grok 4.5", logoSrc: "/llm-logos/grok.svg", badge: "proxy", badgeLabel: "本机代理" },
      { id: "gemini-pro-agent", label: "Gemini Pro Agent", logoSrc: "/llm-logos/gemini.svg", badge: "proxy", badgeLabel: "本机代理" },
    ],
  },
  {
    provider: "minimax_token_plan",
    displayName: "MiniMax · Token Plan",
    shortName: "MiniMax",
    connectionKind: "official",
    protocol: "anthropic_messages",
    authMode: "x-api-key",
    baseUrl: "https://api.minimaxi.com/anthropic",
    logoSrc: "/llm-logos/minimax.svg",
    models: [
      { id: "MiniMax-M3", label: "MiniMax M3", logoSrc: "/llm-logos/minimax.svg", badge: "official", badgeLabel: "官方" },
    ],
  },
  {
    provider: "stepfun_step_plan",
    displayName: "阶跃星辰 · Step Plan",
    shortName: "阶跃星辰",
    connectionKind: "official",
    protocol: "anthropic_messages",
    authMode: "bearer",
    baseUrl: "https://api.stepfun.com/step_plan",
    logoSrc: "/llm-logos/stepfun.svg",
    models: [
      { id: "step-3.7-flash", label: "Step 3.7 Flash", logoSrc: "/llm-logos/stepfun.svg", badge: "official", badgeLabel: "官方" },
    ],
  },
];

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
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error || `请求失败 (${response.status})`,
    );
  }
  return data;
}

export function ModelConnector({
  status,
  presets: presetsProp,
  onStatusChange,
  requestJson = defaultRequestJson,
}: Props) {
  const presets = useMemo(
    () =>
      (presetsProp?.length ? presetsProp : FALLBACK_PRESETS).filter(
        (p) =>
          p.provider === "px_proxy" ||
          p.provider === "minimax_token_plan" ||
          p.provider === "stepfun_step_plan",
      ),
    [presetsProp],
  );

  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [draftProvider, setDraftProvider] = useState<LlmProvider>("px_proxy");
  const [draftModel, setDraftModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });
  const [saveBusy, setSaveBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingSwitchHint, setPendingSwitchHint] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const connectCardRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const connected = Boolean(status?.connected && status.verifiedAt);
  const currentProvider = status?.provider ?? null;
  const currentModel = status?.model ?? null;

  const selectedPreset = useMemo(
    () =>
      presets.find((p) => p.provider === draftProvider) ??
      presets[0] ??
      FALLBACK_PRESETS[0],
    [draftProvider, presets],
  );

  const flatRows = useMemo(() => {
    const rows: Array<{
      provider: LlmProvider;
      model: ModelOptionView;
      preset: ModelPresetView;
    }> = [];
    for (const p of presets) {
      for (const m of p.models) {
        rows.push({ provider: p.provider, model: m, preset: p });
      }
    }
    return rows;
  }, [presets]);

  const closePanel = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
      capsuleRef.current?.focus();
    }, 110);
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closePanel();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, closePanel]);

  // Focus trap for connect panel
  useEffect(() => {
    if (!connectOpen) return;
    const card = connectCardRef.current;
    const focusable = card?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !saveBusy) {
        e.preventDefault();
        setConnectOpen(false);
        capsuleRef.current?.focus();
      }
      if (e.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectOpen, saveBusy]);

  function openConnect(provider: LlmProvider, modelId?: string) {
    const preset = presets.find((p) => p.provider === provider) ?? presets[0];
    setDraftProvider(provider);
    setDraftModel(modelId || preset.models[0]?.id || "");
    setApiKey("");
    setTestState({ kind: "idle" });
    setFormError(null);
    setConnectOpen(true);
    setOpen(false);
  }

  function clearTestOnEdit() {
    setTestState({ kind: "idle" });
  }

  async function runTest() {
    setTestState({ kind: "busy" });
    setFormError(null);
    try {
      const result = await requestJson<{
        ok: boolean;
        testedAt?: string;
        diagnostic?: string;
        error?: string;
        modelsNote?: string;
      }>("/api/llm/test-connection", {
        method: "POST",
        body: JSON.stringify({
          provider: draftProvider,
          model: draftModel,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      if (!result.ok || !result.testedAt) {
        setTestState({
          kind: "fail",
          error: result.error || "连接失败",
          diagnostic: result.diagnostic,
        });
        return;
      }
      setTestState({
        kind: "ok",
        testedAt: result.testedAt,
        diagnostic: result.diagnostic || result.modelsNote || "测试通过",
      });
    } catch (err) {
      setTestState({
        kind: "fail",
        error: err instanceof Error ? err.message : "连接失败",
      });
    }
  }

  async function saveAndUse() {
    if (testState.kind !== "ok") {
      setFormError("请先测试连接成功，再保存并使用（服务端会再次验证）");
      return;
    }
    setSaveBusy(true);
    setFormError(null);
    try {
      // Never send verifiedAt — server probes again.
      // Empty apiKey → server reuses same-provider key or local provider vault.
      const data = await requestJson<{
        status: ModelConnectorStatus;
        message?: string;
      }>("/api/llm/byok", {
        method: "PUT",
        body: JSON.stringify({
          provider: draftProvider,
          llmModel: draftModel,
          llmApiKey: apiKey.trim() || undefined,
        }),
      });
      onStatusChange?.(data.status);
      setPendingSwitchHint("已连接。将在下一次分析中使用此模型。");
      setConnectOpen(false);
      setApiKey("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaveBusy(false);
    }
  }

  /**
   * One-click switch when this machine already has a vaulted key for the provider.
   */
  async function quickActivate(provider: LlmProvider, modelId: string) {
    setSaveBusy(true);
    setPendingSwitchHint("正在切换并验证连接…");
    setOpen(false);
    try {
      const data = await requestJson<{
        status: ModelConnectorStatus;
        message?: string;
      }>("/api/llm/byok", {
        method: "PUT",
        body: JSON.stringify({
          provider,
          llmModel: modelId,
        }),
      });
      onStatusChange?.(data.status);
      setPendingSwitchHint("已切换。将在下一次分析中使用此模型。");
    } catch (err) {
      setPendingSwitchHint(
        err instanceof Error ? err.message : "切换失败，请打开管理连接重试",
      );
      openConnect(provider, modelId);
    } finally {
      setSaveBusy(false);
    }
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flatRows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = flatRows[activeIndex];
      if (!row) return;
      const vaulted = status?.vaultedProviders?.includes(row.provider);
      if (vaulted) void quickActivate(row.provider, row.model.id);
      else openConnect(row.provider, row.model.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePanel();
    }
  }

  const currentMeta = useMemo(() => {
    if (!currentProvider || !currentModel) return null;
    for (const p of presets) {
      if (p.provider !== currentProvider) continue;
      const m = p.models.find((x) => x.id === currentModel);
      if (m) return { preset: p, model: m };
    }
    return null;
  }, [currentProvider, currentModel, presets]);

  const capsuleText = connected
    ? `${currentMeta?.preset.shortName ?? currentProvider} · ${currentMeta?.model.label ?? currentModel}`
    : status?.needsReverify
      ? status.legacyLabel || "历史连接 · 需重新验证"
      : status?.configured
        ? "需重新验证"
        : "选择模型";

  const capsuleLogo =
    currentMeta?.model.logoSrc ||
    currentMeta?.preset.logoSrc ||
    "/llm-logos/custom.svg";

  return (
    <>
      <div className={styles.wrap} ref={rootRef} data-testid="model-connector">
        <button
          ref={capsuleRef}
          type="button"
          className={styles.capsule}
          data-testid="model-connector-capsule"
          data-open={open ? "true" : "false"}
          data-connected={connected ? "true" : "false"}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label="模型连接"
          title={
            connected
              ? `当前：${capsuleText}`
              : "选择模型连接（Key 只存本机）"
          }
          onClick={() => (open ? closePanel() : setOpen(true))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.logo}
            src={connected ? capsuleLogo : "/llm-logos/custom.svg"}
            alt=""
            width={20}
            height={20}
          />
          <span className={styles.capsuleLabel}>{capsuleText}</span>
          <ChevronDown className={styles.chevron} size={14} aria-hidden />
        </button>

        {open || leaving ? (
          <div
            className={styles.panel}
            data-testid="model-connector-panel"
            data-leaving={leaving ? "true" : "false"}
            role="dialog"
            aria-label="选择模型连接"
          >
            <div className={styles.panelHeader}>模型连接</div>
            <ul
              id={listId}
              ref={listRef}
              className={styles.providerList}
              role="listbox"
              tabIndex={0}
              onKeyDown={onListKey}
            >
              {flatRows.map((row, index) => {
                // Connected only when exact provider + model match (not sibling aliases).
                const isExactConnected =
                  connected &&
                  status?.provider === row.provider &&
                  status?.model === row.model.id;
                const vaulted = Boolean(
                  status?.vaultedProviders?.includes(row.provider),
                );
                let statusText = "需配置";
                let statusKind: "connected" | "current" | "need" = "need";
                if (isExactConnected) {
                  statusText = "当前";
                  statusKind = "current";
                } else if (vaulted) {
                  // Same provider different model, or another vaulted provider.
                  statusText =
                    connected && status?.provider === row.provider
                      ? "一键切换"
                      : "可切换";
                  statusKind = "connected";
                } else if (
                  connected &&
                  status?.provider === row.provider &&
                  status?.model !== row.model.id
                ) {
                  statusText = "切换后需测试";
                  statusKind = "need";
                }
                return (
                  <li key={`${row.provider}:${row.model.id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      className={styles.providerRow}
                      data-active={activeIndex === index ? "true" : "false"}
                      data-selected={isExactConnected ? "true" : "false"}
                      data-testid={`model-row-${row.provider}-${row.model.id}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        if (vaulted) {
                          void quickActivate(row.provider, row.model.id);
                        } else {
                          openConnect(row.provider, row.model.id);
                        }
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.logo}
                        src={row.model.logoSrc}
                        alt=""
                        width={20}
                        height={20}
                      />
                      <span className={styles.providerName}>
                        {row.preset.displayName === "本机代理"
                          ? row.model.label
                          : `${row.preset.shortName} · ${row.model.label}`}
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            color:
                              row.model.badge === "proxy"
                                ? "#b25000"
                                : "#1a7f37",
                            border: "1px solid currentColor",
                            borderRadius: 4,
                            padding: "0 4px",
                          }}
                          data-testid={`badge-${row.model.id}`}
                        >
                          {row.model.badgeLabel}
                        </span>
                      </span>
                      <span
                        className={styles.providerStatus}
                        data-kind={statusKind}
                      >
                        {statusText}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className={styles.footerRow}>
              <button
                type="button"
                className={styles.manageBtn}
                data-testid="model-connector-manage"
                onClick={() =>
                  openConnect(
                    currentProvider &&
                      (currentProvider === "px_proxy" ||
                        currentProvider === "minimax_token_plan" ||
                        currentProvider === "stepfun_step_plan")
                      ? currentProvider
                      : "px_proxy",
                    currentModel || undefined,
                  )
                }
              >
                管理连接…
              </button>
            </div>
            {pendingSwitchHint ? (
              <p
                style={{
                  margin: "0 14px 10px",
                  fontSize: 11,
                  color: "#74777d",
                }}
                data-testid="model-switch-hint"
              >
                {pendingSwitchHint}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {connectOpen ? (
        <div
          className={styles.connectBackdrop}
          role="presentation"
          data-testid="model-connect-panel"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saveBusy) setConnectOpen(false);
          }}
        >
          <div
            className={styles.connectCard}
            role="dialog"
            aria-modal="true"
            ref={connectCardRef}
          >
            <header>
              <div>
                <h2>连接模型</h2>
                <p>
                  {selectedPreset.displayName}
                  {selectedPreset.connectionKind === "proxy"
                    ? " · 代理别名，不是官方直连"
                    : " · 官方直连"}
                  。密钥只保存在本机。测试通过后，保存时服务端会再次验证。
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setConnectOpen(false)}
                disabled={saveBusy}
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </header>

            <label className={styles.field}>
              模型
              <select
                data-testid="model-connect-model"
                value={draftModel}
                onChange={(e) => {
                  setDraftModel(e.target.value);
                  clearTestOnEdit();
                }}
                disabled={saveBusy || testState.kind === "busy"}
              >
                {selectedPreset.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}（{m.badgeLabel}）
                  </option>
                ))}
              </select>
              <span style={{ fontWeight: 500, color: "#74777d", fontSize: 11 }}>
                预置模型，保存时会再次验证
              </span>
            </label>

            <label className={styles.field}>
              API Key
              <input
                data-testid="model-connect-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  clearTestOnEdit();
                }}
                placeholder={
                  status?.hasApiKey && status.provider === draftProvider
                    ? "已配置 · 留空则沿用本连接密钥"
                    : "粘贴你的 API Key（切换供应商必须重填）"
                }
                autoComplete="off"
                disabled={saveBusy || testState.kind === "busy"}
              />
            </label>

            <div className={styles.testRow}>
              <button
                type="button"
                className={styles.testBtn}
                data-testid="model-connect-test"
                onClick={() => void runTest()}
                disabled={saveBusy || testState.kind === "busy"}
              >
                {testState.kind === "busy" ? (
                  <span className={styles.spinner} aria-hidden />
                ) : null}
                测试连接
              </button>
              <span
                className={styles.testState}
                data-kind={
                  testState.kind === "ok"
                    ? "ok"
                    : testState.kind === "fail"
                      ? "fail"
                      : testState.kind === "busy"
                        ? "busy"
                        : undefined
                }
                data-testid="model-connect-test-state"
              >
                {testState.kind === "idle" && "尚未测试"}
                {testState.kind === "busy" && "正在连接…"}
                {testState.kind === "ok" && (
                  <>
                    <span className={styles.checkPop}>
                      <Check size={14} aria-hidden />
                    </span>{" "}
                    测试通过
                  </>
                )}
                {testState.kind === "fail" && `连接失败：${testState.error}`}
              </span>
            </div>

            {testState.kind === "ok" || testState.kind === "fail" ? (
              <p className={styles.diag} data-testid="model-connect-diag">
                {testState.kind === "ok"
                  ? testState.diagnostic
                  : testState.diagnostic}
              </p>
            ) : null}
            {formError ? (
              <p className={styles.error} role="alert">
                {formError}
              </p>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => setConnectOpen(false)}
                disabled={saveBusy}
              >
                取消
              </button>
              <button
                type="button"
                data-primary="true"
                data-testid="model-connect-save"
                disabled={saveBusy || testState.kind !== "ok"}
                onClick={() => void saveAndUse()}
              >
                {saveBusy ? "验证并保存…" : "保存并使用"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ModelConnectorMissingBanner({
  visible,
  onOpen,
}: {
  visible: boolean;
  onOpen: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      data-testid="model-connector-missing-banner"
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
        <strong>还没有可用的模型连接。</strong>{" "}
        选择 本机代理 / MiniMax Token Plan / 阶跃星辰 Step Plan，测试并保存后才能真读项目。
      </span>
      <button
        type="button"
        data-testid="model-connector-banner-open"
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
        选择模型
      </button>
    </div>
  );
}
