"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStoreApi,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bot,
  FileText,
  ListChecks,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import type {
  CanvasEdge,
  CanvasNode,
  CanvasNodeKind,
  CanvasNodeRef,
  ProjectCanvasSnapshot,
} from "@/shared/types/knowledge";
import {
  type CanvasViewId,
  filterEdgesForView,
  labelStrengthsForView,
} from "@/shared/knowledge/canvas-command";
import styles from "../project-canvas.module.css";

type Props = {
  snapshot: ProjectCanvasSnapshot | null;
  loading: boolean;
  onFocus: (ref: CanvasNodeRef) => void;
  /** Optional: pulse these node ids after search hit */
  highlightNodeIds?: string[];
  /** canvas-menu-v1 presentation preset */
  viewPreset?: CanvasViewId;
  onViewPresetChange?: (view: CanvasViewId) => void;
};

type GraphNodeData = {
  ref: CanvasNodeRef;
  label: string;
  subtitle?: string;
  state: CanvasNode["state"];
  relationLabel?: string;
  relationStatus?: CanvasEdge["status"];
  relationStrength?: CanvasEdge["strength"];
  isCenter: boolean;
  pulse?: boolean;
};

type GraphEdgeData = {
  canvasEdge: CanvasEdge;
};

type GraphNode = Node<GraphNodeData, "graph">;
type PosMap = Record<string, { x: number; y: number }>;

const MAX_VISIBLE_NEIGHBORS = 10;
const RADIUS_X = 300;
const RADIUS_Y = 210;
const POS_KEY_PREFIX = "fc-opc-canvas-pos:";

function posStorageKey(projectId: string, focusKey: string) {
  return `${POS_KEY_PREFIX}${projectId}:${focusKey}`;
}

function readSavedPositions(projectId: string, focusKey: string): PosMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(posStorageKey(projectId, focusKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PosMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSavedPositions(
  projectId: string,
  focusKey: string,
  positions: PosMap,
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      posStorageKey(projectId, focusKey),
      JSON.stringify(positions),
    );
  } catch {
    /* quota */
  }
}

const VIEW_PRESETS: Array<{ id: CanvasViewId; label: string }> = [
  { id: "now", label: "现在怎样" },
  { id: "by_kind", label: "类型一眼" },
  { id: "decision", label: "决策通路" },
  { id: "evidence", label: "证据网" },
];

function refKey(ref: CanvasNodeRef) {
  return `${ref.kind}:${ref.id}`;
}

