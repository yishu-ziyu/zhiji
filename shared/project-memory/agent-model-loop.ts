/**
 * MVP V0 Task 4 — replaceable Agent model loop.
 * Default: attempt real model via shared/llm/adapter; deterministic only on failure.
 */

import { complete, extractJson } from "@/shared/llm/adapter";
import { HONEST_WHY_DEFAULT } from "./reducer";
import {
  countPdfPaths,
  humanizeUserFacingList,
  humanizeUserFacingText,
} from "./user-facing-zh";
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
    const path = e.relativePath;
    const evidence = anchors.filter(
      (a) =>
        a.revisionId === e.afterRevisionId ||
        a.revisionId === e.beforeRevisionId,
    );
    return {
      before:
        e.kind === "modified"
          ? "修改前"
          : e.previousPath
            ? `原路径 ${e.previousPath}`
            : "",
      after:
        e.kind === "deleted"
          ? `已删除 ${path}`
          : e.kind === "renamed"
            ? `${e.previousPath ?? "?"} → ${path}`
            : e.kind === "added"
              ? `新增 ${path}`
              : `已更新 ${path}`,
      eventIds: [e.id],
      evidence,
    };
  });

  const why = buildWhyClaims(input, anchors, nowIso);
  const prev = input.accepted?.body;
  const priorText = prev?.now?.text?.trim() ?? "";
  const priorIsFiller =
    !priorText ||
    /no (current|prior|events)|cannot determine|no events have been/i.test(
      priorText,
    );
  const nowText =
    !priorIsFiller && priorText && input.events.length === 0
      ? priorText
      : summarizeNow(input, changed);

  const now: StateClaim = {
    text: nowText,
    evidence: anchors,
    gaps: anchors.length === 0 ? ["暂无可用的原文依据"] : [],
    conflicts: [],
  };

  const then: StateClaim & { at: string } = {
    text: priorIsFiller ? "还没有已确认的先前理解" : priorText,
    at: priorIsFiller ? "unknown" : (input.accepted?.createdAt ?? "unknown"),
    evidence: priorIsFiller ? [] : (prev?.now?.evidence ?? []),
    gaps: priorIsFiller ? ["尚无已确认理解"] : [],
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
      ? "还没有足够依据。请补充材料，或直接修改这段理解。"
      : "请确认这段理解是否准确，也可以改完再确认。",
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
        reason: `${eventKindLabel(e.kind)} ${e.relativePath}`,
      });
    }
  }
  return deps;
}

