"use client";

import { CircleHelp, FileText, Sparkles } from "lucide-react";
import type { MemoryResponse } from "../lib/api";
import { extractUnderstandingLead } from "../lib/onboarding-folder-choice";
import styles from "../mvp-workbench.module.css";

type Props = {
  memory: MemoryResponse;
  onOpenRevision: (revisionId: string) => void;
};

/**
 * First meaningful output after connect: source-backed current understanding
 * plus explicit unknown/conflict gaps — not IDs or an empty canvas.
 */
export function InitialUnderstandingLead({ memory, onOpenRevision }: Props) {
  const body = memory.candidate?.body || memory.accepted?.body;
  if (!body) {
    return (
      <section className={styles.understandingLead} data-testid="understanding-lead-empty">
        <span className={styles.kicker}>
          <Sparkles size={13} />
          当前理解
        </span>
        <h2>还没有可审阅的理解</h2>
        <p>连接后应出现有依据的当前状态与明确未知项；若仍为空，请检查授权文件夹内是否有可读材料。</p>
      </section>
    );
  }

  const lead = extractUnderstandingLead(body);
  const kind = memory.candidate ? "candidate · 待 Owner 确认" : "accepted · 已确认";

  return (
    <section className={styles.understandingLead} data-testid="understanding-lead">
      <div className={styles.understandingLeadHeader}>
        <div>
          <span className={styles.kicker}>
            <Sparkles size={13} />
            当前理解
          </span>
          <h2>有依据的现状，先于任何内部编号</h2>
        </div>
        <span className={`${styles.statusTag} ${memory.candidate ? styles.statusCandidate : styles.statusAccepted}`}>
          {kind}
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
          明确未知 / 冲突
        </span>
        {lead.unknowns.length === 0 ? (
          <p className={styles.unknownEmpty}>当前没有列出的 unknown / conflicted 缺口。</p>
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
