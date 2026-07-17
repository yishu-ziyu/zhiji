"use client";

/**
 * Per-claim accept / accept_edited / reject / defer.
 * Must call onResolve (server) — never fake local accept.
 */
import { useEffect, useMemo, useState } from "react";
import type {
  Claim,
  ClaimEvidenceLink,
  ClaimSupportStatus,
  OwnerResolution,
  OwnerResolutionDecision,
  PreciseEvidenceAnchor,
} from "@/shared/project-memory/claims/types";
import { applyOwnerResolution } from "@/shared/project-memory/claims/claim-service";
import {
  claimReviewActionsEnabled,
  isFinalizingClaimDecision,
  planClaimReviewAction,
} from "@/shared/project-memory/claims/claim-review-policy";
import styles from "./claim-review-panel.module.css";

export type ClaimReviewDecision = Extract<
  OwnerResolutionDecision,
  "accept" | "accept_edited" | "reject" | "defer"
>;

export type ClaimReviewPanelProps = {
  claims: Claim[];
  anchors?: PreciseEvidenceAnchor[];
  links?: ClaimEvidenceLink[];
  initialResolutions?: OwnerResolution[];
  onResolve?: (
    claim: Claim,
    decision: ClaimReviewDecision,
    editedText?: string,
  ) => void | Promise<void | OwnerResolution>;
  title?: string;
  emptyLabel?: string;
};

function statusLabel(status: ClaimSupportStatus): string {
  switch (status) {
    case "supported":
      return "有依据";
    case "partially_supported":
      return "部分依据";
    case "unsupported":
      return "依据不足";
    case "conflicted":
      return "冲突";
    case "owner_stated":
      return "你已确认";
    case "unknown":
      return "未知";
    default:
      return status;
  }
}

function decisionLabel(decision: OwnerResolutionDecision): string {
  switch (decision) {
    case "accept":
      return "已接受";
    case "accept_edited":
      return "已修改并接受";
    case "reject":
      return "已拒绝";
    case "defer":
      return "已暂缓";
    default:
      return decision;
  }
}

function applyResolutionsToClaims(
  claims: Claim[],
  resolutions: OwnerResolution[],
): Claim[] {
  return claims.map((claim) => {
    const res = resolutions.find((r) => r.claimId === claim.id);
    if (!res || res.decision === "defer") return claim;
    const applied = applyOwnerResolution(claim, res.decision, {
      projectId: claim.projectId,
      editedText: res.editedText,
      note: res.note,
      id: res.id,
      resolvedAt: res.resolvedAt,
    });
    return applied.ok ? applied.claim : claim;
  });
}

