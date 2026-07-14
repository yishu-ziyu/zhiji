export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "text" | "knowledge" | "action";
  data?: Record<string, unknown>;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
}
