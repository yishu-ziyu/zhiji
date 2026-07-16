"use client";

import { CheckCircle2, Circle, LoaderCircle, Radio } from "lucide-react";
import {
  AGENT_PROCESS_STEPS,
  type AgentProcessStepId,
  type AgentProcessStepStatus,
} from "../lib/agent-process";
import {
  buildLiveFeedFromReceipts,
  toolTitle,
} from "../lib/agent-canvas-live";
import type { AgentToolReceiptSummary } from "../lib/api";
import styles from "../workbench-entry.module.css";

type Props = {
  statuses: Record<AgentProcessStepId, AgentProcessStepStatus>;
  active: AgentProcessStepId | null;
  caption: string;
  folderName?: string;
  compact?: boolean;
  /** Real tool receipts from analysis-runs (not decorative). */
  toolReceipts?: AgentToolReceiptSummary[];
  runStatus?: string | null;
  progressSummary?: string | null;
};

export function AgentProcessPanel({
  statuses,
  active,
  caption,
  folderName,
  compact = false,
  toolReceipts = [],
  runStatus = null,
  progressSummary = null,
}: Props) {
  const liveRows = buildLiveFeedFromReceipts(toolReceipts, {
    runStatus,
    progressSummary,
  });
  const isLive = runStatus === "running" || runStatus === "queued";

  return (
    <section
      className={compact ? styles.agentProcessCompact : styles.agentProcessPanel}
      data-testid="agent-process-panel"
      aria-label="工作进度"
      aria-live="polite"
    >
      <div className={styles.agentProcessHeader}>
        <span className={styles.kicker}>
          {isLive ? "Live" : "进度"}
        </span>
        <h2>{compact ? "正在处理" : "它在做什么"}</h2>
        {folderName ? (
          <strong className={styles.agentProcessFolder}>{folderName}</strong>
        ) : null}
        <p>{caption}</p>
      </div>
      <ol className={styles.agentProcessList}>
        {AGENT_PROCESS_STEPS.map((step) => {
          const status = statuses[step.id];
          const isActive = active === step.id || status === "active";
          return (
            <li
              key={step.id}
              data-step={step.id}
              data-status={status}
              data-active={isActive ? "true" : "false"}
              className={
                status === "active"
                  ? styles.agentProcessStepActive
                  : status === "done"
                    ? styles.agentProcessStepDone
                    : styles.agentProcessStepPending
              }
            >
              <span className={styles.agentProcessIndex} aria-hidden>
                {status === "active" ? (
                  <LoaderCircle size={15} className={styles.spin} />
                ) : status === "done" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Circle size={15} />
                )}
              </span>
              <div className={styles.agentProcessBody}>
                <div className={styles.agentProcessTitleRow}>
                  <strong>{step.title}</strong>
                  <span className={styles.agentProcessStatusLabel}>
                    {status === "active"
                      ? "进行中"
                      : status === "done"
                        ? "完成"
                        : ""}
                  </span>
                </div>
                {!compact && <p>{step.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {liveRows.length > 0 ? (
        <div
          className={styles.agentLiveFeed}
          data-testid="agent-tool-receipts"
          data-live={isLive ? "true" : "false"}
        >
          <div className={styles.agentLiveFeedHeader}>
            <span className={styles.kicker}>Live Feed</span>
            {isLive ? (
              <span className={styles.agentLiveBadge}>
                <Radio size={12} aria-hidden /> 实时
              </span>
            ) : null}
          </div>
          <ul>
            {liveRows.map((row) => (
              <li
                key={row.id}
                data-live={row.live ? "true" : "false"}
                data-outcome={row.outcome ?? ""}
              >
                <span className={styles.agentToolTag}>
                  {row.tool ? toolTitle(row.tool) : row.title}
                </span>
                <span className={styles.agentLiveBody}>{row.body}</span>
                {row.live ? (
                  <LoaderCircle size={12} className={styles.spin} aria-hidden />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
