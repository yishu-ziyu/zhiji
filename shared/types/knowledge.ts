/** Knowledge-worker loop: retrieve → store → act → track status. */

export type KnowledgeSource = "meeting" | "email" | "chat" | "doc" | "manual";

export type KnowledgeCard = {
  id: string;
  content: string;
  source: KnowledgeSource;
  tags: string[];
  timestamp: string;
  /** Related card IDs */
  links: string[];
  title?: string;
};

export type ActionStatus = "todo" | "doing" | "confirmed" | "done";

export type ActionItem = {
  id: string;
  description: string;
  assignee: string;
  deadline: string;
  status: ActionStatus;
  verificationCriteria: string;
  /** Optional link back to a knowledge card */
  cardId?: string;
  updatedAt: string;
};

export type KnowledgeSearchFilters = {
  source?: KnowledgeSource | KnowledgeSource[];
  tags?: string[];
  limit?: number;
};

export type KnowledgeSearchRequest = {
  query: string;
  filters?: KnowledgeSearchFilters;
};

export type KnowledgeSearchHit = KnowledgeCard & {
  score: number;
};

export type MinutesResult = {
  title: string;
  summary: string;
  cards: KnowledgeCard[];
  actionItems: ActionItem[];
  offline?: boolean;
};

export type DissectResult = {
  goal: string;
  actionItems: ActionItem[];
  offline?: boolean;
};

export type ActionSuggestion = {
  id: string;
  title: string;
  reason: string;
  suggestedStatus?: ActionStatus;
  relatedCardIds: string[];
};

export const ACTION_STATUSES: ActionStatus[] = [
  "todo",
  "doing",
  "confirmed",
  "done",
];

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  "meeting",
  "email",
  "chat",
  "doc",
  "manual",
];
