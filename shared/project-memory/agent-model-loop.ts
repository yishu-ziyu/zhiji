/**
 * MVP V0 Task 4 — replaceable Agent model loop.
 * Default: attempt real model via shared/llm/adapter; deterministic only on failure.
 */

import { complete, extractJson } from "@/shared/llm/adapter";
import { HONEST_WHY_DEFAULT } from "./reducer";
import type {
  AgentModelLoop,
  ChangeClaim,
  ChangeEvent,
  EvidenceAnchor,
  MatterStateReconstructionInput,
  StateClaim,
  UnderstandingBody,
  WhyClaim,
} from "./types";

export const WHY_UNKNOWN = HONEST_WHY_DEFAULT;

export type {
  AgentModelLoop,
  MatterStateReconstructionInput,
  UnderstandingBody,
  WhyClaim,
};

/** Deterministic reconstruction when model is off or fails. */
export function buildDeterministicUnderstandingBody(
  input: MatterStateReconstructionInput,
): UnderstandingBody {
  const nowIso = new Date().toISOString();
  const anchors = anchorsFromEvents(input.events, nowIso);
  const evidenceRevisionIds = [
    ...new Set(anchors.map((a) => a.revisionId)),
  ];

  const changed: ChangeClaim[] = input.events.map((e) => {
    const pin =
      e.afterRevisionId ?? e.beforeRevisionId ?? "revision:unavailable";
    const path = e.relativePath;
    const evidence = anchors.filter(
      (a) =>
        a.revisionId === e.afterRevisionId ||
        a.revisionId === e.beforeRevisionId,
    );
    return {
      before: e.previousPath ?? e.beforeRevisionId ?? "",
      after:
        e.kind === "deleted"
          ? `deleted ${path}`
          : e.kind === "renamed"
            ? `${e.previousPath ?? "?"} → ${path}`
            : `${e.kind} ${path} @ ${pin}`,
      eventIds: [e.id],
      evidence,
    };
  });

  const why = buildWhyClaims(input, anchors, nowIso);
  const prev = input.accepted?.body;
  const nowText =
    prev?.now?.text && input.events.length === 0
      ? prev.now.text
      : summarizeNow(input, changed);

  const now: StateClaim = {
    text: nowText,
    evidence: anchors,
    gaps: anchors.length === 0 ? ["暂无可用的原文依据"] : [],
    conflicts: [],
  };

  const then: StateClaim & { at: string } = {
    text: prev?.now?.text ?? "还没有已确认的先前理解",
    at: input.accepted?.createdAt ?? "unknown",
    evidence: prev?.now?.evidence ?? [],
    gaps: prev ? [] : ["尚无已确认理解"],
    conflicts: [],
  };

  return {
    now,
    then,
    changed:
      changed.length > 0
        ? changed
        : [
            {
              before: "",
              after: "无明显文件变化",
              eventIds: [],
              evidence: [],
            },
          ],
    why,
    depends: buildDepends(input),
    evidenceRevisionIds,
    nextDecision: why.every((w) => w.status === "unknown")
      ? "需 Owner 判断：依据不足时请补材料或直接编辑候选理解"
      : "请 Owner 确认、编辑后确认，或拒绝本候选理解",
  };
}

function summarizeNow(
  input: MatterStateReconstructionInput,
  changed: ChangeClaim[],
): string {
  if (changed.length === 0 || changed[0]?.after === "无明显文件变化") {
    return "目前还没有可核对的文件变化。";
  }
  return `看到 ${changed.length} 处相关变化，请确认下面的理解是否准确。`;
}

function anchorsFromEvents(
  events: ChangeEvent[],
  nowIso: string,
): EvidenceAnchor[] {
  const out: EvidenceAnchor[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    const rid = e.afterRevisionId ?? e.beforeRevisionId;
    if (!rid || seen.has(rid)) continue;
    seen.add(rid);
    out.push({
      revisionId: rid,
      relativePath: e.relativePath.replace(/\\/g, "/"),
      quote: "",
      lastVerifiedAt: e.observedAt || nowIso,
    });
  }
  return out;
}

function buildWhyClaims(
  input: MatterStateReconstructionInput,
  anchors: EvidenceAnchor[],
  nowIso: string,
): WhyClaim[] {
  const claims: WhyClaim[] = [];

  for (const snip of input.evidenceSnippets ?? []) {
    const text = snip.text?.trim();
    if (!text) continue;
    const match =
      anchors.find((a) => a.revisionId === snip.revisionId) ?? anchors[0];
    if (
      match &&
      snip.revisionId &&
      snip.revisionId !== "quote:unpinned" &&
      match.relativePath
    ) {
      claims.push({
        text,
        status: "supported",
        evidence: [
          {
            revisionId:
              snip.revisionId === "quote:unpinned"
                ? match.revisionId
                : snip.revisionId,
            relativePath: match.relativePath,
            quote: text,
            lastVerifiedAt: match.lastVerifiedAt || nowIso,
          },
        ],
      });
    } else {
      claims.push({ text, status: "unknown", evidence: [] });
    }
  }

  if (claims.length === 0) {
    const acceptedSupported = (input.accepted?.body.why ?? []).filter(
      (w) => w.status === "supported" && isFullySupportedAnchor(w),
    );
    if (acceptedSupported.length > 0) {
      return acceptedSupported.map((w) => ({
        ...w,
        evidence: [...w.evidence],
      }));
    }
    claims.push({ text: WHY_UNKNOWN, status: "unknown", evidence: [] });
  }

  return claims.map(normalizeWhyClaim);
}

