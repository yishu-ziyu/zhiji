import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Zap, TrendingUp, Video, FileText, KanbanSquare } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">FC-OPC iBot</h1>
            <p className="text-xs text-muted-foreground">AI Agent 平台 · 一人公司的智能助手</p>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            FC-OPC Next iBot 2026 · 杭州黑客松
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            一个平台，两个 AI 角色
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            覆盖电商经营与团队效率两大场景，用对话驱动 AI Agent 完成选品分析、内容生产、会议纪要和项目管理。
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Link href="/track/ecommerce">
              <Card className="p-6 text-left hover:border-primary/50 transition-colors cursor-pointer group h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-orange-400" />
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Track 01</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">电商经营 Agent</h3>
                <p className="text-sm text-muted-foreground mb-4">选品分析、短视频脚本生成、私域运营话术</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 选品分析</span>
                  <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded flex items-center gap-1"><Video className="w-3 h-3" /> 脚本生成</span>
                </div>
              </Card>
            </Link>
            <Link href="/track/efficiency">
              <Card className="p-6 text-left hover:border-primary/50 transition-colors cursor-pointer group h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Track 02</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">效率 Agent</h3>
                <p className="text-sm text-muted-foreground mb-4">会议纪要自动整理、项目任务管理看板</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded flex items-center gap-1"><FileText className="w-3 h-3" /> 会议纪要</span>
                  <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded flex items-center gap-1"><KanbanSquare className="w-3 h-3" /> 项目看板</span>
                </div>
              </Card>
            </Link>
          </div>
        </section>
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Next.js 16</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> TypeScript</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Tailwind CSS</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> AI-Powered</span>
          </div>
        </section>
      </main>
    </div>
  );
}
