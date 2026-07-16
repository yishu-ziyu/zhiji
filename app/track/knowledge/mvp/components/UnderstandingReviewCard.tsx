"use client";

import { Check, Edit3, X } from "lucide-react";
import { useState } from "react";
import type { UnderstandingBody, UnderstandingRevision } from "../lib/api";
import styles from "../mvp-workbench.module.css";

type Props = {
  candidate?: UnderstandingRevision;
  accepted?: UnderstandingRevision;
  onResolve: (
    decision: "accept" | "edit_accept" | "reject",
    editedBody?: UnderstandingBody,
  ) => Promise<void>;
  resolutionMessage: string | null;
};

export function UnderstandingReviewCard({
  candidate,
  accepted,
  onResolve,
  resolutionMessage,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editedNow, setEditedNow] = useState(candidate?.body.now.text || "");
  const [busy, setBusy] = useState(false);

  if (!candidate) {
    return (
      <section className={styles.reviewCard} aria-labelledby="review-heading">
        <div className={styles.reviewHeading}>
          <span>下一步</span>
          <span className={styles.statusTag}>
            {accepted ? "已确认" : "暂无待办"}
          </span>
        </div>
        <h2 id="review-heading">
          {accepted ? "当前理解已确认" : "还没有需要你拍板的内容"}
        </h2>
        <p>
          {accepted
            ? "有新的变化时，会再请你看一眼。"
            : "读完材料后，这里会出现一段待你确认的理解。"}
        </p>
        {resolutionMessage && (
          <div className={styles.resolutionMessage}>{resolutionMessage}</div>
        )}
      </section>
    );
  }

  async function resolve(
    decision: "accept" | "edit_accept" | "reject",
    editedBody?: UnderstandingBody,
  ) {
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
    now: {
      ...candidate.body.now,
      text: editedNow.trim() || candidate.body.now.text,
    },
  };

  return (
    <section className={styles.reviewCard} aria-labelledby="review-heading">
      <div className={styles.reviewHeading}>
        <span>下一步</span>
        <span className={`${styles.statusTag} ${styles.statusCandidate}`}>
          待你确认
        </span>
      </div>
      <h2 id="review-heading">这段理解对吗？</h2>
      <p className={styles.reviewPreview}>{candidate.body.now.text}</p>
      {editing ? (
        <div className={styles.editForm}>
          <label>
            <span>改成你想说的</span>
            <textarea
              value={editedNow}
              onChange={(event) => setEditedNow(event.target.value)}
              aria-label="编辑当前理解"
            />
          </label>
          <div className={styles.buttonRow}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setEditing(false)}
            >
              取消
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={busy}
              onClick={() => void resolve("edit_accept", editBody)}
            >
              <Check size={14} />
              改完就这样
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.buttonRow}>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={busy}
            onClick={() => void resolve("accept")}
          >
            <Check size={14} />
            就这样
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={busy}
            onClick={() => {
              setEditedNow(candidate.body.now.text);
              setEditing(true);
            }}
          >
            <Edit3 size={14} />
            改一改
          </button>
          <button
            className={styles.dangerButton}
            type="button"
            disabled={busy}
            onClick={() => void resolve("reject")}
          >
            <X size={14} />
            先不用
          </button>
        </div>
      )}
      {resolutionMessage && (
        <div className={styles.resolutionMessage}>{resolutionMessage}</div>
      )}
    </section>
  );
}
