"use client";

import { Eye, PauseCircle, Save } from "lucide-react";
import { useState } from "react";
import type { MatterWatchSet, SourceGrant, WatchSetUpdate } from "../lib/api";
import styles from "../mvp-workbench.module.css";

type Props = {
  grant: SourceGrant;
  watchSet: MatterWatchSet;
  filteredCount: number;
  onSave: (input: WatchSetUpdate) => Promise<void>;
  onStop: () => Promise<void>;
};

function folderLabel(path: string) {
  const parts = path.replace(/\\/g, "/").replace(/\/+$/, "").split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function SourceGrantPanel({
  grant,
  watchSet,
  filteredCount,
  onSave,
  onStop,
}: Props) {
  const [includes, setIncludes] = useState(
    watchSet.includePathPrefixes.join("\n"),
  );
  const [excludes, setExcludes] = useState(
    watchSet.excludePathPrefixes.join("\n"),
  );
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        grantId: watchSet.grantId,
        includePathPrefixes: includes
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        excludePathPrefixes: excludes
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        status: "active",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.grantPanel} aria-labelledby="grant-heading">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>你授权的项目</span>
          <h2 id="grant-heading">{folderLabel(grant.rootPath)}</h2>
        </div>
        <span
          className={`${styles.statusTag} ${watchSet.status === "active" ? styles.statusActive : styles.statusPaused}`}
        >
          {watchSet.status === "active" ? "关注中" : "已暂停"}
        </span>
      </div>
      <div className={styles.grantPath}>
        <Eye size={14} />
        <span title={grant.rootPath}>{grant.rootPath}</span>
      </div>
      <p className={styles.mutedCopy}>
        只在这个文件夹里阅读。外面的内容不会碰。
        {filteredCount > 0
          ? ` 另有 ${filteredCount} 处变化与当前事项无关，先放一边。`
          : ""}
      </p>
      <div className={styles.buttonRow}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "收起范围" : "调整关注范围"}
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => void onStop()}
          disabled={saving || watchSet.status !== "active"}
        >
          <PauseCircle size={14} />
          暂停关注
        </button>
      </div>
      {showAdvanced && (
        <>
          <div className={styles.watchGrid}>
            <label>
              <span>要看的目录（每行一个）</span>
              <textarea
                value={includes}
                onChange={(event) => setIncludes(event.target.value)}
                aria-label="要看的目录"
              />
            </label>
            <label>
              <span>先跳过的目录（每行一个）</span>
              <textarea
                value={excludes}
                onChange={(event) => setExcludes(event.target.value)}
                aria-label="跳过的目录"
              />
            </label>
          </div>
          <div className={styles.grantFooter}>
            <span className={styles.traceNote}>一般不用改；默认已够用。</span>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => void save()}
              disabled={saving || watchSet.status !== "active"}
            >
              <Save size={14} />
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </>
      )}
      {watchSet.status !== "active" && (
        <div className={styles.pausedNote}>已暂停关注。之前的内容仍可打开。</div>
      )}
    </section>
  );
}
