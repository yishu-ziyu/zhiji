"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, ListTree, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar } from "@/shared/components/layout/Sidebar";
import type {
  ActionItem,
  ActionStatus,
  ActionSuggestion,
  KnowledgeSearchHit,
  KnowledgeSource,
} from "@/shared/types/knowledge";
import { ActionSuggestions } from "./components/ActionSuggestions";
import { CardList } from "./components/CardList";
import { KnowledgeSearch } from "./components/KnowledgeSearch";

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

export default function KnowledgePage() {
  const [query, setQuery] = useState("检索 来源");
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("手记");
  const [transcript, setTranscript] = useState(
    "今天对齐了知识工作者 demo：先检索再沉淀。小王负责补验收标准，本周五前完成。决定采用带来源的卡片列表。",
  );
  const [goal, setGoal] = useState("48 小时内做出可演示的知识检索与行动闭环");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshActions = useCallback(async () => {
    const res = await fetch("/api/knowledge/state");
    const data = (await res.json()) as { actions?: ActionItem[] };
    setActions(data.actions ?? []);
  }, []);

  const runSearch = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ hits: KnowledgeSearchHit[] }>(
        "/api/knowledge/search",
        { query: q ?? query },
      );
      setHits(data.hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "检索失败");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const refreshSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ suggestions: ActionSuggestion[] }>(
        "/api/knowledge/state",
        { action: "suggest", context: query },
      );
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "建议失败");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [searchData, stateRes, suggestData] = await Promise.all([
          postJson<{ hits: KnowledgeSearchHit[] }>("/api/knowledge/search", {
            query: "检索 来源",
          }),
          fetch("/api/knowledge/state").then((r) => r.json()) as Promise<{
            actions?: ActionItem[];
          }>,
          postJson<{ suggestions: ActionSuggestion[] }>("/api/knowledge/state", {
            action: "suggest",
            context: "检索 来源",
          }),
        ]);
        if (!alive) return;
        setHits(searchData.hits);
        setActions(stateRes.actions ?? []);
        setSuggestions(suggestData.suggestions ?? []);
      } catch {
        // First paint can stay empty; user can retry via buttons.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleAdd() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await postJson("/api/knowledge/add", {
        content: newContent,
        source: "manual" as KnowledgeSource,
        tags: newTags
          .split(/[,，\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        title: newContent.slice(0, 24),
      });
      setNewContent("");
      setNotice("已保存卡片");
      await runSearch(query || newContent.slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleMinutes() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await postJson<{
        title: string;
        cards: unknown[];
        actionItems: ActionItem[];
        offline?: boolean;
      }>("/api/knowledge/minutes", { transcript });
      setNotice(
        `纪要「${data.title}」完成：${data.cards.length} 张卡片，${data.actionItems.length} 条行动${data.offline ? "（离线兜底）" : ""}`,
      );
      await refreshActions();
      await runSearch("会议");
      await refreshSuggestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "纪要失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDissect() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await postJson<{
        actionItems: ActionItem[];
        offline?: boolean;
      }>("/api/knowledge/dissect", { goal });
      setNotice(
        `拆解完成：${data.actionItems.length} 条行动${data.offline ? "（离线）" : ""}`,
      );
      await refreshActions();
      await refreshSuggestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "拆解失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId: string, status: ActionStatus) {
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/knowledge/state", {
        action: "update",
        taskId,
        newStatus: status,
      });
      await refreshActions();
      await refreshSuggestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "状态更新失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar efficiencyMode="board" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          <header className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              <BookOpen className="w-3.5 h-3.5" />
              知识工作者闭环 · 检索 / 沉淀 / 协作
            </div>
            <h1 className="text-2xl font-bold tracking-tight">知识库工作台</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              找得到 → 收成卡片 → 拆成行动 → 更新状态。MCP 工具见{" "}
              <code className="text-xs bg-muted px-1 rounded">GET /api/knowledge/mcp</code>
              。
            </p>
          </header>

          {(error || notice) && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                error
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {error || notice}
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              资料检索
            </h2>
            <KnowledgeSearch
              query={query}
              loading={loading}
              onQueryChange={setQuery}
              onSearch={() => void runSearch()}
            />
            <CardList hits={hits} />
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold">沉淀卡片</h2>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="写一条可复用的事实、结论或约定…"
                rows={4}
              />
              <input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="标签，逗号分隔"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <Button type="button" onClick={() => void handleAdd()} disabled={loading || !newContent.trim()}>
                保存到知识库
              </Button>
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ListTree className="w-4 h-4" />
                任务拆解
              </h2>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={4}
              />
              <Button type="button" onClick={() => void handleDissect()} disabled={loading || !goal.trim()}>
                拆解为目标行动
              </Button>
            </Card>
          </div>

          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">会议 / 粘贴文本 → 卡片 + 行动</h2>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={5}
            />
            <Button type="button" onClick={() => void handleMinutes()} disabled={loading || !transcript.trim()}>
              生成纪要并入库
            </Button>
          </Card>

          <section>
            <ActionSuggestions
              actions={actions}
              suggestions={suggestions}
              onStatusChange={(id, status) => void handleStatusChange(id, status)}
              onRefreshSuggestions={() => void refreshSuggestions()}
              loading={loading}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
