"use client";

import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Target,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import type { ChangeEventView, MemoryResponse } from "../lib/api";
import styles from "../mvp-workbench.module.css";

type FocusKind = "matter" | "change" | "evidence" | "action";
type FocusNode = { id: string; kind: FocusKind; label: string; detail: string; revisionId?: string };

type Props = {
  memory: MemoryResponse;
  focusId: string;
  onFocus: (node: FocusNode) => void;
  onOpenRevision: (revisionId: string) => void;
};

const slots = [
  { left: "12%", top: "22%" },
  { left: "82%", top: "22%" },
  { left: "13%", top: "76%" },
  { left: "81%", top: "76%" },
  { left: "50%", top: "11%" },
];

function eventLabel(event: ChangeEventView) {
  const labels: Record<ChangeEventView["kind"], string> = {
    added: "新增",
    modified: "修改",
    renamed: "重命名",
    deleted: "删除",
    reconciled: "对账",
  };
  return labels[event.kind];
}

function iconFor(kind: FocusKind) {
  if (kind === "matter") return Target;
  if (kind === "change") return Workflow;
  if (kind === "evidence") return FileText;
  return CheckCircle2;
}

const iconsByKind = {
  matter: Target,
  change: Workflow,
  evidence: FileText,
  action: CheckCircle2,
};

function buildNodes(memory: MemoryResponse): FocusNode[] {
  const eventNodes = memory.events.map((event) => ({
    id: event.id,
    kind: "change" as const,
    label: event.relativePath,
    detail: `${eventLabel(event)} · ${event.matchReason || "匹配当前事项"}`,
    revisionId: event.afterRevisionId || event.beforeRevisionId,
  }));
  const evidenceNodes = (memory.candidate?.body.now.evidence || []).map((anchor) => ({
    id: anchor.revisionId,
    kind: "evidence" as const,
    label: anchor.relativePath,
    detail: `exact revision · ${anchor.revisionId.slice(0, 22)}…`,
    revisionId: anchor.revisionId,
  }));
  return [
    { id: memory.matter.id, kind: "matter", label: memory.matter.title, detail: "当前事项 · 判断中心" },
    ...eventNodes,
    ...evidenceNodes.filter((node, index, all) => all.findIndex((item) => item.id === node.id) === index),
    { id: "action-demo-scope", kind: "action", label: "Demo 的 4 项行动", detail: "受影响的 action · 等 Owner 决定" },
  ];
}

export function MatterFocusCanvas({ memory, focusId, onFocus, onOpenRevision }: Props) {
  const nodes = buildNodes(memory);
  const focused = nodes.find((node) => node.id === focusId) || nodes[0];
  const neighbors = nodes.filter((node) => node.id !== focused.id).slice(0, 5);
  const Icon = iconsByKind[focused.kind];

  return (
    <section className={styles.canvasSection} aria-labelledby="focus-heading">
      <div className={styles.canvasHeader}>
        <div>
          <span className={styles.kicker}><Workflow size={13} />非线性一跳画布</span>
          <h2 id="focus-heading">一件事项居中，只展开一层直接关系</h2>
          <p>点击变化、依据或行动换中心；每条关系都保留证据句和 match reason。</p>
        </div>
        <div className={styles.canvasRule}><span>当前焦点</span><strong>{focused.label}</strong></div>
      </div>
      <div className={styles.canvas}>
        <div className={styles.canvasHint}>默认中心 · {memory.matter.title} <span>·</span> 仅显示一层
        </div>
        <div className={styles.edgeLayer} aria-hidden="true">
          {neighbors.map((node, index) => (
            <span key={node.id} className={styles.edgeLine} style={{ left: "50%", top: "50%", transform: `rotate(${index * 72 - 36}deg)`, width: `${35 + (index % 2) * 5}%` }} />
          ))}
        </div>
        <div className={styles.focusNode}>
          <span className={styles.nodeIcon}><Icon size={18} /></span>
          <span className={styles.nodeKind}>当前焦点</span>
          <strong>{focused.label}</strong>
          <small>{focused.detail}</small>
        </div>
        {neighbors.map((node, index) => {
          const NodeIcon = iconFor(node.kind);
          return (
            <button key={node.id} type="button" className={`${styles.relationNode} ${styles[`relation${node.kind[0].toUpperCase()}${node.kind.slice(1)}`]}`} style={slots[index]} onClick={() => onFocus(node)} aria-label={`${node.label}，${node.kind}`}>
              <span className={styles.nodeIcon}><NodeIcon size={16} /></span>
              <span className={styles.nodeKind}>{node.kind === "change" ? "变化" : node.kind === "evidence" ? "依据" : node.kind === "action" ? "行动" : "事项"}</span>
              <strong>{node.label}</strong>
              <small>{node.detail}</small>
              {node.revisionId && <span className={styles.nodeLink} onClick={(event) => { event.stopPropagation(); onOpenRevision(node.revisionId!); }}><FileText size={11} />打开 exact revision</span>}
            </button>
          );
        })}
        <div className={styles.canvasFootnote}><span className={styles.blueDot} />当前中心不是确认真相 · 关系只显示一跳</div>
      </div>
      <div className={styles.eventStrip}>
        <div><span className={styles.stripLabel}>匹配变化</span><strong>{memory.events.length} 条</strong></div>
        <div><span className={styles.stripLabel}>非匹配 trace</span><strong>{memory.filteredEvents.length} 条</strong></div>
        <div className={styles.stripWarning}><TriangleAlert size={14} /><span>非匹配变化不进入中心</span></div>
        <button type="button" className={styles.textButton} onClick={() => {
          const event = memory.events[0];
          if (event?.afterRevisionId) onOpenRevision(event.afterRevisionId);
        }}>查看最新依据 <ArrowRight size={13} /></button>
      </div>
    </section>
  );
}

export type { FocusNode };
