import {
  analyzeFixtureChange,
  ChangeError,
  createChangeDraft,
  createDemoProject,
  getProviderChange,
  sendChangeToClient,
} from "@/shared/delivery/change";
import { complete, extractJson } from "@/shared/llm/adapter";
import {
  buildChangePrompt,
  CHANGE_SYSTEM,
} from "@/shared/llm/prompts/change";

function errorResponse(error: unknown) {
  const status = error instanceof ChangeError ? error.status : 400;
  return Response.json(
    { error: error instanceof Error ? error.message : "操作失败" },
    { status },
  );
}

function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ChangeError(`缺少 ${key}`, 400);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "seed") {
      return Response.json(createDemoProject(), { status: 201 });
    }

    if (body.action === "confirm") {
      throw new ChangeError("服务方接口不能执行客户确认", 400);
    }

    const projectId = requiredString(body, "projectId");
    const providerSecret = requiredString(body, "providerSecret");

    if (body.action === "get") {
      return Response.json(getProviderChange(projectId, providerSecret));
    }

    if (body.action === "analyze") {
      const sourceText = requiredString(body, "sourceText");
      if (body.fixture === true) {
        return Response.json(
          analyzeFixtureChange(projectId, providerSecret, sourceText),
        );
      }

      const { project } = getProviderChange(projectId, providerSecret);
      const text = await complete(
        buildChangePrompt(project, sourceText),
        CHANGE_SYSTEM,
        { timeout: 12_000, maxRetries: 1 },
      );
      const parsed = extractJson(text);
      for (const key of [
        "scopeChange",
        "scopeQuote",
        "deliveryQuote",
        "priceQuote",
      ]) {
        if (typeof parsed[key] !== "string" || !parsed[key]) {
          throw new ChangeError("AI 没有给出可核对的原文依据", 422);
        }
      }
      return Response.json(
        createChangeDraft({
          projectId,
          providerSecret,
          sourceText,
          scopeChange: parsed.scopeChange as string,
          scopeQuote: parsed.scopeQuote as string,
          deliveryQuote: parsed.deliveryQuote as string,
          priceQuote: parsed.priceQuote as string,
        }),
      );
    }

    if (body.action === "send") {
      const totalPriceMinor = body.totalPriceMinor;
      if (!Number.isSafeInteger(totalPriceMinor)) {
        throw new ChangeError("总价格式错误", 400);
      }
      const sent = sendChangeToClient({
        proposalId: requiredString(body, "proposalId"),
        providerSecret,
        scope: requiredString(body, "scope"),
        deliveryDate: requiredString(body, "deliveryDate"),
        totalPriceMinor: totalPriceMinor as number,
      });
      return Response.json({
        proposal: sent.proposal,
        clientUrl: `${new URL(request.url).origin}/c/${sent.clientToken}`,
      });
    }

    throw new ChangeError("服务方操作无效", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
