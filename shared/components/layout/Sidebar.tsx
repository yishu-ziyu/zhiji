"use client";

import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Target } from "lucide-react";
import type { EfficiencyMode } from "@/shared/types/common";
import { cn } from "@/lib/utils";

interface SidebarProps {
  efficiencyMode?: EfficiencyMode;
}

const navItems = [
  {
    id: "knowledge",
    label: "知识库",
    icon: BookOpen,
    href: "/track/knowledge",
  },
  {
    id: "capture",
    label: "客户变化",
    icon: Target,
    href: "/track/efficiency",
  },
] as const;

export function Sidebar({ efficiencyMode = "capture" }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const goHome = () => router.push("/");

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
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname?.startsWith(item.href) ||
              (item.id === "capture" &&
                efficiencyMode === "capture" &&
                pathname?.includes("efficiency")) ||
              (item.id === "knowledge" &&
                efficiencyMode === "board" &&
                pathname?.includes("knowledge"));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(item.href)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[12px] text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-primary font-medium border border-primary/30"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground border border-transparent",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-sans">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <div className="p-4 border-t border-border">
        <p className="font-hand text-base text-primary leading-tight">
          搜得到 · 收成卡
        </p>
        <p className="mono-label mt-1">Not another wiki</p>
      </div>
    </aside>
  );
}
