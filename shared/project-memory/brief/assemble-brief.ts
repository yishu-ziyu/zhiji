/**
 * Project intelligence Brief — read model only.
 * Assembled from Matter Candidate/Accepted + Claims; never a second truth store.
 *
 * Candidate brief hard gate (all required):
 * - current run is success-like (awaiting_owner / completed / …)
 * - candidate belongs to current run (ids match when known)
 * - real project_map + search_text + (read_revision|read_path) receipts
 */
import type { UnderstandingBody } from "../types";
import type { Claim, OwnerResolution } from "../claims/types";

export type ProjectIntelligenceBrief = {
  matterId: string;
  currentJudgment: string;
  whyNow: string;
  claimIds: string[];
  contraryOrLimits: string[];
  unknowns: string[];
  /** One decision question for Owner. */
  decisionPrompt: string;
  /** Agent next step as suggestion only — never a formal work item. */
  suggestion?: { text: string; status: "suggestion" };
  sourceRevisionIds: string[];
  generatedFromRunId: string;
  kind: "candidate" | "accepted";
  /** Always true for candidate brief that passed hard gate. */
  groundedInTools: boolean;
  /** Accepted restore label for re-entry (not this-run success). */
  restoreLabel?: "上次已确认判断";
};

export type BriefMissingPart = "map" | "search" | "read";

export type BriefSelection =
  | {
      status: "candidate";
      brief: ProjectIntelligenceBrief;
    }
  | {
      status: "accepted_restore";
      brief: ProjectIntelligenceBrief;
    }
  | {
      status: "insufficient";
      message: string;
      missing: BriefMissingPart[];
      /** Never include candidate judgment body here. */
      matterId: string;
      runId: string;
    }
  | {
      status: "run_failed";
      message: string;
      matterId: string;
      runId: string;
    }
  | { status: "none" };

export type AssembleBriefInput = {
  matterId: string;
  body: UnderstandingBody | null | undefined;
  kind: "candidate" | "accepted";
  claims?: Claim[];
  resolutions?: OwnerResolution[];
  runId?: string | null;
  toolNames?: string[];
  runFailed?: boolean;
  /** Candidate must pass grounded gate; accepted restore may skip. */
  requireGrounded?: boolean;
};

const EMPTY = "尚不能判断";

/** Success-like statuses where a candidate may become a reviewable brief. */
const RUN_SUCCESS_STATUSES = new Set([
  "awaiting_owner",
  "confirmation_required",
  "completed",
  "succeeded",
  "done",
]);

export function isRunSuccessStatus(status: string | null | undefined): boolean {
  if (!status?.trim()) return false;
  return RUN_SUCCESS_STATUSES.has(status.trim());
}

export function isRunFailedStatus(status: string | null | undefined): boolean {
  return status === "failed" || status === "interrupted";
}

export type ToolReceiptPresence = {
  hasMap: boolean;
  hasSearch: boolean;
  hasRead: boolean;
  complete: boolean;
  missing: BriefMissingPart[];
};

/**
 * Hard gate tools: project_map + search_text + (read_revision | read_path).
 * search_symbols alone does not satisfy search.
 */
export function inspectMapSearchReadReceipts(
  toolNames: string[] | undefined,
): ToolReceiptPresence {
  const tools = toolNames ?? [];
  const hasMap = tools.includes("project_map");
  const hasSearch = tools.includes("search_text");
  const hasRead =
    tools.includes("read_revision") || tools.includes("read_path");
  const missing: BriefMissingPart[] = [];
  if (!hasMap) missing.push("map");
  if (!hasSearch) missing.push("search");
  if (!hasRead) missing.push("read");
  return {
    hasMap,
    hasSearch,
    hasRead,
    complete: missing.length === 0,
    missing,
  };
}

export function hasMapSearchReadReceipts(
  toolNames: string[] | undefined,
): boolean {
  return inspectMapSearchReadReceipts(toolNames).complete;
}

export function formatMissingToolsMessage(missing: BriefMissingPart[]): string {
  const labels: Record<BriefMissingPart, string> = {
    map: "地图（project_map）",
    search: "搜索（search_text）",
    read: "读取（read_revision / read_path）",
  };
  if (missing.length === 0) {
    return "依据不足，尚不能形成项目情报简报";
  }
  return `依据不足，尚不能形成项目情报简报。缺少：${missing
    .map((m) => labels[m])
    .join("、")}`;
}

/**
 * Candidate hard gate — all must pass.
 */
