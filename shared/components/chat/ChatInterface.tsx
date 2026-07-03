"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import type { Message } from "@/shared/types/common";

interface ChatInterfaceProps {
  messages: Message[];
  onSend: (content: string) => void;
  isLoading: boolean;
  placeholder?: string;
  modeLabel?: string;
}

export function ChatInterface({
  messages,
  onSend,
  isLoading,
  placeholder = "输入你的需求...",
  modeLabel,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 opacity-20">
                {modeLabel === "选品分析" && "📊"}
                {modeLabel === "脚本生成" && "🎬"}
                {modeLabel === "会议纪要" && "📝"}
                {modeLabel === "项目看板" && "📋"}
              </div>
              <p className="text-muted-foreground text-sm">
                {modeLabel
                  ? `在「${modeLabel}」模式下开始对话`
                  : "选择一个功能开始使用 AI Agent"}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI 正在思考...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="resize-none bg-card border-border text-foreground placeholder:text-muted-foreground min-h-[44px] max-h-32"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 h-11 w-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // AI message — render structured data if available
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-primary">AI</span>
      </div>
      <div className="flex-1 min-w-0">
        {message.data ? <StructuredResult data={message.data} /> : (
          <div className="bg-card border border-border rounded-xl rounded-tl-sm px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

function StructuredResult({ data }: { data: Record<string, unknown> }) {
  if (data.raw) {
    return (
      <div className="bg-card border border-border rounded-xl rounded-tl-sm px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
        {String(data.raw)}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl rounded-tl-sm p-4 space-y-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <div className="text-xs text-muted-foreground font-medium mb-1 capitalize">
            {formatKey(key)}
          </div>
          <div className="text-sm text-foreground">
            {formatValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatKey(key: string): string {
  const map: Record<string, string> = {
    productName: "商品名称",
    marketHeat: "市场热度",
    competition: "竞争程度",
    profitMargin: "预估利润率",
    targetAudience: "目标人群",
    strengths: "核心优势",
    risks: "风险提示",
    recommendation: "综合建议",
    title: "标题",
    date: "日期",
    participants: "参会人",
    decisions: "决议事项",
    actionItems: "待办任务",
    timeline: "时间线",
    keyQuotes: "重要发言",
    scripts: "脚本",
    shots: "分镜",
  };
  return map[key] || key;
}

function formatValue(value: unknown): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">无</span>;
    if (typeof value[0] === "string") {
      return (
        <ul className="list-disc list-inside space-y-0.5">
          {value.map((item, i) => (
            <li key={i} className="text-foreground">{String(item)}</li>
          ))}
        </ul>
      );
    }
    // Array of objects
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="text-foreground">
            {typeof item === "object" && item !== null ? (
              <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto">
                {JSON.stringify(item, null, 2)}
              </pre>
            ) : (
              String(item)
            )}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object" && value !== null) {
    return (
      <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="text-foreground">{String(value)}</span>;
}
