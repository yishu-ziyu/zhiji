"use client";

import { Check, ChevronRight, Circle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  confirmed: "Confirm",
  done: "Done",
};

const statusOrder: ActionStatus[] = ["todo", "doing", "confirmed", "done"];

const nextStatus: Partial<Record<ActionStatus, ActionStatus>> = {
  todo: "doing",
  doing: "confirmed",
  confirmed: "done",
};

function StatusIcon({ status }: { status: ActionStatus }) {
  if (status === "done") return <Check className="w-3 h-3" />;
  if (status === "doing") return <Circle className="w-3 h-3 fill-primary text-primary" />;
  return <Circle className="w-3 h-3" />;
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
          <p className="mono-label">Action Board</p>
          <h2 className="font-hand text-[26px] leading-none mt-1 text-foreground">
            行动
          </h2>
          <p className="mono-label mt-2">{openCount} open</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefreshSuggestions}
          disabled={loading}
          className="h-8 w-8 p-0"
          aria-label="刷新建议"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="space-y-3">
        {actions.length === 0 && (
          <div className="surface-card p-3 border-dashed">
            <p className="font-serif-cn text-xs text-muted-foreground">
              暂无行动。拆解目标，或从会议文本生成。
            </p>
          </div>
        )}

        {grouped.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.status} className="space-y-1.5">
                <div className="flex items-center gap-2 px-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-[60px] border px-2 py-0.5 mono-label",
                      group.status === "doing"
                        ? "border-primary/50 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <StatusIcon status={group.status} />
                    {statusLabel[group.status]}
                  </span>
                  <span className="mono-label">{group.items.length}</span>
                </div>
                {group.items.map((item) => {
                  const next = nextStatus[item.status];
                  return (
                    <div
                      key={item.id}
                      className="surface-card p-3"
                      data-testid="action-item"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium leading-snug text-foreground">
                            {item.description}
                          </p>
                          <p className="mono-label mt-1.5 normal-case tracking-normal">
                            {item.assignee} · {item.deadline}
                          </p>
                          <p className="font-serif-cn text-[11px] text-muted-foreground mt-1 line-clamp-2">
                            验收：{item.verificationCriteria}
                          </p>
                        </div>
                        {next && (
                          <Button
                            type="button"
                            size="sm"
                            variant={item.status === "doing" ? "default" : "outline"}
                            className="h-7 shrink-0 px-2.5 text-[11px]"
                            onClick={() => onStatusChange(item.id, next)}
                            disabled={loading}
                          >
                            {statusLabel[next]}
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ),
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <p className="mono-label">Next Suggest</p>
        {suggestions.length === 0 && (
          <p className="font-serif-cn text-[11px] text-muted-foreground">
            点刷新生成建议。
          </p>
        )}
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="rounded-[20px] border border-primary/35 bg-primary/10 p-3"
          >
            <p className="text-[13px] font-medium leading-snug">{s.title}</p>
            <p className="font-serif-cn text-[11px] text-muted-foreground mt-1 leading-relaxed">
              {s.reason}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
