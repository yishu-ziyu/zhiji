import { getSlipByToken } from "@/shared/delivery/repository";
import { toPublicSlip } from "@/shared/delivery/public-slip";
import { notFound } from "next/navigation";
import { ClientActions } from "./ClientActions";

export const dynamic = "force-dynamic";

export default async function ClientCommitmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const slip = getSlipByToken(token);
  if (!slip) notFound();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e1b4b_0%,#0a0a0f_45%)] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <p className="text-sm font-semibold tracking-wide text-indigo-300">iBot · 交付确认</p>
          <p className="mt-1 text-xs text-muted-foreground">无需登录 · 由你确认事实</p>
        </div>
        <ClientActions token={token} initialSlip={toPublicSlip(slip)} />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          本页面记录协作确认，不替代法律合同或电子签名。
        </p>
      </div>
    </main>
  );
}
