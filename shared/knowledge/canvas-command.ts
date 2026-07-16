/**
 * Canvas menu v1 — executable presentation contract.
 * Agent and UI share this module; no invented edges.
 */

import type { CanvasEdge, CanvasNodeRef } from "@/shared/types/knowledge";

export const CANVAS_MENU_VERSION = "canvas-menu-v1" as const;

export type CanvasViewId = "now" | "by_kind" | "decision" | "evidence";

export type CanvasFoldPolicy = "1hop" | "path";

export type CanvasIntentId =
  | "what_now"
  | "resume_recent"
  | "why_evidence"
  | "whats_blocked"
  | "survey_types"
  | "open_entity"
  | "decision_path"
  | "unknown";

export type CanvasCommand = {
  menuVersion: typeof CANVAS_MENU_VERSION;
  view: CanvasViewId;
  focus?: CanvasNodeRef;
  highlightNodeKeys?: string[];
  fold?: CanvasFoldPolicy;
  reason?: string;
  intentId?: CanvasIntentId;
};

export const CANVAS_VIEW_IDS: readonly CanvasViewId[] = [
  "now",
  "by_kind",
  "decision",
  "evidence",
] as const;

export const DEFAULT_CANVAS_VIEW: CanvasViewId = "now";

const NODE_KEY_RE = /^[a-z_]+:.+$/;

export function nodeRefKey(ref: CanvasNodeRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function isCanvasViewId(value: unknown): value is CanvasViewId {
  return (
    typeof value === "string" &&
    (CANVAS_VIEW_IDS as readonly string[]).includes(value)
  );
}

export function isCanvasIntentId(value: unknown): value is CanvasIntentId {
  return (
    typeof value === "string" &&
    [
      "what_now",
      "resume_recent",
      "why_evidence",
      "whats_blocked",
      "survey_types",
      "open_entity",
      "decision_path",
      "unknown",
    ].includes(value)
  );
}

export type CanvasCommandValidation =
  | { ok: true; command: CanvasCommand }
  | { ok: false; error: string };

/**
 * Normalize + validate a CanvasCommand-like payload.
 */
export function parseCanvasCommand(raw: unknown): CanvasCommandValidation {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "command 必须是对象" };
  }
  const o = raw as Record<string, unknown>;
  const view = o.view;
  if (!isCanvasViewId(view)) {
    return {
      ok: false,
      error: `view 非法，允许: ${CANVAS_VIEW_IDS.join(", ")}`,
    };
  }

  let focus: CanvasNodeRef | undefined;
  if (o.focus != null) {
    if (typeof o.focus !== "object" || o.focus === null) {
      return { ok: false, error: "focus 必须是 { kind, id }" };
    }
    const f = o.focus as Record<string, unknown>;
    if (typeof f.kind !== "string" || typeof f.id !== "string") {
      return { ok: false, error: "focus.kind / focus.id 必填" };
    }
    if (!f.kind.trim() || !f.id.trim()) {
      return { ok: false, error: "focus.kind / focus.id 不能为空" };
    }
    focus = { kind: f.kind as CanvasNodeRef["kind"], id: f.id.trim() };
  }

  let highlightNodeKeys: string[] | undefined;
  if (o.highlightNodeKeys != null) {
    if (!Array.isArray(o.highlightNodeKeys)) {
      return { ok: false, error: "highlightNodeKeys 必须是数组" };
    }
    highlightNodeKeys = [];
    for (const key of o.highlightNodeKeys) {
      if (typeof key !== "string" || !NODE_KEY_RE.test(key)) {
        return {
          ok: false,
          error: `highlightNodeKeys 项非法: ${String(key)}`,
        };
      }
      highlightNodeKeys.push(key);
    }
  }

  const fold =
    o.fold === "path" || o.fold === "1hop" ? (o.fold as CanvasFoldPolicy) : "1hop";

  const intentId = isCanvasIntentId(o.intentId) ? o.intentId : undefined;
  const reason =
    typeof o.reason === "string" && o.reason.trim()
      ? o.reason.trim().slice(0, 200)
      : undefined;

  return {
    ok: true,
    command: {
      menuVersion: CANVAS_MENU_VERSION,
      view,
      focus,
      highlightNodeKeys,
      fold,
      reason,
      intentId,
    },
  };
}

/** Edge kinds kept under each view (null = no kind filter). */
export function edgeKindsForView(
  view: CanvasViewId,
): ReadonlySet<string> | null {
  if (view === "decision") {
    return new Set(["attention", "blocked", "work"]);
  }
  if (view === "evidence") {
    return new Set(["evidence", "material", "attention"]);
  }
  return null;
}

/**
 * Filter edges for a view preset (pure; used by canvas layout).
 */
export function filterEdgesForView(
  edges: CanvasEdge[],
  view: CanvasViewId,
): CanvasEdge[] {
  const kinds = edgeKindsForView(view);
  let next = edges;
  if (view === "now" || view === "by_kind") {
    next = next.filter((e) => e.strength !== "weak");
  }
  if (view === "decision") {
    next = next.filter((e) => {
      const kind = e.kind ?? "other";
      if (kind === "blocked" || kind === "attention") return true;
      if (kind === "work" && e.strength === "strong") return true;
      if (e.strength === "strong" && (kind === "work" || kind === "attention"))
        return true;
      return kinds?.has(kind) && e.strength !== "weak";
    });
    // Prefer action edges: drop weak always
    next = next.filter((e) => e.strength !== "weak");
  }
  if (view === "evidence") {
    next = next.filter((e) => {
      const kind = e.kind ?? "other";
      return kinds?.has(kind) ?? false;
    });
  }
  return next;
}

/** Label policy: which strengths show labels without hover. */
export function labelStrengthsForView(
  view: CanvasViewId,
): ReadonlySet<"strong" | "medium" | "weak"> {
  if (view === "decision" || view === "evidence") {
    return new Set(["strong", "medium", "weak"]);
  }
  if (view === "by_kind") {
    return new Set(); // labels off by default
  }
  return new Set(["strong"]);
}

export function buildCanvasCommand(input: {
  view: CanvasViewId;
  focus?: CanvasNodeRef;
  highlightNodeKeys?: string[];
  fold?: CanvasFoldPolicy;
  reason?: string;
  intentId?: CanvasIntentId;
}): CanvasCommand {
  const parsed = parseCanvasCommand({
    menuVersion: CANVAS_MENU_VERSION,
    ...input,
  });
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.command;
}
