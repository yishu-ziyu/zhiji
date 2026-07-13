"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  RefreshCw,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/shared/components/layout/Sidebar";
import type {
  ProviderChangeProposal,
  PublicChangeProject,
} from "@/shared/delivery/change";

const CHANGE_FIXTURE_TEXT =
  "客户：再加一组 A/B 测试，还是周五上，价格先按之前的。";

const money = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});

async function postChange(body: Record<string, unknown>) {
  const response = await fetch("/api/efficiency/changes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown> & {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || "操作失败");
  return data;
}

export default function EfficiencyPage() {
  const [providerSecret, setProviderSecret] = useState("");
  const [project, setProject] = useState<PublicChangeProject | null>(null);
  const [proposal, setProposal] = useState<ProviderChangeProposal | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [useFixture, setUseFixture] = useState(false);
  const [scope, setScope] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [clientUrl, setClientUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = project?.id;

  useEffect(() => {
    if (!projectId || !providerSecret) return;
    const timer = window.setInterval(async () => {
      try {
        const data = await postChange({
          action: "get",
          projectId,
          providerSecret,
        });
        setProject(data.project as PublicChangeProject);
        setProposal(data.proposal as ProviderChangeProposal | null);
      } catch {
        // The next explicit action will show the error; polling stays quiet.
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [projectId, providerSecret]);

  async function seedProject() {
    setLoading(true);
    setError(null);
    try {
      const data = await postChange({ action: "seed" });
      const nextProject = data.project as PublicChangeProject;
      setProject(nextProject);
      setProviderSecret(data.providerSecret as string);
      setProposal(null);
      setSourceText("");
      setUseFixture(false);
      setScope(nextProject.scope);
      setDeliveryDate(nextProject.deliveryMilestone.date);
      setTotalPrice(String(nextProject.totalPriceMinor / 100));
      setClientUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "载入失败");
    } finally {
      setLoading(false);
    }
  }

  async function analyze(fixture: boolean) {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const data = await postChange({
        action: "analyze",
        projectId: project.id,
        providerSecret,
        sourceText,
        fixture,
      });
      const next = data as unknown as ProviderChangeProposal;
      setProposal(next);
      const scopeSuggestion = next.impacts.find(
        (impact) => impact.kind === "scope",
      )?.proposedValue;
      setScope(
        typeof scopeSuggestion === "string"
          ? `${project.scope}，${scopeSuggestion}`
          : project.scope,
      );
      setDeliveryDate(project.deliveryMilestone.date);
      setTotalPrice(String(project.totalPriceMinor / 100));
      setClientUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!project || !proposal) return;
    setLoading(true);
    setError(null);
    try {
      const data = await postChange({
        action: "send",
        projectId: project.id,
        providerSecret,
        proposalId: proposal.id,
        scope,
        deliveryDate,
        totalPriceMinor: Math.round(Number(totalPrice) * 100),
      });
      setProposal(data.proposal as ProviderChangeProposal);
      setClientUrl(data.clientUrl as string);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发送失败");
    } finally {
      setLoading(false);
    }
  }

  async function copyClientUrl() {
    await navigator.clipboard.writeText(clientUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar efficiencyMode="capture" />
      </div>
      <main className="min-w-0 flex-1">
        <header className="border-b border-border bg-[radial-gradient(circle_at_top_left,#25215b_0%,#0a0a0f_45%)] px-4 py-7 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge className="border-indigo-400/30 bg-indigo-400/10 text-indigo-200">
                客户变化处理
              </Badge>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                客户提出变化后，哪些约定要改？
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                对照当前项目，先找出受影响的内容；价格和日期由服务方决定，确认后再更新。
              </p>
            </div>
            <Button onClick={() => void seedProject()} disabled={loading}>
              <RefreshCw />载入演示项目
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
          {!project && (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
              <FileText className="mx-auto size-8 text-indigo-300" />
              <p className="mt-4 text-sm text-muted-foreground">
                先载入一个已有约定的演示项目。
              </p>
            </div>
          )}

          {project && (
            <>
              <section className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
                <ProjectCard project={project} />
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold">客户的新消息</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        这里只提交与变化有关的内容，不读取微信历史。
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSourceText(CHANGE_FIXTURE_TEXT);
                        setUseFixture(true);
                      }}
                    >
                      载入演示消息
                    </Button>
                  </div>
                  <textarea
                    value={sourceText}
                    onChange={(event) => {
                      setSourceText(event.target.value);
                      setUseFixture(false);
                    }}
                    aria-label="客户的新消息"
                    placeholder="粘贴客户的新消息…"
                    className="mt-4 min-h-32 w-full rounded-xl border border-border bg-muted/20 p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={() => void analyze(useFixture)}
                      disabled={loading || !sourceText.trim()}
                    >
                      分析这条消息<ArrowRight />
                    </Button>
                  </div>
                </div>
              </section>

              {proposal && (
                <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div>
                      <h2 className="font-semibold">这条消息会影响什么</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        每条判断都能回到客户原话；不确定的内容留给服务方决定。
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {proposal.impacts.map((impact) => (
                        <article
                          key={impact.kind}
                          className="rounded-xl border border-border bg-muted/15 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-medium">{impact.label}</h3>
                            {impact.proposedValue === null && (
                              <Badge variant="outline" className="text-amber-200">
                                需要服务方决定
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-foreground">
                            {impact.proposedValue === null
                              ? impact.explanation
                              : String(impact.proposedValue)}
                          </p>
                          <p className="mt-3 border-l-2 border-indigo-500/50 pl-3 text-xs text-muted-foreground">
                            原话：{impact.evidence.quote}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {proposal.status === "applied" ? (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                        <h2 className="font-semibold text-emerald-100">客户已确认新方案</h2>
                        <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                          项目已经更新为版本 v{project.version}。后续工作以当前版本为准。
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="font-semibold">服务方提出新方案</h2>
                        <div className="mt-4 space-y-3">
                          <label className="block text-xs text-muted-foreground">
                            新的工作范围
                            <textarea
                              aria-label="新的工作范围"
                              value={scope}
                              onChange={(event) => setScope(event.target.value)}
                              className="mt-1.5 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                            />
                          </label>
                          <label className="block text-xs text-muted-foreground">
                            新的交付日期
                            <input
                              aria-label="新的交付日期"
                              type="date"
                              value={deliveryDate}
                              onChange={(event) => setDeliveryDate(event.target.value)}
                              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                            />
                          </label>
                          <label className="block text-xs text-muted-foreground">
                            新的总价（元）
                            <input
                              aria-label="新的总价（元）"
                              type="number"
                              min={project.paidMinor / 100}
                              step="1"
                              value={totalPrice}
                              onChange={(event) => setTotalPrice(event.target.value)}
                              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                            />
                          </label>
                          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                            已付款 {money.format(project.paidMinor / 100)}；新尾款 {money.format(Math.max(0, Number(totalPrice || 0) - project.paidMinor / 100))}
                          </div>
                        </div>
                        {proposal.clientNote && (
                          <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                            客户要求修改：{proposal.clientNote}
                          </div>
                        )}
                        <Button
                          className="mt-4 w-full"
                          onClick={() => void send()}
                          disabled={loading}
                        >
                          <Send />
                          {proposal.status === "changes_requested"
                            ? "修改后再次发送"
                            : "发送给客户确认"}
                        </Button>
                      </div>
                    )}

                    {clientUrl && proposal.status === "pending_client" && (
                      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5">
                        <h2 className="text-sm font-semibold">客户确认链接</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          链接绑定当前项目版本；服务方再次修改后，旧链接失效。
                        </p>
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 p-2">
                          <code
                            data-testid="client-link"
                            className="min-w-0 flex-1 truncate text-xs text-indigo-200"
                          >
                            {clientUrl}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="复制客户链接"
                            onClick={() => void copyClientUrl()}
                          >
                            {copied ? <Check /> : <Clipboard />}
                          </Button>
                          <Button size="icon" variant="ghost" asChild>
                            <a
                              href={clientUrl}
                              target="_blank"
                              aria-label="打开客户链接"
                            >
                              <ExternalLink />
                            </a>
                          </Button>
                        </div>
                        <p className="mt-2 text-[11px] text-amber-200">
                          这个链接不验证点击者身份，不等同于电子签名。
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {project && project.version > 1 && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-100">
              <Check className="mr-2 inline size-4" />
              交付日期和尾款已同时更新
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ProjectCard({ project }: { project: PublicChangeProject }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{project.clientName}</p>
          <h2 className="mt-1 text-xl font-semibold">{project.title}</h2>
        </div>
        <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
          当前版本 v{project.version}
        </Badge>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <Fact label="工作范围" value={project.scope} />
        <Fact label="交付日期" value={project.deliveryMilestone.date} />
        <Fact label="总价" value={money.format(project.totalPriceMinor / 100)} />
        <Fact
          label="付款"
          value={`已付 ${money.format(project.paidMinor / 100)} · 尾款 ${money.format(project.paymentMilestone.amountMinor / 100)}`}
        />
      </dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