export function canShowCandidateBrief(input: {
  runStatus?: string | null;
  runFailed?: boolean;
  toolNames?: string[];
  candidateId?: string | null;
  runCandidateRevisionId?: string | null;
  body?: UnderstandingBody | null;
}): { ok: true } | { ok: false; missing: BriefMissingPart[]; reason: string } {
  if (input.runFailed || isRunFailedStatus(input.runStatus)) {
    return {
      ok: false,
      missing: ["map", "search", "read"],
      reason: "本轮 Run 失败",
    };
  }
  if (!isRunSuccessStatus(input.runStatus)) {
    return {
      ok: false,
      missing: inspectMapSearchReadReceipts(input.toolNames).missing,
      reason: "当前 Run 尚未成功结束",
    };
  }
  if (!input.body) {
    return {
      ok: false,
      missing: inspectMapSearchReadReceipts(input.toolNames).missing,
      reason: "无 Candidate 正文",
    };
  }
  // Candidate must belong to current run when run publishes a candidate id.
  const runCand = (input.runCandidateRevisionId || "").trim();
  const candId = (input.candidateId || "").trim();
  if (runCand && candId && runCand !== candId) {
    return {
      ok: false,
      missing: inspectMapSearchReadReceipts(input.toolNames).missing,
      reason: "Candidate 不属于当前 Run",
    };
  }
  const tools = inspectMapSearchReadReceipts(input.toolNames);
  if (!tools.complete) {
    return {
      ok: false,
      missing: tools.missing,
      reason: formatMissingToolsMessage(tools.missing),
    };
  }
  return { ok: true };
}

/** @deprecated use canShowCandidateBrief — kept for call sites that only fail-on-runFailed */
export function canAssembleBrief(input: AssembleBriefInput): boolean {
  if (input.runFailed) return false;
  if (!input.body) return false;
  if (!input.matterId?.trim()) return false;
  if (input.kind === "candidate" && input.requireGrounded !== false) {
    return hasMapSearchReadReceipts(input.toolNames);
  }
  return true;
}

function cleanText(value: string | undefined | null): string {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : EMPTY;
}

function pickWhyNow(body: UnderstandingBody): string {
  if (body.changed?.length) {
    const first = body.changed[0];
    const line = [first.before, first.after]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(" → ");
    if (line) return line;
  }
  const thenText = body.then?.text?.trim();
  const nowText = body.now?.text?.trim();
  if (thenText && nowText && thenText !== nowText) {
    return `相对此前「${thenText.slice(0, 80)}」，当前判断已变化`;
  }
  if (body.why?.[0]?.text?.trim()) {
    return body.why[0].text.trim();
  }
  return EMPTY;
}

function collectContrary(body: UnderstandingBody, claims: Claim[]): string[] {
  const out: string[] = [];
  for (const c of body.now?.conflicts ?? []) {
    if (c?.trim()) out.push(c.trim());
  }
  for (const w of body.why ?? []) {
    if (w.status === "conflicted" && w.text?.trim()) {
      out.push(w.text.trim());
    }
  }
  for (const claim of claims) {
    if (claim.status === "conflicted" && claim.text?.trim()) {
      out.push(claim.text.trim());
    }
  }
  return unique(out);
}

