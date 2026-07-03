import { complete, extractJson } from "@/shared/llm/adapter";
import { buildScriptPrompt, SCRIPT_SYSTEM } from "@/shared/llm/prompts/script";

export async function POST(request: Request) {
  try {
    const { productName, style } = await request.json();

    if (!productName || typeof productName !== "string" || productName.trim().length === 0) {
      return Response.json({ error: "请提供商品名称" }, { status: 400 });
    }

    const prompt = buildScriptPrompt(productName.trim(), style);
    const text = await complete(prompt, SCRIPT_SYSTEM);

    let result: Record<string, unknown>;
    try {
      result = extractJson(text);
    } catch {
      result = { raw: text };
    }

    return Response.json(result);
  } catch (error) {
    console.error("/api/ecommerce/script error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "生成脚本失败" },
      { status: 500 },
    );
  }
}
