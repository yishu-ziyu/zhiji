import Link from "next/link";
import { ArrowRight, BookOpen, Target } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 z-20 bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div>
            <div className="font-hand text-[28px] leading-none text-foreground">
              FC-OPC
            </div>
            <p className="mono-label mt-1">Knowledge Loop</p>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-16 text-center">
            <p className="mono-label mb-4">FC-OPC · Knowledge Loop</p>
            <h2 className="font-hand text-[44px] md:text-[56px] text-foreground mb-5 leading-[1.05]">
              找得到，收成卡，
              <br />
              <span className="text-primary">变成可勾选的下一步</span>
            </h2>
            <p className="font-serif-cn text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              给知识工作者：检索带来源，卡片可复用，行动有状态。
              <span className="text-foreground font-medium">不卖编辑器，卖闭环。</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
              <Link
                href="/track/knowledge"
                className="inline-flex items-center gap-2 rounded-[60px] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                打开知识库工作台
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/track/efficiency"
                className="inline-flex items-center gap-2 rounded-[60px] border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground hover:border-primary/40 transition-colors"
              >
                客户变化处理
              </Link>
            </div>

            <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-4 text-left">
              <Link href="/track/knowledge" className="block group">
                <div className="paper-card paper-grain p-6 h-full transition-transform group-hover:-rotate-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-[12px] bg-[#1a1a1a] flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-paper" />
                    </div>
                    <span className="mono-label text-[#1a1a1a]/70">Main</span>
                  </div>
                  <h3 className="font-hand text-[28px] leading-none text-[#1a1a1a] mb-2">
                    知识库闭环
                  </h3>
                  <p className="font-serif-cn text-sm text-[#1a1a1a]/80 leading-relaxed">
                    资料检索、卡片沉淀、任务拆解与协作状态。面向知识工作者，可演示、可 MCP 调用。
                  </p>
                </div>
              </Link>
              <Link href="/track/efficiency" className="block group">
                <div className="surface-card p-6 h-full group-hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-[12px] bg-surface-raised flex items-center justify-center">
                      <Target className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <span className="mono-label">Legacy</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    客户变化处理
                  </h3>
                  <p className="font-serif-cn text-sm text-muted-foreground mb-4 leading-relaxed">
                    客户提出变化 → 对照原约定 → 服务方提出新方案 → 更新交付日期和尾款。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="mono-label border border-border rounded-[60px] px-2 py-1">
                      原文
                    </span>
                    <span className="mono-label border border-border rounded-[60px] px-2 py-1">
                      版本
                    </span>
                    <span className="mono-label border border-border rounded-[60px] px-2 py-1">
                      状态
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mono-label">
            <span>Efficiency Track</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>Search · Card · Action</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>Submit 7/18 · Pitch 7/19</span>
          </div>
        </section>
      </main>
    </div>
  );
}
