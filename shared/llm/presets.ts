/**
 * Competition demo presets — Owner-owned credentials only in primary UI.
 */
import type { LlmPreset, LlmProvider } from "./types";

export const LLM_PRESETS: readonly LlmPreset[] = Object.freeze([
  {
    provider: "px_proxy",
    displayName: "PX Proxy",
    shortName: "PX Proxy",
    connectionKind: "proxy",
    protocol: "anthropic_messages",
    authMode: "bearer",
    baseUrl: "http://127.0.0.1:8317",
    logoSrc: "/llm-logos/px-proxy.svg",
    competitionPrimary: true,
    models: [
      {
        id: "gpt-5.6-sol",
        label: "GPT 5.6 Sol",
        logoSrc: "/llm-logos/openai.svg",
        badge: "proxy",
        badgeLabel: "PX 代理",
      },
      {
        id: "grok-4.5",
        label: "Grok 4.5",
        logoSrc: "/llm-logos/grok.svg",
        badge: "proxy",
        badgeLabel: "PX 代理",
      },
      {
        id: "gemini-pro-agent",
        label: "Gemini Pro Agent",
        logoSrc: "/llm-logos/gemini.svg",
        badge: "proxy",
        badgeLabel: "PX 代理",
      },
    ],
  },
  {
    provider: "minimax_token_plan",
    displayName: "MiniMax · Token Plan",
    shortName: "MiniMax",
    connectionKind: "official",
    protocol: "anthropic_messages",
    authMode: "x-api-key",
    // China Token Plan endpoint verified 2026-07-18 (api.minimaxi.com rejects this key class).
    baseUrl: "https://api.minimaxi.com/anthropic",
    logoSrc: "/llm-logos/minimax.svg",
    competitionPrimary: true,
    models: [
      {
        id: "MiniMax-M3",
        label: "MiniMax M3",
        logoSrc: "/llm-logos/minimax.svg",
        badge: "official",
        badgeLabel: "官方",
      },
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
    competitionPrimary: true,
    models: [
      {
        id: "step-3.7-flash",
        label: "Step 3.7 Flash",
        logoSrc: "/llm-logos/stepfun.svg",
        badge: "official",
        badgeLabel: "官方",
      },
    ],
  },
  // Architecture retained — not competition primary.
  {
    provider: "openai",
    displayName: "OpenAI",
    shortName: "OpenAI",
    connectionKind: "official",
    protocol: "openai_responses",
    authMode: "bearer",
    baseUrl: "https://api.openai.com",
    logoSrc: "/llm-logos/openai.svg",
    competitionPrimary: false,
    models: [{ id: "gpt-4.1", label: "GPT 4.1", logoSrc: "/llm-logos/openai.svg", badge: "official", badgeLabel: "官方" }],
  },
  {
    provider: "deepseek",
    displayName: "DeepSeek",
    shortName: "DeepSeek",
    connectionKind: "official",
    protocol: "openai_chat",
    authMode: "bearer",
    baseUrl: "https://api.deepseek.com",
    logoSrc: "/llm-logos/deepseek.svg",
    competitionPrimary: false,
    models: [{ id: "deepseek-chat", label: "DeepSeek Chat", logoSrc: "/llm-logos/deepseek.svg", badge: "official", badgeLabel: "官方" }],
  },
  {
    provider: "custom_anthropic",
    displayName: "自定义网关",
    shortName: "自定义网关",
    connectionKind: "legacy",
    protocol: "anthropic_messages",
    authMode: "x-api-key",
    baseUrl: "",
    logoSrc: "/llm-logos/custom.svg",
    competitionPrimary: false,
    models: [],
  },
] as const satisfies readonly LlmPreset[]);

export function getPreset(provider: LlmProvider): LlmPreset {
  const found = LLM_PRESETS.find((p) => p.provider === provider);
  if (!found) {
    // Synthetic for legacy
    if (provider === "legacy_custom" || provider === "stepfun" || provider === "minimax") {
      return {
        provider,
        displayName: "历史自定义连接",
        shortName: "历史连接",
        connectionKind: "legacy",
        protocol: "anthropic_messages",
        authMode: "x-api-key",
        baseUrl: "",
        logoSrc: "/llm-logos/custom.svg",
        competitionPrimary: false,
        models: [],
      };
    }
    throw new Error(`Unknown LLM provider preset: ${provider}`);
  }
  return found;
}

export function competitionPresets(): LlmPreset[] {
  return LLM_PRESETS.filter((p) => p.competitionPrimary);
}

export function recommendedModelsFor(provider: LlmProvider): string[] {
  return getPreset(provider).models.map((m) => m.id);
}

export function defaultModelFor(provider: LlmProvider): string {
  return getPreset(provider).models[0]?.id ?? "";
}
