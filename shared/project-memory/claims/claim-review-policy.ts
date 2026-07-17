/**
 * ClaimReviewPanel policy seams (pure) — no React.
 * Fake local accept without server onResolve is forbidden.
 */

export type ClaimReviewDecision =
  | "accept"
  | "accept_edited"
  | "reject"
  | "defer";

export type ClaimReviewPlan =
  | { ok: true; decision: ClaimReviewDecision }
  | { ok: false; reason: string };

/**
 * Without a real onResolve handler, UI must not mark decisions as done.
 * defer is allowed and durable; accept_edited requires non-empty editedText.
 */
export function planClaimReviewAction(input: {
  hasOnResolve: boolean;
  decision: ClaimReviewDecision;
  alreadyResolved?: boolean;
  editedText?: string;
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
  if (input.decision === "accept_edited") {
    if (!input.editedText?.trim()) {
      return {
        ok: false,
        reason: "修改接受需要填写改写后的判断",
      };
    }
  }
  return { ok: true, decision: input.decision };
}

export function claimReviewActionsEnabled(hasOnResolve: boolean): boolean {
  return hasOnResolve === true;
}

/** Finalizing decisions that allow advancing whole candidate. */
export function isFinalizingClaimDecision(
  decision: string | undefined,
): boolean {
  return (
    decision === "accept" ||
    decision === "accept_edited" ||
    decision === "reject"
  );
}
