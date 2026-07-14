"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  query: string;
  loading?: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
};

export function KnowledgeSearch({
  query,
  loading,
  onQueryChange,
  onSearch,
}: Props) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          placeholder="搜卡片：检索、来源、协作、会议…"
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <Button type="button" onClick={onSearch} disabled={loading}>
        {loading ? "检索中…" : "检索"}
      </Button>
    </div>
  );
}
