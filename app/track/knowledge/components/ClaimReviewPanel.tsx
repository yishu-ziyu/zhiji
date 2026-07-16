"use client";

/**
 * Per-claim accept / reject. Must call onResolve (server) — never fake local accept.
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
  planClaimReviewAction,
} from "@/shared/project-memory/claims/claim-review-policy";
import styles from "./claim-review-panel.module.css";

export type ClaimReviewPanelProps = {
  claims: Claim[];
  anchors?: PreciseEvidenceAnchor[];
  links?: ClaimEvidenceLink[];
  /** Hydrate from GET after refresh */
  initialResolutions?: OwnerResolution[];
  /**
   * Required for real accept/reject. Without it buttons stay disabled
   * and handle() refuses to mark done.
   */
  onResolve?: (
    claim: Claim,
    decision: Extract<OwnerResolutionDecision, "accept" | "reject">,
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

function applyResolutionsToClaims(
  claims: Claim[],
  resolutions: OwnerResolution[],
): Claim[] {
  return claims.map((claim) => {
    const res = resolutions.find(
      (r) => r.claimId === claim.id && r.decision !== "defer",
    );
    if (!res) return claim;
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

  useEffect(() => {
    setResolutions(initialResolutions);
    setClaims(applyResolutionsToClaims(initialClaims, initialResolutions));
  }, [initialClaims, initialResolutions]);

  const pending = useMemo(
    () =>
      claims.filter(
        (c) =>
          !resolutions.some(
            (r) => r.claimId === c.id && r.decision !== "defer",
          ),
      ),
    [claims, resolutions],
  );

  async function handle(
    claim: Claim,
    decision: Extract<OwnerResolutionDecision, "accept" | "reject">,
  ) {
    setError(null);
    const plan = planClaimReviewAction({
      hasOnResolve: canPersist,
      decision,
      alreadyResolved: resolutions.some(
        (r) => r.claimId === claim.id && r.decision !== "defer",
      ),
    });
    if (!plan.ok) {
      setError(plan.reason);
      return;
    }

    setBusyId(claim.id);
    try {
      // Server first — never mark local accept before persistence succeeds.
      const persisted = await onResolve!(claim, decision);
      const result = applyOwnerResolution(claim, decision, {
        projectId: claim.projectId,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "确认失败");
      // Do not write local accept on failure
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
          {pending.length}/{claims.length} 待处理
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
          const done = resolutions.find(
            (r) => r.claimId === claim.id && r.decision !== "defer",
          );
          const busy = busyId === claim.id;
          const disabled = !canPersist || busy || Boolean(done);
          const evidence = links
            .filter(
              (link) =>
                link.claimId === claim.id && link.relation === "supports",
            )
            .map((link) => anchors.find((anchor) => anchor.id === link.anchorId))
            .filter((anchor): anchor is PreciseEvidenceAnchor => Boolean(anchor));
          return (
            <li key={claim.id} className={styles.item}>
              <div className={styles.itemMain}>
                <p className={styles.claimText}>{claim.text}</p>
                <span className={styles.badge} data-status={claim.status}>
                  {statusLabel(claim.status)}
                </span>
                {done && (
                  <span className={styles.resolved}>
                    已{done.decision === "reject" ? "拒绝" : "接受"}
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
                <button
                  type="button"
                  className={styles.accept}
                  disabled={disabled}
                  title={
                    canPersist
                      ? undefined
                      : "需要服务端确认，无法本地假装接受"
                  }
                  onClick={() => void handle(claim, "accept")}
                >
                  接受
                </button>
                <button
                  type="button"
                  className={styles.reject}
                  disabled={disabled}
                  title={
                    canPersist
                      ? undefined
                      : "需要服务端确认，无法本地假装接受"
                  }
                  onClick={() => void handle(claim, "reject")}
                >
                  拒绝
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
