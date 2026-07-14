"use client";

import { ArrowRight, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeSource } from "@/shared/types/knowledge";

const SOURCE_FILTERS: { id: KnowledgeSource | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "meeting", label: "会议" },
  { id: "doc", label: "文档" },
  { id: "chat", label: "聊天" },
  { id: "email", label: "邮件" },
  { id: "manual", label: "手记" },
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
    <div className="space-y-4">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary/90">
          <Sparkles className="w-3.5 h-3.5" />
          搜得到 · 带来源
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          问一句，从已有知识里找答案
        </h1>
        <p className="text-sm text-muted-foreground">
          不卖编辑器。结果必须能指回会议、文档或手记。
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="flex gap-2 rounded-2xl border border-border/80 bg-card/80 p-2 shadow-lg shadow-primary/5 ring-1 ring-primary/10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch(query);
              }}
              placeholder="例如：验收标准是什么？协作状态怎么走？"
              className="w-full rounded-xl bg-transparent pl-9 pr-3 py-3 text-sm outline-none placeholder:text-muted-foreground/70"
              aria-label="知识检索"
            />
          </div>
          <Button
            type="button"
            className="rounded-xl h-auto px-4"
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
                "rounded-full px-2.5 py-1 text-[11px] border transition-colors",
                sourceFilter === f.id
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] text-muted-foreground">试试：</span>
          {exampleQueries.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                onQueryChange(q);
                onSearch(q);
              }}
              className="text-[11px] rounded-md border border-dashed border-border px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-primary/40"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
