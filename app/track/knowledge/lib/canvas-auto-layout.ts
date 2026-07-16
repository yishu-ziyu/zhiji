/**
 * Hierarchical auto-layout for ProjectCanvas (xyflow nodes/edges).
 * Uses @dagrejs/dagre — the same approach as official React Flow layout examples.
 * ELK is heavier; dagre covers star / one-hop project graphs well.
 */
import dagre from "@dagrejs/dagre";

export type LayoutDirection = "TB" | "LR";

export type LayoutNode = {
  id: string;
  width?: number | null;
  height?: number | null;
  position: { x: number; y: number };
  /** Center / project node — preferred rank source. */
  isCenter?: boolean;
};

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
};

export type AutoLayoutResult<T extends LayoutNode> = {
  nodes: T[];
  direction: LayoutDirection;
  engine: "dagre";
};

/**
 * Place nodes with dagre. Mutates copies only; input arrays unchanged.
 * Edges are oriented center → neighbor when one end is marked isCenter.
 */
export function applyDagreLayout<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
  options?: {
    direction?: LayoutDirection;
    nodeSep?: number;
    rankSep?: number;
  },
): AutoLayoutResult<T> {
  const direction = options?.direction ?? "TB";
  if (nodes.length === 0) {
    return { nodes: [], direction, engine: "dagre" };
  }

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: options?.nodeSep ?? 56,
    ranksep: options?.rankSep ?? 88,
    marginx: 28,
    marginy: 28,
  });

  for (const node of nodes) {
    const w = Math.max(80, node.width ?? 196);
    const h = Math.max(48, node.height ?? 96);
    g.setNode(node.id, { width: w, height: h });
  }

  const centerId = nodes.find((n) => n.isCenter)?.id;
  const seenEdges = new Set<string>();
  for (const edge of edges) {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
    if (edge.source === edge.target) continue;
    // Prefer flow out of center so rank is stable for project focus graphs.
    let source = edge.source;
    let target = edge.target;
    if (centerId && target === centerId && source !== centerId) {
      source = edge.target;
      target = edge.source;
    }
    const key = `${source}->${target}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    g.setEdge(source, target);
  }

  // If no edges, still assign a simple vertical stack via dagre ranks.
  if (seenEdges.size === 0 && nodes.length > 1) {
    const [first, ...rest] = nodes;
    for (const n of rest) {
      g.setEdge(first!.id, n.id);
    }
  }

  dagre.layout(g);

  const next = nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    const w = Math.max(80, node.width ?? 196);
    const h = Math.max(48, node.height ?? 96);
    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });

  return { nodes: next, direction, engine: "dagre" };
}
