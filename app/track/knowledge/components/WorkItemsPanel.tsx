"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Circle,
  Link2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ActionItem,
  ActionStatus,
  ActionSuggestion,
  KnowledgeCard,
  KnowledgeRelation,
  WorkEvent,
} from "@/shared/types/knowledge";
import { STATUS_LABELS } from "@/shared/types/knowledge";
import { EvidenceIslandList } from "./CardRelationsPanel";

type Detail = {
  item: ActionItem;
  events: WorkEvent[];
  evidence: KnowledgeCard[];
};

type Props = {
  items: ActionItem[];
  selectedId: string | null;
  detail: Detail | null;
  suggestions: ActionSuggestion[];
  filterMine: boolean;
  defaultUser: string;
  loading?: boolean;
  onSelect: (id: string) => void;
  onFilterMineChange: (v: boolean) => void;
  onRefreshSuggestions: () => void;
  onCreate: (input: {
    title: string;
    assignee: string;
    nextStep: string;
  }) => void;
  onPatch: (
    id: string,
    patch: Partial<{
      status: ActionStatus;
      assignee: string;
      nextStep: string;
      blockedReason: string;
    }>,
  ) => void;
  onAddEvent: (
    id: string,
    type: "comment" | "decision" | "result" | "block",
    body: string,
  ) => void;
  onLinkEvidence: (workItemId: string, cardId: string) => void;
  linkableCards: KnowledgeCard[];
  islandEdges?: KnowledgeRelation[];
};

const statusOrder: ActionStatus[] = [
  "todo",
  "doing",
  "blocked",
  "confirmed",
  "done",
];

const nextStatus: Partial<Record<ActionStatus, ActionStatus>> = {
  todo: "doing",
  doing: "confirmed",
  confirmed: "done",
};

function StatusIcon({ status }: { status: ActionStatus }) {
  if (status === "done") return <Check className="w-3 h-3" />;
  if (status === "doing")
    return <Circle className="w-3 h-3 fill-primary text-primary" />;
  if (status === "blocked")
    return <Circle className="w-3 h-3 fill-destructive text-destructive" />;
  return <Circle className="w-3 h-3" />;
}

const eventTypeLabel: Record<string, string> = {
  comment: "评论",
  decision: "决定",
  status_change: "状态",
  assign: "负责人",
  next_step_change: "下一步",
  block: "阻塞",
  unblock: "解除阻塞",
  result: "结果",
  evidence_link: "依据",
};

