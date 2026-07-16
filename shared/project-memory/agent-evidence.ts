/**
 * Source-backed understanding gates — product innovation control.
 * A claim is only "read the folder" when usable file evidence is present.
 *
 * vNext (PR-07): never auto-fill unrelated pins onto claims that lack evidence.
 * Missing evidence → unsupported / honest unknown, not fabricated support.
 */
import type { EvidenceAnchor, UnderstandingBody } from "./types";

/** Real pin from a grant file read — not a synthetic quote:unpinned stub. */
export function isUsableEvidenceAnchor(
  a: EvidenceAnchor | null | undefined,
): a is EvidenceAnchor {
  if (!a) return false;
  if (!a.quote?.trim()) return false;
  if (!a.relativePath?.trim()) return false;
  if (!a.revisionId?.trim()) return false;
  if (a.revisionId.startsWith("quote:")) return false;
  // Unresolved path placeholder from tools: `(revision abcd…)`
  if (a.relativePath.startsWith("(")) return false;
  return true;
}

export function collectUsableEvidence(
  body: UnderstandingBody | null | undefined,
): EvidenceAnchor[] {
  if (!body) return [];
  const out: EvidenceAnchor[] = [];
  const push = (list?: EvidenceAnchor[]) => {
    for (const a of list ?? []) {
      if (isUsableEvidenceAnchor(a)) out.push(a);
    }
  };
  push(body.now?.evidence);
  push(body.then?.evidence);
  for (const w of body.why ?? []) push(w.evidence);
  for (const c of body.changed ?? []) push(c.evidence);
  const seen = new Set<string>();
  return out.filter((a) => {
    const k = `${a.revisionId}\0${a.relativePath}\0${a.quote}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Enforce source-backed claims without inventing support links.
 *
 * - If the run produced zero usable pins: demote body to honest unknown.
 * - If a claim says supported but has no usable evidence: demote to unsupported.
 * - Never attach random pins to fill empty evidence arrays.
 */
export function enforceSourceBackedBody(
  body: UnderstandingBody,
  pins: EvidenceAnchor[],
): UnderstandingBody {
  const usable = pins.filter(isUsableEvidenceAnchor);
  if (usable.length === 0) {
    return {
      ...body,
      now: {
        text:
          body.now?.text?.trim() ||
          "还没有可核对的原文依据，不能假装读懂。",
        evidence: [],
        gaps: [
          ...new Set([...(body.now?.gaps ?? []), "缺少可引用原文"]),
        ],
        conflicts: body.now?.conflicts ?? [],
      },
      why: [
        {
          text: "依据不足：授权夹内没有形成可引用摘录。",
          status: "unknown",
          evidence: [],
        },
      ],
      evidenceRevisionIds: [],
      nextDecision: "请确认文件夹内有可读材料，或扩大授权后再试。",
    };
  }

  const nowExisting = (body.now?.evidence ?? []).filter(isUsableEvidenceAnchor);
  const nowGaps = [...(body.now?.gaps ?? [])];
  if (nowExisting.length === 0) {
    if (!nowGaps.some((g) => /缺少|无可用|无引用|unsupported/i.test(g))) {
      nowGaps.push("当前摘要缺少直接引用；下列结论须各自自带出处");
    }
  }

  const why =
    body.why?.length > 0
      ? body.why.map((w) => {
          const claimEvidence = (w.evidence ?? []).filter(isUsableEvidenceAnchor);
          if (claimEvidence.length > 0) {
            return { ...w, evidence: claimEvidence };
          }
          // No auto-fill. Supported without evidence is dishonest → unknown.
          // (WhyClaim.status has no "unsupported"; product shows unknown + empty evidence.)
          if (w.status === "supported") {
            return {
              ...w,
              status: "unknown" as const,
              evidence: [],
            };
          }
          return {
            ...w,
            evidence: [],
          };
        })
      : [
          {
            text: "已读到材料，但模型未给出可绑定的具体判断。",
            status: "unknown" as const,
            evidence: [],
          },
        ];

  const bodyUsable = collectUsableEvidence({
    ...body,
    now: { ...body.now, evidence: nowExisting, gaps: nowGaps, conflicts: body.now?.conflicts ?? [], text: body.now?.text ?? "" },
    why,
  });

  return {
    ...body,
    now: {
      ...body.now,
      text:
        body.now?.text?.trim() ||
        (nowExisting[0]
          ? `已从授权夹读到 ${nowExisting[0].relativePath} 等材料。`
          : "已读取授权夹，但摘要尚未绑定具体摘录。"),
      evidence: nowExisting,
      gaps: nowGaps.filter((g) => !/缺少可引用原文$/.test(g) || nowExisting.length === 0),
      conflicts: body.now?.conflicts ?? [],
    },
    why,
    evidenceRevisionIds: [
      ...new Set([
        ...(body.evidenceRevisionIds ?? []),
        ...bodyUsable.map((p) => p.revisionId),
        ...usable.map((p) => p.revisionId),
      ]),
    ],
  };
}

/**
 * Quote integrity: the quote must appear in the provided revision text.
 * Callers pass revision bytes/text from CAS; empty text fails closed.
 */
export function quoteExistsInRevisionText(
  quote: string,
  revisionText: string,
): boolean {
  const q = quote.trim();
  if (!q || !revisionText) return false;
  return revisionText.includes(q);
}

/**
 * Grant-scoped path check: relativePath must be under known fixture paths when provided.
 * vNext: no loose suffix guessing across unrelated paths.
 */
export function evidencePathsInGrant(
  evidence: EvidenceAnchor[],
  allowedRelativePaths: string[],
): boolean {
  if (evidence.length === 0) return false;
  if (allowedRelativePaths.length === 0) return true;
  const allowed = new Set(
    allowedRelativePaths.map((p) => p.replace(/\\/g, "/")),
  );
  return evidence.every((e) => {
    const rel = e.relativePath.replace(/\\/g, "/");
    if (allowed.has(rel)) return true;
    for (const a of allowed) {
      if (rel === a || rel.startsWith(a.endsWith("/") ? a : `${a}/`)) {
        return true;
      }
    }
    return false;
  });
}
