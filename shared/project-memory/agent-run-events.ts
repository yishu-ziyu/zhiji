import type { AgentRunView } from "./types";

/** Changes for status, progress text, candidates, and every real tool receipt. */
export function runViewEventFingerprint(view: AgentRunView): string {
  return JSON.stringify({
    status: view.run.status,
    updatedAt: view.run.updatedAt,
    progressSummary: view.run.progressSummary ?? "",
    candidateRevisionId: view.run.candidateRevisionId ?? "",
    receipts: view.toolReceipts.map((receipt) => ({
      sequence: receipt.sequence,
      tool: receipt.tool,
      outcome: receipt.outcome,
      summary: receipt.summary,
      finishedAt: receipt.finishedAt,
    })),
  });
}