export function WorkItemsPanel({
  items,
  selectedId,
  detail,
  suggestions,
  filterMine,
  defaultUser,
  loading,
  onSelect,
  onFilterMineChange,
  onRefreshSuggestions,
  onCreate,
  onPatch,
  onAddEvent,
  onLinkEvidence,
  linkableCards,
  islandEdges = [],
}: Props) {
  const [title, setTitle] = useState("");
  const [nextStep, setNextStep] = useState("确认下一步并开始推进");
  const [comment, setComment] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [editNext, setEditNext] = useState("");
  const [editAssignee, setEditAssignee] = useState("");

  const openCount = items.filter(
    (a) => a.status !== "done" && a.status !== "cancelled",
  ).length;

  const grouped = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        items: items.filter((a) => a.status === status),
      })),
    [items],
  );

  const selected = detail?.item;

  return (
    <aside className="space-y-4" data-testid="work-items-panel">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="mono-label">Work items</p>
          <h2 className="font-hand text-[26px] leading-none mt-1 text-foreground">
            工作项
          </h2>
          <p className="mono-label mt-2">{openCount} 未完成</p>
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

      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={filterMine}
          onChange={(e) => onFilterMineChange(e.target.checked)}
          className="rounded border-border"
        />
        只看我的（{defaultUser}）
      </label>

      <div className="space-y-2 rounded-[16px] border border-border p-3">
        <p className="mono-label">新建</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="工作项标题"
          aria-label="工作项标题"
          className="w-full rounded-[10px] border border-border bg-transparent px-2 py-1.5 text-sm"
        />
        <input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="下一步（一句）"
          aria-label="下一步"
          className="w-full rounded-[10px] border border-border bg-transparent px-2 py-1.5 text-sm"
        />
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={loading || !title.trim()}
          onClick={() => {
            onCreate({
              title: title.trim(),
              assignee: defaultUser,
              nextStep: nextStep.trim() || "确认下一步并开始推进",
            });
            setTitle("");
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          创建
        </Button>
      </div>

      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-0.5">
        {items.length === 0 && (
          <div className="surface-card p-3 border-dashed">
            <p className="font-serif-cn text-xs text-muted-foreground">
              暂无工作项。创建一条，或从会议/拆解生成。
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
                        : group.status === "blocked"
                          ? "border-destructive/50 text-destructive"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    <StatusIcon status={group.status} />
                    {STATUS_LABELS[group.status]}
                  </span>
                  <span className="mono-label">{group.items.length}</span>
                </div>
                {group.items.map((item) => {
                  const next = nextStatus[item.status];
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "surface-card p-3 cursor-pointer transition-colors",
                        selectedId === item.id && "ring-1 ring-primary/50",
                      )}
                      data-testid="action-item"
                      data-work-id={item.id}
                      onClick={() => {
                        onSelect(item.id);
                        setEditNext(item.nextStep);
                        setEditAssignee(item.assignee);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium leading-snug text-foreground">
                            {item.title || item.description}
                          </p>
                          <p className="mono-label mt-1.5 normal-case tracking-normal">
                            {item.assignee} · 下一步：{item.nextStep || "—"}
                          </p>
                          {item.status === "blocked" && item.blockedReason && (
                            <p className="text-[11px] text-destructive mt-1">
                              阻塞：{item.blockedReason}
                            </p>
                          )}
                        </div>
                        {next && (
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              item.status === "doing" ? "default" : "outline"
                            }
                            className="h-7 shrink-0 px-2.5 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(item.id);
                              onPatch(item.id, { status: next });
                            }}
                            disabled={loading}
                          >
                            {STATUS_LABELS[next]}
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

      {selected && detail && (
        <div
          className="space-y-3 rounded-[16px] border border-primary/30 bg-primary/5 p-3"
          data-testid="work-item-detail"
        >
          <p className="mono-label">详情</p>
          <h3 className="font-hand text-[22px] leading-tight">
            {selected.title}
          </h3>
          <div className="grid grid-cols-1 gap-1 text-[12px]">
            <p>
              <span className="text-muted-foreground">状态 </span>
              {STATUS_LABELS[selected.status]}
            </p>
            <p>
              <span className="text-muted-foreground">负责人 </span>
              {selected.assignee}
            </p>
            <p>
              <span className="text-muted-foreground">下一步 </span>
              {selected.nextStep || "—"}
            </p>
            {selected.blockedReason && (
              <p className="text-destructive">
                阻塞原因 {selected.blockedReason}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <input
              value={editAssignee}
              onChange={(e) => setEditAssignee(e.target.value)}
              aria-label="编辑负责人"
              className="w-full rounded-[10px] border border-border bg-background px-2 py-1 text-sm"
            />
            <input
              value={editNext}
              onChange={(e) => setEditNext(e.target.value)}
              aria-label="编辑下一步"
              className="w-full rounded-[10px] border border-border bg-background px-2 py-1 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() =>
                onPatch(selected.id, {
                  assignee: editAssignee,
                  nextStep: editNext,
                })
              }
            >
              保存负责人/下一步
            </Button>
          </div>

          <div className="space-y-1">
            <p className="mono-label">依据</p>
            {detail.evidence.length === 0 && (
              <p className="text-[11px] text-muted-foreground">尚未关联</p>
            )}
            {detail.evidence.map((c) => (
              <div
                key={c.id}
                className="text-[11px] rounded-[8px] border border-border px-2 py-1"
              >
                <span className="mono-label mr-1">{c.source}</span>
                {c.title || c.content.slice(0, 36)}
              </div>
            ))}
            {linkableCards.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {linkableCards.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-[60px] border border-dashed border-border px-2 py-0.5 text-[10px] hover:border-primary/50"
                    onClick={() => onLinkEvidence(selected.id, c.id)}
                    disabled={loading}
                  >
                    <Link2 className="w-3 h-3" />
                    挂 {c.title?.slice(0, 12) || c.id.slice(0, 6)}
                  </button>
                ))}
              </div>
            )}
            {detail.evidence.length >= 2 && (
              <div className="mt-2 space-y-1">
                <p className="mono-label">依据怎么连</p>
                <EvidenceIslandList
                  edges={islandEdges}
                  cards={detail.evidence}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="mono-label">时间线</p>
            <div
              className="max-h-40 overflow-y-auto space-y-1.5"
              data-testid="work-item-timeline"
            >
              {detail.events.map((ev) => (
                <div
                  key={ev.id}
                  className="text-[11px] border-l-2 border-border pl-2"
                  data-testid="work-event"
                >
                  <span className="mono-label">
                    {eventTypeLabel[ev.type] || ev.type} · {ev.actor}
                  </span>
                  <p className="text-foreground/90 leading-snug">
                    {ev.body || "—"}
                  </p>
                </div>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="写评论…"
              aria-label="工作项评论"
              rows={2}
              className="w-full rounded-[10px] border border-border bg-background px-2 py-1.5 text-sm"
            />
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                disabled={loading || !comment.trim()}
                onClick={() => {
                  onAddEvent(selected.id, "comment", comment.trim());
                  setComment("");
                }}
              >
                评论
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !comment.trim()}
                onClick={() => {
                  onAddEvent(selected.id, "decision", comment.trim());
                  setComment("");
                }}
              >
                记决定
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !comment.trim()}
                onClick={() => {
                  onAddEvent(selected.id, "result", comment.trim());
                  setComment("");
                }}
              >
                记结果
              </Button>
            </div>
            <div className="flex gap-1">
              <input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="阻塞原因"
                aria-label="阻塞原因"
                className="flex-1 rounded-[10px] border border-border bg-background px-2 py-1 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !blockReason.trim()}
                onClick={() => {
                  onAddEvent(selected.id, "block", blockReason.trim());
                  setBlockReason("");
                }}
              >
                报阻塞
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-border">
        <p className="mono-label">建议</p>
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
