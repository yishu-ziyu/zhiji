"use client";

import { useMemo } from "react";
import { AgentProcessPanel } from "./AgentProcessPanel";
import { AgentChatPanel } from "./AgentChatPanel";
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
import styles from "../project-canvas.module.css";

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
  /** Always required so chat can mount without a folder session. */
  projectId: string;
  session: AgentSession | null;
  resolutionMessage?: string | null;
  onResolve?: (
    decision: "accept" | "edit_accept" | "reject",
    editedBody?: UnderstandingBody,
  ) => Promise<void>;
  onRerun?: () => Promise<void>;
  /** Owner free-text → dialogue memory + model loop. */
  onChatSend?: (text: string) => Promise<void>;
  busy?: boolean;
  /** Bump when topbar AI Copilot should open/focus the chat. */
  chatFocusKey?: number;
};

/**
 * Workbench Agent presence: always-visible chat + (when granted) process + confirm.
 * Chat is not gated on agentSession - product gap §2b.
 */
export function AgentPresenceRail({
  projectId,
  session,
  resolutionMessage = null,
  onResolve,
  onRerun,
  onChatSend,
  busy = false,
  chatFocusKey = 0,
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

  const hasSession = Boolean(session?.matterId);
  const chatRefreshKey = session
    ? [
        session.run?.id ?? "",
        session.run?.status ?? "",
        session.memory?.candidate?.id ?? "",
        session.toolReceipts.length,
      ].join(":")
    : "no-session";

  const candidate = session?.memory?.candidate as UnderstandingRevision | undefined;
  const accepted = session?.memory?.accepted as UnderstandingRevision | undefined;

  return (
    <aside
      className={styles.agentPresenceRail}
      data-testid="inspector-agent-process"
      data-has-session={hasSession ? "true" : "false"}
      aria-label="Agent 对话与工作状态"
    >
      {/* Chat first: Owner must always see where to speak (§2b). */}
      {onChatSend ? (
        <AgentChatPanel
          projectId={projectId}
          matterId={session?.matterId}
          busy={busy}
          onSend={onChatSend}
          refreshKey={chatRefreshKey}
          canSend={hasSession}
          blockedHint={
            hasSession
              ? null
              : "当前项目还没有授权文件夹。授权后即可发送，Agent 会在夹里查依据。"
          }
          focusKey={chatFocusKey}
        />
      ) : null}

      {hasSession && session ? (
        <div data-testid="inspector-agent-feed">
          <AgentProcessPanel
            statuses={processView.statuses}
            active={processView.active}
            caption={processView.caption}
            folderName={session.folderName}
            toolReceipts={session.toolReceipts}
            runStatus={session.run?.status}
            progressSummary={session.run?.progressSummary}
          />
        </div>
      ) : null}

      {hasSession && onResolve ? (
        <UnderstandingReviewCard
          candidate={candidate}
          accepted={accepted}
          resolutionMessage={resolutionMessage ?? null}
          onResolve={onResolve}
        />
      ) : null}

      {hasSession && onRerun ? (
        <div className={styles.agentPresenceActions}>
          <button
            type="button"
            className={styles.agentPresenceRerun}
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