export function ClaimReviewPanel({
  claims: initialClaims,
  anchors = [],
  links = [],
  initialResolutions = [],
  onResolve,
  title = "逐条确认",
  emptyLabel = "暂无待确认的判断",
}: ClaimReviewPanelProps) {
  const canPersist = claimReviewActionsEnabled(typeof onResolve === "function");
  const [claims, setClaims] = useState<Claim[]>(() =>
    applyResolutionsToClaims(initialClaims, initialResolutions),
  );
  const [resolutions, setResolutions] =
    useState<OwnerResolution[]>(initialResolutions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    setResolutions(initialResolutions);
    setClaims(applyResolutionsToClaims(initialClaims, initialResolutions));
  }, [initialClaims, initialResolutions]);

  const pending = useMemo(
    () =>
      claims.filter((c) => {
        const d = resolutions.find((r) => r.claimId === c.id)?.decision;
        return !isFinalizingClaimDecision(d);
      }),
    [claims, resolutions],
  );

  async function handle(
    claim: Claim,
    decision: ClaimReviewDecision,
    editedText?: string,
  ) {
    setError(null);
    const existing = resolutions.find((r) => r.claimId === claim.id);
    const plan = planClaimReviewAction({
      hasOnResolve: canPersist,
      decision,
      alreadyResolved: isFinalizingClaimDecision(existing?.decision),
      editedText,
    });
    if (!plan.ok) {
      setError(plan.reason);
      return;
    }

    setBusyId(claim.id);
    try {
      const persisted = await onResolve!(claim, decision, editedText);
      const result = applyOwnerResolution(claim, decision, {
        projectId: claim.projectId,
        editedText,
        id: persisted && "id" in persisted ? persisted.id : undefined,
        resolvedAt:
          persisted && "resolvedAt" in persisted
            ? persisted.resolvedAt
            : undefined,
      });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      const resolution: OwnerResolution =
        persisted && "id" in persisted && "decision" in persisted
          ? (persisted as OwnerResolution)
          : result.resolution;
      setClaims((prev) =>
        prev.map((c) => (c.id === claim.id ? result.claim : c)),
      );
      setResolutions((prev) => [
        ...prev.filter((r) => r.claimId !== claim.id),
        resolution,
      ]);
      setEditingId(null);
      setEditText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "确认失败");
    } finally {
      setBusyId(null);
    }
  }

  if (claims.length === 0) {
    return (
      <section className={styles.panel} aria-label={title}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </header>
        <p className={styles.empty}>{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.meta}>
          {pending.length}/{claims.length} 待终裁
        </span>
      </header>
      {!canPersist && (
        <p className={styles.error} role="status">
          未接服务端确认，无法接受或拒绝（禁止本地假装已接受）
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.list}>
        {claims.map((claim) => {
          const done = resolutions.find((r) => r.claimId === claim.id);
          const finalized = isFinalizingClaimDecision(done?.decision);
          const deferred = done?.decision === "defer";
          const busy = busyId === claim.id;
          const disabled = !canPersist || busy || finalized;
          const evidence = links
            .filter(
              (link) =>
                link.claimId === claim.id && link.relation === "supports",
            )
            .map((link) =>
              anchors.find((anchor) => anchor.id === link.anchorId),
            )
            .filter((anchor): anchor is PreciseEvidenceAnchor =>
              Boolean(anchor),
            );
          const isEditing = editingId === claim.id;
          return (
            <li key={claim.id} className={styles.item}>
              <div className={styles.itemMain}>
                {isEditing ? (
                  <textarea
                    className={styles.editArea}
                    data-testid={`claim-edit-${claim.id}`}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    disabled={busy}
                  />
                ) : (
                  <p className={styles.claimText}>{claim.text}</p>
                )}
                <span className={styles.badge} data-status={claim.status}>
                  {statusLabel(claim.status)}
                </span>
                {done && (
                  <span
                    className={styles.resolved}
                    data-decision={done.decision}
                    data-testid={`claim-resolved-${claim.id}`}
                  >
                    {decisionLabel(done.decision)}
                  </span>
                )}
                {evidence.length > 0 ? (
                  <div className={styles.evidenceList}>
                    {evidence.map((anchor) => (
                      <div key={anchor.id} className={styles.evidenceItem}>
                        <span>{anchor.relativePath}</span>
                        <blockquote>{anchor.quote}</blockquote>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noEvidence}>没有可核对原文</span>
                )}
              </div>
              <div className={styles.actions}>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className={styles.accept}
                      disabled={disabled || !editText.trim()}
                      data-testid={`claim-save-edit-${claim.id}`}
                      onClick={() =>
                        void handle(claim, "accept_edited", editText)
                      }
                    >
                      保存修改并接受
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.accept}
                      disabled={disabled}
                      onClick={() => void handle(claim, "accept")}
                    >
                      接受
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setEditingId(claim.id);
                        setEditText(claim.text);
                      }}
                    >
                      修改
                    </button>
                    <button
                      type="button"
                      className={styles.reject}
                      disabled={disabled}
                      onClick={() => void handle(claim, "reject")}
                    >
                      拒绝
                    </button>
                    <button
                      type="button"
                      disabled={disabled && !deferred}
                      data-testid={`claim-defer-${claim.id}`}
                      onClick={() => void handle(claim, "defer")}
                    >
                      暂缓
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
