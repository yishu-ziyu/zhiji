/**
 * Policy A: after folder authorize / materialize, seed draft work items
 * onto the knowledge canvas immediately (no Owner confirm gate).
 *
 * Deterministic only — model loop can later replace/supplement the same schema.
 */
import type { ActionItem, KnowledgeCard } from "@/shared/types/knowledge";
import {
  addAction,
  getAction,
  getCard,
  listActions,
  listCards,
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
 * Create draft work items from project material citation cards.
 * Idempotent by stable seed ids. Does not require Owner confirm (policy A).
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

  const cards = listCards({ projectId }).filter(isSeedableCard);
  if (cards.length === 0) {
    return {
      created: 0,
      skippedExisting: 0,
      cancelledNoise,
      itemIds: [],
      emptyReason: "还没有可当作依据的材料，无法提出在跟的事",
    };
  }

  const ranked = [...cards].sort(
    (a, b) =>
      rankMaterialCard(a) - rankMaterialCard(b) ||
      b.timestamp.localeCompare(a.timestamp),
  );

  // Prefer distinct roles (readme/todo/notes/decisions) before generic md.
  const picked: KnowledgeCard[] = [];
  const seenRole = new Set<number>();
  for (const card of ranked) {
    if (picked.length >= MAX_SEED_ITEMS) break;
    const role = rankMaterialCard(card);
    if (role <= 3) {
      if (seenRole.has(role)) continue;
      seenRole.add(role);
      picked.push(card);
      continue;
    }
    // Generic md only after roles; already filtered by isSeedableCard.
    picked.push(card);
  }

  let created = 0;
  let skippedExisting = 0;
  const itemIds: string[] = [];

  for (const card of picked) {
    const draft = draftForCard(projectId, card);
    if (getAction(draft.id)) {
      skippedExisting += 1;
      itemIds.push(draft.id);
      continue;
    }
    try {
      const item = addAction({
        id: draft.id,
        projectId,
        title: draft.title,
        description: draft.description,
        nextStep: draft.nextStep,
        evidenceIds: draft.evidenceIds,
        cardId: draft.cardId,
        status: "todo",
        assignee: "自己",
        deadline: "待确认",
        verificationCriteria: "打开依据材料后，能说出是否仍要推进",
      });
      created += 1;
      itemIds.push(item.id);
    } catch {
      // Card/project race: skip rather than fail authorize.
    }
  }

  // If project already has non-seed open work, still ok — seeds fill gaps only.
  const openCount = listActions({ projectId }).filter(
    (item: ActionItem) =>
      item.status !== "done" && item.status !== "cancelled",
  ).length;

  return {
    created,
    skippedExisting,
    cancelledNoise,
    itemIds,
    emptyReason:
      created === 0 && skippedExisting === 0
        ? "未能从材料提出在跟的事"
        : created === 0 && openCount > 0
          ? null
          : created === 0
            ? "在跟的事已存在或无法新建"
            : null,
  };
}
