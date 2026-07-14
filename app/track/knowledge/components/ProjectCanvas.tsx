import Image from "next/image";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CircleDashed,
  FileText,
  Link2,
  ListChecks,
  MessageSquareText,
  Sparkles,
  Star,
} from "lucide-react";
import type {
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

const positions = [
  { x: 24, y: 28 },
  { x: 73, y: 30 },
  { x: 22, y: 66 },
  { x: 76, y: 66 },
  { x: 50, y: 78 },
  { x: 50, y: 16 },
];

function stateColor(state: CanvasNode["state"]) {
  if (state === "confirmed") return "green";
  if (state === "changed") return "orange";
  if (state === "active") return "blue";
  if (state === "blocked") return "red";
  return "slate";
}

function NodeIcon({ kind }: { kind: CanvasNodeKind }) {
  if (kind === "card") return <FileText size={18} />;
  if (kind === "work_item") return <ListChecks size={18} />;
  if (kind === "event") return <MessageSquareText size={18} />;
  return <Bot size={18} />;
}

function CenterNode({ node }: { node: CanvasNode }) {
  return (
    <>
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
        <span className={styles.centerIcon}><NodeIcon kind={node.ref.kind} /></span>
      )}
      <strong>{node.label}</strong>
      <span>{node.subtitle ?? "当前关注"}</span>
    </>
  );
}

function NeighborNode({ node, index }: { node: CanvasNode; index: number }) {
  const color = stateColor(node.state);
  return (
    <>
      <span className={styles.nodeNumber} data-color={color}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className={styles.nodeCopy}>
        <strong>{node.label}</strong>
        <small>{node.subtitle ?? "直接相关"}</small>
      </span>
      <Star className={styles.nodeStar} size={14} fill="currentColor" aria-hidden="true" />
    </>
  );
}

export function ProjectCanvas({ snapshot, loading, onFocus }: Props) {
  const [foldState, setFoldState] = useState({ focusKey: "", open: false });

  if (!snapshot) {
    return (
      <section className={styles.canvasArea} data-testid="project-canvas">
        <div className={styles.canvasLoading}>{loading ? "正在恢复项目…" : "暂无项目数据"}</div>
      </section>
    );
  }

  const center = snapshot.nodes.find((node) => node.depth === 0);
  const neighbors = snapshot.nodes.filter((node) => node.depth === 1);
  const currentFocusKey = `${snapshot.focus.kind}:${snapshot.focus.id}`;
  const showFolded = foldState.focusKey === currentFocusKey && foldState.open;
  const edgeFor = (node: CanvasNode) =>
    snapshot.edges.find(
      (edge) =>
        (edge.source.kind === node.ref.kind && edge.source.id === node.ref.id) ||
        (edge.target.kind === node.ref.kind && edge.target.id === node.ref.id),
    );

  return (
    <section className={styles.canvasArea} data-testid="project-canvas">
      <div className={styles.attentionCallout}>
        <Sparkles size={17} />
        <div>
          <strong>Agent 找到 {snapshot.attention.length} 个当前重点</strong>
          <p>{snapshot.attention[0]?.reason ?? "点击节点，查看它的直接关系和执行记录。"}</p>
        </div>
      </div>

      <div className={styles.graphStage}>
        <svg
          className={styles.graphLines}
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <circle cx="500" cy="300" r="118" />
          <circle cx="500" cy="300" r="210" />
          {neighbors.map((node, index) => {
            const position = positions[index % positions.length];
            const x = position.x * 10;
            const y = position.y * 6;
            const bendX = (500 + x) / 2 + (index % 2 ? 30 : -30);
            const bendY = (300 + y) / 2;
            return (
              <path
                key={`${node.ref.kind}:${node.ref.id}`}
                d={`M 500 300 Q ${bendX} ${bendY} ${x} ${y}`}
              />
            );
          })}
        </svg>

        {center ? (
          <button
            type="button"
            className={`${styles.canvasNode} ${styles.centerNode}`}
            data-testid={`canvas-node-${center.ref.kind}-${center.ref.id}`}
            onClick={() => onFocus(center.ref)}
          >
            <CenterNode node={center} />
          </button>
        ) : null}

        {neighbors.map((node, index) => {
          const position = positions[index % positions.length];
          const edge = edgeFor(node);
          const edgeIsOutgoing = Boolean(
            edge && center &&
            edge.source.kind === center.ref.kind &&
            edge.source.id === center.ref.id,
          );
          const edgeDescription = edgeIsOutgoing
            ? `从当前中心指向此节点：${edge?.label ?? "直接相关"}`
            : `从此节点指向当前中心：${edge?.label ?? "直接相关"}`;
          return (
            <div
              key={`${node.ref.kind}:${node.ref.id}`}
              className={styles.nodeCluster}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <button
                type="button"
                className={`${styles.canvasNode} ${styles.neighborNode}`}
                data-state={node.state}
                data-testid={`canvas-node-${node.ref.kind}-${node.ref.id}`}
                onClick={() => onFocus(node.ref)}
              >
                <NeighborNode node={node} index={index} />
              </button>
              <span
                className={styles.edgeLabel}
                data-status={edge?.status ?? "confirmed"}
                title={edge?.evidenceSentence}
                aria-label={`${edgeDescription}。${edge?.evidenceSentence ?? "无补充来源句"}`}
              >
                {edgeIsOutgoing ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
                {edge?.label ?? "直接相关"}
                {edge?.status === "suggested" ? <CircleDashed size={11} /> : null}
              </span>
              <span className={styles.nodeTools} aria-hidden="true">
                <span><NodeIcon kind={node.ref.kind} /></span>
                <span><Link2 size={15} /></span>
                <span><FileText size={15} /></span>
              </span>
            </div>
          );
        })}
      </div>

      {snapshot.hiddenNeighborCount > 0 ? (
        <div className={styles.foldedNeighbors}>
          <button
            type="button"
            onClick={() => setFoldState({ focusKey: currentFocusKey, open: !showFolded })}
          >
            另有 {snapshot.hiddenNeighborCount} 项{showFolded ? "，收起" : "，展开"}
          </button>
          {showFolded ? (
            <div className={styles.foldedList}>
              {snapshot.foldedNodes.map((node) => (
                <button
                  key={`${node.ref.kind}:${node.ref.id}`}
                  type="button"
                  onClick={() => onFocus(node.ref)}
                >
                  <NodeIcon kind={node.ref.kind} />
                  <span>{node.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? <div className={styles.canvasRefresh}>正在更新关系…</div> : null}
    </section>
  );
}
