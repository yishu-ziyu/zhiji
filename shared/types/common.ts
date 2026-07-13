export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "text" | "analysis" | "script" | "minutes" | "kanban";
  data?: Record<string, unknown>;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
}

export type TrackType = "ecommerce" | "efficiency";
export type EcommerceMode = "analyze" | "script";
export type EfficiencyMode = "minutes" | "kanban" | "capture" | "board";
