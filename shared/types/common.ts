export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "text" | "knowledge" | "action";
  data?: Record<string, unknown>;
}

import type {
  LlmAuthMode,
  LlmConnectionKind,
  LlmProtocol,
  LlmProvider,
} from "@/shared/llm/types";

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  provider: LlmProvider;
  protocol: LlmProtocol;
  authMode: LlmAuthMode;
  /** ISO time of last server-side successful probe; null if never verified. */
  verifiedAt: string | null;
  connectionKind?: LlmConnectionKind;
  profileFingerprint?: string;
}
