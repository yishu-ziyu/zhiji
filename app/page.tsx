import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Zap,
  FileText,
  KanbanSquare,
  ArrowRight,
  Target,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 backdrop-blur-sm sticky top-0 z-20 bg-background/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              FC-OPC iBot
            </h1>
            <p className="text-xs text-muted-foreground">
              一人公司 · 交付运营助手
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.35), transparent), radial-gradient(ellipse 40% 30% at 90% 40%, rgba(34,211,238,0.12), transparent)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              FC-OPC Next iBot 2026 · 效率赛道
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5 leading-[1.15] tracking-tight">
              客户聊完之后，
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-300">
                谁钉交付？
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              一人公司最稀缺的是注意力。本场只做效率 OPC：
              <span className="text-foreground font-medium">
                {" "}
                承诺草稿 → 客户确认 → 交付验收{" "}
              </span>
              ，让客户拥有确认与验收动作。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
              <Link
                href="/track/efficiency"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
              >
                打开交付运营助手
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="max-w-xl mx-auto text-left">
              <Link href="/track/efficiency" className="block group">
                <Card className="p-6 h-full border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/70 transition-all shadow-xl shadow-primary/5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 flex items-center justify-center ring-1 ring-primary/30">
                      <Target className="w-6 h-6 text-indigo-300" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/15 border border-primary/25 px-2 py-1 rounded-full">
                      唯一主线
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    交付运营助手
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    客户对齐 → 双方承诺单 → 无登录客户确认 → 交付验收。电商赛道本场不做。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-1 rounded flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 承诺提取
                    </span>
                    <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-1 rounded flex items-center gap-1">
                      <KanbanSquare className="w-3 h-3" /> 交付确认
                    </span>
                    <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-1 rounded flex items-center gap-1">
                      <Zap className="w-3 h-3" /> 候选指标
                    </span>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-border/80">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            <span>赛道：效率 OPC only</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>创新点：客户拥有确认 / 验收权</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>交件 7/18 · 路演 7/19</span>
          </div>
        </section>
      </main>
    </div>
  );
}
