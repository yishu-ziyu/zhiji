"use client";

import { cn } from "@/lib/utils";
import type {
  FootprintLitEntry,
  FootprintViewMode,
  KnowledgeSource,
  LibraryNode,
} from "@/shared/types/knowledge";
import {
  SOURCE_CLUSTER_LABELS,
  SOURCE_CLUSTER_ORDER,
} from "@/shared/types/knowledge";

type Props = {
  nodes: LibraryNode[];
  lit: FootprintLitEntry[];
  mode: FootprintViewMode;
  litCount: number;
  dimCount: number;
  selectedCardId?: string | null;
  loading?: boolean;
  onModeChange: (mode: FootprintViewMode) => void;
  onSelectCard: (cardId: string) => void;
  workItemModeAvailable?: boolean;
};

const sourceShort: Record<KnowledgeSource, string> = {
  meeting: "会",
  doc: "文",
  chat: "聊",
  email: "邮",
  manual: "记",
};

function depthClass(depth: number, lit: boolean): string {
  if (!lit || depth <= 0) {
    return "opacity-25 border-border/60 bg-surface/40 text-muted-foreground";
  }
  if (depth >= 3) {
    return "opacity-100 border-primary bg-primary/25 text-foreground ring-1 ring-primary/50";
  }
  if (depth === 2) {
    return "opacity-95 border-primary/70 bg-primary/15 text-foreground";
  }
  return "opacity-90 border-primary/40 bg-primary/10 text-foreground";
}

export function KnowledgeFootprintMap({
  nodes,
  lit,
  mode,
  litCount,
  dimCount,
  selectedCardId,
  loading,
  onModeChange,
  onSelectCard,
  workItemModeAvailable,
}: Props) {
  const litMap = new Map(lit.map((e) => [e.cardId, e]));

  return (
    <section
      className="max-w-3xl mx-auto space-y-3 animate-rise"
      data-testid="knowledge-footprint"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="mono-label">Knowledge footprint</p>
          <h2 className="font-hand text-[26px] leading-none mt-1 text-foreground">
            知识足迹
          </h2>
          <p className="font-serif-cn text-[12px] text-muted-foreground mt-1.5">
            亮 = 被检索或使用；暗 = 库里有但当前没用到。
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["current_query", "本次检索"],
              ["window", "最近 7 天"],
              ["work_item", "当前工作项"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              disabled={m === "work_item" && !workItemModeAvailable}
              onClick={() => onModeChange(m)}
              className={cn(
                "rounded-[60px] border px-2.5 py-1 text-[11px] mono-label transition-colors",
                mode === m
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
                m === "work_item" &&
                  !workItemModeAvailable &&
                  "opacity-40 cursor-not-allowed",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mono-label text-[10px]">
        <span>点亮 {litCount}</span>
        <span>未用到 {dimCount}</span>
        <span className="opacity-70">深色描边 = 已挂到工作项</span>
        {loading && <span>更新中…</span>}
      </div>

      <div className="rounded-[16px] border border-border bg-surface/30 p-3 overflow-x-auto">
        <div className="grid grid-cols-5 gap-2 min-w-[520px]">
          {SOURCE_CLUSTER_ORDER.map((source) => {
            const col = nodes.filter((n) => n.source === source);
            return (
              <div key={source} className="space-y-1.5 min-w-0">
                <p className="mono-label text-center text-[10px]">
                  {SOURCE_CLUSTER_LABELS[source]}
                </p>
                <div className="flex flex-col gap-1">
                  {col.length === 0 && (
                    <div className="h-8 rounded-[8px] border border-dashed border-border/50" />
                  )}
                  {col.map((node) => {
                    const entry = litMap.get(node.cardId);
                    const depth = entry?.depth ?? 0;
                    const isLit = depth > 0;
                    return (
                      <button
                        key={node.cardId}
                        type="button"
                        data-testid="footprint-node"
                        data-card-id={node.cardId}
                        data-lit={isLit ? "1" : "0"}
                        data-depth={depth}
                        onClick={() => onSelectCard(node.cardId)}
                        title={node.title}
                        className={cn(
                          "w-full text-left rounded-[10px] border px-1.5 py-1 text-[10px] leading-snug transition-colors",
                          depthClass(depth, isLit),
                          selectedCardId === node.cardId &&
                            "outline outline-1 outline-offset-1 outline-foreground/40",
                        )}
                      >
                        <span className="mono-label mr-0.5">
                          {sourceShort[node.source]}
                        </span>
                        <span className="line-clamp-2 break-all">
                          {node.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
