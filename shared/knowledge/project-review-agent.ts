import {
  isUsefulCanvasCard,
  sortCardsForCanvas,
} from "@/shared/knowledge/canvas-material-rank";
import { complete, extractJson } from "@/shared/llm/adapter";
import type {
  ActionItem,
  KnowledgeCard,
  KnowledgeRelation,
  WorkEvent,
} from "@/shared/types/knowledge";

export type ProjectReviewResult = {
  judgment: string;
  gaps: string[];
  nextStep: string;
  evidenceIds: string[];
  mode: "model" | "deterministic";
};

/** B-2: project-level “现在怎样” (not work-item shell narrative). */
export type ProjectNowResult = {
  status: "empty" | "ready";
  judgment: string;
  gaps: string[];
  nextStep: string;
  /** Only real card ids that exist in input.cards */
  evidenceIds: string[];
  mode: "model" | "deterministic";
};

type ReviewInput = {
  item: ActionItem;
  evidence: KnowledgeCard[];
  events: WorkEvent[];
};

export type ProjectNowInput = {
  projectName: string;
  cards: KnowledgeCard[];
  workItems: ActionItem[];
  events: WorkEvent[];
  relations?: KnowledgeRelation[];
};

function deterministicReview(input: ReviewInput): ProjectReviewResult {
  const gaps: string[] = [];
  if (input.item.deadline === "待确认") gaps.push("截止时间尚未确认");
  if (!input.item.verificationCriteria.trim()) gaps.push("验收标准尚未填写");
  if (input.evidence.length === 0) gaps.push("尚未关联项目依据");
  return {
    judgment:
      input.item.status === "blocked"
        ? `当前工作被阻塞：${input.item.blockedReason || "原因待确认"}`
        : `当前工作可继续，但需要按验收标准核对结果`,
    gaps,
    nextStep: input.item.nextStep,
    evidenceIds: input.evidence.map((card) => card.id),
    mode: "deterministic",
  };
}

export async function reviewWorkItem(
  input: ReviewInput,
  options?: { mode?: "model" | "deterministic" },
): Promise<ProjectReviewResult> {
  const mode = options?.mode ?? "deterministic";
  if (mode === "deterministic") return deterministicReview(input);

  const evidenceIds = new Set(input.evidence.map((card) => card.id));
  const prompt = [
    `工作项：${input.item.title}`,
    `说明：${input.item.description}`,
    `当前状态：${input.item.status}`,
    `下一步：${input.item.nextStep}`,
    `验收标准：${input.item.verificationCriteria}`,
    "依据：",
    ...input.evidence.map(
      (card) => `[${card.id}] ${card.title || "材料"}：${card.content}`,
    ),
    "最近记录：",
    ...input.events.slice(0, 8).map((event) => `${event.type}：${event.body}`),
    "只返回 JSON：judgment(string), gaps(string[]), nextStep(string), evidenceIds(string[])。不得引用列表之外的依据。",
  ].join("\n");
  const raw = await complete(
    prompt,
    "你是项目复核 Agent。只根据提供的项目事实判断，不补写不存在的信息。",
    { timeout: 15_000, maxRetries: 1 },
  );
  const parsed = extractJson(raw);
  const nextStep = String(parsed.nextStep ?? "").trim();
  const judgment = String(parsed.judgment ?? "").trim();
  if (!judgment || !nextStep) throw new Error("Agent 返回缺少判断或下一步");
  return {
    judgment,
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
    nextStep,
    evidenceIds: Array.isArray(parsed.evidenceIds)
      ? parsed.evidenceIds.map(String).filter((id) => evidenceIds.has(id))
      : [],
    mode: "model",
  };
}

/** Cards that count as real project materials (not fake seed narrative). */
export function materialCardsForReview(cards: KnowledgeCard[]): KnowledgeCard[] {
  return cards.filter((card) => {
    if (!isUsefulCanvasCard(card)) return false;
    if (card.sourceFileId?.trim()) return true;
    if (card.source === "doc" || card.source === "meeting" || card.source === "email" || card.source === "chat") {
      return Boolean(card.content?.trim() || card.title?.trim());
    }
    // Manual notes with content still citable; empty shells out.
    return Boolean(card.content?.trim());
  });
}

function pickEvidenceIds(
  materials: KnowledgeCard[],
  workItems: ActionItem[],
  max = 3,
): string[] {
  const known = new Set(materials.map((c) => c.id));
  const ordered: string[] = [];
  const push = (id: string | undefined) => {
    if (!id || !known.has(id) || ordered.includes(id)) return;
    ordered.push(id);
  };

  // Prefer evidence linked from open/blocked work, then ranked useful materials.
  const openWork = workItems
    .filter((w) => w.status !== "done" && w.status !== "cancelled")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const item of openWork) {
    for (const id of item.evidenceIds ?? []) push(id);
    push(item.cardId);
  }
  for (const card of sortCardsForCanvas(materials)) push(card.id);
  return ordered.slice(0, max);
}

/**
 * B-2 deterministic project review.
 * Empty materials → honest empty; never invent evidence ids.
 */
