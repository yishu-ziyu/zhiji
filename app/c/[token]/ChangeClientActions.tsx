"use client";

import { useState } from "react";
import { Check, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClientChangeView } from "@/shared/delivery/change";

const money = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});

export function ChangeClientActions({
  token,
  initialChange,
}: {
  token: string;
  initialChange: ClientChangeView;
}) {
  const [change, setChange] = useState(initialChange);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "request_changes") {
    if (action === "request_changes" && !note.trim()) {
      setError("请填写需要修改的内容");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/efficiency/changes/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = (await response.json()) as {
        change?: ClientChangeView;
        error?: string;
      };
      if (!response.ok || !data.change) {
        throw new Error(data.error || "操作失败");
      }
      setChange(data.change);
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
        <div className="border-b border-border bg-indigo-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-indigo-200">
              第 {change.revision} 次发送
            </span>
            <Badge variant="outline" className="border-amber-400/40 text-amber-200">
              身份未验证
            </Badge>
          </div>
          <h1 className="mt-4 break-words text-2xl font-semibold leading-tight">
            {change.projectTitle}：新方案
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            请核对变化后的工作、交付日期和尾款。
          </p>
        </div>

        <div className="space-y-5 p-5">
          <Comparison
            label="工作范围"
            oldValue={change.oldVersion.scope}
            newValue={change.newVersion.scope}
          />
          <Comparison
            label="交付日期"
            oldValue={change.oldVersion.deliveryDate}
            newValue={change.newVersion.deliveryDate}
          />
          <Comparison
            label="尾款"
            oldValue={money.format(change.oldVersion.finalPaymentMinor / 100)}
            newValue={money.format(change.newVersion.finalPaymentMinor / 100)}
          />

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FileText className="size-4" />
              客户原消息
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-foreground">
              {change.sourceText}
            </p>
          </div>
        </div>
      </section>

      {change.status === "pending_client" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <label htmlFor="change-note" className="text-xs text-muted-foreground">
            需要修改的内容（要求修改时必填）
          </label>
          <Textarea
            id="change-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setError(null);
            }}
            className="mt-2 min-h-24 resize-y rounded-xl bg-muted/30 text-sm"
            placeholder="例如：交付日期改为 7 月 21 日"
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void act("request_changes")}
            >
              要求修改
            </Button>
            <Button disabled={loading} onClick={() => void act("confirm")}>
              确认新方案
            </Button>
          </div>
        </section>
      )}

      {change.status === "applied" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-100">
          <Check className="mr-2 inline size-4" />
          新方案已生效
        </div>
      )}

      {change.status === "changes_requested" && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
          修改意见已发送，服务方需要修改后重新发送。
        </div>
      )}

      {error && change.status !== "pending_client" && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

function Comparison({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: string;
  newValue: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">
        {oldValue} → {newValue}
      </p>
    </div>
  );
}
