"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { KnowledgeSearchHit } from "@/shared/types/knowledge";

type Props = {
  hits: KnowledgeSearchHit[];
  emptyHint?: string;
};

const sourceLabel: Record<string, string> = {
  meeting: "会议",
  email: "邮件",
  chat: "聊天",
  doc: "文档",
  manual: "手记",
};

export function CardList({ hits, emptyHint }: Props) {
  if (hits.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyHint ?? "还没有结果。试着搜「检索」或「协作」。"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hits.map((hit) => (
        <Card key={hit.id} className="p-4 border-border/80">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {hit.title || hit.content.slice(0, 36)}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                来源：{sourceLabel[hit.source] ?? hit.source}
                {typeof hit.score === "number" ? ` · 相关度 ${hit.score.toFixed(1)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              {hit.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{hit.content}</p>
          {hit.links.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              关联卡片：{hit.links.join(", ")}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
