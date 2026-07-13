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
  if (error instanceof ChangeError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("customer change route failed", error);
  return Response.json({ error: "服务暂时不可用，请稍后重试" }, { status: 500 });
}

function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ChangeError(`缺少 ${key}`, 400);
  }
  return value;
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ChangeError("请求内容不是合法的 JSON", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ChangeError("请求内容必须是 JSON 对象", 400);
  }
  return body as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonObject(request);
    if (body.action === "seed") {
      return Response.json(createDemoProject(), { status: 201 });
    }

    if (body.action === "confirm") {
      throw new ChangeError("服务方接口不能执行客户确认", 400);
    }

    const projectId = requiredString(body, "projectId");
    const providerSecret = requiredString(body, "providerSecret");

    if (body.action === "get") {
      const state = getProviderChange(projectId, providerSecret);
      return Response.json({
        project: state.project,
        proposal: state.proposal,
        clientUrl: state.clientToken
          ? `${new URL(request.url).origin}/c/${state.clientToken}`
          : undefined,
      });
    }

    if (body.action === "analyze") {
      const sourceText = requiredString(body, "sourceText");
      if (body.fixture === true) {
        return Response.json(
          analyzeFixtureChange(projectId, providerSecret, sourceText),
        );
      }

      const { project } = getProviderChange(projectId, providerSecret);
      let parsed: Record<string, unknown>;
      try {
        const text = await complete(
          buildChangePrompt(project, sourceText),
          CHANGE_SYSTEM,
          { timeout: 12_000, maxRetries: 1 },
        );
        parsed = extractJson(text);
      } catch (error) {
        console.error("customer change analysis failed", error);
        throw new ChangeError("AI 分析失败，请稍后重试", 502);
      }
      for (const key of [
        "scopeChange",
        "scopeQuote",
        "deliveryQuote",
        "priceQuote",
      ]) {
        if (typeof parsed[key] !== "string") {
          throw new ChangeError("AI 返回的内容格式不完整", 422);
        }
      }
      if (
        ![parsed.scopeQuote, parsed.deliveryQuote, parsed.priceQuote].some(
          (value) => typeof value === "string" && value.trim(),
        )
      ) {
        throw new ChangeError("AI 没有给出可核对的原文依据", 422);
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
