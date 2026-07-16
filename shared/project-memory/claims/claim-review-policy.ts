/**
 * ClaimReviewPanel policy seams (pure) — no React.
 * Fake local accept without server onResolve is forbidden.
 */

export type ClaimReviewDecision = "accept" | "reject";

export type ClaimReviewPlan =
  | { ok: true; decision: ClaimReviewDecision }
  | { ok: false; reason: string };

/**
 * Without a real onResolve handler, UI must not mark accept/reject as done.
 */
export function planClaimReviewAction(input: {
  hasOnResolve: boolean;
  decision: ClaimReviewDecision;
  alreadyResolved?: boolean;
}): ClaimReviewPlan {
  if (input.alreadyResolved) {
    return { ok: false, reason: "该判断已有决议，勿重复提交" };
  }
  if (!input.hasOnResolve) {
    return {
      ok: false,
      reason: "需要服务端确认，无法本地假装接受",
    };
  }
  return { ok: true, decision: input.decision };
}

export function claimReviewActionsEnabled(hasOnResolve: boolean): boolean {
  return hasOnResolve === true;
}
