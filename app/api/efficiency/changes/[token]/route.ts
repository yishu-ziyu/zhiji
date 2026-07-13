import {
  ChangeError,
  confirmClientChange,
  getClientChange,
  requestClientChange,
} from "@/shared/delivery/change";

function errorResponse(error: unknown) {
  const status = error instanceof ChangeError ? error.status : 400;
  return Response.json(
    { error: error instanceof Error ? error.message : "操作失败" },
    { status },
  );
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
    const body = (await request.json()) as Record<string, unknown>;
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
