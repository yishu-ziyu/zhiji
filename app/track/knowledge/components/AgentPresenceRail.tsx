"use client";

import { useMemo } from "react";
import { AgentProcessPanel } from "./AgentProcessPanel";
import { AgentChatPanel } from "./AgentChatPanel";
import { UnderstandingReviewCard } from "./UnderstandingReviewCard";
import { ProjectIntelligenceBriefCard } from "./ProjectIntelligenceBriefCard";
import {
  resolveProcessStatuses,
  type AgentPipelinePhase,
} from "../lib/agent-process";
import { selectBriefSelection } from "@/shared/project-memory/brief/assemble-brief";
import type {
  Claim,
  ClaimEvidenceLink,
  OwnerResolution,
  OwnerResolutionDecision,
  PreciseEvidenceAnchor,
} from "@/shared/project-memory/claims/types";
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
    candidateRevisionId?: string;
    eventIds?: string[];
    createdAt?: string;
    updatedAt?: string;
  } | null;
  pipelinePhase?: AgentPipelinePhase | null;
};

type Props = {
  projectId: string;
  session: AgentSession | null;
  resolutionMessage?: string | null;
  onResolve?: (
    decision: "accept" | "edit_accept" | "reject",
    editedBody?: UnderstandingBody,
  ) => Promise<void>;
  onRerun?: () => Promise<void>;
  onChatSend?: (text: string) => Promise<void>;
  onAuthorizeFolder?: () => void;
  busy?: boolean;
  chatFocusKey?: number;
  claims?: Claim[];
  claimAnchors?: PreciseEvidenceAnchor[];
  claimLinks?: ClaimEvidenceLink[];
  claimResolutions?: OwnerResolution[];
  onResolveClaim?: (
    claim: Claim,
    decision: Extract<
      OwnerResolutionDecision,
      "accept" | "accept_edited" | "reject" | "defer"
    >,
    editedText?: string,
  ) => void | Promise<void | OwnerResolution>;
};

/**
 * Right-rail: Brief (hard-gated) → process receipts → claim HITL → chat last.
 */
export function AgentPresenceRail({
  projectId,
  session,
  resolutionMessage = null,
  onResolve,
  onRerun,
  onChatSend,
  onAuthorizeFolder,
  busy = false,
  chatFocusKey = 0,
  claims = [],
  claimAnchors = [],
  claimLinks = [],
  claimResolutions = [],
  onResolveClaim,
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

  const candidate = session?.memory?.candidate as
    | UnderstandingRevision
    | undefined;
  const accepted = session?.memory?.accepted as
    | UnderstandingRevision
    | undefined;

  const briefSelection = useMemo(() => {
    if (!session?.matterId) return { status: "none" as const };
    return selectBriefSelection({
      matterId: session.matterId,
      candidate: candidate
        ? { id: candidate.id, body: candidate.body }
        : null,
      accepted: accepted
        ? { id: accepted.id, body: accepted.body }
        : null,
      runId: session.run?.id,
      runStatus: session.run?.status,
      runCandidateRevisionId:
        session.run?.candidateRevisionId ?? candidate?.id ?? null,
      toolNames: session.toolReceipts.map((r) => r.tool),
      claims,
    });
  }, [session, candidate, accepted, claims]);

  const showWholeBodyReview =
    hasSession &&
    onResolve &&
    briefSelection.status !== "run_failed" &&
    !(
      briefSelection.status === "candidate" &&
      claims.length > 0
    );

  const showBriefCard =
    hasSession &&
    (briefSelection.status === "candidate" ||
      briefSelection.status === "accepted_restore" ||
      briefSelection.status === "insufficient" ||
      briefSelection.status === "run_failed");

  return (
    <aside
      className={styles.agentPresenceRail}
      data-testid="inspector-agent-process"
      data-has-session={hasSession ? "true" : "false"}
      data-brief-status={briefSelection.status}
      aria-label="Agent 对话与工作状态"
    >
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
          onAuthorize={onAuthorizeFolder}
          focusKey={chatFocusKey}
        />
      ) : null}

      {showBriefCard ? (
        <ProjectIntelligenceBriefCard
          mode={
            briefSelection.status === "run_failed"
              ? "run_failed"
              : briefSelection.status === "insufficient"
                ? "insufficient"
                : "brief"
          }
          brief={
            briefSelection.status === "candidate" ||
            briefSelection.status === "accepted_restore"
              ? briefSelection.brief
              : null
          }
          insufficientMessage={
            briefSelection.status === "insufficient"
              ? briefSelection.message
              : null
          }
          missingTools={
            briefSelection.status === "insufficient"
              ? briefSelection.missing
              : []
          }
          failureMessage={
            briefSelection.status === "run_failed"
              ? briefSelection.message
              : session?.run?.progressSummary
          }
          claims={claims}
          anchors={claimAnchors}
          links={claimLinks}
          resolutions={claimResolutions}
          onResolveClaim={onResolveClaim}
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

      {showWholeBodyReview ? (
        <UnderstandingReviewCard
          candidate={candidate}
          accepted={accepted}
          resolutionMessage={resolutionMessage ?? null}
          onResolve={onResolve!}
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
