import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 z-20 bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="font-hand text-[28px] leading-none text-foreground">
            FC-OPC
          </div>
          <p className="mono-label mt-1">Knowledge Loop</p>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-16 text-center">
            <p className="mono-label mb-4">Efficiency Track · Knowledge Loop</p>
            <h1 className="font-hand text-[44px] md:text-[56px] text-foreground mb-5 leading-[1.05]">
              找得到，收成卡，
              <br />
              <span className="text-primary">变成可勾选的下一步</span>
            </h1>
            <p className="font-serif-cn text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              资料检索 · 知识管理 · 协作工作流。
              <span className="text-foreground font-medium">
                不卖编辑器，卖闭环。
              </span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
              <Link
                href="/track/knowledge"
                className="inline-flex items-center gap-2 rounded-[60px] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                打开知识库工作台
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="max-w-xl mx-auto text-left">
              <Link href="/track/knowledge" className="block group">
                <div className="paper-card paper-grain p-6 transition-transform group-hover:-rotate-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-[12px] bg-[#1a1a1a] flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-paper" />
                    </div>
                    <span className="mono-label text-[#1a1a1a]/70">Only path</span>
                  </div>
                  <h2 className="font-hand text-[28px] leading-none text-[#1a1a1a] mb-2">
                    知识闭环
                  </h2>
                  <p className="font-serif-cn text-sm text-[#1a1a1a]/80 leading-relaxed">
                    搜得到带来源的卡片，收进库，把行动推进到完成。面向知识工作者。
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mono-label">
            <span>Search · Card · Action</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>No delivery track</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>No ecommerce track</span>
          </div>
        </section>
      </main>
    </div>
  );
}
