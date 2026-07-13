"use client";

import { useRouter } from "next/navigation";
import { Zap, Target } from "lucide-react";
import type { EfficiencyMode } from "@/shared/types/common";
import { cn } from "@/lib/utils";

interface SidebarProps {
  efficiencyMode?: EfficiencyMode;
}

const efficiencyItems = [
  { id: "capture" as const, label: "交付闭环", icon: Target },
];

export function Sidebar({ efficiencyMode = "capture" }: SidebarProps) {
  const router = useRouter();
  const goHome = () => router.push("/");

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-border flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">FC-OPC</div>
            <div className="text-xs text-muted-foreground">交付运营助手</div>
          </div>
        </button>
      </div>
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground px-2 py-1.5 font-medium">
            效率 OPC · 本场主线
          </div>
          {efficiencyItems.map((item) => {
            const Icon = item.icon;
            const active = efficiencyMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push("/track/efficiency")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          效率赛道 · 双方确认事实
        </div>
      </div>
    </aside>
  );
}