function buildDepends(
  input: MatterStateReconstructionInput,
): UnderstandingBody["depends"] {
  const deps: UnderstandingBody["depends"] = [
    { kind: "matter", id: input.matterId, reason: "当前聚焦事项" },
  ];
  for (const e of input.events) {
    const rev = e.afterRevisionId ?? e.beforeRevisionId;
    if (rev) {
      deps.push({
        kind: "evidence",
        id: rev,
        reason: `变化 ${e.kind} ${e.relativePath}`,
      });
    }
  }
  return deps;
}

export function isFullySupportedAnchor(claim: WhyClaim): boolean {
  if (claim.status !== "supported") return false;
  if (!claim.evidence.length) return false;
  return claim.evidence.every(
    (e) =>
      Boolean(e.revisionId?.trim()) &&
      Boolean(e.relativePath?.trim()) &&
      Boolean(e.quote?.trim()) &&
      Boolean(e.lastVerifiedAt?.trim()),
  );
}

export function normalizeWhyClaim(claim: WhyClaim): WhyClaim {
  const text = claim.text?.trim() || WHY_UNKNOWN;
  if (claim.status === "supported" && !isFullySupportedAnchor(claim)) {
    return {
      text,
      status: "unknown",
      evidence: (claim.evidence ?? []).filter((e) => e.quote?.trim()),
    };
  }
  if (claim.status === "conflicted") {
    return { ...claim, text, evidence: claim.evidence ?? [] };
  }
  if (!text || text === WHY_UNKNOWN) {
    return {
      text: WHY_UNKNOWN,
      status: "unknown",
      evidence: claim.evidence ?? [],
    };
  }
  return { ...claim, text };
}

function buildModelPrompt(input: MatterStateReconstructionInput): string {
  return [
    "Return a single JSON object for UnderstandingBody with keys:",
    "now {text,evidence[],gaps[],conflicts[]}, then {text,at,evidence[],gaps[],conflicts[]},",
    "changed[{before,after,eventIds[],evidence[]}], why[{text,status,evidence[]}],",
    "depends[{kind,id,reason}], evidenceRevisionIds[], nextDecision.",
    "why[].status is supported|unknown|conflicted. supported requires revisionId+relativePath+quote+lastVerifiedAt.",
    "Only cite revision ids present in the events below.",
    `projectId=${input.projectId} matterId=${input.matterId}`,
    `events=${JSON.stringify(input.events)}`,
    `accepted=${JSON.stringify(input.accepted?.body ?? null)}`,
    `snippets=${JSON.stringify(input.evidenceSnippets ?? [])}`,
  ].join("\n");
}

function coerceModelBody(raw: Record<string, unknown>): UnderstandingBody {
  const asState = (v: unknown, fallback: StateClaim): StateClaim => {
    if (!v || typeof v !== "object") return fallback;
    const o = v as Record<string, unknown>;
    return {
      text: typeof o.text === "string" ? o.text : fallback.text,
      evidence: Array.isArray(o.evidence)
        ? (o.evidence as EvidenceAnchor[])
        : fallback.evidence,
      gaps: Array.isArray(o.gaps) ? (o.gaps as string[]) : fallback.gaps,
      conflicts: Array.isArray(o.conflicts)
        ? (o.conflicts as string[])
        : fallback.conflicts,
    };
  };
  const det = buildDeterministicUnderstandingBody({
    projectId: "",
    matterId: "",
    events: [],
    evidenceSnippets: [],
  });
  const now = asState(raw.now, det.now);
  const thenBase = asState(raw.then, det.then);
  const thenAt =
    raw.then &&
    typeof raw.then === "object" &&
    typeof (raw.then as { at?: unknown }).at === "string"
      ? (raw.then as { at: string }).at
      : det.then.at;
  return {
    now,
    then: { ...thenBase, at: thenAt },
    changed: Array.isArray(raw.changed)
      ? (raw.changed as ChangeClaim[])
      : det.changed,
    why: Array.isArray(raw.why) ? (raw.why as WhyClaim[]) : det.why,
    depends: Array.isArray(raw.depends)
      ? (raw.depends as UnderstandingBody["depends"])
      : det.depends,
    evidenceRevisionIds: Array.isArray(raw.evidenceRevisionIds)
      ? (raw.evidenceRevisionIds as string[])
      : det.evidenceRevisionIds,
    nextDecision:
      typeof raw.nextDecision === "string"
        ? raw.nextDecision
        : det.nextDecision,
  };
}

