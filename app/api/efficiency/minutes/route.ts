import { complete, extractJson } from "@/shared/llm/adapter";
import { buildMinutesPrompt, MINUTES_SYSTEM } from "@/shared/llm/prompts/minutes";

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return Response.json({ error: "请提供会议记录文本" }, { status: 400 });
    }

    const prompt = buildMinutesPrompt(transcript.trim());
    const text = await complete(prompt, MINUTES_SYSTEM);

    let result: Record<string, unknown>;
    try {
      result = extractJson(text);
    } catch {
      result = { raw: text };
    }

    return Response.json(result);
  } catch (error) {
    console.error("/api/efficiency/minutes error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "生成纪要失败" },
      { status: 500 },
    );
  }
}
