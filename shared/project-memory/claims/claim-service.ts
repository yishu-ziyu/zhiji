/**
 * PR-12 claim service seams (pure):
 * - buildClaimBundleFromWhy: UnderstandingBody.why → ClaimBundle (no auto-fill pins)
 * - applyOwnerResolution: per-claim HITL state transitions
 * - canLinkAsSupports: quote must appear in revisionText
 */
import { createHash, randomUUID } from "node:crypto";
import type { EvidenceAnchor, UnderstandingBody, WhyClaim } from "../types";
import {
  demoteUnsupportedClaims,
  type Claim,
  type ClaimBundle,
  type ClaimEvidenceLink,
  type ClaimSupportStatus,
  type OwnerResolution,
  type OwnerResolutionDecision,
  type PreciseEvidenceAnchor,
} from "./types";

export type BuildClaimBundleContext = {
  projectId: string;
  matterId?: string;
  runId?: string;
  now?: string;
  /**
   * When set, claim ids are scoped to this candidate revision
   * (`claim:<candidateRevisionId>:why:<i>:<hash>`) so resolutions
   * cannot collide across candidates (no second-ledger ambiguity).
   */
  candidateRevisionId?: string;
  /**
   * Revision bodies keyed by revisionId for quote integrity.
   * supports requires a non-empty body for the pin's revisionId and
   * quote ⊆ body. Missing map / missing key / empty body → no supports
   * (claim cannot remain supported without a valid supports link).
   */
  revisionTexts?: Record<string, string>;
};

/** Stable claim id — includes candidateRevisionId when provided. */
export function makeWhyClaimId(
  whyIndex: number,
  text: string,
  candidateRevisionId?: string,
): string {
  const hash = createHash("sha256")
    .update((text || String(whyIndex)).trim(), "utf8")
    .digest("hex")
    .slice(0, 16);
  if (candidateRevisionId?.trim()) {
    return `claim:${candidateRevisionId.trim()}:why:${whyIndex}:${hash}`;
  }
  return `claim:why:${whyIndex}:${hash}`;
}

export type ApplyOwnerResolutionInput = {
  projectId?: string;
  id?: string;
  resolvedAt?: string;
  editedText?: string;
  note?: string;
};

export type ApplyOwnerResolutionResult =
  | { ok: true; claim: Claim; resolution: OwnerResolution }
  | { ok: false; reason: string };

export type SupportsLinkCheck =
  | { ok: true }
  | { ok: false; reason: string };

export function quoteAppearsInRevision(
  quote: string,
  revisionText: string,
): boolean {
  const q = quote.trim();
  if (!q) return false;
  return revisionText.includes(q);
}

/**
 * Gate for relation === "supports":
 * - revision body must be present and non-empty
 * - quote must be findable in that fixed revision text
 */
export function canLinkAsSupports(
  quote: string,
  revisionText: string | undefined | null,
): SupportsLinkCheck {
  if (revisionText === undefined || revisionText === null) {
    return {
      ok: false,
      reason: "missing revisionText; supports relation refused",
    };
  }
  if (!revisionText.trim()) {
    return {
      ok: false,
      reason: "empty revisionText; supports relation refused",
    };
  }
  const q = quote.trim();
  if (!q) {
    return { ok: false, reason: "empty quote cannot support a claim" };
  }
  if (!quoteAppearsInRevision(q, revisionText)) {
    return {
      ok: false,
      reason: "quote not found in revisionText; supports relation refused",
    };
  }
  return { ok: true };
}

function mapWhyStatus(status: WhyClaim["status"]): ClaimSupportStatus {
  switch (status) {
    case "supported":
      return "supported";
    case "conflicted":
      return "conflicted";
    case "unknown":
    default:
      return "unsupported";
  }
}

function isUsablePin(a: EvidenceAnchor | null | undefined): a is EvidenceAnchor {
  if (!a) return false;
  if (!a.quote?.trim()) return false;
  if (!a.relativePath?.trim()) return false;
  if (!a.revisionId?.trim()) return false;
  if (a.revisionId.startsWith("quote:")) return false;
  if (a.relativePath.startsWith("(")) return false;
  return true;
}

function quoteHash(quote: string): string {
  return createHash("sha256").update(quote.trim(), "utf8").digest("hex").slice(0, 16);
}

/**
 * Project body.why (+ optional pins for anchor materialization) into a ClaimBundle.
 * Never attaches unrelated pins. Supported without a valid supports link → demoted.
 */
