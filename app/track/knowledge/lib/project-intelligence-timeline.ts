import type {
  CanvasTimelineEvent,
  WorkEventType,
} from "@/shared/types/knowledge";
import type {
  Claim,
  OwnerResolution,
} from "@/shared/project-memory/claims/types";
import type {
  ChangeEventView,
  UnderstandingRevision,
} from "./folder-connection-api";

export type IntelligenceRunSummary = {
  id?: string;
  status?: string;
  eventIds?: string[];
  candidateRevisionId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TimelineInput = {
  projectId: string;
  changes: ChangeEventView[];
  candidate?: UnderstandingRevision | null;
  run?: IntelligenceRunSummary | null;
  claims: Claim[];
  resolutions: OwnerResolution[];
};

const decisionLabels: Record<OwnerResolution["decision"], string> = {
  accept: "已接受",
  accept_edited: "已修改并接受",
  reject: "已拒绝",
  defer: "已暂缓",
};

function changeBody(event: ChangeEventView): string {
  if (event.kind === "added") return `发现新材料：${event.relativePath}`;
  if (event.kind === "modified") return `材料有更新：${event.relativePath}`;
  if (event.kind === "renamed") {
    return `材料已改名：${event.previousPath ?? "原文件"} → ${event.relativePath}`;
  }
  return `材料已移除：${event.relativePath}`;
}

function eventTypeForChange(kind: ChangeEventView["kind"]): WorkEventType {
  return kind === "deleted" ? "status_change" : "evidence_link";
}

export function selectNewIncrementalChanges(
  events: ChangeEventView[],
  seenIds: ReadonlySet<string>,
): ChangeEventView[] {
  return events.filter(
    (event) => event.kind !== "reconciled" && !seenIds.has(event.id),
  );
}

/**
 * Read-only projection of Project Memory truth into the existing canvas timeline.
 * It does not create WorkEvents or advance any project state.
 */
export function buildProjectIntelligenceTimeline(
  input: TimelineInput,
): CanvasTimelineEvent[] {
  const ref = { kind: "project" as const, id: input.projectId };
  const workItemId = `project-intelligence:${input.projectId}`;
  // A timeline entry represents one reviewable chain, not a collection of
  // unrelated live feed rows. Keep the evidence, Agent conclusion and every
  // Owner decision together until every Claim has a decision; then archive the
  // complete chain as history.
  const resolvedClaimIds = new Set(
    input.resolutions.map((resolution) => resolution.claimId),
  );
  const reviewComplete =
    input.claims.length > 0 &&
    input.claims.every((claim) => resolvedClaimIds.has(claim.id));
  const phase = reviewComplete ? "history" : "now";
  const rows: CanvasTimelineEvent[] = input.changes
    .filter((event) => event.kind !== "reconciled")
    .slice()
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .slice(-6)
    .map((event) => ({
      id: `intelligence:change:${event.id}`,
      ref,
      workItemId,
      type: eventTypeForChange(event.kind),
      actor: "项目文件夹",
      body: changeBody(event),
      createdAt: event.observedAt,
      phase,
    }));

  const runCanHaveResult =
    input.run?.status !== "failed" &&
    input.run?.status !== "interrupted" &&
    input.run?.status !== "confirmation_required";
  const candidateMatchesRun =
    !input.run?.candidateRevisionId ||
    input.run.candidateRevisionId === input.candidate?.id;
  if (
    input.candidate?.body?.now?.text?.trim() &&
    runCanHaveResult &&
    candidateMatchesRun
  ) {
    rows.push({
      id: `intelligence:candidate:${input.candidate.id}`,
      ref,
      workItemId,
      type: "result",
      actor: "agent:folder-reader",
      body: input.candidate.body.now.text.trim(),
      createdAt:
        input.run?.updatedAt || input.candidate.createdAt,
      phase,
    });
  }

  const claimText = new Map(input.claims.map((claim) => [claim.id, claim.text]));
  for (const resolution of input.resolutions) {
    rows.push({
      id: `intelligence:resolution:${resolution.id}`,
      ref,
      workItemId,
      type: "decision",
      actor: "自己",
      body: `${decisionLabels[resolution.decision]}：${claimText.get(resolution.claimId) ?? "一条判断"}`,
      createdAt: resolution.resolvedAt,
      phase,
    });
  }

  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
