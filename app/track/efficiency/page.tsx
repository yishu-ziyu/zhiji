"use client";

import { Sidebar } from "@/shared/components/layout/Sidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DELIVERY_COLUMNS,
  DELIVERY_STATUS_LABELS,
  type Commitment,
  type DeliveryStatus,
  type DeliveryTask,
  type ExtractCommitmentsResponse,
  type ExtractedCommitment,
  type Priority,
} from "@/shared/delivery/types";
import { canTransition } from "@/shared/delivery/state-machine";
import {
  computeMetrics,
  formatClosedLoopRate,
  isOverdue,
} from "@/shared/delivery/metrics";
import {
  emptyStore,
  loadDeliveryStore,
  saveDeliveryStore,
} from "@/shared/delivery/storage";
import { getFixtureTranscript } from "@/shared/delivery/extract-mock";
import { AlertTriangle, CheckCircle2, Target } from "lucide-react";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toCommitments(extracted: ExtractedCommitment[]): Commitment[] {
  return extracted.map((item) => ({
    id: newId("cm"),
    text: item.text,
    kind: item.kind,
    sourceExcerpt: item.sourceExcerpt,
    accepted: item.kind === "hard",
    suggestedDeadline: item.suggestedDeadline,
    suggestedPriority: item.suggestedPriority,
  }));
}

function MetricsStrip({
  rateLabel,
  overdue,
  open,
  confirmed,
  period,
}: {
  rateLabel: string;
  overdue: number;
  open: number;
  confirmed: number;
  period: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
      <div className="rounded-xl border border-primary/35 bg-gradient-to-br from-primary/15 to-primary/5 px-3.5 py-3 shadow-sm shadow-primary/10">
        <div className="text-primary/80 font-medium tracking-wide">闭环率</div>
        <div className="mt-1 text-2xl font-bold text-foreground tabular-nums tracking-tight">
          {rateLabel}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {confirmed}/{period} 已确认交付
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card/80 px-3.5 py-3">
        <div className="text-muted-foreground">未确认</div>
        <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
          {open}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">仍在管道中</div>
      </div>
      <div
        className={cn(
          "rounded-xl border px-3.5 py-3",
          overdue > 0
            ? "border-red-500/45 bg-red-500/10"
            : "border-border bg-card/80",
        )}
      >
        <div className={overdue > 0 ? "text-red-300/90" : "text-muted-foreground"}>
          逾期
        </div>
        <div
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            overdue > 0 ? "text-red-400" : "text-foreground",
          )}
        >
          {overdue}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">须今日处理</div>
      </div>
      <div className="rounded-xl border border-border bg-card/80 px-3.5 py-3">
        <div className="text-muted-foreground">北极星定义</div>
        <div className="mt-1.5 text-[11px] font-medium text-foreground leading-snug">
          客户确认 ÷ 本期新增承诺
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">可复盘、可比较</div>
      </div>
    </div>
  );
}

