/**
 * Bridge folder-grant observation signals into knowledge materials + citation cards
 * so the project canvas can show real nodes after authorize (Phase 2).
 *
 * Project-memory remains the grant/event truth; this only copies a bounded set of
 * readable files into the knowledge materials store (same path as drag-upload).
 */
import {
  kindFromName,
  materialCardSummary,
  writeProjectMaterial,
} from "@/shared/knowledge/materials";
import { ensureMaterialCitationCard } from "@/shared/knowledge/repository";
import { seedWorkItemsFromMaterials } from "@/shared/knowledge/seed-work-items-from-materials";

export type GrantSignalLike = {
  relativePath: string;
  content?: Uint8Array;
  kind?: string;
};

const SKIP_PATH_PARTS = [
  "/.git/",
  "/node_modules/",
  "/.next/",
  "/dist/",
  "/build/",
  "/.ship/",
  "/.DS_Store",
];

const MAX_FILES = 12;
const MAX_BYTES = 256_000;

function isSkippablePath(relativePath: string): boolean {
  const normalized = `/${relativePath.replace(/\\/g, "/")}`;
  const parts = normalized.split("/").filter(Boolean);
  for (const part of parts) {
    // Skip all hidden segments (.git, .fixture-seed-*, .DS_Store, …).
    // Canvas seeds should come from visible work docs (README/TODO/…), not dots.
    if (part.startsWith(".")) return true;
    if (/fixture[-_]?seed/i.test(part)) return true;
  }
  return SKIP_PATH_PARTS.some((part) => normalized.includes(part));
}

function isCanvasMaterialPath(relativePath: string): boolean {
  if (isSkippablePath(relativePath)) return false;
  const kind = kindFromName(relativePath);
  return kind === "markdown" || kind === "text" || kind === "html";
}

function rankPath(relativePath: string): number {
  const base = relativePath.split("/").pop()?.toLowerCase() ?? "";
  if (/^readme\./i.test(base)) return 0;
  if (/^todo\./i.test(base)) return 1;
  if (/^notes?\./i.test(base)) return 2;
  if (/decision/i.test(base)) return 3;
  if (base.endsWith(".md")) return 10;
  if (base.endsWith(".txt")) return 20;
  return 30;
}

/**
 * Materialize up to MAX_FILES text-like grant files into knowledge materials + cards.
 * Idempotent via write overwrite + ensureMaterialCitationCard by sourceFileId.
 * Policy A: also seed draft work items from those materials (no Owner confirm).
 */
export function materializeGrantSignalsToProject(
  projectId: string,
  signals: GrantSignalLike[],
): {
  written: number;
  cardIds: string[];
  workItemsCreated: number;
  workItemIds: string[];
} {
  if (!projectId.trim()) {
    return { written: 0, cardIds: [], workItemsCreated: 0, workItemIds: [] };
  }

  const candidates = signals
    .filter(
      (signal) =>
        signal.content &&
        signal.content.byteLength > 0 &&
        signal.content.byteLength <= MAX_BYTES &&
        isCanvasMaterialPath(signal.relativePath) &&
        (signal.kind === undefined ||
          signal.kind === "reconciled" ||
          signal.kind === "added" ||
          signal.kind === "updated"),
    )
    .sort(
      (a, b) =>
        rankPath(a.relativePath) - rankPath(b.relativePath) ||
        a.relativePath.localeCompare(b.relativePath),
    )
    .slice(0, MAX_FILES);

  const cardIds: string[] = [];
  let written = 0;

  for (const signal of candidates) {
    const bytes = signal.content!;
    const text = Buffer.from(bytes).toString("utf8");
    // Skip opaque binary that snuck past extension check
    if (text.includes("\u0000")) continue;

    const material = writeProjectMaterial(
      projectId,
      signal.relativePath,
      text,
      { encoding: "utf8" },
    );
    const kind = kindFromName(material.name);
    const summary = materialCardSummary(
      material.relativePath || material.name,
      kind === "image" || kind === "binary" || kind === "audio" ? "" : text,
    );
    const card = ensureMaterialCitationCard({
      projectId,
      materialId: material.id,
      title: material.name,
      contentSummary: summary,
      contentHash: material.contentHash,
    });
    written += 1;
    cardIds.push(card.id);
  }

  // Competition contract: materials must NOT auto-create formal todos.
  // seedWorkItemsFromMaterials only cleans historical noise seed-* drafts.
  const seeded = seedWorkItemsFromMaterials(projectId);

  return {
    written,
    cardIds,
    workItemsCreated: seeded.created,
    workItemIds: seeded.itemIds,
  };
}
