"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  ExternalLink,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/shared/components/layout/Sidebar";
import { getFixtureTranscript } from "@/shared/delivery/extract-mock";
import { computeMetrics, formatRate, isOverdue } from "@/shared/delivery/metrics";
import {
  DELIVERY_STATUS_LABELS,
  type Commitment,
  type CommitmentSlip,
  type ExtractCommitmentsResponse,
  type ExtractedCommitment,
  type Priority,
} from "@/shared/delivery/types";

type DraftCommitment = Commitment & { acceptanceCriteria: string };
const PROVIDER_TOKEN_KEY = "fc-opc-provider-client-tokens";

function newId(): string {
  return crypto.randomUUID();
}

function toCommitments(extracted: ExtractedCommitment[]): DraftCommitment[] {
  return extracted.map((item) => ({
    id: newId(),
    text: item.text,
    kind: item.kind,
    sourceExcerpt: item.sourceExcerpt,
    accepted: item.kind === "hard",
    suggestedDeadline: item.suggestedDeadline,
    suggestedPriority: item.suggestedPriority,
    acceptanceCriteria: "",
  }));
}

function clientUrl(slip: CommitmentSlip): string | null {
  if (!slip.clientToken || typeof window === "undefined") return null;
  return `${window.location.origin}/c/${slip.clientToken}`;
}

function loadProviderTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PROVIDER_TOKEN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function rememberProviderToken(slip: CommitmentSlip): void {
  if (!slip.clientToken) return;
  localStorage.setItem(
    PROVIDER_TOKEN_KEY,
    JSON.stringify({ ...loadProviderTokens(), [slip.id]: slip.clientToken }),
  );
}

function latestClientNote(slip: CommitmentSlip): string | null {
  return [...slip.history].reverse().find((entry) => entry.actor === "client" && entry.note)?.note ?? null;
}

