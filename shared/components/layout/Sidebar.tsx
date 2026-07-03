"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingBag,
  Zap,
  TrendingUp,
  Video,
  MessageSquare,
  KanbanSquare,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import type { TrackType, EcommerceMode, EfficiencyMode } from "@/shared/types/common";
import { cn } from "@/lib/utils";

interface SidebarProps {
  track: TrackType;
  ecommerceMode: EcommerceMode;
  efficiencyMode: EfficiencyMode;
  onTrackChange: (track: TrackType) => void;
}

const ecommerceItems = [
  { id: "analyze" as const, label: "选品分析", icon: TrendingUp },
  { id: "script" as const, label: "脚本生成", icon: Video },
];

const efficiencyItems = [
  { id: "minutes" as const, label: "会议纪要", icon: FileText },
  { id: "kanban" as const, label: "项目看板", icon: KanbanSquare },
];

export function Sidebar({ track, ecommerceMode, efficiencyMode, onTrackChange }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const goHome = () => router.push("/");

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <button onClick={goHome} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">FC-OPC</div>
            <div className="text-xs text-muted-foreground">iBot 2026</div>
          </div>
        </button>
      </div>

      {/* Track Switcher */}
      <div className="p-3">
        <Tabs
          value={track}
          onValueChange={(v) => onTrackChange(v as TrackType)}
          className="w-full"
        >
          <TabsList className="w-full bg-muted/50 h-9">
            <TabsTrigger
              value="ecommerce"
              className="flex-1 text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              电商 Agent
            </TabsTrigger>
            <TabsTrigger
              value="efficiency"
              className="flex-1 text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              效率 Agent
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Mode Tabs */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {track === "ecommerce" ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground px-2 py-1.5 font-medium">
              功能
            </div>
            {ecommerceItems.map((item) => {
              const Icon = item.icon;
              const active = ecommerceMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (pathname !== `/track/ecommerce`) {
                      router.push("/track/ecommerce");
                    }
                  }}
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
        ) : (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground px-2 py-1.5 font-medium">
              功能
            </div>
            {efficiencyItems.map((item) => {
              const Icon = item.icon;
              const active = efficiencyMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (pathname !== `/track/efficiency`) {
                      router.push("/track/efficiency");
                    }
                  }}
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
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          FC-OPC Next iBot 2026
        </div>
      </div>
    </aside>
  );
}