export function reviewProjectNow(input: ProjectNowInput): ProjectNowResult {
  const materials = materialCardsForReview(input.cards);
  const knownIds = new Set(input.cards.map((c) => c.id));
  const relations = (input.relations ?? []).filter(
    (r) => knownIds.has(r.fromCardId) && knownIds.has(r.toCardId),
  );

  if (materials.length === 0) {
    return {
      status: "empty",
      judgment: "还没材料，还谈不上理解项目局面。",
      gaps:
        input.workItems.length > 0
          ? ["有工作项但没有可点的入库材料，不能当进度判断"]
          : ["先拖入或上传文件，再看「现在怎样」"],
      nextStep: "添加本项目材料",
      evidenceIds: [],
      mode: "deterministic",
    };
  }

  const blocked = input.workItems.filter((w) => w.status === "blocked");
  const open = input.workItems.filter(
    (w) => w.status !== "done" && w.status !== "cancelled",
  );
  const recent = sortCardsForCanvas(materials)[0];
  const recentLabel = recent.title?.trim() || recent.sourceFileId || "最近材料";
  const gaps: string[] = [];
  let judgment: string;
  let nextStep: string;

  if (blocked.length > 0) {
    const b = blocked[0];
    judgment = `现在卡在「${b.title}」：${b.blockedReason || "原因待确认"}。项目已有 ${materials.length} 份材料可对。`;
    nextStep = `先打开依据，核对「${b.title}」阻塞是否仍成立`;
    gaps.push(`阻塞项：${b.title}`);
  } else if (open.length > 0) {
    judgment = `现在：已有 ${materials.length} 份材料、${open.length} 项在跟工作。建议先看「${recentLabel}」。`;
    nextStep = open[0].nextStep?.trim() || `打开「${recentLabel}」核对下一步`;
    if (!open[0].nextStep?.trim()) gaps.push("在跟工作缺少明确下一步");
  } else {
    judgment = `现在：已入库 ${materials.length} 份材料，暂无在跟工作。局面以材料为准，建议从「${recentLabel}」看起。`;
    nextStep = `打开「${recentLabel}」确认是否要建下一步`;
  }

  if (relations.length > 0) {
    gaps.push(`已有 ${relations.length} 条材料关系可点回`);
  } else if (materials.length >= 2) {
    gaps.push("材料之间关系仍少，判断主要靠单份材料");
  }

  const recentEvents = [...input.events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  if (recentEvents.length > 0 && open.length > 0) {
    gaps.push(`最近记录：${recentEvents[0].body.slice(0, 48)}`);
  }

  const evidenceIds = pickEvidenceIds(materials, input.workItems, 3).filter(
    (id) => knownIds.has(id),
  );

  // Must always have at least one real evidence when ready.
  if (evidenceIds.length === 0 && recent) {
    evidenceIds.push(recent.id);
  }

  return {
    status: "ready",
    judgment,
    gaps: gaps.slice(0, 4),
    nextStep,
    evidenceIds,
    mode: "deterministic",
  };
}

/** Optional model mode for project-now (filters evidence to known cards). */
export async function reviewProjectNowAsync(
  input: ProjectNowInput,
  options?: { mode?: "model" | "deterministic" },
): Promise<ProjectNowResult> {
  const mode = options?.mode ?? "deterministic";
  if (mode === "deterministic") return reviewProjectNow(input);

  const materials = materialCardsForReview(input.cards);
  if (materials.length === 0) return reviewProjectNow(input);

  const known = new Set(materials.map((c) => c.id));
  const prompt = [
    `项目：${input.projectName}`,
    "材料（只能引用下列 id）：",
    ...materials
      .slice(0, 20)
      .map(
        (c) =>
          `[${c.id}] ${c.title || c.sourceFileId || "材料"}：${(c.content || "").slice(0, 200)}`,
      ),
    "工作项：",
    ...input.workItems
      .slice(0, 12)
      .map((w) => `${w.status} ${w.title} next=${w.nextStep}`),
    "最近事件：",
    ...input.events
      .slice(0, 8)
      .map((e) => `${e.type}:${e.body}`),
    "只返回 JSON：judgment, gaps[], nextStep, evidenceIds[]。evidenceIds 必须来自材料列表。无材料不得装懂。",
  ].join("\n");

  try {
    const raw = await complete(
      prompt,
      "你只根据提供的项目材料与记录说话。不得编造材料 id。",
      { timeout: 15_000, maxRetries: 1 },
    );
    const parsed = extractJson(raw);
    const judgment = String(parsed.judgment ?? "").trim();
    const nextStep = String(parsed.nextStep ?? "").trim();
    const evidenceIds = Array.isArray(parsed.evidenceIds)
      ? parsed.evidenceIds.map(String).filter((id) => known.has(id))
      : [];
    if (!judgment || evidenceIds.length === 0) {
      return reviewProjectNow(input);
    }
    return {
      status: "ready",
      judgment,
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
      nextStep: nextStep || "打开依据材料核对",
      evidenceIds,
      mode: "model",
    };
  } catch {
    return reviewProjectNow(input);
  }
}
