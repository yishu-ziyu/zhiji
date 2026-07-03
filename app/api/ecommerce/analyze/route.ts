import { complete, extractJson } from "@/shared/llm/adapter";
import { buildAnalyzePrompt, ANALYZE_SYSTEM } from "@/shared/llm/prompts/analyze";

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();
    if (!productName || typeof productName !== "string" || productName.trim().length === 0) {
      return Response.json({ error: "请提供商品名称" }, { status: 400 });
    }
    const prompt = buildAnalyzePrompt(productName.trim());
    const text = await complete(prompt, ANALYZE_SYSTEM);
    let result: Record<string, unknown>;
    try { result = extractJson(text); }
    catch { result = { raw: text }; }
    return Response.json(result);
  } catch (error) {
    console.error("/api/ecommerce/analyze error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "分析失败" }, { status: 500 });
  }
}