export default function EfficiencyPage() {
  const [transcript, setTranscript] = useState("");
  const [commitments, setCommitments] = useState<DraftCommitment[]>([]);
  const [risks, setRisks] = useState<string[]>([]);
  const [slips, setSlips] = useState<CommitmentSlip[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshSlips = useCallback(async () => {
    const response = await fetch("/api/efficiency/slips", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { slips: CommitmentSlip[] };
    const tokens = loadProviderTokens();
    setSlips(
      data.slips.map((slip) =>
        tokens[slip.id] ? { ...slip, clientToken: tokens[slip.id] } : slip,
      ),
    );
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshSlips(), 0);
    const timer = window.setInterval(() => void refreshSlips(), 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshSlips]);

  const metrics = useMemo(() => computeMetrics(slips), [slips]);

  const applyExtraction = useCallback((data: ExtractCommitmentsResponse) => {
    if (!data.commitments?.length) {
      setError("没有提取到可执行承诺。请换一段对齐文本或使用演示剧本。");
      setCommitments([]);
      return;
    }
    setError(null);
    setSummary(data.summary ?? null);
    setRisks(data.risks ?? []);
    setCommitments(toCommitments(data.commitments));
  }, []);

  const extract = useCallback(
    async (fixture = false) => {
      const text = fixture ? getFixtureTranscript("dialog-01") : transcript.trim();
      if (!text) {
        setError("请粘贴客户聊天或需求对齐文本");
        return;
      }
      setTranscript(text);
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/efficiency/commitments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fixture ? { fixture: "dialog-01", transcript: text } : { transcript: text }),
        });
        const data = (await response.json()) as ExtractCommitmentsResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "提取失败");
        applyExtraction(data);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "提取失败");
      } finally {
        setLoading(false);
      }
    },
    [applyExtraction, transcript],
  );

  const updateCommitment = useCallback(
    (id: string, patch: Partial<DraftCommitment>) => {
      setCommitments((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [],
  );

  const createDrafts = useCallback(async () => {
    const selected = commitments.filter((item) => item.accepted);
    if (!selected.length) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/efficiency/slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          slips: selected.map((item) => ({
            title: item.text,
            acceptanceCriteria: item.acceptanceCriteria || undefined,
            dueAt: item.suggestedDeadline || undefined,
            priority: item.suggestedPriority || "中",
            sourceExcerpt: item.sourceExcerpt,
          })),
        }),
      });
      const data = (await response.json()) as {
        slips?: CommitmentSlip[];
        error?: string;
      };
      if (!response.ok || !data.slips) throw new Error(data.error || "生成承诺单失败");
      const sent = await Promise.all(
        data.slips.map(async (slip) => {
          const sentResponse = await fetch("/api/efficiency/slips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "send",
              id: slip.id,
              title: slip.title,
              acceptanceCriteria: slip.acceptanceCriteria,
              dueAt: slip.dueAt,
              priority: slip.priority,
            }),
          });
          const sentData = (await sentResponse.json()) as {
            slip?: CommitmentSlip;
            error?: string;
          };
          if (!sentResponse.ok || !sentData.slip) {
            throw new Error(sentData.error || "发送承诺单失败");
          }
          return sentData.slip;
        }),
      );
      sent.forEach(rememberProviderToken);
      setCommitments([]);
      await refreshSlips();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成承诺单失败");
    } finally {
      setLoading(false);
    }
  }, [commitments, refreshSlips]);

  const updateLocalSlip = useCallback((id: string, patch: Partial<CommitmentSlip>) => {
    setSlips((current) => current.map((slip) => (slip.id === id ? { ...slip, ...patch } : slip)));
  }, []);

  const providerAction = useCallback(
    async (slip: CommitmentSlip, action: "update" | "send" | "deliver") => {
      setError(null);
      try {
        const response = await fetch("/api/efficiency/slips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            id: slip.id,
            title: slip.title,
            acceptanceCriteria: slip.acceptanceCriteria,
            dueAt: slip.dueAt,
            priority: slip.priority,
          }),
        });
        const data = (await response.json()) as {
          slip?: CommitmentSlip;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "操作失败");
        if (data.slip) rememberProviderToken(data.slip);
        await refreshSlips();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "操作失败");
      }
    },
    [refreshSlips],
  );

  const copyClientLink = useCallback(async (slip: CommitmentSlip) => {
    const url = clientUrl(slip);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedId(slip.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block"><Sidebar efficiencyMode="capture" /></div>
      <main className="min-w-0 flex-1">
        <header className="border-b border-border bg-[radial-gradient(circle_at_top_left,#25215b_0%,#0a0a0f_42%)] px-4 py-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">双向交付承诺</h1>
                  <Badge className="border-indigo-400/30 bg-indigo-400/10 text-indigo-200">效率 OPC · 演示主线</Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  粘贴一次客户对齐，变成双方都能确认、交付、验收的事实。
                </p>
              </div>
              <Button variant="outline" onClick={() => void refreshSlips()}>
                <RefreshCw />刷新客户状态
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="7 日客户确认率" value={formatRate(metrics.confirmationRate)} detail={`近 30 日同 cohort · ${metrics.confirmedWithinWindow}/${metrics.cohortSize}`} />
              <Metric label="确认耗时中位数" value={metrics.medianConfirmHours === null ? "待积累" : `${Math.round(metrics.medianConfirmHours)}h`} detail="候选指标，不伪造精度" />
              <Metric label="按期验收率" value={metrics.acceptedOnTimeRate === null ? "待积累" : formatRate(metrics.acceptedOnTimeRate)} detail="有计划日期的同 cohort" />
              <Metric label="待处理 / 逾期" value={`${metrics.openCount} / ${metrics.overdueCount}`} detail="服务方当前动作队列" danger={metrics.overdueCount > 0} />
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="text-indigo-300" />1. 提取承诺草稿</div>
              <p className="mt-1 text-xs text-muted-foreground">Web 粘贴，不声称已接入微信。演示剧本完全离线可用。</p>
              <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="粘贴客户聊天 / 需求对齐文本…" className="mt-4 min-h-40 w-full rounded-xl border border-border bg-muted/20 p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void extract(false)} disabled={loading}>{loading ? "处理中…" : "提取承诺"}</Button>
                <Button variant="outline" onClick={() => void extract(true)} disabled={loading}>载入演示对话</Button>
              </div>
              {summary && <p className="mt-3 text-xs text-muted-foreground">场景：{summary}</p>}
              {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
            </div>

            {commitments.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="text-sm font-semibold">2. 服务方审阅草稿</h2><p className="mt-1 text-xs text-muted-foreground">AI 缺失的日期与验收标准明确标为未知，由你补充。</p></div>
                  <Button size="sm" onClick={() => void createDrafts()} disabled={loading || !commitments.some((item) => item.accepted)}>生成并发送给客户</Button>
                </div>
                <div className="mt-4 space-y-3">
                  {commitments.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-muted/15 p-3">
                      <div className="flex gap-3">
                        <input aria-label={`选择 ${item.text}`} type="checkbox" checked={item.accepted} onChange={() => updateCommitment(item.id, { accepted: !item.accepted })} />
                        <div className="min-w-0 flex-1 space-y-2">
                          <input aria-label="承诺标题" value={item.text} onChange={(event) => updateCommitment(item.id, { text: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                          <input aria-label="验收标准" value={item.acceptanceCriteria} onChange={(event) => updateCommitment(item.id, { acceptanceCriteria: event.target.value })} placeholder="验收标准：未知（可补充）" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                          <div className="grid grid-cols-2 gap-2">
                            <input aria-label="计划日期" type="date" value={item.suggestedDeadline ?? ""} onChange={(event) => updateCommitment(item.id, { suggestedDeadline: event.target.value || undefined })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                            <select aria-label="优先级" value={item.suggestedPriority ?? "中"} onChange={(event) => updateCommitment(item.id, { suggestedPriority: event.target.value as Priority })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option>高</option><option>中</option><option>低</option></select>
                          </div>
                          {item.sourceExcerpt && <p className="text-xs text-muted-foreground">原文：{item.sourceExcerpt}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {risks.length > 0 && <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100"><div className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle />待澄清</div>{risks.map((risk) => <p key={risk}>· {risk}</p>)}</div>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">3. 双方交付队列</h2><p className="mt-1 text-xs text-muted-foreground">客户确认与验收只能从客户链接完成。</p></div><span className="text-xs text-muted-foreground">{slips.length} 张</span></div>
            <div className="mt-4 space-y-3">
              {slips.map((slip) => <SlipCard key={slip.id} slip={slip} copied={copiedId === slip.id} onChange={updateLocalSlip} onAction={providerAction} onCopy={copyClientLink} />)}
              {slips.length === 0 && <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">先载入演示对话，生成第一张承诺单。</div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? "border-red-500/35 bg-red-500/10" : "border-white/10 bg-black/20"}`}><p className="text-xs text-muted-foreground">{label} · 候选</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>;
}

function SlipCard({ slip, copied, onChange, onAction, onCopy }: { slip: CommitmentSlip; copied: boolean; onChange: (id: string, patch: Partial<CommitmentSlip>) => void; onAction: (slip: CommitmentSlip, action: "update" | "send" | "deliver") => Promise<void>; onCopy: (slip: CommitmentSlip) => Promise<void> }) {
  const editable = slip.status === "draft" || slip.status === "client_requested_changes";
  const url = clientUrl(slip);
  const clientNote = latestClientNote(slip);
  return (
    <article className={`rounded-xl border p-4 ${isOverdue(slip) ? "border-red-500/40" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3"><Badge variant="outline">{DELIVERY_STATUS_LABELS[slip.status]}</Badge><span className="text-xs text-muted-foreground">{slip.dueAt || "日期未知"}</span></div>
      {editable ? <div className="mt-3 space-y-2"><input aria-label="承诺单标题" value={slip.title} onChange={(event) => onChange(slip.id, { title: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium" /><input aria-label="承诺单验收标准" value={slip.acceptanceCriteria ?? ""} onChange={(event) => onChange(slip.id, { acceptanceCriteria: event.target.value })} placeholder="验收标准：未知" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div> : <div className="mt-3"><h3 className="font-medium">{slip.title}</h3><p className="mt-1 text-xs text-muted-foreground">验收标准：{slip.acceptanceCriteria || "未知"}</p></div>}
      {clientNote && <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-100">客户说明：{clientNote}</div>}
      {url && <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/30 p-2"><code className="min-w-0 flex-1 truncate text-xs text-indigo-200">{url}</code><Button size="icon" variant="ghost" aria-label="复制客户链接" onClick={() => void onCopy(slip)}>{copied ? <Check /> : <Clipboard />}</Button><Button size="icon" variant="ghost" asChild><a href={url} target="_blank" aria-label="打开客户链接"><ExternalLink /></a></Button></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {editable && <><Button size="sm" variant="outline" onClick={() => void onAction(slip, "update")}>保存草稿</Button><Button size="sm" onClick={() => void onAction(slip, "send")}><Send />{slip.status === "draft" ? "发送给客户" : "更新并重发"}</Button></>}
        {(slip.status === "client_confirmed" || slip.status === "client_rejected") && <Button size="sm" onClick={() => void onAction(slip, "deliver")}>标记已交付</Button>}
        {slip.status === "pending_client_confirm" && <span className="self-center text-xs text-muted-foreground">等待客户确认，服务方不能代点。</span>}
        {slip.status === "provider_delivered" && <span className="self-center text-xs text-muted-foreground">等待客户验收。</span>}
        {slip.status === "client_accepted" && <span className="flex items-center gap-1 text-xs text-emerald-300"><Check />双方闭环</span>}
      </div>
    </article>
  );
}
