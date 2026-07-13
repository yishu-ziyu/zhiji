import {
  ChangeError,
  confirmClientChange,
  getClientChange,
  requestClientChange,
} from "@/shared/delivery/change";

function errorResponse(error: unknown) {
  if (error instanceof ChangeError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("client change route failed", error);
  return Response.json({ error: "服务暂时不可用，请稍后重试" }, { status: 500 });
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    return Response.json({ change: getClientChange(token) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await parseJsonObject(request);
    if (body.action === "confirm") {
      const result = confirmClientChange(token);
      return Response.json({ change: getClientChange(token), project: result.project });
    }
    if (body.action === "request_changes") {
      return Response.json({
        change: requestClientChange(
          token,
          typeof body.note === "string" ? body.note : undefined,
        ),
      });
    }
    throw new ChangeError("客户操作无效", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