function eventKindLabel(kind: ChangeEvent["kind"]): string {
  if (kind === "added") return "新增";
  if (kind === "modified") return "更新";
  if (kind === "renamed") return "重命名";
  if (kind === "deleted") return "删除";
  return "重新核对";
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

export function buildModelPrompt(
  input: MatterStateReconstructionInput,
): string {
  return [
    "Return a single JSON object for UnderstandingBody with keys:",
    "now {text,evidence[],gaps[],conflicts[]}, then {text,at,evidence[],gaps[],conflicts[]},",
    "changed[{before,after,eventIds[],evidence[]}], why[{text,status,evidence[]}],",
    "depends[{kind,id,reason}], evidenceRevisionIds[], nextDecision.",
    "why[].status is supported|unknown|conflicted. supported requires revisionId+relativePath+quote+lastVerifiedAt.",
    "Only cite revision ids present in the events below.",
    "面向用户的内容使用简体中文：now/then 的 text、gaps、conflicts，changed 的 before/after，why.text，depends.reason，nextDecision。",
    "原文引用保留来源语言：evidence[].quote、文件路径和 ID 不翻译。",
    "不要在面向用户的内容中出现 Owner、candidate、accepted、revision、matter、evidence 等内部字段名。",
    "这是给刚回到项目、需要马上做决定的负责人看的，不是工程审计报告。",
    "now.text 只写 1—2 句：项目现在到了哪一步、真正还差什么；不要堆内部实现名或测试数字。",
    "why 最多 3 条，只保留会改变负责人判断的事实；不要把整段 README 或数据集介绍当结论。",
    "nextDecision 只给一个具体问题，写清动作和取舍，不要重复当前判断。",
    "若工程已完成但真人演示/验收未完成，明确区分“工程可用”和“已经验收”，优先建议完成真实闭环。",
    `projectId=${input.projectId} matterId=${input.matterId}`,
    `events=${JSON.stringify(input.events)}`,
    `accepted=${JSON.stringify(input.accepted?.body ?? null)}`,
    `snippets=${JSON.stringify(input.evidenceSnippets ?? [])}`,
  ].join("\n");
}

function coerceModelBody(
  raw: Record<string, unknown>,
  input: MatterStateReconstructionInput,
): UnderstandingBody {
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
  const det = buildDeterministicUnderstandingBody(input);
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
  llmSnapshot?: import("@/shared/llm/types").LlmConnectionSnapshot,
): Promise<UnderstandingBody> {
  const text = await complete(
    buildModelPrompt(input),
    "你是项目理解 Agent。只输出 JSON。所有解释使用简体中文，原文引用保留来源语言。",
    {
      maxRetries: 1,
      timeout: 15000,
      snapshot: llmSnapshot,
    },
  );
  return coerceModelBody(extractJson(text), input);
}

export type AgentModelLoopOptions = {
  /**
   * Default `model`: attempt complete (llm adapter or inject).
   * Deterministic shell only when mode=deterministic or allowDeterministicFallback=true.
   */
  mode?: "deterministic" | "model";
  complete?: (
    input: MatterStateReconstructionInput,
  ) => Promise<UnderstandingBody>;
  /** Frozen connection for this Run — required for model mode product paths. */
  llmSnapshot?: import("@/shared/llm/types").LlmConnectionSnapshot;
  /**
   * Product default false. Only true for tests / explicit AGENT_ALLOW_DETERMINISTIC_FALLBACK=1.
   * When false, any LLM failure rethrows (caller marks Run failed, no Candidate).
   */
  allowDeterministicFallback?: boolean;
};

/** Deterministic inject allowed only in explicit modes — never silent product fallback. */
export function resolveAllowDeterministicFallback(
  mode: "model" | "deterministic",
  explicit?: boolean,
): boolean {
  if (mode === "deterministic") return true;
  if (typeof explicit === "boolean") return explicit;
  return process.env.AGENT_ALLOW_DETERMINISTIC_FALLBACK === "1";
}

export function createAgentModelLoop(
  options: AgentModelLoopOptions = {},
): AgentModelLoop {
  // PRD: attempt model by default; never silent-template under product "model".
  const mode = options.mode ?? "model";
  const allowFallback = resolveAllowDeterministicFallback(
    mode,
    options.allowDeterministicFallback,
  );
  const snap = options.llmSnapshot;
  const completeFn =
    options.complete ??
    ((input: MatterStateReconstructionInput) =>
      completeUnderstandingViaLlm(input, snap));
  return {
    async propose(input) {
      if (mode === "deterministic") {
        return buildDeterministicUnderstandingBody(input);
      }
      try {
        return sanitizeModelBody(await completeFn(input), input);
      } catch (err) {
        // Product model mode: any LLM failure is terminal (auth/network/5xx/timeout/invalid).
        if (!allowFallback) {
          throw err instanceof Error ? err : new Error(String(err));
        }
        // Explicit allow only: deterministic shell with honest marker.
        const fallback = buildDeterministicUnderstandingBody(input);
        return {
          ...fallback,
          now: {
            ...fallback.now,
            text: `${fallback.now.text}（暂时无法进一步分析）`,
          },
          nextDecision: "请稍后再试，或直接修改这段理解。",
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

  const asAnchorList = (value: unknown): EvidenceAnchor[] => {
    if (Array.isArray(value)) return value as EvidenceAnchor[];
    if (value && typeof value === "object") {
      // Model sometimes returns a single anchor object.
      const o = value as EvidenceAnchor;
      if (typeof o.revisionId === "string") return [o];
    }
    return [];
  };

  const filterAnchors = (anchors: unknown): EvidenceAnchor[] =>
    asAnchorList(anchors)
      .filter((a) => a && typeof a === "object")
      .filter((a) =>
        allowed.size === 0 ? Boolean(a.revisionId) : allowed.has(a.revisionId),
      )
      .map((a) => ({
        revisionId: String(a.revisionId ?? ""),
        relativePath:
          String(a.relativePath ?? "")
            .trim()
            .replace(/\\/g, "/") ||
          pathByRev.get(String(a.revisionId ?? "")) ||
          "",
        quote: String(a.quote ?? ""),
        lastVerifiedAt:
          String(a.lastVerifiedAt ?? "").trim() || new Date().toISOString(),
      }))
      .filter((a) => a.revisionId);

  const det = buildDeterministicUnderstandingBody(input);
  const rawEvidenceIds = Array.isArray(body.evidenceRevisionIds)
    ? body.evidenceRevisionIds
    : [];
  const evidenceRevisionIds = rawEvidenceIds
    .map(String)
    .filter((id) =>
      allowed.size === 0 ? Boolean(id) : allowed.has(id),
    );
  const pins =
    evidenceRevisionIds.length > 0
      ? evidenceRevisionIds
      : det.evidenceRevisionIds;

  const pdfCount = countPdfPaths(input.events.map((e) => e.relativePath));
  const zh = (s: string) => humanizeUserFacingText(s, { pdfCount });

  const rawWhy = Array.isArray(body.why) ? body.why : [];
  const why = (rawWhy.length ? rawWhy : det.why).map((w) =>
    normalizeWhyClaim({
      ...w,
      text: zh(String(w?.text ?? "")),
      evidence: filterAnchors(w?.evidence),
    }),
  );

  const nextDecisionRaw = body.nextDecision as unknown;
  const nextDecisionText =
    typeof nextDecisionRaw === "string"
      ? nextDecisionRaw
      : nextDecisionRaw &&
          typeof nextDecisionRaw === "object" &&
          typeof (nextDecisionRaw as { text?: unknown }).text === "string"
        ? String((nextDecisionRaw as { text: string }).text)
        : det.nextDecision;

  const rawChanged = Array.isArray(body.changed) ? body.changed : [];
  const rawDepends = Array.isArray(body.depends) ? body.depends : [];

  return {
    now: {
      text: zh(body.now?.text?.trim() || det.now.text),
      evidence: filterAnchors(body.now?.evidence ?? det.now.evidence),
      gaps: humanizeUserFacingList(
        Array.isArray(body.now?.gaps) ? body.now.gaps : det.now.gaps,
        { pdfCount },
      ),
      conflicts: humanizeUserFacingList(
        Array.isArray(body.now?.conflicts)
          ? body.now.conflicts
          : det.now.conflicts,
        { pdfCount },
      ),
    },
    then: {
      text: zh(body.then?.text?.trim() || det.then.text),
      at: body.then?.at || det.then.at,
      evidence: filterAnchors(body.then?.evidence ?? det.then.evidence),
      gaps: humanizeUserFacingList(
        Array.isArray(body.then?.gaps) ? body.then.gaps : det.then.gaps,
        {
          pdfCount,
        },
      ),
      conflicts: humanizeUserFacingList(
        Array.isArray(body.then?.conflicts)
          ? body.then.conflicts
          : det.then.conflicts,
        { pdfCount },
      ),
    },
    changed:
      rawChanged.length > 0
        ? rawChanged.map((c) => ({
            before: zh(String(c?.before ?? "")),
            after: zh(String(c?.after ?? "")),
            eventIds: Array.isArray(c?.eventIds) ? c.eventIds.map(String) : [],
            evidence: filterAnchors(c?.evidence),
          }))
        : det.changed,
    why: why.length > 0 ? why : det.why,
    depends: (rawDepends.length ? rawDepends : det.depends).map((d) => ({
      ...d,
      reason: zh(String(d?.reason ?? "")),
    })),
    evidenceRevisionIds: pins,
    nextDecision: zh(nextDecisionText.trim() || det.nextDecision),
  };
}
