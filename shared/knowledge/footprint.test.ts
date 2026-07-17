import { describe, expect, it } from "vitest";
import {
  aggregateLit,
  buildLibraryMap,
  litFromHits,
} from "./footprint";
import type { FootprintEvent, KnowledgeCard } from "@/shared/types/knowledge";

const cards: KnowledgeCard[] = [
  {
    id: "a",
    projectId: "project-zhiji",
    content: "a",
    source: "meeting",
    tags: [],
    timestamp: "2026-01-01",
    links: [],
    title: "A",
  },
  {
    id: "b",
    projectId: "project-zhiji",
    content: "b",
    source: "doc",
    tags: [],
    timestamp: "2026-01-01",
    links: [],
    title: "B",
  },
  {
    id: "c",
    projectId: "project-zhiji",
    content: "c",
    source: "meeting",
    tags: [],
    timestamp: "2026-01-01",
    links: [],
    title: "C",
  },
];

describe("footprint layout and lit", () => {
  it("builds stable source-grid layout", () => {
    const first = buildLibraryMap(cards);
    const second = buildLibraryMap(cards);
    expect(first.layout).toBe("source-grid-v1");
    expect(first.nodes.map((n) => n.cardId)).toEqual(
      second.nodes.map((n) => n.cardId),
    );
    expect(first.nodes.map((n) => `${n.x},${n.y}`)).toEqual(
      second.nodes.map((n) => `${n.x},${n.y}`),
    );
  });

  it("litFromHits matches hit ids (conservation)", () => {
    const hits = [
      { id: "a", score: 2 },
      { id: "c", score: 1 },
    ];
    const lit = litFromHits(hits);
    expect(lit.map((e) => e.cardId).sort()).toEqual(["a", "c"]);
    expect(lit.every((e) => e.depth === 1)).toBe(true);
  });

  it("aggregates max depth for window mode", () => {
    const events: FootprintEvent[] = [
      {
        id: "1",
        cardId: "a",
        at: "2026-07-14T00:00:00.000Z",
        kind: "retrieved",
        depth: 1,
        actor: "自己",
      },
      {
        id: "2",
        cardId: "a",
        at: "2026-07-14T01:00:00.000Z",
        kind: "linked",
        depth: 3,
        actor: "自己",
        workItemId: "w1",
      },
    ];
    const map = aggregateLit(events, { mode: "window" });
    expect(map.get("a")?.depth).toBe(3);
    expect(map.get("a")?.touchCount).toBe(2);
  });
});
