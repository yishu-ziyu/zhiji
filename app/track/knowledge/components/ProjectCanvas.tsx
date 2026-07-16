import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Bot,
  CircleDashed,
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
import styles from "../project-canvas.module.css";

type Props = {
  snapshot: ProjectCanvasSnapshot | null;
  loading: boolean;
  onFocus: (ref: CanvasNodeRef) => void;
};

type RelationSide = "left" | "right";

type CanvasLink = {
  id: string;
  d: string;
  direction: CanvasEdge["direction"];
  status: CanvasEdge["status"];
};

function refKey(ref: CanvasNodeRef) {
  return `${ref.kind}:${ref.id}`;
}

function sideFor(node: CanvasNode): RelationSide {
  return node.ref.kind === "card" ? "left" : "right";
}

function edgesFor(
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

function directionCopy(direction: CanvasEdge["direction"]) {
  if (direction === "out") return "指向";
  if (direction === "in") return "来自";
  return "相互关联";
}

function NodeIcon({ kind }: { kind: CanvasNodeKind }) {
  if (kind === "card") return <FileText size={18} />;
  if (kind === "work_item") return <ListChecks size={18} />;
  if (kind === "event") return <MessageSquareText size={18} />;
  return <Bot size={18} />;
}

function EdgeTags({ edges }: { edges: CanvasEdge[] }) {
  return (
    <div className={styles.edgeTags}>
      {edges.map((edge) => (
        <span
          key={edge.id}
          className={styles.edgeLabel}
          data-status={edge.status}
          data-edge-id={edge.id}
          title={
            edge.evidenceSentence
              ? `来源：${edge.evidenceSentence}`
              : undefined
          }
          aria-label={`${directionCopy(edge.direction)}：${edge.label}。${
            edge.evidenceSentence
              ? `来源：${edge.evidenceSentence}`
              : "无补充来源句"
          }`}
        >
          <span className={styles.edgeLabelMain}>
            <span>{directionCopy(edge.direction)}</span>
            <span>{edge.label}</span>
            {edge.status === "suggested" ? (
              <CircleDashed size={11} aria-hidden="true" />
            ) : null}
          </span>
          {edge.evidenceSentence ? (
            <span className={styles.edgeEvidence}>来源：{edge.evidenceSentence}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function RelationNode({
  node,
  edges,
  onFocus,
}: {
  node: CanvasNode;
  edges: CanvasEdge[];
  onFocus: (ref: CanvasNodeRef) => void;
}) {
  return (
    <button
      type="button"
      className={styles.relationNode}
      data-state={node.state}
      data-testid={`canvas-node-${node.ref.kind}-${node.ref.id}`}
      data-edge-id={edges[0]?.id}
      data-edge-ids={edges.map((edge) => edge.id).join(" ")}
      data-direction={edges[0]?.direction ?? "out"}
      data-canvas-ref={refKey(node.ref)}
      onClick={() => onFocus(node.ref)}
    >
      <span className={styles.relationNodeIcon} aria-hidden="true">
        <NodeIcon kind={node.ref.kind} />
      </span>
      <span className={styles.relationNodeCopy}>
        <strong>{node.label}</strong>
        <small>{node.subtitle ?? "直接相关"}</small>
      </span>
      <EdgeTags edges={edges} />
    </button>
  );
}

export function ProjectCanvas({ snapshot, loading, onFocus }: Props) {
  const [foldState, setFoldState] = useState({ focusKey: "", open: false });
  const [showAllAttention, setShowAllAttention] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [canvasLinks, setCanvasLinks] = useState<{
    width: number;
    height: number;
    links: CanvasLink[];
  }>({ width: 0, height: 0, links: [] });

  const currentFocusKey = snapshot ? refKey(snapshot.focus) : "";

  useLayoutEffect(() => {
    if (!snapshot) return;

    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    const updateLinks = () => {
      const stageRect = stage.getBoundingClientRect();
      const center = stage.querySelector<HTMLElement>("[data-canvas-center]");
      if (!center || stageRect.width === 0 || stageRect.height === 0) return;

      const centerRect = center.getBoundingClientRect();
      const centerPoint = {
        x: centerRect.left - stageRect.left + centerRect.width / 2,
        y: centerRect.top - stageRect.top + centerRect.height / 2,
      };
      const nodes = new Map(
        Array.from(stage.querySelectorAll<HTMLElement>("[data-canvas-ref]")).map(
          (element) => [element.dataset.canvasRef, element],
        ),
      );
      const edgesByEndpoint = new Map<string, CanvasEdge[]>();

      for (const edge of snapshot.edges) {
        const sourceKey = refKey(edge.source);
        const targetKey = refKey(edge.target);
        const endpointKey =
          sourceKey === currentFocusKey ? targetKey :
            targetKey === currentFocusKey ? sourceKey : null;
        if (!endpointKey || !nodes.has(endpointKey)) continue;
        const group = edgesByEndpoint.get(endpointKey) ?? [];
        group.push(edge);
        edgesByEndpoint.set(endpointKey, group);
      }

      const links: CanvasLink[] = [];
      for (const [endpointKey, edges] of edgesByEndpoint) {
        const node = nodes.get(endpointKey);
        if (!node) continue;
        const nodeRect = node.getBoundingClientRect();
        const nodePoint = {
          x: nodeRect.left - stageRect.left + nodeRect.width / 2,
          y: nodeRect.top - stageRect.top + nodeRect.height / 2,
        };
        const isLeft = nodePoint.x < centerPoint.x;
        const startX =
          centerPoint.x + (isLeft ? -centerRect.width / 2 : centerRect.width / 2);
        const endX =
          nodePoint.x + (isLeft ? nodeRect.width / 2 : -nodeRect.width / 2);
        const controlDistance = Math.max(28, Math.abs(endX - startX) * 0.44);

        edges.forEach((edge, index) => {
          const offset = (index - (edges.length - 1) / 2) * 5;
          const startY = centerPoint.y + offset;
          const endY = nodePoint.y + offset;
          const firstControlX = startX + (isLeft ? -controlDistance : controlDistance);
          const secondControlX = endX + (isLeft ? controlDistance : -controlDistance);
          links.push({
            id: edge.id,
            direction: edge.direction,
            status: edge.status,
            d: `M ${startX} ${startY} C ${firstControlX} ${startY}, ${secondControlX} ${endY}, ${endX} ${endY}`,
          });
        });
      }

      setCanvasLinks((previous) => {
        const same =
          previous.width === Math.round(stageRect.width) &&
          previous.height === Math.round(stageRect.height) &&
          previous.links.length === links.length &&
          previous.links.every((link, index) =>
            link.id === links[index]?.id && link.d === links[index]?.d,
          );
        return same
          ? previous
          : {
              width: Math.round(stageRect.width),
              height: Math.round(stageRect.height),
              links,
            };
      });
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateLinks);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(stage);
    for (const element of stage.querySelectorAll<HTMLElement>(
      "[data-canvas-center], [data-canvas-ref]",
    )) {
      observer.observe(element);
    }
    scheduleUpdate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [currentFocusKey, snapshot]);

  if (!snapshot) {
    return (
      <section className={styles.canvasArea} data-testid="project-canvas">
        <div className={styles.canvasLoading}>
          {loading ? "正在恢复项目…" : "暂无项目数据"}
        </div>
      </section>
    );
  }

  const center = snapshot.nodes.find((node) => node.depth === 0);
  const neighbors = snapshot.nodes.filter((node) => node.depth === 1);
  const leftNeighbors = neighbors.filter((node) => sideFor(node) === "left");
  const rightNeighbors = neighbors.filter((node) => sideFor(node) === "right");
  const showFolded = foldState.focusKey === currentFocusKey && foldState.open;
  const primaryAttention = snapshot.attention[0];
  const attentionItems = showAllAttention
    ? snapshot.attention.slice(0, 5)
    : primaryAttention
      ? [primaryAttention]
      : [];

  return (
    <section className={styles.canvasArea} data-testid="project-canvas">
      <aside className={styles.agentAttention} data-testid="agent-attention">
        <div className={styles.agentAttentionHeader}>
          <Sparkles size={16} aria-hidden="true" />
          <strong data-testid="agent-attention-primary-label">
            {snapshot.attention.length > 0
              ? "当前请先看这一条"
              : "暂无重点提示"}
          </strong>
        </div>
        {attentionItems.length > 0 ? (
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
        ) : (
          <p className={styles.agentAttentionEmpty}>
            点击对象，查看它的直接关系和执行记录。
          </p>
        )}
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
      </aside>

      <div className={styles.focusCanvas} ref={stageRef}>
        {canvasLinks.links.length > 0 ? (
          <svg
            className={styles.graphLinks}
            data-testid="canvas-graph-links"
            aria-hidden="true"
            viewBox={`0 0 ${canvasLinks.width} ${canvasLinks.height}`}
          >
            {canvasLinks.links.map((link) => (
              <path
                key={link.id}
                className={styles.graphLink}
                data-edge-id={link.id}
                data-direction={link.direction}
                data-status={link.status}
                d={link.d}
              />
            ))}
          </svg>
        ) : null}
        <div className={styles.relationColumn} data-side="left">
          {leftNeighbors.map((node) => {
            const edges = edgesFor(snapshot, node);
            return (
              <div
                key={`${node.ref.kind}:${node.ref.id}`}
                data-testid="one-hop-relation"
              >
                <RelationNode node={node} edges={edges} onFocus={onFocus} />
              </div>
            );
          })}
        </div>

        {center ? (
          <button
            type="button"
            className={styles.focusState}
            data-testid="focus-state"
            data-canvas-center
            data-canvas-ref={refKey(center.ref)}
            onClick={() => onFocus(center.ref)}
          >
            {center.ref.kind === "project" ? (
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
                <NodeIcon kind={center.ref.kind} />
              </span>
            )}
            <strong>{center.label}</strong>
            <span>{center.subtitle ?? "当前关注"}</span>
            {snapshot.inspector.whyImportant ? (
              <span className={styles.focusWhy}>
                {snapshot.inspector.whyImportant}
              </span>
            ) : null}
          </button>
        ) : null}

        <div className={styles.relationColumn} data-side="right">
          {rightNeighbors.map((node) => {
            const edges = edgesFor(snapshot, node);
            return (
              <div
                key={`${node.ref.kind}:${node.ref.id}`}
                data-testid="one-hop-relation"
              >
                <RelationNode node={node} edges={edges} onFocus={onFocus} />
              </div>
            );
          })}
        </div>
      </div>

      {snapshot.hiddenNeighborCount > 0 ? (
        <div className={styles.foldedNeighbors}>
          <button
            type="button"
            onClick={() =>
              setFoldState({ focusKey: currentFocusKey, open: !showFolded })
            }
          >
            另有 {snapshot.hiddenNeighborCount} 项
            {showFolded ? "，收起" : "，展开"}
          </button>
          {showFolded ? (
            <div className={styles.foldedList}>
              {snapshot.foldedNodes.map((node) => {
                const edges = edgesFor(snapshot, node, true);
                if (edges.length === 0) return null;
                return (
                  <button
                    key={`${node.ref.kind}:${node.ref.id}`}
                    type="button"
                    data-testid={`canvas-node-${node.ref.kind}-${node.ref.id}`}
                    onClick={() => onFocus(node.ref)}
                  >
                    <NodeIcon kind={node.ref.kind} />
                    <span>{node.label}</span>
                    <small>{edges[0]?.label}</small>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className={styles.canvasRefresh}>正在更新关系…</div>
      ) : null}
    </section>
  );
}
