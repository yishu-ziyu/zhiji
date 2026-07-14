"use client";

import { Check, ChevronRight, Circle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ActionItem,
  ActionStatus,
  ActionSuggestion,
} from "@/shared/types/knowledge";

type Props = {
  actions: ActionItem[];
  suggestions: ActionSuggestion[];
  onStatusChange: (taskId: string, status: ActionStatus) => void;
  onRefreshSuggestions: () => void;
  loading?: boolean;
};

const statusLabel: Record<ActionStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  confirmed: "Confirmed",
  done: "Done",
};

const statusOrder: ActionStatus[] = ["todo", "doing", "confirmed", "done"];

const nextStatus: Partial<Record<ActionStatus, ActionStatus>> = {
  todo: "doing",
  doing: "confirmed",
  confirmed: "done",
};

const statusStyle: Record<ActionStatus, string> = {
  todo: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10",
  doing: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  confirmed: "text-amber-200 border-amber-500/40 bg-amber-500/10",
  done: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
};

function StatusIcon({ status }: { status: ActionStatus }) {
  if (status === "done") return <Check className="w-3.5 h-3.5" />;
  if (status === "doing") return <Loader2 className="w-3.5 h-3.5" />;
  if (status === "confirmed") return <Circle className="w-3.5 h-3.5 fill-current" />;
  return <Circle className="w-3.5 h-3.5" />;
}

export function ActionSuggestions({
  actions,
  suggestions,
  onStatusChange,
  onRefreshSuggestions,
  loading,
}: Props) {
  const openCount = actions.filter((a) => a.status !== "done").length;

  const grouped = statusOrder.map((status) => ({
    status,
    items: actions.filter((a) => a.status === status),
  }));

  return (
    <aside className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">行动板</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Linear 式状态 · {openCount} 条未完成
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefreshSuggestions}
          disabled={loading}
          className="h-8 px-2"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="space-y-3">
        {actions.length === 0 && (
          <Card className="p-3 border-dashed">
            <p className="text-xs text-muted-foreground">
              暂无行动。拆解一个目标，或从会议文本生成。
            </p>
          </Card>
        )}

        {grouped.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.status} className="space-y-1.5">
                <div className="flex items-center gap-2 px-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      statusStyle[group.status],
                    )}
                  >
                    <StatusIcon status={group.status} />
                    {statusLabel[group.status]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                {group.items.map((item) => {
                  const next = nextStatus[item.status];
                  return (
                    <Card
                      key={item.id}
                      className="p-2.5 border-border/70 hover:border-border transition-colors"
                      data-testid="action-item"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium leading-snug">
                            {item.description}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {item.assignee} · {item.deadline}
                          </p>
                          <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2">
                            验收：{item.verificationCriteria}
                          </p>
                        </div>
                        {next && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 shrink-0 px-2 text-[11px]"
                            onClick={() => onStatusChange(item.id, next)}
                            disabled={loading}
                          >
                            {statusLabel[next]}
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ),
        )}
      </div>

      <div className="space-y-2 pt-1 border-t border-border/60">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          下一步建议
        </h3>
        {suggestions.length === 0 && (
          <p className="text-[11px] text-muted-foreground">点刷新生成建议。</p>
        )}
        {suggestions.map((s) => (
          <Card
            key={s.id}
            className="p-2.5 bg-primary/5 border-primary/20"
          >
            <p className="text-[13px] font-medium leading-snug">{s.title}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              {s.reason}
            </p>
          </Card>
        ))}
      </div>
    </aside>
  );
}