/** Default live completion via shared/llm/adapter. */
export async function completeUnderstandingViaLlm(
  input: MatterStateReconstructionInput,
): Promise<UnderstandingBody> {
  const text = await complete(
    buildModelPrompt(input),
    "You are a project-memory reconstruction agent. Output JSON only.",
    { maxRetries: 1, timeout: 15000 },
  );
  return coerceModelBody(extractJson(text));
}

export type AgentModelLoopOptions = {
  /**
   * Default `model`: attempt complete (llm adapter or inject), fall back deterministic on failure.
   * `deterministic` forces template path (tests).
   */
  mode?: "deterministic" | "model";
  complete?: (
    input: MatterStateReconstructionInput,
  ) => Promise<UnderstandingBody>;
};

export function createAgentModelLoop(
  options: AgentModelLoopOptions = {},
): AgentModelLoop {
  // PRD: attempt model by default; never silent-template under "model".
  const mode = options.mode ?? "model";
  const completeFn = options.complete ?? completeUnderstandingViaLlm;
  return {
    async propose(input) {
      if (mode === "deterministic") {
        return buildDeterministicUnderstandingBody(input);
      }
      try {
        return sanitizeModelBody(await completeFn(input), input);
      } catch {
        const fallback = buildDeterministicUnderstandingBody(input);
        return {
          ...fallback,
          now: {
            ...fallback.now,
            text: `${fallback.now.text}（模型不可用，已保留确定性 changed/evidence）`,
          },
          nextDecision: "需 Owner 判断（模型失败，仅确定性摘要可用）",
        };
      }
    },
  };
}

export function sanitizeModelBody(
  body: UnderstandingBody,
  input: MatterStateReconstructionInput,
): UnderstandingBody {
  const allowed = new Set<string>();
  const pathByRev = new Map<string, string>();
  for (const e of input.events) {
    if (e.afterRevisionId) {
      allowed.add(e.afterRevisionId);
      pathByRev.set(e.afterRevisionId, e.relativePath.replace(/\\/g, "/"));
    }
    if (e.beforeRevisionId) {
      allowed.add(e.beforeRevisionId);
      pathByRev.set(e.beforeRevisionId, e.relativePath.replace(/\\/g, "/"));
    }
  }
  for (const snip of input.evidenceSnippets ?? []) {
    if (snip.revisionId) allowed.add(snip.revisionId);
  }

  const filterAnchors = (anchors: EvidenceAnchor[]): EvidenceAnchor[] =>
    (anchors ?? [])
      .filter((a) =>
        allowed.size === 0 ? Boolean(a.revisionId) : allowed.has(a.revisionId),
      )
      .map((a) => ({
        revisionId: a.revisionId,
        relativePath:
          a.relativePath?.trim().replace(/\\/g, "/") ||
          pathByRev.get(a.revisionId) ||
          "",
        quote: a.quote ?? "",
        lastVerifiedAt: a.lastVerifiedAt?.trim() || new Date().toISOString(),
      }));

  const det = buildDeterministicUnderstandingBody(input);
  const evidenceRevisionIds = (body.evidenceRevisionIds ?? []).filter((id) =>
    allowed.size === 0 ? Boolean(id) : allowed.has(id),
  );
  const pins =
    evidenceRevisionIds.length > 0
      ? evidenceRevisionIds
      : det.evidenceRevisionIds;

  const why = (body.why?.length ? body.why : det.why).map((w) =>
    normalizeWhyClaim({
      ...w,
      evidence: filterAnchors(w.evidence ?? []),
    }),
  );

  return {
    now: {
      text: body.now?.text?.trim() || det.now.text,
      evidence: filterAnchors(body.now?.evidence ?? det.now.evidence),
      gaps: body.now?.gaps ?? det.now.gaps,
      conflicts: body.now?.conflicts ?? det.now.conflicts,
    },
    then: {
      text: body.then?.text?.trim() || det.then.text,
      at: body.then?.at || det.then.at,
      evidence: filterAnchors(body.then?.evidence ?? det.then.evidence),
      gaps: body.then?.gaps ?? det.then.gaps,
      conflicts: body.then?.conflicts ?? det.then.conflicts,
    },
    changed:
      body.changed?.length > 0
        ? body.changed.map((c) => ({
            before: c.before ?? "",
            after: c.after ?? "",
            eventIds: c.eventIds ?? [],
            evidence: filterAnchors(c.evidence ?? []),
          }))
        : det.changed,
    why: why.length > 0 ? why : det.why,
    depends: body.depends?.length ? body.depends : det.depends,
    evidenceRevisionIds: pins,
    nextDecision: body.nextDecision?.trim() || det.nextDecision,
  };
}
