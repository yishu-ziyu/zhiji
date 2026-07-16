"use client";

import { useMemo } from "react";
import { AgentProcessPanel } from "./AgentProcessPanel";
import { UnderstandingReviewCard } from "./UnderstandingReviewCard";
import {
  resolveProcessStatuses,
  type AgentPipelinePhase,
} from "../lib/agent-process";
import type {
  AgentToolReceiptSummary,
  MemoryResponse,
  UnderstandingBody,
  UnderstandingRevision,
} from "../lib/folder-connection-api";
import styles from "../workbench-entry.module.css";

export type AgentSession = {
  projectId: string;
  matterId: string;
  grantId?: string;
  folderName?: string;
  memory: MemoryResponse | null;
  toolReceipts: AgentToolReceiptSummary[];
  run?: {
    id?: string;
    status?: string;
    progressSummary?: string;
  } | null;
  pipelinePhase?: AgentPipelinePhase | null;
};

type Props = {
  session: AgentSession | null;
  resolutionMessage?: string | null;
  onResolve?: (
    decision: "accept" | "edit_accept" | "reject",
    editedBody?: UnderstandingBody,
  ) => Promise<void>;
  onRerun?: () => Promise<void>;
  busy?: boolean;
};

/**
 * Workbench Agent presence: 8-step process + real tool feed + Owner confirm.
 * Shown whenever a folder-backed session exists for the active project.
 */
export function AgentPresenceRail({
  session,
  resolutionMessage = null,
  onResolve,
  onRerun,
  busy = false,
}: Props) {
  const processView = useMemo(() => {
    if (!session) {
      return resolveProcessStatuses({
        pipelinePhase: null,
        memory: null,
        connected: false,
      });
    }
    return resolveProcessStatuses({
      pipelinePhase: session.pipelinePhase ?? null,
      memory: session.memory,
      connected: true,
      run: session.run,
      toolNames: session.toolReceipts.map((r) => r.tool),
    });
  }, [session]);

  if (!session) return null;

  const candidate = session.memory?.candidate as UnderstandingRevision | undefined;
  const accepted = session.memory?.accepted as UnderstandingRevision | undefined;

  return (
    <aside
      className={styles.agentPresenceRail}
      data-testid="inspector-agent-process"
      aria-label="Agent 工作状态"
    >
      <div data-testid="inspector-agent-feed">
        <AgentProcessPanel
          statuses={processView.statuses}
          active={processView.active}
          caption={processView.caption}
          folderName={session.folderName}
          toolReceipts={session.toolReceipts}
        />
      </div>

      {onResolve ? (
        <UnderstandingReviewCard
          candidate={candidate}
          accepted={accepted}
          resolutionMessage={resolutionMessage ?? null}
          onResolve={onResolve}
        />
      ) : null}

      {onRerun ? (
        <div className={styles.agentPresenceActions}>
          <button
            type="button"
            className={styles.entryPrimaryButton}
            disabled={busy}
            data-testid="agent-rerun"
            onClick={() => void onRerun()}
          >
            再读一遍变化
          </button>
        </div>
      ) : null}
    </aside>
  );
}
