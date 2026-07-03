"use client";

import { Sidebar } from "@/shared/components/layout/Sidebar";
import { ChatInterface } from "@/shared/components/chat/ChatInterface";
import type { Message, EfficiencyMode } from "@/shared/types/common";
import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, KanbanSquare } from "lucide-react";

const MOCK_TASKS = [
  { id: "1", title: "设计首页 UI 原型", status: "done" as const, priority: "高" },
  { id: "2", title: "实现 LLM 调用层", status: "done" as const, priority: "高" },
  { id: "3", title: "电商选品分析功能", status: "in-progress" as const, priority: "高" },
  { id: "4", title: "短视频脚本生成", status: "todo" as const, priority: "中" },
  { id: "5", title: "会议纪要功能", status: "todo" as const, priority: "中" },
  { id: "6", title: "项目看板组件", status: "todo" as const, priority: "低" },
];

function KanbanBoard() {
  const [tasks, setTasks] = useState(MOCK_TASKS);

  const moveTask = (id: string, newStatus: "todo" | "in-progress" | "done") => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)),
    );
  };

  const columns = [
    { status: "todo" as const, label: "待办", color: "bg-muted" },
    { status: "in-progress" as const, label: "进行中", color: "bg-primary/10" },
    { status: "done" as const, label: "完成", color: "bg-green-500/10" },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div key={col.status} className={`flex-1 min-w-[240px] rounded-xl border border-border ${col.color}`}>
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground">
              {col.label}
              <span className="ml-1.5 text-muted-foreground/60">
                {tasks.filter((t) => t.status === col.status).length}
              </span>
            </div>
          </div>
          <div className="p-2 space-y-2">
            {tasks
              .filter((t) => t.status === col.status)
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={(s) => moveTask(task.id, s)}
                />
              ))}
            {tasks.filter((t) => t.status === col.status).length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6 opacity-50">
                暂无任务
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  onStatusChange,
}: {
  task: { id: string; title: string; status: string; priority: string };
  onStatusChange: (s: "todo" | "in-progress" | "done") => void;
}) {
  const priorityColor =
    task.priority === "高"
      ? "bg-red-500/20 text-red-400"
      : task.priority === "中"
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-blue-500/20 text-blue-400";

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <p className="text-sm text-foreground leading-snug">{task.title}</p>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColor}`}>
          {task.priority}
        </span>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value as "todo" | "in-progress" | "done")}
          className="text-xs bg-muted border border-border rounded px-1.5 py-0.5 text-foreground cursor-pointer"
        >
          <option value="todo">待办</option>
          <option value="in-progress">进行中</option>
          <option value="done">完成</option>
        </select>
      </div>
    </div>
  );
}

export default function EfficiencyPage() {
  const [mode, setMode] = useState<EfficiencyMode>("minutes");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async (content: string) => {
    if (mode !== "minutes") return;

    const userMsg: Message = {
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/efficiency/minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: content }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "请求失败");
      }

      const data = await res.json();
      const aiMsg: Message = {
        role: "assistant",
        content: "",
        timestamp: new Date(),
        type: "minutes",
        data,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: Message = {
        role: "assistant",
        content: error instanceof Error ? error.message : "请求失败，请稍后重试。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  return (
    <div className="flex h-screen">
      <Sidebar
        track="efficiency"
        ecommerceMode="analyze"
        efficiencyMode={mode}
        onTrackChange={() => {}}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground">效率 Agent</h1>
          <p className="text-xs text-muted-foreground">AI 驱动的团队效率工具</p>
        </div>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as EfficiencyMode)}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-3">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="minutes" className="gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5" />
                会议纪要
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 text-xs">
                <KanbanSquare className="w-3.5 h-3.5" />
                项目看板
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="minutes" className="flex-1 mt-0 min-h-0">
            <ChatInterface
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              placeholder="粘贴会议记录，AI 自动整理结构化纪要..."
              modeLabel="会议纪要"
            />
          </TabsContent>
          <TabsContent value="kanban" className="flex-1 mt-0 min-h-0 overflow-auto p-6">
            <KanbanBoard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
