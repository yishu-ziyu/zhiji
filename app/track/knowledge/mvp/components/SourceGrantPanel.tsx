"use client";

import { Eye, PauseCircle, Plus, Save, ShieldCheck, X } from "lucide-react";
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

export function SourceGrantPanel({ grant, watchSet, filteredCount, onSave, onStop }: Props) {
  const [includes, setIncludes] = useState(watchSet.includePathPrefixes.join("\n"));
  const [excludes, setExcludes] = useState(watchSet.excludePathPrefixes.join("\n"));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        grantId: watchSet.grantId,
        includePathPrefixes: includes.split("\n").map((item) => item.trim()).filter(Boolean),
        excludePathPrefixes: excludes.split("\n").map((item) => item.trim()).filter(Boolean),
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
          <span className={styles.kicker}><ShieldCheck size={13} />来源授权</span>
          <h2 id="grant-heading">当前事项可见范围</h2>
        </div>
        <span className={`${styles.statusTag} ${watchSet.status === "active" ? styles.statusActive : styles.statusPaused}`}>
          {watchSet.status === "active" ? "观察中" : "已停用"}
        </span>
      </div>
      <div className={styles.grantPath}><Eye size={14} /><span>{grant.rootPath}</span></div>
      <p className={styles.mutedCopy}>只有 Owner 显式指定的路径进入当前 matter；未匹配变化只保留 trace，不进入中心。</p>
      <div className={styles.watchGrid}>
        <label>
          <span>允许观察的 path prefixes</span>
          <textarea value={includes} onChange={(event) => setIncludes(event.target.value)} aria-label="允许观察的路径" />
        </label>
        <label>
          <span>排除的 path prefixes</span>
          <textarea value={excludes} onChange={(event) => setExcludes(event.target.value)} aria-label="排除的路径" />
        </label>
      </div>
      <div className={styles.grantFooter}>
        <span className={styles.traceNote}><span className={styles.traceDot} />{filteredCount} 条非匹配变化仅保留 trace</span>
        <div className={styles.buttonRow}>
          <button className={styles.secondaryButton} type="button" onClick={() => void onStop()} disabled={saving || watchSet.status !== "active"}><PauseCircle size={14} />停止 watch</button>
          <button className={styles.primaryButton} type="button" onClick={() => void save()} disabled={saving || watchSet.status !== "active"}><Save size={14} />{saving ? "保存中…" : "保存观察范围"}</button>
        </div>
      </div>
      <div className={styles.watchHint}><Plus size={13} />每行一个 prefix · 至少保留一个显式 include</div>
      {watchSet.status !== "active" && <div className={styles.pausedNote}><X size={13} />watch 已停止；历史 revision 仍可读取。</div>}
    </section>
  );
}
