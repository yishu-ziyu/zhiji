"use client";

import { usePathname, useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const goHome = () => router.push("/");
  const active = pathname?.startsWith("/track/knowledge");

  return (
    <aside className="w-60 h-screen bg-sidebar border-r border-border flex flex-col shrink-0">
      <div className="p-5 border-b border-border">
        <button
          type="button"
          onClick={goHome}
          className="text-left transition-opacity hover:opacity-80"
        >
          <div className="font-hand text-[28px] leading-none text-foreground">
            FC-OPC
          </div>
          <div className="mono-label mt-2">Knowledge Loop</div>
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="mono-label px-2 mb-3">Nav</div>
        <button
          type="button"
          onClick={() => router.push("/track/knowledge")}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[12px] text-sm transition-colors border",
            active
              ? "bg-primary/15 text-primary font-medium border-primary/30"
              : "text-muted-foreground hover:bg-surface hover:text-foreground border-transparent",
          )}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span className="font-sans">知识库</span>
        </button>
      </nav>
      <div className="p-4 border-t border-border">
        <p className="font-hand text-base text-primary leading-tight">
          搜得到 · 收成卡
        </p>
        <p className="mono-label mt-1">Only mainline</p>
      </div>
    </aside>
  );
}
