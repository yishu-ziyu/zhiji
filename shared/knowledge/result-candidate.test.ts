import { describe, expect, it } from "vitest";
import type { KnowledgeCard, WorkEvent } from "@/shared/types/knowledge";
import { projectResultToCandidateCard } from "./result-candidate";

describe("result candidate projection", () => {
  it("projects one Agent result into a candidate linked only to same-project evidence", () => {
    const resultEvent: WorkEvent = {
      id: "event-result-1",
      workItemId: "work-1",
      type: "result",
      actor: "agent:project-reviewer",
      body: "当前判断：项目可以继续推进。",
      createdAt: "2026-07-16T09:00:00.000Z",
    };
    const evidence: KnowledgeCard = {
      id: "card-local",
      projectId: "project-a",
      content: "本项目依据",
      source: "doc",
      tags: [],
      timestamp: "2026-07-16T08:00:00.000Z",
      links: [],
    };
    const foreignEvidence: KnowledgeCard = {
      ...evidence,
      id: "card-foreign",
      projectId: "project-b",
    };

    const candidate = projectResultToCandidateCard({
      projectId: "project-a",
      resultEvent,
      evidence: [evidence, foreignEvidence, evidence],
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        projectId: "project-a",
        identity: "candidate",
        resultEventLocator: "event:event-result-1",
        content: resultEvent.body,
        links: ["card-local"],
      }),
    );
    expect(candidate.identity).not.toBe("claim");
  });
});
