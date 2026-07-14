"use client";

import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnySearchHit } from "@/shared/anysearch/client";

type Props = {
  hits: AnySearchHit[];
  loading?: boolean;
  authMode?: "api_key" | "anonymous";
  elapsedMs?: number;
  onIngest: (hit: AnySearchHit) => void;
  ingestingUrl?: string | null;
};

export function WebSearchPanel({
  hits,
  loading,
  authMode,
  elapsedMs,
  onIngest,
  ingestingUrl,
}: Props) {
  if (!loading && hits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground font-serif-cn">
        全网检索结果会出现在这里。可先搜，再点「入库」写成带来源 URL 的卡片。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 mono-label text-muted-foreground">
        <span>AnySearch</span>
        {authMode && (
          <span className="rounded-[60px] border border-border px-2 py-0.5">
            {authMode === "api_key" ? "key" : "匿名"}
          </span>
        )}
        {typeof elapsedMs === "number" && <span>{elapsedMs} ms</span>}
        <span>{hits.length} 条</span>
      </div>

      <ul className="space-y-2">
        {hits.map((hit) => (
          <li
            key={`${hit.rank}-${hit.url}`}
            className="rounded-[16px] border border-border bg-surface p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium leading-snug">
                  <span className="mono-label text-muted-foreground mr-2">
                    #{hit.rank}
                  </span>
                  {hit.title}
                </p>
                {hit.url && (
                  <a
                    href={hit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary break-all hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {hit.url}
                  </a>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-[60px] shrink-0"
                disabled={ingestingUrl === hit.url}
                onClick={() => onIngest(hit)}
              >
                <Plus className="w-3.5 h-3.5" />
                {ingestingUrl === hit.url ? "写入中…" : "入库"}
              </Button>
            </div>
            {hit.snippet && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 font-serif-cn">
                {hit.snippet}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
