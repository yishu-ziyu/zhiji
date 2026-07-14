import type {
  FootprintEvent,
  FootprintKind,
  FootprintLitEntry,
  FootprintViewMode,
  KnowledgeCard,
  KnowledgeSource,
  LibraryNode,
  TouchDepth,
} from "@/shared/types/knowledge";
import {
  FOOTPRINT_KIND_DEPTH,
  SOURCE_CLUSTER_ORDER,
} from "@/shared/types/knowledge";

export function depthForKind(kind: FootprintKind): TouchDepth {
  return FOOTPRINT_KIND_DEPTH[kind];
}

/** Stable source-grid layout: columns by source, rows by id. */
export function buildLibraryMap(
  cards: KnowledgeCard[],
  layout = "source-grid-v1",
): { nodes: LibraryNode[]; layout: string } {
  const bySource = new Map<KnowledgeSource, KnowledgeCard[]>();
  for (const src of SOURCE_CLUSTER_ORDER) {
    bySource.set(src, []);
  }
  for (const card of cards) {
    const list = bySource.get(card.source) ?? [];
    list.push(card);
    bySource.set(card.source, list);
  }
  for (const list of bySource.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }

  const colCount = SOURCE_CLUSTER_ORDER.length;
  const nodes: LibraryNode[] = [];

  SOURCE_CLUSTER_ORDER.forEach((source, col) => {
    const list = bySource.get(source) ?? [];
    const rowCount = Math.max(list.length, 1);
    list.forEach((card, row) => {
      const x = (col + 0.5) / colCount;
      const y = (row + 0.5) / rowCount;
      nodes.push({
        cardId: card.id,
        title: card.title || card.content.slice(0, 24),
        source: card.source,
        x,
        y,
        clusterKey: source,
      });
    });
  });

  return { nodes, layout };
}

export function aggregateLit(
  events: FootprintEvent[],
  options?: {
    mode: FootprintViewMode;
    querySessionId?: string;
    workItemId?: string;
    evidenceIds?: string[];
    since?: string;
  },
): Map<string, FootprintLitEntry> {
  const mode = options?.mode ?? "window";
  let filtered = events;

  if (mode === "current_query" && options?.querySessionId) {
    filtered = events.filter(
      (e) =>
        e.querySessionId === options.querySessionId && e.kind === "retrieved",
    );
  } else if (mode === "work_item") {
    const ids = new Set(options?.evidenceIds ?? []);
    if (options?.workItemId) {
      filtered = events.filter(
        (e) =>
          e.workItemId === options.workItemId ||
          (e.kind === "linked" && ids.has(e.cardId)),
      );
    }
    // Also force-lit evidence ids at least as linked depth
    const map = new Map<string, FootprintLitEntry>();
    for (const id of ids) {
      map.set(id, { cardId: id, depth: 3, touchCount: 1 });
    }
    for (const e of filtered) {
      mergeEvent(map, e);
    }
    return map;
  } else if (mode === "window" && options?.since) {
    const since = options.since;
    filtered = events.filter((e) => e.at >= since && e.depth > 0);
  } else {
    filtered = events.filter((e) => e.depth > 0);
  }

  const map = new Map<string, FootprintLitEntry>();
  for (const e of filtered) {
    if (e.depth <= 0) continue;
    mergeEvent(map, e);
  }
  return map;
}

function mergeEvent(
  map: Map<string, FootprintLitEntry>,
  e: FootprintEvent,
): void {
  const prev = map.get(e.cardId);
  if (!prev) {
    map.set(e.cardId, {
      cardId: e.cardId,
      depth: e.depth,
      score: e.score,
      touchCount: 1,
    });
    return;
  }
  map.set(e.cardId, {
    cardId: e.cardId,
    depth: (Math.max(prev.depth, e.depth) as TouchDepth),
    score:
      e.score !== undefined
        ? Math.max(prev.score ?? 0, e.score)
        : prev.score,
    touchCount: prev.touchCount + 1,
  });
}

/** Lit set for current_query must equal hit ids (spec conservation). */
export function litFromHits(
  hits: Array<{ id: string; score?: number }>,
): FootprintLitEntry[] {
  return hits.map((h) => ({
    cardId: h.id,
    depth: 1 as TouchDepth,
    score: h.score,
    touchCount: 1,
  }));
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
