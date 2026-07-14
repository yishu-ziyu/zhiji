"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionItem, ActionStatus, ActionSuggestion } from "@/shared/types/knowledge";

type Props = {
  actions: ActionItem[];
  suggestions: ActionSuggestion[];
  onStatusChange: (taskId: string, status: ActionStatus) => void;
  onRefreshSuggestions: () => void;
  loading?: boolean;
};

const statusLabel: Record<ActionStatus, string> = {
  todo: "待开始",
  doing: "进行中",
  confirmed: "已确认",
  done: "完成",
};

const nextStatus: Partial<Record<ActionStatus, ActionStatus>> = {
  todo: "doing",
  doing: "confirmed",
  confirmed: "done",
};

export function ActionSuggestions({
  actions,
  suggestions,
  onStatusChange,
  onRefreshSuggestions,
  loading,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">行动项</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefreshSuggestions}
          disabled={loading}
        >
          刷新建议
        </Button>
      </div>

      <div className="space-y-2">
        {actions.length === 0 && (
          <p className="text-xs text-muted-foreground">暂无行动项。可先拆解一个目标。</p>
        )}
        {actions.map((item) => {
          const next = nextStatus[item.status];
          return (
            <Card key={item.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.assignee} · 截止 {item.deadline}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    验收：{item.verificationCriteria}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant="outline">{statusLabel[item.status]}</Badge>
                  {next && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onStatusChange(item.id, next)}
                    >
                      → {statusLabel[next]}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">下一步建议</h3>
        <div className="space-y-2">
          {suggestions.map((s) => (
            <Card key={s.id} className="p-3 bg-primary/5 border-primary/20">
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
            </Card>
          ))}
          {suggestions.length === 0 && (
            <p className="text-xs text-muted-foreground">点「刷新建议」生成。</p>
          )}
        </div>
      </div>
    </div>
  );
}
