import { complete } from "@/shared/llm/adapter";

export async function POST(request: Request) {
  try {
    const { prompt, systemPrompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "请提供 prompt" }, { status: 400 });
    }

    const text = await complete(prompt, systemPrompt);
    return Response.json({ text });
  } catch (error) {
    console.error("/api/llm/completions error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "LLM error" },
      { status: 500 },
    );
  }
}
