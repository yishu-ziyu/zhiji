"use client";

import { Sidebar } from "@/shared/components/layout/Sidebar";
import { ChatInterface } from "@/shared/components/chat/ChatInterface";
import type { Message, EcommerceMode } from "@/shared/types/common";
import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Video } from "lucide-react";

export default function EcommercePage() {
  const [mode, setMode] = useState<EcommerceMode>("analyze");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async (content: string) => {
    const userMsg: Message = { role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const endpoint = mode === "analyze" ? "/api/ecommerce/analyze" : "/api/ecommerce/script";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: content }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "请求失败"); }
      const data = await res.json();
      const aiMsg: Message = { role: "assistant", content: "", timestamp: new Date(), type: mode === "analyze" ? "analysis" : "script", data };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: Message = { role: "assistant", content: error instanceof Error ? error.message : "请求失败", timestamp: new Date() };
      setMessages((prev) => [...prev, errorMsg]);
    } finally { setIsLoading(false); }
  }, [mode]);

  return (
    <div className="flex h-screen">
      <Sidebar track="ecommerce" ecommerceMode={mode} efficiencyMode="minutes" onTrackChange={() => {}} />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">电商经营 Agent</h1>
            <p className="text-xs text-muted-foreground">AI 驱动的电商运营助手</p>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as EcommerceMode)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="analyze" className="gap-1.5 text-xs"><TrendingUp className="w-3.5 h-3.5" /> 选品分析</TabsTrigger>
              <TabsTrigger value="script" className="gap-1.5 text-xs"><Video className="w-3.5 h-3.5" /> 脚本生成</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ChatInterface messages={messages} onSend={handleSend} isLoading={isLoading}
          placeholder={mode === "analyze" ? "输入商品名称，如：无线蓝牙耳机" : "输入商品名称，如：便携充电宝"}
          modeLabel={mode === "analyze" ? "选品分析" : "脚本生成"} />
      </main>
    </div>
  );
}
