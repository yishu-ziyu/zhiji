/**
 * Material → work item seeding.
 *
 * Competition contract (2026-07-17): do NOT auto-create formal Work Items
 * (status=todo) on authorize or Agent run. Suggestions stay in Brief until
 * Owner explicitly adopts. Existing user tasks are never deleted.
 *
 * This function remains for noise cleanup of historical seed-* todos only.
 */
import type { KnowledgeCard } from "@/shared/types/knowledge";
import {
  getCard,
  listActions,
  updateActionStatus,
} from "@/shared/knowledge/repository";
import { createHash } from "node:crypto";

const MAX_SEED_ITEMS = 5;

export type SeedWorkItemsResult = {
  created: number;
  skippedExisting: number;
  cancelledNoise: number;
  itemIds: string[];
  /** Stable reason for empty seed (product-facing Chinese). */
  emptyReason: string | null;
};

/** Stable id so re-authorize is idempotent (policy A drafts). */
export function seedWorkItemId(projectId: string, sourceFileId: string): string {
  const digest = createHash("sha256")
    .update(`${projectId}\0${sourceFileId}`)
    .digest("hex")
    .slice(0, 20);
  return `seed-${digest}`;
}

function baseName(pathOrName: string): string {
  return pathOrName.split(/[/\\]/).pop() || pathOrName;
}

/** Hidden / fixture / lockfile noise must never become work items. */
export function isNoiseSeedName(name: string): boolean {
  const n = name.toLowerCase();
  if (!n.trim()) return true;
  if (n.startsWith(".")) return true;
  if (/fixture[-_]?seed/i.test(n)) return true;
  if (/seed[-_]?(sha|log|hash|id)/i.test(n)) return true;
  if (n.includes("package-lock") || n.includes("pnpm-lock")) return true;
  if (n === "package.json" || n === "tsconfig.json") return true;
  if (
    n.endsWith(".map") ||
    n.endsWith(".mp3") ||
    n.endsWith(".css") ||
    n.endsWith(".lock") ||
    n.endsWith(".png") ||
    n.endsWith(".jpg") ||
    n.endsWith(".jpeg") ||
    n.endsWith(".gif") ||
    n.endsWith(".webp") ||
    n.endsWith(".svg")
  ) {
    return true;
  }
  return false;
}

function rankMaterialCard(card: KnowledgeCard): number {
  const name = baseName(card.sourceFileId || card.title || "").toLowerCase();
  if (/^readme(\.|$)/i.test(name)) return 0;
  if (/^todo(\.|$)/i.test(name)) return 1;
  if (/^notes?(\.|$)/i.test(name)) return 2;
  if (/decision/i.test(name)) return 3;
  if (name.endsWith(".md")) return 10;
  if (name.endsWith(".txt")) return 20;
  return 40;
}

function hasWorkSignal(content: string | undefined): boolean {
  const text = (content || "").trim();
  if (!text) return false;
  // Checklist / action-ish markdown
  if (/^\s*[-*]\s+\[[ xX]\]/m.test(text)) return true;
  if (/\b(TODO|FIXME|下一步|待办|要做)\b/i.test(text)) return true;
  // Real prose, not a bare hash/token
  if (text.length >= 40 && !/^[a-f0-9\s-]{8,}$/i.test(text)) return true;
  return false;
}

function isSeedableCard(card: KnowledgeCard): boolean {
  if (!card.sourceFileId?.trim() && !card.title?.trim()) return false;
  const name = baseName(card.sourceFileId || card.title || "");
  if (isNoiseSeedName(name)) return false;
  const rank = rankMaterialCard(card);
  // Prefer role docs (readme/todo/notes/decisions).
  if (rank <= 3) return true;
  // Other markdown only when content looks like work, not fixture noise.
  if (rank <= 10 && hasWorkSignal(card.content)) return true;
  return false;
}

type Draft = {
  id: string;
  title: string;
  description: string;
  nextStep: string;
  evidenceIds: string[];
  cardId: string;
};