function CommitmentReview({
  commitments,
  risks,
  onToggle,
  onAccept,
  disabled,
}: {
  commitments: Commitment[];
  risks: string[];
  onToggle: (id: string) => void;
  onAccept: () => void;
  disabled: boolean;
}) {
  if (commitments.length === 0) return null;
  const acceptedCount = commitments.filter((c) => c.accepted).length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">承诺审阅</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            勾选可执行承诺后生成任务。散文总结不算成功。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onAccept}
          disabled={disabled || acceptedCount === 0}
        >
          采纳并生成任务 ({acceptedCount})
        </Button>
      </div>
      <ul className="space-y-2">
        {commitments.map((c) => (
          <li
            key={c.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={c.accepted}
              onChange={() => onToggle(c.id)}
              aria-label={`采纳 ${c.text}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-foreground">{c.text}</span>
                <Badge
                  className={cn(
                    "text-[10px]",
                    c.kind === "hard" &&
                      "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                    c.kind === "soft" &&
                      "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
                    c.kind === "clarification" &&
                      "bg-orange-500/15 text-orange-300 border-orange-500/30",
                  )}
                >
                  {c.kind === "hard"
                    ? "硬承诺"
                    : c.kind === "soft"
                      ? "软偏好"
                      : "待澄清"}
                </Badge>
              </div>
              {c.sourceExcerpt && (
                <p className="text-xs text-muted-foreground mt-1">
                  原文：{c.sourceExcerpt}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {risks.length > 0 && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-100/90 space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            风险 / 待澄清
          </div>
          {risks.map((r) => (
            <div key={r}>· {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryBoard({
  tasks,
  onStatusChange,
}: {
  tasks: DeliveryTask[];
  onStatusChange: (id: string, status: DeliveryStatus) => void;
}) {
  const now = useMemo(() => new Date(), []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">交付看板</h2>
        <span className="text-xs text-muted-foreground">
          {tasks.length} 个任务
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {DELIVERY_COLUMNS.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div
              key={status}
              className="flex-1 min-w-[220px] rounded-xl border border-border bg-muted/20"
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="text-xs font-medium text-muted-foreground">
                  {DELIVERY_STATUS_LABELS[status]}
                  <span className="ml-1.5 text-muted-foreground/60">
                    {colTasks.length}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {colTasks.map((task) => {
                  const overdue = isOverdue(task, now);
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "bg-card border rounded-lg p-3 space-y-2",
                        overdue
                          ? "border-red-500/40"
                          : "border-border",
                      )}
                    >
                      <p className="text-sm text-foreground leading-snug">
                        {task.title}
                      </p>
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {task.deadline && (
                          <span className={overdue ? "text-red-400" : undefined}>
                            截止：{task.deadline}
                            {overdue ? " · 逾期" : ""}
                          </span>
                        )}
                        <span>优先级：{task.priority}</span>
                      </div>
                      <select
                        value={task.status}
                        onChange={(e) =>
                          onStatusChange(
                            task.id,
                            e.target.value as DeliveryStatus,
                          )
                        }
                        className="w-full text-xs bg-muted border border-border rounded px-1.5 py-1 text-foreground cursor-pointer"
                      >
                        {DELIVERY_COLUMNS.map((s) => (
                          <option
                            key={s}
                            value={s}
                            disabled={
                              s !== task.status &&
                              !canTransition(task.status, s)
                            }
                          >
                            {DELIVERY_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6 opacity-50">
                    暂无任务
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EfficiencyPage() {
  const [transcript, setTranscript] = useState("");
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [risks, setRisks] = useState<string[]>([]);
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [periodNew, setPeriodNew] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const store = loadDeliveryStore();
    setCommitments(store.commitments);
    setTasks(store.tasks);
    setPeriodNew(store.periodNewCommitments);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDeliveryStore({
      version: 1,
      commitments,
      tasks,
      periodNewCommitments: periodNew,
    });
  }, [commitments, tasks, periodNew, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (
      window as unknown as {
        __setEfficiencyMode?: (m: string) => void;
        __runDeliveryDemo?: () => void;
      }
    ).__setEfficiencyMode = () => {
      /* workbench is single-page; hook kept for e2e compatibility */
    };
  }, []);

  const metrics = useMemo(
    () => computeMetrics(tasks, periodNew),
    [tasks, periodNew],
  );

  const applyExtraction = useCallback((data: ExtractCommitmentsResponse) => {
    if (!data.commitments || data.commitments.length === 0) {
      setError("未提取到可执行承诺。散文总结不算成功，请换一段对话或用剧本。");
      setCommitments([]);
      setRisks(data.risks ?? []);
      setSummary(data.summary ?? null);
      return;
    }
    setError(null);
    setSummary(data.summary ?? null);
    setRisks(data.risks ?? []);
    setCommitments(toCommitments(data.commitments));
  }, []);

  const runFixtureDemo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const text = getFixtureTranscript("dialog-01");
      setTranscript(text);
      const res = await fetch("/api/efficiency/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixture: "dialog-01", transcript: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "剧本加载失败",
        );
      }
      const data = (await res.json()) as ExtractCommitmentsResponse;
      applyExtraction(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "剧本加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [applyExtraction]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (
      window as unknown as { __runDeliveryDemo?: () => void }
    ).__runDeliveryDemo = () => {
      void runFixtureDemo();
    };
  }, [runFixtureDemo]);

  const extractFromTranscript = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      setError("请粘贴客户对话，或使用客户对话剧本");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/efficiency/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "提取失败",
        );
      }
      const data = (await res.json()) as ExtractCommitmentsResponse;
      applyExtraction(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失败");
    } finally {
      setIsLoading(false);
    }
  }, [transcript, applyExtraction]);

  const toggleCommitment = useCallback((id: string) => {
    setCommitments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, accepted: !c.accepted } : c)),
    );
  }, []);

  const acceptCommitments = useCallback(() => {
    const accepted = commitments.filter((c) => c.accepted);
    if (accepted.length === 0) return;
    const nowIso = new Date().toISOString();
    const newTasks: DeliveryTask[] = accepted.map((c) => ({
      id: newId("task"),
      commitmentId: c.id,
      title: c.text,
      status: "captured" as const,
      deadline: c.suggestedDeadline,
      priority: (c.suggestedPriority ?? "中") as Priority,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
    setTasks((prev) => [...newTasks, ...prev]);
    setPeriodNew((n) => n + accepted.length);
    setCommitments((prev) => prev.filter((c) => !c.accepted));
  }, [commitments]);

  const moveTask = useCallback((id: string, next: DeliveryStatus) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (!canTransition(t.status, next) && t.status !== next) return t;
        return {
          ...t,
          status: next,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const resetAll = useCallback(() => {
    const empty = emptyStore();
    setCommitments(empty.commitments);
    setTasks(empty.tasks);
    setPeriodNew(0);
    setRisks([]);
    setSummary(null);
    setError(null);
    setTranscript("");
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar
        track="efficiency"
        ecommerceMode="analyze"
        efficiencyMode="capture"
        onTrackChange={() => {}}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-foreground">
                  交付运营助手
                </h1>
                <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/20">
                  参赛主线 · 效率 OPC
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                客户对话 → 承诺捕获 → 交付确认。北极星：闭环率。
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetAll}
              >
                清空
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={runFixtureDemo}
                disabled={isLoading}
              >
                <Target className="w-3.5 h-3.5 mr-1" />
                使用客户对话剧本
              </Button>
            </div>
          </div>
          <MetricsStrip
            rateLabel={formatClosedLoopRate(metrics.closedLoopRate)}
            overdue={metrics.overdueCount}
            open={metrics.openCount}
            confirmed={metrics.confirmedCount}
            period={metrics.periodNewCommitments}
          />
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              捕获客户承诺
            </div>
            {summary && (
              <p className="text-xs text-muted-foreground">场景：{summary}</p>
            )}
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="粘贴客户微信/会议对齐文本……或点上方「使用客户对话剧本」"
              className="w-full min-h-[120px] rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={extractFromTranscript}
                disabled={isLoading}
              >
                {isLoading ? "提取中…" : "提取承诺"}
              </Button>
              <p className="text-xs text-muted-foreground self-center">
                剧本路径不依赖外网；粘贴文本可走 LLM，失败自动 mock。
              </p>
            </div>
            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
          </section>

          <CommitmentReview
            commitments={commitments}
            risks={risks}
            onToggle={toggleCommitment}
            onAccept={acceptCommitments}
            disabled={isLoading}
          />

          <DeliveryBoard tasks={tasks} onStatusChange={moveTask} />
        </div>
      </main>
    </div>
  );
}
