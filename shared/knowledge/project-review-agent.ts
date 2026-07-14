import { complete, extractJson } from "@/shared/llm/adapter";
import type {
  ActionItem,
  KnowledgeCard,
  WorkEvent,
} from "@/shared/types/knowledge";

export type ProjectReviewResult = {
  judgment: string;
  gaps: string[];
  nextStep: string;
  evidenceIds: string[];
  mode: "model" | "deterministic";
};

type ReviewInput = {
  item: ActionItem;
  evidence: KnowledgeCard[];
  events: WorkEvent[];
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
