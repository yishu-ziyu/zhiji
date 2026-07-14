"use client";

import { useState } from "react";
import { FileText, ListTree, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tab = "note" | "minutes" | "dissect";

type Props = {
  loading?: boolean;
  newContent: string;
  newTags: string;
  transcript: string;
  goal: string;
  onNewContentChange: (v: string) => void;
  onNewTagsChange: (v: string) => void;
  onTranscriptChange: (v: string) => void;
  onGoalChange: (v: string) => void;
  onAdd: () => void;
  onMinutes: () => void;
  onDissect: () => void;
};

const tabs: { id: Tab; label: string; icon: typeof PenLine }[] = [
  { id: "note", label: "手记入库", icon: PenLine },
  { id: "minutes", label: "粘贴纪要", icon: FileText },
  { id: "dissect", label: "拆解目标", icon: ListTree },
];

export function CapturePanel({
  loading,
  newContent,
  newTags,
  transcript,
  goal,
  onNewContentChange,
  onNewTagsChange,
  onTranscriptChange,
  onGoalChange,
  onAdd,
  onMinutes,
  onDissect,
}: Props) {
  const [tab, setTab] = useState<Tab>("note");

  return (
    <Card className="p-4 border-border/70 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">沉淀入口</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            次级能力：写卡 · 会议入库 · 拆任务（不抢检索主入口）
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "note" && (
        <div className="space-y-2">
          <Textarea
            value={newContent}
            onChange={(e) => onNewContentChange(e.target.value)}
            placeholder="一条可复用的事实、结论或约定（短比长好）…"
            rows={3}
          />
          <input
            value={newTags}
            onChange={(e) => onNewTagsChange(e.target.value)}
            placeholder="标签，逗号分隔 · 如：产品, 验收"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button
            type="button"
            onClick={onAdd}
            disabled={loading || !newContent.trim()}
          >
            保存为卡片
          </Button>
        </div>
      )}

      {tab === "minutes" && (
        <div className="space-y-2">
          <Textarea
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            placeholder="粘贴会议/聊天原文…"
            rows={5}
          />
          <Button
            type="button"
            onClick={onMinutes}
            disabled={loading || !transcript.trim()}
          >
            生成卡片 + 行动
          </Button>
        </div>
      )}

      {tab === "dissect" && (
        <div className="space-y-2">
          <Textarea
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="一个目标，拆成可验收子任务…"
            rows={3}
          />
          <Button
            type="button"
            onClick={onDissect}
            disabled={loading || !goal.trim()}
          >
            拆解并写入行动板
          </Button>
        </div>
      )}
    </Card>
  );
}
