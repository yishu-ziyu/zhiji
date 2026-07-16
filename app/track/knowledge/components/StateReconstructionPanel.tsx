"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileText,
  GitCompareArrows,
  History,
} from "lucide-react";
import type { MemoryResponse, StateClaim, WhyClaim } from "../lib/api";
import {
  countPdfPaths,
  humanizeUnderstandingText,
  isEmptyEventUnderstanding,
} from "../lib/onboarding-folder-choice";
import styles from "../workbench-entry.module.css";

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
  if (status === "supported") return "有原文依据";
  if (status === "conflicted") return "依据有冲突";
  return "还说不准";
}

function Claim({
  title,
  claim,
  onOpenRevision,
}: {
  title: string;
  claim: StateClaim;
  onOpenRevision: (revisionId: string) => void;
}) {
  return (
    <div className={styles.claimBlock}>
      <span className={styles.questionLabel}>{title}</span>
      <p>{humanizeUnderstandingText(claim.text)}</p>
      {(claim.gaps.length > 0 || claim.conflicts.length > 0) && (
        <div className={styles.claimNote}>
          {[...claim.gaps, ...claim.conflicts]
            .map((item) => humanizeUnderstandingText(item))
            .join(" · ")}
        </div>
      )}
      {claim.evidence.map((anchor) => (
        <button
          key={`${anchor.revisionId}-${anchor.relativePath}`}
          className={styles.quoteLink}
          type="button"
          onClick={() => onOpenRevision(anchor.revisionId)}
        >
          <FileText size={12} />
          <span>{anchor.relativePath}</span>
          {anchor.quote?.trim() ? <em>“{anchor.quote}”</em> : null}
          <ChevronRight size={12} />
        </button>
      ))}
    </div>
  );
}

export function StateReconstructionPanel({ memory, onOpenRevision }: Props) {
  const body = memory.candidate?.body || memory.accepted?.body;
  const pdfCount = countPdfPaths(memory.events.map((e) => e.relativePath));
  const zh = (t: string) => humanizeUnderstandingText(t, { pdfCount });

  if (!body) {
    return (
      <section className={styles.emptyPanel}>
        还没有可展示的理解。读完材料后会在这里展开。
      </section>
    );
  }

  if (isEmptyEventUnderstanding(body)) {
    return (
      <section className={styles.statePanel} aria-labelledby="six-questions-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>项目现在怎样</span>
            <h2 id="six-questions-heading">
              {pdfCount > 0 ? "PDF 已发现，正文尚未读出" : "还没有可展示的材料变化"}
            </h2>
          </div>
          <span className={styles.statusTag}>暂无内容</span>
        </div>
        <div className={styles.claimBlock}>
          <p>{zh(body.now.text)}</p>
          <div className={styles.claimNote}>
            {pdfCount > 0
              ? "不必对空结果做确认；有可复制文字的文件会更容易形成理解。"
              : "放入或修改文件后再读。不必对空结果做确认。"}
          </div>
        </div>
      </section>
    );
  }

  const nowClaim = {
    ...body.now,
    text: zh(body.now.text),
    gaps: body.now.gaps.map(zh),
  };
  const thenClaim = {
    ...body.then,
    text: zh(body.then.text),
    gaps: body.then.gaps.map(zh),
  };

  return (
    <section className={styles.statePanel} aria-labelledby="six-questions-heading">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>项目现在怎样</span>
          <h2 id="six-questions-heading">一眼看清，点进依据</h2>
        </div>
        <span
          className={`${styles.statusTag} ${memory.candidate ? styles.statusCandidate : styles.statusAccepted}`}
        >
          {memory.candidate ? "待确认" : "已确认"}
        </span>
      </div>
      <div className={styles.sixGrid}>
        <Claim title="现在怎样" claim={nowClaim} onOpenRevision={onOpenRevision} />
        <Claim title="之前怎样" claim={thenClaim} onOpenRevision={onOpenRevision} />
        <div className={styles.claimBlock}>
          <span className={styles.questionLabel}>
            <GitCompareArrows size={12} />
            变了什么
          </span>
          {body.changed.map((change, index) => (
            <div
              key={`${change.before}-${index}`}
              className={styles.changeClaim}
            >
              <span>{zh(change.before || "—")}</span>
              <ChevronRight size={13} />
              <strong>{zh(change.after)}</strong>
              {change.evidence.map((anchor) => (
                <button
                  key={anchor.revisionId}
                  type="button"
                  className={styles.miniEvidence}
                  onClick={() => onOpenRevision(anchor.revisionId)}
                >
                  <FileText size={11} />
                  {anchor.relativePath}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.claimBlock}>
          <span className={styles.questionLabel}>为什么</span>
          <div className={styles.whyList}>
            {body.why.map((why, index) => {
              const Icon = claimIcon(why.status);
              return (
                <div
                  key={`${why.status}-${index}`}
                  className={`${styles.whyItem} ${styles[`why${why.status[0].toUpperCase()}${why.status.slice(1)}`]}`}
                >
                  <Icon size={14} />
                  <div>
                    <strong>{statusText(why.status)}</strong>
                    <p>{zh(why.text)}</p>
                    {why.evidence.map((anchor) => (
                      <button
                        key={anchor.revisionId}
                        type="button"
                        className={styles.quoteLink}
                        onClick={() => onOpenRevision(anchor.revisionId)}
                      >
                        <FileText size={11} />
                        <span>{anchor.relativePath}</span>
                        {anchor.quote?.trim() ? <em>“{anchor.quote}”</em> : null}
                        <ChevronRight size={11} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.claimBlock}>
          <span className={styles.questionLabel}>影响什么</span>
          <div className={styles.dependsList}>
            {body.depends.length === 0 ? (
              <p className={styles.mutedCopy}>暂未标出连带影响。</p>
            ) : (
              body.depends.map((item, index) => (
                <div key={`${item.kind}-${item.id}-${index}`}>
                  <strong>{item.reason}</strong>
                </div>
              ))
            )}
          </div>
        </div>
        <div className={`${styles.claimBlock} ${styles.nextDecision}`}>
          <span className={styles.questionLabel}>
            <History size={12} />
            建议你下一步
          </span>
          <p>{humanizeUnderstandingText(body.nextDecision)}</p>
        </div>
      </div>
    </section>
  );
}