export function buildClaimBundleFromWhy(
  body: UnderstandingBody,
  pins: EvidenceAnchor[],
  ctx: BuildClaimBundleContext,
): ClaimBundle {
  const now = ctx.now ?? new Date().toISOString();
  const claims: Claim[] = [];
  const anchors: PreciseEvidenceAnchor[] = [];
  const links: ClaimEvidenceLink[] = [];
  const pinByKey = new Map<string, EvidenceAnchor>();
  for (const p of pins) {
    if (!isUsablePin(p)) continue;
    pinByKey.set(`${p.revisionId}\0${p.relativePath}\0${p.quote.trim()}`, p);
  }

  const whyList = body.why ?? [];
  whyList.forEach((w, index) => {
    const claimId = makeWhyClaimId(
      index,
      w.text || String(index),
      ctx.candidateRevisionId,
    );
    const claimLinks: ClaimEvidenceLink[] = [];
    const claimAnchors: PreciseEvidenceAnchor[] = [];

    // Only evidence attached to this why row — never stray pins.
    // supports requires verified revision body; no silent skip of the gate.
    const ownEvidence = (w.evidence ?? []).filter(isUsablePin);
    for (const ev of ownEvidence) {
      const revisionText = ctx.revisionTexts?.[ev.revisionId];
      const check = canLinkAsSupports(ev.quote, revisionText);
      if (!check.ok) {
        continue;
      }

      const anchorId = `anchor:${ev.revisionId}:${quoteHash(ev.quote)}`;
      const anchor: PreciseEvidenceAnchor = {
        id: anchorId,
        projectId: ctx.projectId,
        revisionId: ev.revisionId,
        relativePath: ev.relativePath,
        quote: ev.quote.trim(),
        lastVerifiedAt: ev.lastVerifiedAt || now,
      };
      const linkId = `link:${claimId}:${anchorId}`;
      const link: ClaimEvidenceLink = {
        id: linkId,
        claimId,
        anchorId,
        relation: "supports",
      };
      claimAnchors.push(anchor);
      claimLinks.push(link);
      // keep pin map consulted only for future extension (dedupe)
      pinByKey.get(`${ev.revisionId}\0${ev.relativePath}\0${ev.quote.trim()}`);
    }

    const claim: Claim = {
      id: claimId,
      projectId: ctx.projectId,
      matterId: ctx.matterId,
      runId: ctx.runId,
      text: (w.text || "").trim() || "(empty claim)",
      status: mapWhyStatus(w.status),
      linkIds: claimLinks.map((l) => l.id),
      createdAt: now,
    };

    claims.push(claim);
    anchors.push(...claimAnchors);
    links.push(...claimLinks);
  });

  const demoted = demoteUnsupportedClaims(claims, links);

  return {
    claims: demoted,
    anchors,
    links,
    conflicts: [],
    resolutions: [],
  };
}

/**
 * Per-claim owner HITL transitions.
 *
 * | decision       | claim effect                                      |
 * |----------------|---------------------------------------------------|
 * | accept         | if unsupported → owner_stated; else unchanged     |
 * | accept_edited  | text := editedText (required); status unchanged   |
 * | reject         | status := unsupported                             |
 * | defer          | no claim mutation                                 |
 */
export function applyOwnerResolution(
  claim: Claim,
  decision: OwnerResolutionDecision,
  input: ApplyOwnerResolutionInput = {},
): ApplyOwnerResolutionResult {
  const resolvedAt = input.resolvedAt ?? new Date().toISOString();
  const projectId = input.projectId ?? claim.projectId;
  const id = input.id ?? `ores:${randomUUID()}`;

  if (decision === "accept_edited") {
    const edited = input.editedText?.trim();
    if (!edited) {
      return {
        ok: false,
        reason: "accept_edited requires non-empty editedText",
      };
    }
    const next: Claim = { ...claim, text: edited };
    const resolution: OwnerResolution = {
      id,
      projectId,
      claimId: claim.id,
      decision,
      editedText: edited,
      note: input.note,
      resolvedAt,
    };
    return { ok: true, claim: next, resolution };
  }

  if (decision === "reject") {
    const next: Claim = { ...claim, status: "unsupported" };
    const resolution: OwnerResolution = {
      id,
      projectId,
      claimId: claim.id,
      decision,
      note: input.note,
      resolvedAt,
    };
    return { ok: true, claim: next, resolution };
  }

  if (decision === "defer") {
    const resolution: OwnerResolution = {
      id,
      projectId,
      claimId: claim.id,
      decision,
      note: input.note,
      resolvedAt,
    };
    return { ok: true, claim: { ...claim }, resolution };
  }

  if (decision === "accept") {
    // Owner may elevate honest-unsupported into owner_stated (explicit belief).
    const next: Claim =
      claim.status === "unsupported"
        ? { ...claim, status: "owner_stated" }
        : { ...claim };
    const resolution: OwnerResolution = {
      id,
      projectId,
      claimId: claim.id,
      decision,
      note: input.note,
      resolvedAt,
    };
    return { ok: true, claim: next, resolution };
  }

  return {
    ok: false,
    reason: `unknown decision: ${String(decision)}`,
  };
}
