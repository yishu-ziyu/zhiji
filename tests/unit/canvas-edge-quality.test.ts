import { describe, expect, it } from "vitest";
import {
  buildProjectCanvasSnapshot,
  cardDedupeKey,
  classifyEdgeLabel,
} from "@/shared/knowledge/project-canvas";
import type { KnowledgeCard, Project } from "@/shared/types/knowledge";

const project: Project = {
  id: "p-edge",
  name: "scion",
  summary: "",
  status: "active",
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

function card(
  id: string,
  title: string,
  sourceFileId: string,
): KnowledgeCard {
  return {
    id,
    projectId: project.id,
    title,
    content: `${title} body`,
    source: "manual",
    tags: [],
    timestamp: "2026-07-16T10:00:00.000Z",
    links: [],
    sourceFileId,
  };
}

describe("industrial canvas edges + dedupe", () => {
  it("classifies edge strength dictionary", () => {
    expect(classifyEdgeLabel("理解依据").strength).toBe("strong");
    expect(classifyEdgeLabel("最近打开").strength).toBe("weak");
    expect(classifyEdgeLabel("在跟工作").kind).toBe("work");
  });

  it("dedupes same basename to one identity", () => {
    expect(cardDedupeKey(card("a", "README.md", "docs/README.md"))).toBe(
      cardDedupeKey(card("b", "README.md", "README.md")),
    );
  });

  it("project focus: no duplicate README nodes; recent weaker than evidence", () => {
    const cards = [
      card("c1", "README.md", "README.md"),
      card("c2", "README.md", "docs/README.md"),
      card("c3", "PRODUCT.md", "PRODUCT.md"),
      card("c4", "CONTEXT.md", "CONTEXT.md"),
    ];
    const snapshot = buildProjectCanvasSnapshot({
      project,
      cards,
      workItems: [],
      events: [],
      relations: [],
      checkpoint: null,
      focus: { kind: "project", id: project.id },
      now: "2026-07-16T12:00:00.000Z",
      recentCardIds: ["c1", "c3"],
    });

    const readmeNodes = snapshot.nodes.filter(
      (n) =>
        n.ref.kind === "card" &&
        (n.label === "README.md" || n.label.includes("README")),
    );
    expect(readmeNodes.length).toBeLessThanOrEqual(1);

    for (const edge of snapshot.edges) {
      expect(edge.kind).toBeTruthy();
      expect(edge.strength).toBeTruthy();
      expect(edge.why).toBeTruthy();
    }

    const recentEdges = snapshot.edges.filter((e) => e.label === "最近打开");
    for (const edge of recentEdges) {
      expect(edge.strength).toBe("weak");
    }
  });
});
