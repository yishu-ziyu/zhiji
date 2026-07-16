"use client";

import { History, X } from "lucide-react";
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
    <div
      className={styles.viewerBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className={styles.revisionViewer} aria-label="原文">
        <div className={styles.viewerHeader}>
          <div>
            <span className={styles.kicker}>
              <History size={13} />
              原文
            </span>
            <h2>{revision?.revision.relativePath || "打开依据"}</h2>
          </div>
          <button
            className={styles.iconButton}
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        {loading && (
          <div className={styles.viewerLoading}>
            <History size={18} />
            正在打开…
          </div>
        )}
        {revision && (
          <>
            <div className={styles.revisionMeta}>
              <strong>{revision.revision.relativePath}</strong>
              <span>
                {revision.revision.tombstone ? "删除前的版本" : "当时的原文"}
              </span>
              <small>
                {new Date(revision.revision.observedAt).toLocaleString("zh-CN")}
              </small>
            </div>
            <pre className={styles.revisionContent}>{revision.content}</pre>
            <div className={styles.viewerFooter}>只读 · 不会改动你的文件</div>
          </>
        )}
      </aside>
    </div>
  );
}