/** Human-facing short title: basename, strip hashtag noise. */
function displayLabel(label: string): string {
  const base = (label.split(/[/\\]/).pop() ?? label).trim();
  const cleaned = base
    .replace(/#[^\s#]+/g, " ")
    .replace(/[_\-.]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = cleaned || base;
  if (text.length <= 28) return text;
  return `${text.slice(0, 26)}…`;
}

function NodeIcon({ kind }: { kind: CanvasNodeKind }) {
  if (kind === "card") return <FileText size={16} />;
  if (kind === "work_item") return <ListChecks size={16} />;
  if (kind === "event") return <MessageSquareText size={16} />;
  if (kind === "agent") return <Bot size={16} />;
  return <Bot size={16} />;
}

function edgesTouching(
  snapshot: ProjectCanvasSnapshot,
  node: CanvasNode,
  includeFolded = false,
) {
  const pool = includeFolded
    ? [...snapshot.edges, ...snapshot.foldedEdges]
    : snapshot.edges;
  return pool.filter(
    (edge) =>
      (edge.source.kind === node.ref.kind && edge.source.id === node.ref.id) ||
      (edge.target.kind === node.ref.kind && edge.target.id === node.ref.id),
  );
}

function edgeVisual(edge: CanvasEdge, opts: {
  emphasized: boolean;
  dimmed: boolean;
  showLabel: boolean;
}): Partial<Edge> {
  const strength = edge.strength ?? "medium";
  const kind = edge.kind ?? "other";
  let stroke = "#c5c9cf";
  let strokeWidth = 1.4;
  let dash: string | undefined;
  if (strength === "strong") {
    if (kind === "blocked") stroke = "#c45c4a";
    else if (kind === "evidence" || kind === "attention") stroke = "#3d6fd8";
    else if (kind === "work") stroke = "#2f6a3a";
    else stroke = "#3d6fd8";
    strokeWidth = 2.4;
  } else if (strength === "medium") {
    stroke = "#9aa3ad";
    strokeWidth = 1.5;
  } else {
    stroke = "#d5d8dd";
    strokeWidth = 1.1;
    dash = "5 5";
  }
  if (edge.status === "suggested") {
    stroke = "#dfc48d";
    dash = dash ?? "4 4";
  }
  if (opts.emphasized) {
    strokeWidth += 1.1;
    stroke = strength === "weak" ? "#7a8490" : stroke;
  }
  if (opts.dimmed) {
    stroke = "#e6e8eb";
    strokeWidth = Math.max(1, strokeWidth - 0.4);
  }
  return {
    label: opts.showLabel ? edge.label : undefined,
    animated: edge.status === "suggested" || opts.emphasized,
    style: {
      stroke,
      strokeWidth,
      strokeDasharray: dash,
      opacity: opts.dimmed ? 0.35 : 1,
    },
    labelStyle: {
      fill: "#5a5e66",
      fontSize: 10,
      fontWeight: 650,
    },
    labelBgStyle: {
      fill: "rgba(255,255,255,0.94)",
      fillOpacity: 1,
    },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 6,
  };
}

/**
 * Radial base layout + optional session positions.
 * Center fixed at origin; neighbors free after user drag (P1).
 */
function layoutFromSnapshot(
  snapshot: ProjectCanvasSnapshot,
  saved: PosMap,
  options?: {
    view?: CanvasViewId;
    highlightIds?: Set<string>;
  },
): {
  nodes: GraphNode[];
  edges: Edge[];
  overflow: CanvasNode[];
  canvasEdges: CanvasEdge[];
} {
  const view = options?.view ?? "now";
  const highlightIds = options?.highlightIds ?? new Set<string>();
  const labelStrengths = labelStrengthsForView(view);
  const center = snapshot.nodes.find((n) => n.depth === 0);
  const neighbors = snapshot.nodes.filter((n) => n.depth === 1);
  const strengthRank = (node: CanvasNode) => {
    const edge = edgesTouching(snapshot, node)[0];
    if (!edge) return 0;
    if (edge.strength === "strong") return 3;
    if (edge.strength === "medium") return 2;
    return 1;
  };
  const sortedNeighbors = [...neighbors].sort(
    (a, b) => strengthRank(b) - strengthRank(a),
  );
  const visible = sortedNeighbors.slice(0, MAX_VISIBLE_NEIGHBORS);
  const overflow = [
    ...sortedNeighbors.slice(MAX_VISIBLE_NEIGHBORS),
    ...snapshot.foldedNodes,
  ];

  const nodes: GraphNode[] = [];
  // Declarative handles so edges can resolve before ResizeObserver/handleBounds.
  const centerHandles = [
    { type: "target" as const, position: Position.Top, x: 100, y: 0, width: 8, height: 8 },
    { type: "source" as const, position: Position.Bottom, x: 100, y: 148, width: 8, height: 8 },
    { type: "source" as const, position: Position.Left, x: 0, y: 74, width: 8, height: 8 },
    { type: "source" as const, position: Position.Right, x: 200, y: 74, width: 8, height: 8 },
  ];
  const neighborHandles = [
    { type: "target" as const, position: Position.Left, x: 0, y: 48, width: 8, height: 8 },
    { type: "target" as const, position: Position.Top, x: 98, y: 0, width: 8, height: 8 },
    { type: "source" as const, position: Position.Right, x: 196, y: 48, width: 8, height: 8 },
    { type: "source" as const, position: Position.Bottom, x: 98, y: 96, width: 8, height: 8 },
  ];

  if (center) {
    const cid = refKey(center.ref);
    nodes.push({
      id: cid,
      type: "graph",
      position: saved[cid] ?? { x: 0, y: 0 },
      // Explicit size helps edges initialize before ResizeObserver fires.
      width: 200,
      height: 148,
      initialWidth: 200,
      initialHeight: 148,
      handles: centerHandles,
      data: {
        ref: center.ref,
        label: center.label,
        subtitle: center.subtitle ?? "当前关注",
        state: center.state,
        isCenter: true,
        pulse: highlightIds.has(cid),
      },
      draggable: false,
      selectable: true,
    });
  }

  const n = Math.max(visible.length, 1);
  visible.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
    const relation = edgesTouching(snapshot, node)[0];
    const id = refKey(node.ref);
    const defaultPos = {
      x: Math.cos(angle) * RADIUS_X - 90,
      y: Math.sin(angle) * RADIUS_Y - 36,
    };
    nodes.push({
      id,
      type: "graph",
      position: saved[id] ?? defaultPos,
      width: 196,
      height: 96,
      initialWidth: 196,
      initialHeight: 96,
      handles: neighborHandles,
      data: {
        ref: node.ref,
        label: node.label,
        subtitle: node.subtitle ?? "直接相关",
        state: node.state,
        relationLabel: relation?.label,
        relationStatus: relation?.status,
        relationStrength: relation?.strength,
        isCenter: false,
        pulse: highlightIds.has(id),
      },
      draggable: true,
      selectable: true,
    });
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const visibleEdges = snapshot.edges.filter(
    (edge) =>
      nodeIds.has(refKey(edge.source)) && nodeIds.has(refKey(edge.target)),
  );
  const canvasEdges = filterEdgesForView(visibleEdges, view);
  const edges: Edge[] = canvasEdges.map((edge) => {
    const strength = edge.strength ?? "medium";
    const showLabel = labelStrengths.has(strength);
    // React Flow treats some punctuation poorly in ids; keep stable slug.
    const safeId = edge.id.replace(/>/g, "__");
    return {
      id: safeId,
      source: refKey(edge.source),
      target: refKey(edge.target),
      type: "default",
      data: { canvasEdge: edge } satisfies GraphEdgeData,
      interactionWidth: 18,
      ...edgeVisual(edge, {
        emphasized: false,
        dimmed: false,
        showLabel,
      }),
    };
  });

  return { nodes, edges, overflow, canvasEdges };
}

function kindLabel(kind: CanvasNodeKind): string {
  if (kind === "card") return "材料";
  if (kind === "work_item") return "工作";
  if (kind === "event") return "记录";
  if (kind === "agent") return "Agent";
  if (kind === "project") return "项目";
  return kind;
}

function GraphNodeView({ data, selected }: NodeProps) {
  const node = data as GraphNodeData;
  if (node.isCenter) {
    return (
      <div
        className={`${styles.rfCenter} ${selected ? styles.rfSelected : ""} ${
          node.pulse ? styles.rfPulse : ""
        }`}
        data-state={node.state}
        data-kind={node.ref.kind}
        data-testid={
          node.ref.kind === "project"
            ? "focus-state"
            : `canvas-node-${node.ref.kind}-${node.ref.id}`
        }
      >
        <Handle type="target" position={Position.Top} className={styles.rfHandle} />
        <Handle type="source" position={Position.Bottom} className={styles.rfHandle} />
        <Handle type="source" position={Position.Left} className={styles.rfHandle} />
        <Handle type="source" position={Position.Right} className={styles.rfHandle} />
        {node.ref.kind === "project" ? (
          <Image
            src="/project-canvas/logo-source.png"
            alt=""
            width={56}
            height={56}
            className={styles.centerLogo}
            priority
          />
        ) : (
          <span className={styles.centerIcon} aria-hidden="true">
            <NodeIcon kind={node.ref.kind} />
          </span>
        )}
        <strong title={node.label}>{displayLabel(node.label)}</strong>
        <span>{node.subtitle ?? "当前关注"}</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.rfNode} ${selected ? styles.rfSelected : ""} ${
        node.ref.kind === "agent" ? styles.rfNodeAgent : ""
      } ${node.pulse ? styles.rfPulse : ""}`}
      data-state={node.state}
      data-kind={node.ref.kind}
      data-testid={`canvas-node-${node.ref.kind}-${node.ref.id}`}
    >
      <i className={styles.rfKindBar} aria-hidden data-kind={node.ref.kind} />
      <Handle type="target" position={Position.Left} className={styles.rfHandle} />
      <Handle type="target" position={Position.Top} className={styles.rfHandle} />
      <Handle type="source" position={Position.Right} className={styles.rfHandle} />
      <Handle type="source" position={Position.Bottom} className={styles.rfHandle} />
      <span className={styles.relationNodeIcon} aria-hidden="true">
        <NodeIcon kind={node.ref.kind} />
      </span>
      <span className={styles.relationNodeCopy}>
        <em className={styles.rfKindTag}>{kindLabel(node.ref.kind)}</em>
        <strong title={node.label}>{displayLabel(node.label)}</strong>
        <small>{node.subtitle ?? "直接相关"}</small>
      </span>
      {node.relationLabel && node.relationStrength !== "weak" ? (
        <span
          className={styles.relationChip}
          data-status={node.relationStatus}
          data-strength={node.relationStrength ?? "medium"}
          title={node.relationLabel}
        >
          {node.relationLabel}
        </span>
      ) : null}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  graph: GraphNodeView,
};

function CanvasFlow({
  snapshot,
  onFocus,
  selectedEdgeId,
  onSelectEdge,
  viewPreset,
  highlightNodeIds,
}: {
  snapshot: ProjectCanvasSnapshot;
  onFocus: (ref: CanvasNodeRef) => void;
  selectedEdgeId: string | null;
  onSelectEdge: (edge: CanvasEdge | null) => void;
  viewPreset: CanvasViewId;
  highlightNodeIds?: string[];
}) {
  const projectId = snapshot.project.id;
  const focusKey = refKey(snapshot.focus);
  // Stabilize highlight key so parent re-renders don't thrash layout/setNodes.
  const highlightKey = (highlightNodeIds ?? []).slice().sort().join("|");
  const highlightSet = useMemo(
    () => new Set(highlightKey ? highlightKey.split("|") : []),
    [highlightKey],
  );

  const layout = useMemo(() => {
    const saved = readSavedPositions(projectId, focusKey);
    return layoutFromSnapshot(snapshot, saved, {
      view: viewPreset,
      highlightIds: highlightSet,
    });
  }, [snapshot, projectId, focusKey, viewPreset, highlightSet]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);
  const [foldOpen, setFoldOpen] = useState(false);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const { fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const storeApi = useStoreApi();
  const prevFocusKeyRef = useRef<string>("");
  const prevLayoutSigRef = useRef<string>("");

  // Topology signature: ignore pulse-only churn; include view + node/edge ids.
  const layoutSig = useMemo(() => {
    const nodeIds = layout.nodes.map((n) => n.id).join(",");
    const edgeIds = layout.edges.map((e) => e.id).join(",");
    return `${focusKey}|${viewPreset}|${nodeIds}|${edgeIds}|${highlightKey}`;
  }, [layout.nodes, layout.edges, focusKey, viewPreset, highlightKey]);

  useEffect(() => {
    if (prevLayoutSigRef.current === layoutSig) return;
    const focusChanged = prevFocusKeyRef.current !== focusKey;
    prevFocusKeyRef.current = focusKey;
    prevLayoutSigRef.current = layoutSig;

    setNodes(layout.nodes);
    setEdges(layout.edges);
    setFoldOpen(false);
    setHoverNodeId(null);

    const ids = layout.nodes.map((n) => n.id);
    const t = window.setTimeout(() => {
      const st = storeApi.getState();
      const updates = new Map<
        string,
        { id: string; nodeElement: HTMLElement; force: boolean }
      >();
      for (const id of ids) {
        const el = st.domNode?.querySelector(
          `.react-flow__node[data-id="${id}"]`,
        ) as HTMLElement | null;
        if (el) updates.set(id, { id, nodeElement: el, force: true });
      }
      if (updates.size > 0) st.updateNodeInternals(updates);
      for (const id of ids) updateNodeInternals(id);
      if (focusChanged) {
        void fitView({ padding: 0.22, duration: 220, maxZoom: 1.05 });
      }
      window.setTimeout(() => {
        const st2 = storeApi.getState();
        const updates2 = new Map<
          string,
          { id: string; nodeElement: HTMLElement; force: boolean }
        >();
        for (const id of ids) {
          const el = st2.domNode?.querySelector(
            `.react-flow__node[data-id="${id}"]`,
          ) as HTMLElement | null;
          if (el) updates2.set(id, { id, nodeElement: el, force: true });
        }
        if (updates2.size > 0) st2.updateNodeInternals(updates2);
      }, 80);
    }, 0);
    return () => window.clearTimeout(t);
  }, [
    layoutSig,
    focusKey,
    layout.nodes,
    layout.edges,
    setEdges,
    setNodes,
    fitView,
    updateNodeInternals,
    storeApi,
  ]);

  // Hover / selection: emphasize 1-hop edges, show labels on demand.
  useEffect(() => {
    setEdges((current) =>
      current.map((edge) => {
        const data = edge.data as GraphEdgeData | undefined;
        const canvasEdge = data?.canvasEdge;
        if (!canvasEdge) return edge;
        const touchesHover =
          hoverNodeId != null &&
          (edge.source === hoverNodeId || edge.target === hoverNodeId);
        const selected =
          selectedEdgeId === edge.id ||
          selectedEdgeId === canvasEdge.id;
        const strength = canvasEdge.strength ?? "medium";
        const showLabel =
          selected ||
          touchesHover ||
          labelStrengthsForView(viewPreset).has(strength);
        const anyFocus = hoverNodeId != null || selectedEdgeId != null;
        const visual = edgeVisual(canvasEdge, {
          emphasized: selected || touchesHover,
          dimmed: anyFocus && !selected && !touchesHover,
          showLabel,
        });
        return {
          ...edge,
          ...visual,
          selected,
        };
      }),
    );
  }, [hoverNodeId, selectedEdgeId, setEdges, viewPreset]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const data = node.data as GraphNodeData;
      onSelectEdge(null);
      onFocus(data.ref);
    },
    [onFocus, onSelectEdge],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const data = node.data as GraphNodeData;
      onSelectEdge(null);
      onFocus(data.ref);
    },
    [onFocus, onSelectEdge],
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, dragged: Node) => {
      setNodes((current) => {
        const next = current.map((n) =>
          n.id === dragged.id
            ? { ...n, position: dragged.position }
            : n,
        );
        const positions: PosMap = {};
        for (const n of next) {
          positions[n.id] = { x: n.position.x, y: n.position.y };
        }
        writeSavedPositions(projectId, focusKey, positions);
        return next;
      });
    },
    [projectId, focusKey, setNodes],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const data = edge.data as GraphEdgeData | undefined;
      if (data?.canvasEdge) onSelectEdge(data.canvasEdge);
    },
    [onSelectEdge],
  );

  const overflow = layout.overflow;
  const hiddenCount =
    snapshot.hiddenNeighborCount +
    Math.max(
      0,
      snapshot.nodes.filter((n) => n.depth === 1).length - MAX_VISIBLE_NEIGHBORS,
    );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onNodeMouseEnter={(_, node) => setHoverNodeId(node.id)}
        onNodeMouseLeave={() => setHoverNodeId(null)}
        onPaneClick={() => onSelectEdge(null)}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        nodesDraggable
        elementsSelectable
        edgesFocusable
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "default",
        }}
        className={styles.rfRoot}
        data-testid="project-canvas-flow"
        data-edge-count={String(edges.length)}
        data-node-count={String(nodes.length)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.1}
          color="rgba(180, 184, 190, 0.45)"
        />
        <MiniMap
          className={styles.rfMiniMap}
          position="bottom-left"
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(node) => {
            const data = node.data as GraphNodeData | undefined;
            if (!data) return "#d0d3d8";
            if (data.isCenter) return "#3d6fd8";
            if (data.ref.kind === "card") return "#6b8f71";
            if (data.ref.kind === "work_item") return "#c48a3a";
            if (data.ref.kind === "event") return "#8a7bb8";
            if (data.ref.kind === "agent") return "#3d6fd8";
            return "#9aa3ad";
          }}
          maskColor="rgba(246, 246, 243, 0.72)"
        />
        <Controls
          showInteractive={false}
          className={styles.rfControls}
          position="bottom-right"
        />
      </ReactFlow>

      {hiddenCount > 0 || overflow.length > 0 ? (
        <div className={styles.foldedNeighbors} data-no-pan>
          <button type="button" onClick={() => setFoldOpen((v) => !v)}>
            另有 {Math.max(hiddenCount, overflow.length)} 项
            {foldOpen ? "，收起" : "，展开"}
          </button>
          {foldOpen ? (
            <div className={styles.foldedList}>
              {overflow.map((node) => {
                const edge = edgesTouching(snapshot, node, true)[0];
                return (
                  <button
                    key={refKey(node.ref)}
                    type="button"
                    data-testid={`canvas-node-${node.ref.kind}-${node.ref.id}`}
                    onClick={() => onFocus(node.ref)}
                  >
                    <NodeIcon kind={node.ref.kind} />
                    <span>{displayLabel(node.label)}</span>
                    <small>{edge?.label ?? "相关"}</small>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function ProjectCanvas({
  snapshot,
  loading,
  onFocus,
  highlightNodeIds,
  viewPreset: viewPresetProp,
  onViewPresetChange,
}: Props) {
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<CanvasEdge | null>(null);
  const [localView, setLocalView] = useState<CanvasViewId>("now");
  const viewPreset = viewPresetProp ?? localView;
  const setViewPreset = (view: CanvasViewId) => {
    if (onViewPresetChange) onViewPresetChange(view);
    else setLocalView(view);
  };

  useEffect(() => {
    setSelectedEdge(null);
    setShowAllAttention(false);
  }, [snapshot?.focus.kind, snapshot?.focus.id, snapshot?.project.id]);

  if (!snapshot) {
    return (
      <section className={styles.canvasArea} data-testid="project-canvas">
        <div className={styles.canvasLoading}>
          {loading ? "正在恢复项目…" : "暂无项目数据"}
        </div>
      </section>
    );
  }

  const primaryAttention = snapshot.attention[0];
  const attentionItems = showAllAttention
    ? snapshot.attention.slice(0, 5)
    : primaryAttention
      ? [primaryAttention]
      : [];
  const evidenceItems = (snapshot.projectNow?.evidence ?? []).slice(0, 3);

  return (
    <section className={styles.canvasArea} data-testid="project-canvas">
      <aside
        className={styles.agentAttention}
        data-testid="agent-attention"
        data-no-pan
      >
        <div
          className={styles.projectNow}
          data-testid="project-now"
          data-status={snapshot.projectNow?.status ?? "empty"}
        >
          <div className={styles.agentAttentionHeader}>
            <Sparkles size={14} aria-hidden="true" />
            <strong data-testid="project-now-label">现在怎样</strong>
          </div>
          <p
            data-testid="project-now-judgment"
            className={styles.projectNowJudgment}
          >
            {snapshot.projectNow?.judgment ??
              "还没材料，还谈不上理解项目局面。"}
          </p>
          {snapshot.projectNow?.nextStep ? (
            <p data-testid="project-now-next" className={styles.projectNowNext}>
              建议：{snapshot.projectNow.nextStep}
            </p>
          ) : null}
          {evidenceItems.length > 0 ? (
            <ul
              data-testid="project-now-evidence"
              className={styles.agentAttentionList}
            >
              {evidenceItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-testid={`project-now-evidence-${item.id}`}
                    onClick={() => onFocus({ kind: "card", id: item.id })}
                    title={item.label}
                  >
                    <FileText size={12} aria-hidden="true" />
                    <span>依据：{displayLabel(item.label)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : snapshot.projectNow?.status === "empty" ? (
            <p
              className={styles.agentAttentionEmpty}
              data-testid="project-now-empty"
            >
              没有可点开的材料依据。
            </p>
          ) : null}
        </div>

        {attentionItems.length > 0 ? (
          <>
            <div className={styles.agentAttentionHeader}>
              <ListChecks size={14} aria-hidden="true" />
              <strong data-testid="agent-attention-primary-label">
                当前请先看
              </strong>
            </div>
            <ul className={styles.agentAttentionList}>
              {attentionItems.map((item, index) => (
                <li key={`${item.target.kind}:${item.target.id}`}>
                  <button
                    type="button"
                    data-testid={
                      index === 0
                        ? "canvas-attention-primary"
                        : `canvas-attention-${item.target.kind}-${item.target.id}`
                    }
                    data-primary={index === 0 ? "true" : "false"}
                    onClick={() => onFocus(item.target)}
                  >
                    <span>{item.reason}</span>
                  </button>
                </li>
              ))}
            </ul>
            {snapshot.attention.length > 1 ? (
              <button
                type="button"
                className={styles.agentAttentionMore}
                data-testid="agent-attention-more"
                onClick={() => setShowAllAttention((value) => !value)}
              >
                {showAllAttention
                  ? "只保留一条"
                  : `还有 ${snapshot.attention.length - 1} 条`}
              </button>
            ) : null}
          </>
        ) : (
          <p className={styles.agentAttentionEmpty}>
            点节点进摘要 · 双击同样进入 · 拖邻居记住位置 · 空白平移 · 滚轮缩放。
          </p>
        )}
        {selectedEdge ? (
          <div
            className={styles.edgeDetail}
            data-testid="canvas-edge-detail"
          >
            <div className={styles.agentAttentionHeader}>
              <strong>这条关系</strong>
            </div>
            <p className={styles.edgeDetailLabel}>
              <span data-strength={selectedEdge.strength ?? "medium"}>
                {selectedEdge.label}
              </span>
            </p>
            <p className={styles.edgeDetailWhy}>
              {selectedEdge.why ||
                selectedEdge.evidenceSentence ||
                "已连接两个节点。"}
            </p>
            <div className={styles.edgeDetailActions}>
              <button
                type="button"
                onClick={() => onFocus(selectedEdge.source)}
              >
                打开起点
              </button>
              <button
                type="button"
                onClick={() => onFocus(selectedEdge.target)}
              >
                打开终点
              </button>
              <button type="button" onClick={() => setSelectedEdge(null)}>
                关闭
              </button>
            </div>
          </div>
        ) : null}

        {snapshot.focus.kind !== "project" ? (
          <button
            type="button"
            className={styles.agentAttentionMore}
            data-testid="canvas-return-project"
            onClick={() =>
              onFocus({ kind: "project", id: snapshot.project.id })
            }
          >
            回到项目中心
          </button>
        ) : null}
        <p className={styles.canvasHint}>
          悬停高亮邻边 · 点边看原因 · 中心固定、邻居可拖 · 弱边默认隐藏
        </p>
      </aside>

      <div
        className={styles.edgeFilterBar}
        data-testid="canvas-view-preset"
        data-no-pan
      >
        {VIEW_PRESETS.map((f) => (
          <button
            key={f.id}
            type="button"
            data-active={viewPreset === f.id ? "true" : "false"}
            data-testid={`canvas-view-preset-${f.id}`}
            onClick={() => setViewPreset(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.rfStage}>
        <ReactFlowProvider>
          <CanvasFlow
            snapshot={snapshot}
            onFocus={onFocus}
            selectedEdgeId={selectedEdge?.id ?? null}
            onSelectEdge={setSelectedEdge}
            viewPreset={viewPreset}
            highlightNodeIds={highlightNodeIds}
          />
        </ReactFlowProvider>
      </div>

      {loading ? (
        <div className={styles.canvasRefresh}>正在更新关系…</div>
      ) : null}
    </section>
  );
}
