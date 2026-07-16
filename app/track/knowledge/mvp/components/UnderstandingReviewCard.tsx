"use client";

import { Check, Edit3, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { UnderstandingBody, UnderstandingRevision } from "../lib/api";
import styles from "../mvp-workbench.module.css";

type Props = {
  candidate?: UnderstandingRevision;
  accepted?: UnderstandingRevision;
  onResolve: (decision: "accept" | "edit_accept" | "reject", editedBody?: UnderstandingBody) => Promise<void>;
  resolutionMessage: string | null;
};

export function UnderstandingReviewCard({ candidate, accepted, onResolve, resolutionMessage }: Props) {
  const [editing, setEditing] = useState(false);
  const [editedNow, setEditedNow] = useState(candidate?.body.now.text || "");
  const [busy, setBusy] = useState(false);

  if (!candidate) {
    return (
      <section className={styles.reviewCard} aria-labelledby="review-heading">
        <div className={styles.reviewHeading}><span><ShieldCheck size={14} />Owner 决议</span><span className={styles.statusTag}>{accepted ? "accepted" : "等待候选"}</span></div>
        <h2 id="review-heading">当前没有待审 candidate</h2>
        <p>已确认 revision 保留在历史中；新的来源变化会产生新的 candidate。</p>
      </section>
    );
  }

  async function resolve(decision: "accept" | "edit_accept" | "reject", editedBody?: UnderstandingBody) {
    setBusy(true);
    try {
      await onResolve(decision, editedBody);
      if (decision !== "edit_accept") setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const editBody: UnderstandingBody = {
    ...candidate.body,
    now: { ...candidate.body.now, text: editedNow.trim() || candidate.body.now.text },
  };

  return (
    <section className={styles.reviewCard} aria-labelledby="review-heading">
      <div className={styles.reviewHeading}><span><Sparkles size={14} />Owner 决议</span><span className={styles.statusTag}>{candidate.kind}</span></div>
      <h2 id="review-heading">接受会新建 accepted revision</h2>
      <p>candidate `{candidate.id}` 保持不可变。Owner 的 accept / edit_accept 只创建新的 accepted revision；reject 只写 resolution。</p>
      {editing ? (
        <div className={styles.editForm}>
          <label><span>编辑「现在怎样」</span><textarea value={editedNow} onChange={(event) => setEditedNow(event.target.value)} aria-label="编辑当前理解" /></label>
          <div className={styles.buttonRow}>
            <button className={styles.secondaryButton} type="button" onClick={() => setEditing(false)}>取消</button>
            <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void resolve("edit_accept", editBody)}><Check size={14} />编辑后接受</button>
          </div>
        </div>
      ) : (
        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void resolve("accept")}><Check size={14} />接受为新 revision</button>
          <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => { setEditedNow(candidate.body.now.text); setEditing(true); }}><Edit3 size={14} />编辑</button>
          <button className={styles.dangerButton} type="button" disabled={busy} onClick={() => void resolve("reject")}><X size={14} />拒绝</button>
        </div>
      )}
      <div className={styles.reviewFootnote}><ShieldCheck size={12} />决议请求固定 actor=`owner`；Agent 没有 OwnerDecisionWriter。</div>
      {resolutionMessage && <div className={styles.resolutionMessage}>{resolutionMessage}</div>}
    </section>
  );
}
