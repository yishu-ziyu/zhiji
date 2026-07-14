import type {
  KnowledgeCard,
  KnowledgeSearchFilters,
  KnowledgeSearchHit,
} from "@/shared/types/knowledge";
import { listCards } from "./repository";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，。；;、/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function scoreCard(card: KnowledgeCard, tokens: string[]): number {
  if (tokens.length === 0) return 0.1;
  const hay = [
    card.title ?? "",
    card.content,
    card.tags.join(" "),
    card.source,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
    if ((card.title ?? "").toLowerCase().includes(token)) score += 0.5;
    if (card.tags.some((t) => t.toLowerCase().includes(token))) score += 0.75;
  }
  return score;
}

function matchesFilters(
  card: KnowledgeCard,
  filters?: KnowledgeSearchFilters,
): boolean {
  if (!filters) return true;

  if (filters.projectId && card.projectId !== filters.projectId) {
    return false;
  }

  if (filters.source) {
    const sources = Array.isArray(filters.source)
      ? filters.source
      : [filters.source];
    if (!sources.includes(card.source)) return false;
  }

  if (filters.tags && filters.tags.length > 0) {
    const want = filters.tags.map((t) => t.toLowerCase());
    const have = card.tags.map((t) => t.toLowerCase());
    if (!want.every((t) => have.some((h) => h.includes(t) || t.includes(h)))) {
      return false;
    }
  }

  return true;
}

/** Hybrid-ish local search: keyword + tag boost. No vector DB required for demo. */
export function searchKnowledge(
  query: string,
  filters?: KnowledgeSearchFilters,
): KnowledgeSearchHit[] {
  const tokens = tokenize(query ?? "");
  const limit = filters?.limit ?? 20;
  const cards = listCards().filter((c) => matchesFilters(c, filters));

  const hits: KnowledgeSearchHit[] = cards
    .map((card) => ({
      ...card,
      score: scoreCard(card, tokens),
    }))
    .filter((hit) => (tokens.length === 0 ? true : hit.score > 0))
    .sort((a, b) => b.score - a.score || b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);

  return hits;
}
