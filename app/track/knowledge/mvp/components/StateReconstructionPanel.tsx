"use client";

import { AlertCircle, CheckCircle2, ChevronRight, CircleHelp, FileText, GitCompareArrows, History, MessageCircleQuestion } from "lucide-react";
import type { MemoryResponse, StateClaim, WhyClaim } from "../lib/api";
import styles from "../mvp-workbench.module.css";

type Props = {
  memory: MemoryResponse;
  onOpenRevision: (revisionId: string) => void;
};

function claimIcon(status: "supported" | "unknown" | "conflicted") {
  if (status === "supported") return CheckCircle2;
  if (status === "conflicted") return AlertCircle;
  return CircleHelp;
}

function statusText(status: WhyClaim["status"]) {
  if (status === "supported") return "supported · 有 exact quote";
  if (status === "conflicted") return "conflicted · 有冲突依据";
  return "unknown · 原因尚无可核对依据";
}

function Claim({ title, claim, onOpenRevision }: { title: string; claim: StateClaim; onOpenRevision: (revisionId: string) => void }) {
  return (
    <div className={styles.claimBlock}>
      <span className={styles.questionLabel}>{title}</span>
      <p>{claim.text}</p>
      {(claim.gaps.length > 0 || claim.conflicts.length > 0) && <div className={styles.claimNote}>{[...claim.gaps, ...claim.conflicts].join(" · ")}</div>}
      {claim.evidence.map((anchor) => (
        <button key={`${anchor.revisionId}-${anchor.relativePath}`} className={styles.quoteLink} type="button" onClick={() => onOpenRevision(anchor.revisionId)}>
          <FileText size={12} /><span>{anchor.relativePath}</span><em>“{anchor.quote}”</em><ChevronRight size={12} />
        </button>
      ))}
    </div>
  );
}

export function StateReconstructionPanel({ memory, onOpenRevision }: Props) {
  const body = memory.candidate?.body || memory.accepted?.body;
  if (!body) return <section className={styles.emptyPanel}>等待第一条 understanding revision。</section>;

  return (
    <section className={styles.statePanel} aria-labelledby="six-questions-heading">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}><MessageCircleQuestion size={13} />状态重建</span>
          <h2 id="six-questions-heading">六个问题，逐条回到依据</h2>
        </div>
        <span className={`${styles.statusTag} ${memory.candidate ? styles.statusCandidate : styles.statusAccepted}`}>
          {memory.candidate ? "candidate" : "accepted"}
        </span>
      </div>
      <div className={styles.sixGrid}>
        <Claim title="1 · 现在怎样" claim={body.now} onOpenRevision={onOpenRevision} />
        <Claim title="2 · 当时怎样" claim={body.then} onOpenRevision={onOpenRevision} />
        <div className={styles.claimBlock}>
          <span className={styles.questionLabel}><GitCompareArrows size={12} />3 · 变了什么</span>
          {body.changed.map((change, index) => (
            <div key={`${change.before}-${index}`} className={styles.changeClaim}>
              <span>{change.before}</span><ChevronRight size={13} /><strong>{change.after}</strong>
              {change.evidence.map((anchor) => <button key={anchor.revisionId} type="button" className={styles.miniEvidence} onClick={() => onOpenRevision(anchor.revisionId)}><FileText size={11} />{anchor.relativePath}</button>)}
            </div>
          ))}
        </div>
        <div className={styles.claimBlock}>
          <span className={styles.questionLabel}>4 · 为什么</span>
          <div className={styles.whyList}>
            {body.why.map((why, index) => {
              const Icon = claimIcon(why.status);
              return (
                <div key={`${why.status}-${index}`} className={`${styles.whyItem} ${styles[`why${why.status[0].toUpperCase()}${why.status.slice(1)}`]}`}>
                  <Icon size={14} />
                  <div><strong>{statusText(why.status)}</strong><p>{why.text}</p>
                    {why.evidence.map((anchor) => <button key={anchor.revisionId} type="button" className={styles.quoteLink} onClick={() => onOpenRevision(anchor.revisionId)}><FileText size={11} /><span>{anchor.relativePath}</span><em>“{anchor.quote}”</em><ChevronRight size={11} /></button>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.claimBlock}>
          <span className={styles.questionLabel}>5 · 影响什么</span>
          <div className={styles.dependsList}>
            {body.depends.map((item) => <div key={`${item.kind}-${item.id}`}><span className={styles.dependsKind}>{item.kind}</span><strong>{item.reason}</strong><small>{item.id}</small></div>)}
          </div>
        </div>
        <div className={`${styles.claimBlock} ${styles.nextDecision}`}>
          <span className={styles.questionLabel}><History size={12} />6 · 下一步决定</span>
          <p>{body.nextDecision}</p>
          <span className={styles.ownerOnly}>需要 Owner 判断 · Agent 不能自我确认</span>
        </div>
      </div>
    </section>
  );
}
