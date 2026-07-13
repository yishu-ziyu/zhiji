import { complete, extractJson } from "@/shared/llm/adapter";
import {
  extractCommitmentsMock,
  type FixtureId,
} from "@/shared/delivery/extract-mock";
import type { ExtractCommitmentsResponse, ExtractedCommitment } from "@/shared/delivery/types";
import {
  buildCommitmentsPrompt,
  buildCommitmentsSystem,
} from "@/shared/llm/prompts/commitments";

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function normalizeResponse(raw: Record<string, unknown>): ExtractCommitmentsResponse {
  const commitmentsRaw = Array.isArray(raw.commitments) ? raw.commitments : [];
  const commitments: ExtractedCommitment[] = [];
  for (const item of commitmentsRaw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (!text) continue;
    const kind =
      rec.kind === "soft" || rec.kind === "clarification" || rec.kind === "hard"
        ? rec.kind
        : "hard";
    const priority =
      rec.suggestedPriority === "高" ||
      rec.suggestedPriority === "中" ||
      rec.suggestedPriority === "低"
        ? rec.suggestedPriority
        : undefined;
    const entry: ExtractedCommitment = { text, kind };
    if (typeof rec.sourceExcerpt === "string") {
      entry.sourceExcerpt = rec.sourceExcerpt;
    }
    if (typeof rec.suggestedDeadline === "string") {
      entry.suggestedDeadline = rec.suggestedDeadline;
    }
    if (priority) entry.suggestedPriority = priority;
    commitments.push(entry);
  }

  const risks = Array.isArray(raw.risks)
    ? raw.risks.filter((r): r is string => typeof r === "string")
    : [];

  return {
    summary: typeof raw.summary === "string" ? raw.summary : undefined,
    commitments,
    risks,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      transcript?: string;
      fixture?: string;
      forceMock?: boolean;
    };

    const fixture =
      body.fixture === "dialog-01" ? ("dialog-01" as FixtureId) : undefined;

    if (fixture || body.forceMock === true) {
      const transcript =
        typeof body.transcript === "string" && body.transcript.trim()
          ? body.transcript
          : "";
      return Response.json(
        extractCommitmentsMock(transcript, fixture ?? "dialog-01"),
      );
    }

    const transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return Response.json({ error: "请提供客户对话文本" }, { status: 400 });
    }

    try {
      const text = await complete(
        buildCommitmentsPrompt(transcript),
        buildCommitmentsSystem(todayLocal()),
      );
      const parsed = extractJson(text);
      const normalized = normalizeResponse(parsed);
      if (normalized.commitments.length === 0) {
        return Response.json(extractCommitmentsMock(transcript));
      }
      return Response.json(normalized);
    } catch {
      return Response.json(extractCommitmentsMock(transcript));
    }
  } catch (error) {
    console.error("/api/efficiency/commitments error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "提取承诺失败" },
      { status: 500 },
    );
  }
}
