"use client";

import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeSource } from "@/shared/types/knowledge";

const SOURCE_FILTERS: { id: KnowledgeSource | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "meeting", label: "Meeting" },
  { id: "doc", label: "Doc" },
  { id: "chat", label: "Chat" },
  { id: "email", label: "Email" },
  { id: "manual", label: "Note" },
];

type Props = {
  query: string;
  loading?: boolean;
  sourceFilter: KnowledgeSource | "all";
  onQueryChange: (value: string) => void;
  onSourceFilterChange: (value: KnowledgeSource | "all") => void;
  onSearch: (nextQuery?: string) => void;
  exampleQueries?: string[];
};

export function KnowledgeSearch({
  query,
  loading,
  sourceFilter,
  onQueryChange,
  onSourceFilterChange,
  onSearch,
  exampleQueries = ["检索 来源", "协作 状态", "会议", "主路径"],
}: Props) {
  return (
    <div className="space-y-5 animate-rise">
      <div className="max-w-2xl mx-auto text-center space-y-3">
        <p className="mono-label">Search · Source-backed</p>
        <h1 className="font-hand text-[40px] md:text-[48px] leading-[1.05] text-foreground">
          问一句，从已有知识里找
        </h1>
        <p className="font-serif-cn text-[15px] text-muted-foreground leading-relaxed">
          不卖编辑器。每条结果要能指回会议、文档或手记。
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="flex gap-2 items-stretch rounded-[20px] border border-border bg-surface p-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch(query);
              }}
              placeholder="验收标准是什么？协作状态怎么走？"
              className="w-full rounded-[12px] bg-transparent pl-9 pr-3 py-3 text-sm outline-none placeholder:text-muted-foreground/70 font-sans"
              aria-label="知识检索"
            />
          </div>
          <Button
            type="button"
            className="rounded-[60px] h-auto px-5"
            onClick={() => onSearch(query)}
            disabled={loading}
          >
            {loading ? "检索中…" : "检索"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSourceFilterChange(f.id)}
              className={cn(
                "rounded-[60px] px-3 py-1 mono-label transition-colors border",
                sourceFilter === f.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="mono-label">Try</span>
          {exampleQueries.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                onQueryChange(q);
                onSearch(q);
              }}
              className="text-[12px] rounded-[60px] border border-dashed border-border px-2.5 py-1 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
