import type { KnowledgeCard, WorkEvent } from "@/shared/types/knowledge";

export type ResultCandidateInput = {
  projectId: string;
  resultEvent: WorkEvent;
  evidence: KnowledgeCard[];
};

export type ResultCandidateCard = Omit<KnowledgeCard, "id"> & {
  identity: "candidate";
  resultEventLocator: string;
};

/** Pure projection: an Agent result remains a project-local candidate. */
export function projectResultToCandidateCard(
  input: ResultCandidateInput,
): ResultCandidateCard {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("项目 ID 无效");
  if (input.resultEvent.type !== "result") {
    throw new Error("只有 result 事件可以生成候选知识");
  }

  const eventId = input.resultEvent.id.trim();
  const content = input.resultEvent.body.trim();
  if (!eventId) throw new Error("结果事件 ID 无效");
  if (!content) throw new Error("结果事件内容不能为空");

  const links = [
    ...new Set(
      input.evidence
        .filter((card) => card.projectId === projectId)
        .map((card) => card.id)
        .filter(Boolean),
    ),
  ];

  return {
    projectId,
    content,
    source: "manual",
    tags: ["agent-result", "candidate"],
    timestamp: input.resultEvent.createdAt,
    links,
    title: "Agent 结果候选",
    identity: "candidate",
    resultEventLocator: `event:${eventId}`,
  };
}