function collectUnknowns(body: UnderstandingBody, claims: Claim[]): string[] {
  const out: string[] = [];
  for (const g of body.now?.gaps ?? []) {
    if (g?.trim()) out.push(g.trim());
  }
  for (const w of body.why ?? []) {
    if (w.status === "unknown" && w.text?.trim()) {
      out.push(w.text.trim());
    }
  }
  for (const claim of claims) {
    if (
      (claim.status === "unknown" || claim.status === "unsupported") &&
      claim.text?.trim()
    ) {
      out.push(claim.text.trim());
    }
  }
  return unique(out);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/**
 * Assemble Brief from existing truth sources. Returns null when not allowed.
 * Candidate path requires grounded tools when requireGrounded is true (default).
 */
export function assembleProjectIntelligenceBrief(
  input: AssembleBriefInput,
): ProjectIntelligenceBrief | null {
  if (input.runFailed) return null;
  if (!input.body) return null;
  if (!input.matterId?.trim()) return null;

  if (input.kind === "candidate" && input.requireGrounded !== false) {
    if (!hasMapSearchReadReceipts(input.toolNames)) return null;
  }

  const body = input.body;
  const claims = input.claims ?? [];
  const grounded =
    input.kind === "accepted"
      ? true
      : hasMapSearchReadReceipts(input.toolNames);

  const claimIds =
    claims.length > 0
      ? claims.map((c) => c.id)
      : (body.why ?? []).map((_, i) => `why:${i}`);

  const decisionRaw = body.nextDecision?.trim() || "";
  const decisionPrompt = decisionRaw || EMPTY;

  const suggestion =
    decisionRaw && decisionRaw !== EMPTY
      ? { text: decisionRaw, status: "suggestion" as const }
      : undefined;

  return {
    matterId: input.matterId.trim(),
    currentJudgment: cleanText(body.now?.text),
    whyNow: pickWhyNow(body),
    claimIds,
    contraryOrLimits: collectContrary(body, claims),
    unknowns: collectUnknowns(body, claims),
    decisionPrompt,
    suggestion,
    sourceRevisionIds: [...(body.evidenceRevisionIds ?? [])].filter(Boolean),
    generatedFromRunId: (input.runId ?? "").trim() || "unknown-run",
    kind: input.kind,
    groundedInTools: grounded,
    restoreLabel:
      input.kind === "accepted" ? "上次已确认判断" : undefined,
  };
}

/**
 * Full brief selection for UI (hard gate + restore + fail).
 */
export function selectBriefSelection(input: {
  matterId: string;
  candidate?: { id: string; body: UnderstandingBody } | null;
  accepted?: { id: string; body: UnderstandingBody } | null;
  runId?: string | null;
  runStatus?: string | null;
  /** Candidate revision id published by the current run (if any). */
  runCandidateRevisionId?: string | null;
  toolNames?: string[];
  claims?: Claim[];
}): BriefSelection {
  const matterId = input.matterId.trim();
  const runId = (input.runId ?? "").trim() || "unknown-run";

  if (isRunFailedStatus(input.runStatus)) {
    return {
      status: "run_failed",
      message:
        "本轮失败：不沿用旧 Candidate 或历史 Accepted 冒充本次成功。",
      matterId,
      runId,
    };
  }

  // Candidate path only when run is success-like and fully grounded.
  if (input.candidate?.body && isRunSuccessStatus(input.runStatus)) {
    const gate = canShowCandidateBrief({
      runStatus: input.runStatus,
      toolNames: input.toolNames,
      candidateId: input.candidate.id,
      runCandidateRevisionId: input.runCandidateRevisionId,
      body: input.candidate.body,
    });
    if (gate.ok) {
      const brief = assembleProjectIntelligenceBrief({
        matterId,
        body: input.candidate.body,
        kind: "candidate",
        claims: input.claims,
        runId,
        toolNames: input.toolNames,
        requireGrounded: true,
      });
      if (brief) return { status: "candidate", brief };
    }
    // Body exists but gate failed → insufficient (no judgment body).
    if (input.candidate.body) {
      const tools = inspectMapSearchReadReceipts(input.toolNames);
      const missing = gate.ok ? tools.missing : gate.missing;
      return {
        status: "insufficient",
        message:
          !gate.ok && gate.reason.startsWith("依据不足")
            ? gate.reason
            : formatMissingToolsMessage(missing),
        missing,
        matterId,
        runId,
      };
    }
  }

  // In-progress run with incomplete tools: show insufficient if candidate body
  // is present but not grounded (do not leak judgment as reviewable brief).
  if (
    input.candidate?.body &&
    input.runStatus &&
    !isRunSuccessStatus(input.runStatus) &&
    !isRunFailedStatus(input.runStatus)
  ) {
    const tools = inspectMapSearchReadReceipts(input.toolNames);
    if (!tools.complete) {
      return {
        status: "insufficient",
        message: formatMissingToolsMessage(tools.missing),
        missing: tools.missing,
        matterId,
        runId,
      };
    }
  }

  // Historical accepted: restore only when not a failed this-round run.
  if (input.accepted?.body) {
    const brief = assembleProjectIntelligenceBrief({
      matterId,
      body: input.accepted.body,
      kind: "accepted",
      claims: input.claims,
      runId: input.runId,
      toolNames: input.toolNames,
      requireGrounded: false,
    });
    if (brief) {
      return { status: "accepted_restore", brief };
    }
  }

  // Candidate body without success run and without accepted → insufficient if tools incomplete
  if (input.candidate?.body) {
    const tools = inspectMapSearchReadReceipts(input.toolNames);
    return {
      status: "insufficient",
      message: formatMissingToolsMessage(tools.missing),
      missing: tools.missing,
      matterId,
      runId,
    };
  }

  return { status: "none" };
}

/**
 * Prefer live candidate when reviewable; else accepted head for re-entry restore.
 * Failed run → null (no leftover success brief).
 * @deprecated prefer selectBriefSelection for UI
 */
export function selectBriefSource(input: {
  matterId: string;
  candidate?: { id: string; body: UnderstandingBody } | null;
  accepted?: { id: string; body: UnderstandingBody } | null;
  runId?: string | null;
  runStatus?: string | null;
  runCandidateRevisionId?: string | null;
  toolNames?: string[];
  claims?: Claim[];
}): ProjectIntelligenceBrief | null {
  const sel = selectBriefSelection(input);
  if (sel.status === "candidate" || sel.status === "accepted_restore") {
    return sel.brief;
  }
  return null;
}
