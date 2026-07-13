export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "text" | "minutes" | "kanban" | "commitment";
  data?: Record<string, unknown>;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
}

/** Efficiency workbench sections */
export type EfficiencyMode = "capture" | "board";
