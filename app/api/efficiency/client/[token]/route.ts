import { getSlipByToken } from "@/shared/delivery/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const slip = getSlipByToken(token);
  if (!slip) {
    return Response.json({ error: "客户链接无效或已失效" }, { status: 404 });
  }
  const publicSlip = { ...slip };
  delete publicSlip.clientToken;
  return Response.json({ slip: publicSlip });
}
