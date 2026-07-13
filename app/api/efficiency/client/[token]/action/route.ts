import { applyClientAction } from "@/shared/delivery/repository";

const actions = new Set(["confirm", "request_changes", "accept", "reject"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.action !== "string" || !actions.has(body.action)) {
      throw new Error("客户动作无效");
    }
    const slip = applyClientAction(
      token,
      body.action as "confirm" | "request_changes" | "accept" | "reject",
      typeof body.note === "string" ? body.note : undefined,
    );
    const publicSlip = { ...slip };
    delete publicSlip.clientToken;
    return Response.json({ slip: publicSlip });
  } catch (error) {
    const message = error instanceof Error ? error.message : "客户操作失败";
    return Response.json(
      { error: message },
      { status: message.includes("无效") ? 404 : 400 },
    );
  }
}
