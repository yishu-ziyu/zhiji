"use client";

import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeSearchHit, KnowledgeSource } from "@/shared/types/knowledge";

type Props = {
  hits: KnowledgeSearchHit[];
  emptyHint?: string;
  query?: string;
};

const sourceLabel: Record<KnowledgeSource, string> = {
  meeting: "Meeting",
  email: "Email",
  chat: "Chat",
  doc: "Doc",
  manual: "Note",
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
    return "Soft match · recent";
  }
  if (!query?.trim()) return "Result";
  const tokens = query
    .toLowerCase()
    .split(/[\s,，]+/)
    .filter(Boolean);
  const hay = `${hit.title ?? ""} ${hit.content} ${hit.tags.join(" ")}`.toLowerCase();
  const hitTokens = tokens.filter((t) => hay.includes(t));
  if (hitTokens.length === 0) return `Score ${hit.score?.toFixed(1) ?? "-"}`;
  return `Hit · ${hitTokens.slice(0, 3).join(" · ")}`;
}

/** Slight collage tilt for paper cards only (DESIGN.md ±2–3°). */
const tilts = ["-rotate-[1.2deg]", "rotate-[1.5deg]", "-rotate-[0.8deg]", "rotate-[2deg]"];

export function CardList({ hits, emptyHint, query }: Props) {
  if (hits.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-border p-10 text-center animate-rise">
        <p className="font-serif-cn text-sm text-muted-foreground">
          {emptyHint ?? "还没有结果。换个说法，或先沉淀一条卡片。"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5">
        <span className="mono-label">
          {hits.length} Results{query?.trim() ? ` · ${query.trim()}` : ""}
        </span>
        <span className="mono-label text-primary">Source required</span>
      </div>

      <div className="space-y-4">
        {hits.map((hit, index) => {
          const usePaper = index % 3 === 1;
          return (
            <article
              key={hit.id}
              data-testid="knowledge-card"
              className={cn(
                "p-4 animate-rise no-shadow paper-grain",
                usePaper ? "paper-card" : "surface-card",
                usePaper && tilts[index % tilts.length],
                index === 0 && "animate-rise-delay-1",
                index === 1 && "animate-rise-delay-2",
                index >= 2 && "animate-rise-delay-3",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 w-7 h-7 rounded-[8px] text-[12px] font-mono flex items-center justify-center shrink-0 border",
                    usePaper
                      ? "bg-[#1a1a1a] text-paper border-[#1a1a1a]"
                      : "bg-primary/15 text-primary border-primary/30",
                  )}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-[60px] border px-2.5 py-0.5 mono-label",
                        usePaper
                          ? "border-[#1a1a1a]/30 text-[#1a1a1a]"
                          : "border-primary/40 text-primary",
                      )}
                    >
                      {sourceLabel[hit.source] ?? hit.source}
                    </span>
                    <span
                      className={cn(
                        "mono-label",
                        usePaper ? "text-[#1a1a1a]/60" : "text-muted-foreground",
                      )}
                    >
                      {formatTime(hit.timestamp)}
                    </span>
                    <span
                      className={cn(
                        "mono-label",
                        usePaper ? "text-[#1a1a1a]/50" : "text-muted-foreground/80",
                      )}
                    >
                      {matchHint(hit, query)}
                    </span>
                  </div>

                  <h3
                    className={cn(
                      "text-[16px] font-semibold leading-snug tracking-tight",
                      usePaper ? "text-[#1a1a1a]" : "text-foreground",
                    )}
                  >
                    {hit.title || hit.content.slice(0, 40)}
                  </h3>
                  <p
                    className={cn(
                      "font-serif-cn text-[14px] leading-relaxed",
                      usePaper ? "text-[#1a1a1a]/85" : "text-foreground/85",
                    )}
                  >
                    {hit.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {hit.tags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          "rounded-[60px] border px-2 py-0.5 text-[11px] font-mono tracking-wide",
                          usePaper
                            ? "border-[#1a1a1a]/25 text-[#1a1a1a]/80"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                    {hit.links.length > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] ml-1 font-mono",
                          usePaper ? "text-[#1a1a1a]/55" : "text-muted-foreground",
                        )}
                      >
                        <Link2 className="w-3 h-3" />
                        {hit.links.length} links
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