function draftForCard(projectId: string, card: KnowledgeCard): Draft {
  const label = baseName(card.sourceFileId || card.title || "材料");
  const sourceKey = card.sourceFileId || card.id;
  const id = seedWorkItemId(projectId, sourceKey);
  const snippet = (card.content || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const lower = label.toLowerCase();

  if (/^readme/i.test(lower)) {
    return {
      id,
      title: "确认项目目标与范围",
      description: snippet
        ? `根据 README：${snippet}`
        : "根据项目说明，确认这轮要完成什么。",
      nextStep: "读完说明后写出当前目标与下一步",
      evidenceIds: [card.id],
      cardId: card.id,
    };
  }
  if (/^todo/i.test(lower)) {
    return {
      id,
      title: "清点待办并挑一条推进",
      description: snippet
        ? `根据 TODO：${snippet}`
        : "根据待办清单，挑出当前最该做的一条。",
      nextStep: "从清单里选定 1 条并开始做",
      evidenceIds: [card.id],
      cardId: card.id,
    };
  }
  if (/^notes?/i.test(lower)) {
    return {
      id,
      title: "整理笔记里的待办与结论",
      description: snippet
        ? `根据 NOTES：${snippet}`
        : "根据笔记，标出仍需跟进的点。",
      nextStep: "标出笔记中仍开放的下一步",
      evidenceIds: [card.id],
      cardId: card.id,
    };
  }
  if (/decision/i.test(lower)) {
    return {
      id,
      title: "核对已定决策是否仍成立",
      description: snippet
        ? `根据决策记录：${snippet}`
        : "根据已记录的决策，确认是否需要调整。",
      nextStep: "逐条确认决策是否还适用",
      evidenceIds: [card.id],
      cardId: card.id,
    };
  }

  return {
    id,
    title: `审阅「${label}」`,
    description: snippet
      ? `材料要点：${snippet}`
      : `打开「${label}」并标出对当前局面有用的信息。`,
    nextStep: `打开「${label}」并记下下一步`,
    evidenceIds: [card.id],
    cardId: card.id,
  };
}

/**
 * Cancel todo seed-* drafts whose evidence is noise or no longer seedable.
 * Idempotent; never touches non-seed or terminal items.
 */
function cancelNoiseSeedDrafts(projectId: string): number {
  let cancelled = 0;
  for (const item of listActions({ projectId })) {
    if (!item.id.startsWith("seed-")) continue;
    if (item.status !== "todo") continue;

    const card = item.cardId ? getCard(item.cardId) : null;
    const label = baseName(
      card?.sourceFileId || card?.title || item.title || "",
    );
    const noise =
      isNoiseSeedName(label) ||
      /审阅「\./.test(item.title) ||
      (card ? !isSeedableCard(card) : /fixture|seed-sha|seed-log/i.test(item.title));

    if (!noise) continue;
    try {
      updateActionStatus(item.id, "cancelled", { actor: "system" });
      cancelled += 1;
    } catch {
      // ignore validation races
    }
  }
  return cancelled;
}

/**
 * No longer auto-creates formal todos from materials (competition contract).
 * Still cancels historical noise seed-* drafts; never deletes user tasks.
 */
export function seedWorkItemsFromMaterials(
  projectId: string,
): SeedWorkItemsResult {
  if (!projectId.trim()) {
    return {
      created: 0,
      skippedExisting: 0,
      cancelledNoise: 0,
      itemIds: [],
      emptyReason: "项目 id 为空",
    };
  }

  const cancelledNoise = cancelNoiseSeedDrafts(projectId);

  // Count existing seed items for observability only — do not create new ones.
  const existingSeedIds = listActions({ projectId })
    .filter((item) => item.id.startsWith("seed-"))
    .map((item) => item.id);

  return {
    created: 0,
    skippedExisting: existingSeedIds.length,
    cancelledNoise,
    itemIds: existingSeedIds,
    emptyReason:
      "材料不会自动变成正式任务；Agent 建议仅出现在项目情报简报中，需你明确采用后才创建任务",
  };
}
