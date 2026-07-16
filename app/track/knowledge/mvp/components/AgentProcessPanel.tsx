"use client";

import { CheckCircle2, Circle, LoaderCircle } from "lucide-react";
import {
  AGENT_PROCESS_STEPS,
  type AgentProcessStepId,
  type AgentProcessStepStatus,
} from "../lib/agent-process";
import styles from "../mvp-workbench.module.css";

type Props = {
  statuses: Record<AgentProcessStepId, AgentProcessStepStatus>;
  active: AgentProcessStepId | null;
  caption: string;
  folderName?: string;
  compact?: boolean;
};

export function AgentProcessPanel({
  statuses,
  active,
  caption,
  folderName,
  compact = false,
}: Props) {
  return (
    <section
      className={compact ? styles.agentProcessCompact : styles.agentProcessPanel}
      data-testid="agent-process-panel"
      aria-label="工作进度"
      aria-live="polite"
    >
      <div className={styles.agentProcessHeader}>
        <span className={styles.kicker}>进度</span>
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
    </section>
  );
}
