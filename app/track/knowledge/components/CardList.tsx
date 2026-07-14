"use client";

import { ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KnowledgeSearchHit, KnowledgeSource } from "@/shared/types/knowledge";

type Props = {
  hits: KnowledgeSearchHit[];
  emptyHint?: string;
  query?: string;
};

const sourceLabel: Record<KnowledgeSource, string> = {
  meeting: "会议",
  email: "邮件",
  chat: "聊天",
  doc: "文档",
  manual: "手记",
};

const sourceTone: Record<KnowledgeSource, string> = {
  meeting: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  email: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  chat: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  doc: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  manual: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function matchHint(hit: KnowledgeSearchHit, query?: string): string {
  if (typeof hit.score === "number" && hit.score <= 0) {
    return "无强匹配，展示最近卡片";
  }
  if (!query?.trim()) return "全部结果";
  const tokens = query
    .toLowerCase()
    .split(/[\s,，]+/)
    .filter(Boolean);
  const hay = `${hit.title ?? ""} ${hit.content} ${hit.tags.join(" ")}`.toLowerCase();
  const hitTokens = tokens.filter((t) => hay.includes(t));
  if (hitTokens.length === 0) return `相关度 ${hit.score?.toFixed(1) ?? "-"}`;
  return `命中：${hitTokens.slice(0, 3).join(" · ")}`;
}

export function CardList({ hits, emptyHint, query }: Props) {
  if (hits.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {emptyHint ?? "还没有结果。换个说法，或先沉淀一条卡片。"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span>
          {hits.length} 条结果
          {query?.trim() ? ` · 「${query.trim()}」` : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          每条带来源
        </span>
      </div>

      {hits.map((hit, index) => (
        <Card
          key={hit.id}
          className="p-4 border-border/70 bg-card/90 hover:border-primary/35 transition-colors"
          data-testid="knowledge-card"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-6 h-6 rounded-md bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    sourceTone[hit.source] ?? sourceTone.manual,
                  )}
                >
                  {sourceLabel[hit.source] ?? hit.source}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatTime(hit.timestamp)}
                </span>
                <span className="text-[11px] text-muted-foreground/80">
                  {matchHint(hit, query)}
                </span>
              </div>

              <h3 className="text-[15px] font-semibold text-foreground leading-snug">
                {hit.title || hit.content.slice(0, 40)}
              </h3>
              <p className="text-sm text-foreground/85 leading-relaxed">
                {hit.content}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {hit.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                    {tag}
                  </Badge>
                ))}
                {hit.links.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-1">
                    <Link2 className="w-3 h-3" />
                    关联 {hit.links.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
