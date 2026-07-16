"use client";

import { CircleHelp, FileText, Sparkles } from "lucide-react";
import type { MemoryResponse } from "../lib/api";
import { extractUnderstandingLead } from "../lib/onboarding-folder-choice";
import styles from "../mvp-workbench.module.css";

type Props = {
  memory: MemoryResponse;
  onOpenRevision: (revisionId: string) => void;
};

export function InitialUnderstandingLead({ memory, onOpenRevision }: Props) {
  const body = memory.candidate?.body || memory.accepted?.body;
  if (!body) {
    return (
      <section
        className={styles.understandingLead}
        data-testid="understanding-lead-empty"
      >
        <span className={styles.kicker}>
          <Sparkles size={13} />
          当前理解
        </span>
        <h2>还没有读出内容</h2>
        <p>文件夹里有可读材料后，这里会出现简短、有来源的现状。</p>
      </section>
    );
  }

  const lead = extractUnderstandingLead(body);

  return (
    <section
      className={styles.understandingLead}
      data-testid="understanding-lead"
    >
      <div className={styles.understandingLeadHeader}>
        <div>
          <span className={styles.kicker}>
            <Sparkles size={13} />
            当前理解
          </span>
          <h2>现在这样</h2>
        </div>
        <span
          className={`${styles.statusTag} ${memory.candidate ? styles.statusCandidate : styles.statusAccepted}`}
        >
          {memory.candidate ? "待你确认" : "已确认"}
        </span>
      </div>
      <p className={styles.understandingNow}>{lead.nowText}</p>
      {body.now.evidence.length > 0 && (
        <div className={styles.understandingEvidence}>
          {body.now.evidence.slice(0, 3).map((anchor) => (
            <button
              key={`${anchor.revisionId}-${anchor.relativePath}`}
              type="button"
              className={styles.quoteLink}
              onClick={() => onOpenRevision(anchor.revisionId)}
            >
              <FileText size={12} />
              <span>{anchor.relativePath}</span>
              <em>“{anchor.quote}”</em>
            </button>
          ))}
        </div>
      )}
      <div className={styles.unknownList} data-testid="explicit-unknowns">
        <span className={styles.questionLabel}>
          <CircleHelp size={12} />
          还不确定
        </span>
        {lead.unknowns.length === 0 ? (
          <p className={styles.unknownEmpty}>目前没有标出的缺口。</p>
        ) : (
          <ul>
            {lead.unknowns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
