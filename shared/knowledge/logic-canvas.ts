/**
 * Business-logic canvas presentation — pure helpers.
 * Agent reads grant files → map to material cards → CanvasCommand with path highlights.
 * Does not invent durable relations; only presentation keys + reason.
 */

import {
  type CanvasCommand,
  type CanvasIntentId,
  buildCanvasCommand,
  nodeRefKey,
} from "./canvas-command";

export type LogicMaterialRef = {
  id: string;
  sourceFileId?: string | null;
  title?: string | null;
};

function normalizeRel(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .trim();
}

function baseName(p: string): string {
  const n = normalizeRel(p);
  const parts = n.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? n;
}

/**
 * Map relative grant paths to card node keys in stable order (first path wins).
 * Matches full relative path, then suffix, then basename against sourceFileId/title.
 */
export function resolveCardKeysFromPaths(
  relativePaths: string[],
  materials: LogicMaterialRef[],
  limit = 8,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const raw of relativePaths) {
    if (keys.length >= limit) break;
    const rel = normalizeRel(raw);
    if (!rel || rel.endsWith("/")) continue;
    const base = baseName(rel).toLowerCase();
    if (!base || base === "." || base === "..") continue;

    let hit: LogicMaterialRef | undefined;
    const relLower = rel.toLowerCase();

    hit = materials.find((m) => {
      const s = normalizeRel(m.sourceFileId || "").toLowerCase();
      return s && (s === relLower || s.endsWith(`/${relLower}`));
    });
    if (!hit) {
      hit = materials.find((m) => {
        const s = normalizeRel(m.sourceFileId || "").toLowerCase();
        return s && (baseName(s).toLowerCase() === base || s.endsWith(`/${base}`));
      });
    }
    if (!hit) {
      hit = materials.find((m) => {
        const t = (m.title || "").toLowerCase();
        return t && (t === base || t.endsWith(base) || t.includes(base));
      });
    }
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    keys.push(nodeRefKey({ kind: "card", id: hit.id }));
  }

  return keys;
}

export type PlanLogicCanvasInput = {
  projectId: string;
  relativePaths: string[];
  materials: LogicMaterialRef[];
  /** Prefer keeping project hub focus so the chain is visible as neighbors. */
  keepProjectFocus?: boolean;
  reason?: string;
};

/**
 * Build a CanvasCommand that presents a business-logic chain on the center canvas.
 * Empty path still returns a now-view command so UI can show "need materials".
 */
export function planLogicCanvasFromPaths(
  input: PlanLogicCanvasInput,
): CanvasCommand {
  const keys = resolveCardKeysFromPaths(
    input.relativePaths,
    input.materials,
    8,
  );
  const reason =
    input.reason?.trim() ||
    (keys.length > 0
      ? `已根据 ${keys.length} 个已读材料节点串联业务逻辑`
      : "已切入业务逻辑呈现；授权夹内可读材料后会把文件节点串到画布上");

  const focus =
    input.keepProjectFocus !== false || keys.length === 0
      ? { kind: "project" as const, id: input.projectId }
      : {
          kind: "card" as const,
          id: keys[0]!.slice("card:".length),
        };

  return buildCanvasCommand({
    view: "now",
    focus,
    highlightNodeKeys: keys.length > 0 ? keys : undefined,
    fold: keys.length >= 2 ? "path" : "1hop",
    reason,
    intentId: "present_logic" as CanvasIntentId,
  });
}

/** Paths that look like structural / business docs — prefer when ordering. */
export function rankPathsForLogicPresentation(paths: string[]): string[] {
  const score = (p: string): number => {
    const n = normalizeRel(p).toLowerCase();
    const base = baseName(n);
    if (/readme|architecture|arch|design|prd|product|context|agents|overview/.test(base))
      return 100;
    if (/flow|pipeline|process|logic|domain|model|spec|adr/.test(base)) return 90;
    if (/\.(md|mdx|txt)$/.test(base)) return 50;
    if (/\.(ts|tsx|py|go|rs|java)$/.test(base)) return 30;
    return 10;
  };
  return [...new Set(paths.map(normalizeRel).filter(Boolean))].sort(
    (a, b) => score(b) - score(a) || a.localeCompare(b),
  );
}
