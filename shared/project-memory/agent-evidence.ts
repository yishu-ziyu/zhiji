/**
 * Source-backed understanding gates — product innovation control.
 * A claim is only "read the folder" when usable file evidence is present.
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
 * Ensure body carries real tool pins. Without pins, demote to honest unknown
 * (caller may still refuse to save as a successful candidate).
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

  const nowEvidence = (() => {
    const existing = (body.now?.evidence ?? []).filter(isUsableEvidenceAnchor);
    return existing.length > 0 ? existing : usable.slice(0, 4);
  })();

  const why =
    body.why?.length > 0
      ? body.why.map((w) => {
          const has = (w.evidence ?? []).some(isUsableEvidenceAnchor);
          if (w.status === "supported" && !has) {
            return {
              ...w,
              status: "supported" as const,
              evidence: usable.slice(0, 2),
            };
          }
          if (!has && usable.length > 0) {
            return {
              ...w,
              evidence:
                w.evidence && w.evidence.length > 0
                  ? w.evidence
                  : usable.slice(0, 2),
            };
          }
          return w;
        })
      : [
          {
            text: usable[0]!.quote.slice(0, 120),
            status: "supported" as const,
            evidence: usable.slice(0, 2),
          },
        ];

  return {
    ...body,
    now: {
      ...body.now,
      text:
        body.now?.text?.trim() ||
        `已从授权夹读到 ${usable[0]!.relativePath} 等材料。`,
      evidence: nowEvidence,
      gaps: (body.now?.gaps ?? []).filter((g) => !/缺少可引用/.test(g)),
      conflicts: body.now?.conflicts ?? [],
    },
    why,
    evidenceRevisionIds: [
      ...new Set([
        ...(body.evidenceRevisionIds ?? []),
        ...usable.map((p) => p.revisionId),
      ]),
    ],
  };
}

/** Grant-scoped path check: relativePath must be under known fixture paths when provided. */
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
    // prefix allow for nested
    for (const a of allowed) {
      if (rel === a || rel.startsWith(a.endsWith("/") ? a : `${a}/`)) {
        return true;
      }
    }
    // also accept if any allowed file is a suffix match of pin path
    return [...allowed].some((a) => rel.endsWith(a) || a.endsWith(rel));
  });
}
