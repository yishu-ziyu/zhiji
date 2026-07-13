import { getSlipByToken } from "@/shared/delivery/repository";
import { toPublicSlip } from "@/shared/delivery/public-slip";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const slip = getSlipByToken(token);
  if (!slip) {
    return Response.json({ error: "客户链接无效或已失效" }, { status: 404 });
  }
  return Response.json({ slip: toPublicSlip(slip) });
}
