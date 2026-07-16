/**
 * Policy A: after folder authorize / materialize, seed draft work items
 * onto the knowledge canvas immediately (no Owner confirm gate).
 *
 * Deterministic only — model loop can later replace/supplement the same schema.
 */
import { createHash } from "node:crypto";
import type { ActionItem, KnowledgeCard } from "@/shared/types/knowledge";
import {
  addAction,
  getAction,
  listActions,
  listCards,
} from "@/shared/knowledge/repository";

const MAX_SEED_ITEMS = 5;

export type SeedWorkItemsResult = {
  created: number;
  skippedExisting: number;
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

function isSeedableCard(card: KnowledgeCard): boolean {
  if (!card.sourceFileId?.trim() && !card.title?.trim()) return false;
  const name = baseName(card.sourceFileId || card.title || "").toLowerCase();
  // Skip obvious non-work noise even if it became a card.
  if (
    name.includes("package-lock") ||
    name.includes("pnpm-lock") ||
    name.endsWith(".map") ||
    name.endsWith(".mp3") ||
    name.endsWith(".css") ||
    name.endsWith(".lock")
  ) {
    return false;
  }
  return rankMaterialCard(card) <= 20 || Boolean(card.content?.trim());
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
      itemIds: [],
      emptyReason: "项目 id 为空",
    };
  }

  const cards = listCards({ projectId }).filter(isSeedableCard);
  if (cards.length === 0) {
    return {
      created: 0,
      skippedExisting: 0,
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
