"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockMorningBrief } from "@/shared/agent/brief/mock";
import { cn } from "@/lib/utils";

type ShopkeeperState = "idle" | "working" | "needs-decision";

const stateStyles: Record<ShopkeeperState, string> = {
  idle: "bg-emerald-400",
  working: "bg-yellow-400",
  "needs-decision": "bg-red-400",
};

export function AgentRuntime({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEfficiency = pathname?.startsWith("/track/efficiency");
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ShopkeeperState>("needs-decision");

  const handleAdopt = () => {
    setState("working");
  };

  return (
    <>
      {children}
      {!isEfficiency && (
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
        {isOpen && (
          <Card className="w-[360px] gap-0 border-border bg-card/95 py-0 shadow-2xl backdrop-blur">
            <CardHeader className="px-4 pt-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription className="text-xs">AI 运营助理</CardDescription>
                  <CardTitle className="mt-1 text-base">小掌柜早报</CardTitle>
                </div>
                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/25">
                  演示模式
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm leading-relaxed text-foreground">
                老板，昨晚 23:40 用户 @{mockMorningBrief.customerMessages[0].from} 私信问便携充电宝续航，已用话术库 #{mockMorningBrief.customerMessages[0].templateId} 自动回复。
              </div>
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm leading-relaxed text-foreground">
                今早热搜「{mockMorningBrief.hotSearches[0].keyword}」匹配选品库 {mockMorningBrief.hotSearches[0].matchSkuId}，建议今日主推。
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-relaxed text-foreground">
                {mockMorningBrief.skuPerformance[0].skuId} 加购率 {mockMorningBrief.skuPerformance[0].addToCartRate}% 高于平均 {mockMorningBrief.skuPerformance[0].avgRate}%，适合进入主推库。
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted-foreground">采纳后会触发 4 个动作链。</p>
                <Button size="sm" onClick={handleAdopt}>
                  采纳建议
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <button
          type="button"
          aria-label="小掌柜"
          onClick={() => setIsOpen((value) => !value)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-orange-500/40 bg-card text-2xl shadow-2xl transition hover:scale-105 hover:border-orange-400"
        >
          <span aria-hidden="true">👨‍💼</span>
          <span className={cn("absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full border-2 border-background", stateStyles[state])} />
          <span className="sr-only">打开小掌柜早报</span>
        </button>
      </div>
      )}
    </>
  );
}
