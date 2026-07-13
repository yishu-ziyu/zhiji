"use client";

import { Button } from "@/components/ui/button";
import { DELIVERY_STATUS_LABELS, type CommitmentSlip } from "@/shared/delivery/types";
import { useCallback, useEffect, useState } from "react";

export function ClientActions({
  token,
  initialSlip,
}: {
  token: string;
  initialSlip: CommitmentSlip;
}) {
  const [slip, setSlip] = useState(initialSlip);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/efficiency/client/${token}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { slip: CommitmentSlip };
    setSlip(data.slip);
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function act(action: "confirm" | "request_changes" | "accept" | "reject") {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/efficiency/client/${token}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = (await response.json()) as {
        slip?: CommitmentSlip;
        error?: string;
      };
      if (!response.ok || !data.slip) throw new Error(data.error || "操作失败");
      setSlip(data.slip);
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  const awaitingConfirm = slip.status === "pending_client_confirm";
  const awaitingAcceptance = slip.status === "provider_delivered";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-indigo-300">双方交付承诺单</span>
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {DELIVERY_STATUS_LABELS[slip.status]}
          </span>
        </div>
        <h1 className="mt-5 text-2xl font-semibold leading-tight text-foreground">
          {slip.title}
        </h1>
        <dl className="mt-6 grid gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">验收标准</dt>
            <dd className="mt-1 text-foreground">
              {slip.acceptanceCriteria || "未知 — 请在确认前与服务方补充"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">计划日期</dt>
            <dd className="mt-1 text-foreground">{slip.dueAt || "未知"}</dd>
          </div>
          {slip.sourceExcerpt && (
            <div>
              <dt className="text-xs text-muted-foreground">对齐原文</dt>
              <dd className="mt-1 border-l-2 border-indigo-500/50 pl-3 text-muted-foreground">
                {slip.sourceExcerpt}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {(awaitingConfirm || awaitingAcceptance) && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <label className="text-xs text-muted-foreground" htmlFor="client-note">
            {awaitingConfirm ? "修改说明（要求修改时必填）" : "拒收说明（拒收时必填）"}
          </label>
          <textarea
            id="client-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-xl border border-border bg-muted/30 p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="把需要调整的地方说清楚，双方少一次来回"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void act(awaitingConfirm ? "request_changes" : "reject")}
            >
              {awaitingConfirm ? "要求修改" : "拒收"}
            </Button>
            <Button
              disabled={loading}
              onClick={() => void act(awaitingConfirm ? "confirm" : "accept")}
            >
              {awaitingConfirm ? "确认承诺" : "确认验收"}
            </Button>
          </div>
        </div>
      )}

      {!awaitingConfirm && !awaitingAcceptance && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm text-emerald-100">
          {slip.status === "client_confirmed" && "承诺已确认，等待服务方交付。"}
          {slip.status === "client_requested_changes" && "修改意见已发送，等待服务方更新后重发。"}
          {slip.status === "client_accepted" && "验收完成，这张承诺单已闭环。"}
          {slip.status === "client_rejected" && "拒收说明已发送，等待服务方重新交付。"}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
