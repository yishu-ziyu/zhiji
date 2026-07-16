"use client";

import { ArrowLeft, ExternalLink, GitCompareArrows, History, X } from "lucide-react";
import type { RevisionResponse } from "../lib/api";
import styles from "../mvp-workbench.module.css";

type Props = {
  revision: RevisionResponse | null;
  loading: boolean;
  onClose: () => void;
};

export function RevisionViewer({ revision, loading, onClose }: Props) {
  if (!revision && !loading) return null;
  return (
    <div className={styles.viewerBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className={styles.revisionViewer} aria-label="exact revision 查看器">
        <div className={styles.viewerHeader}>
          <div><span className={styles.kicker}><History size={13} />来源版本</span><h2>精确 revision</h2></div>
          <button className={styles.iconButton} type="button" onClick={onClose} aria-label="关闭版本查看器"><X size={16} /></button>
        </div>
        {loading && <div className={styles.viewerLoading}><History size={18} />正在读取不可变原文…</div>}
        {revision && (
          <>
            <div className={styles.revisionMeta}><strong>{revision.revision.relativePath}</strong><span>{revision.revision.tombstone ? "删除前版本 · tombstone" : "不可变原文"}</span><code>{revision.revision.id}</code><small>{revision.revision.sizeBytes} bytes · {revision.revision.observedAt}</small></div>
            {revision.revision.previousRevisionId && <div className={styles.beforeAfter}><GitCompareArrows size={14} /><span>previousRevisionId</span><code>{revision.revision.previousRevisionId}</code></div>}
            <div className={styles.contentLabel}><span>exact content</span><ExternalLink size={13} /></div>
            <pre className={styles.revisionContent}>{revision.content}</pre>
            <div className={styles.viewerFooter}><ArrowLeft size={13} />只读查看 · 版本内容不会被 UI 改写</div>
          </>
        )}
      </aside>
    </div>
  );
}
