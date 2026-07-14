"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/shared/components/layout/Sidebar";
import type {
  ActionItem,
  ActionStatus,
  ActionSuggestion,
  KnowledgeSearchHit,
  KnowledgeSource,
} from "@/shared/types/knowledge";
import { ActionSuggestions } from "./components/ActionSuggestions";
import { CapturePanel } from "./components/CapturePanel";
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
  const [sourceFilter, setSourceFilter] = useState<KnowledgeSource | "all">("all");
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
  const [searchedOnce, setSearchedOnce] = useState(false);

  const refreshActions = useCallback(async () => {
    const res = await fetch("/api/knowledge/state");
    const data = (await res.json()) as { actions?: ActionItem[] };
    setActions(data.actions ?? []);
  }, []);

  const runSearch = useCallback(
    async (q?: string, source?: KnowledgeSource | "all") => {
      setLoading(true);
      setError(null);
      setSearchedOnce(true);
      const nextQuery = q ?? query;
      const nextSource = source ?? sourceFilter;
      try {
        const data = await postJson<{ hits: KnowledgeSearchHit[] }>(
          "/api/knowledge/search",
          {
            query: nextQuery,
            filters:
              nextSource === "all"
                ? { limit: 20 }
                : { source: nextSource, limit: 20 },
          },
        );
        setHits(data.hits);
      } catch (e) {
        setError(e instanceof Error ? e.message : "检索失败");
      } finally {
        setLoading(false);
      }
    },
    [query, sourceFilter],
  );

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
        setSearchedOnce(true);
      } catch {
        // First paint can stay empty; user can retry via buttons.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const answerLine = useMemo(() => {
    if (!searchedOnce || hits.length === 0) return null;
    const top = hits[0];
    const src =
      top.source === "meeting"
        ? "会议"
        : top.source === "doc"
          ? "文档"
          : top.source === "chat"
            ? "聊天"
            : top.source === "email"
              ? "邮件"
              : "手记";
    return {
      title: top.title || top.content.slice(0, 48),
      blurb: top.content.slice(0, 120) + (top.content.length > 120 ? "…" : ""),
      source: src,
      count: hits.length,
    };
  }, [hits, searchedOnce]);

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
      setNotice("已保存卡片（Notion 式属性：标签 · 手记 · 时间）");
      await runSearch(query || "手记");
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
        `纪要「${data.title}」：${data.cards.length} 卡 · ${data.actionItems.length} 行动${data.offline ? "（离线）" : ""}`,
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
        `已拆 ${data.actionItems.length} 条行动${data.offline ? "（离线）" : ""}`,
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
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
          <KnowledgeSearch
            query={query}
            loading={loading}
            sourceFilter={sourceFilter}
            onQueryChange={setQuery}
            onSourceFilterChange={(v) => {
              setSourceFilter(v);
              void runSearch(query, v);
            }}
            onSearch={(q) => void runSearch(q)}
          />

          {(error || notice) && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm max-w-3xl mx-auto ${
                error
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {error || notice}
            </div>
          )}

          {answerLine && (
            <div className="max-w-3xl mx-auto rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4">
              <p className="text-[11px] font-medium text-primary mb-1">
                简答 · 依据 {answerLine.count} 条 · 首要来源 {answerLine.source}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {answerLine.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {answerLine.blurb}
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
            <section className="space-y-4 min-w-0">
              <CardList hits={hits} query={query} />
              <CapturePanel
                loading={loading}
                newContent={newContent}
                newTags={newTags}
                transcript={transcript}
                goal={goal}
                onNewContentChange={setNewContent}
                onNewTagsChange={setNewTags}
                onTranscriptChange={setTranscript}
                onGoalChange={setGoal}
                onAdd={() => void handleAdd()}
                onMinutes={() => void handleMinutes()}
                onDissect={() => void handleDissect()}
              />
            </section>

            <div className="lg:sticky lg:top-6">
              <div className="rounded-2xl border border-border/70 bg-card/50 p-3.5">
                <ActionSuggestions
                  actions={actions}
                  suggestions={suggestions}
                  onStatusChange={(id, status) => void handleStatusChange(id, status)}
                  onRefreshSuggestions={() => void refreshSuggestions()}
                  loading={loading}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 px-1 text-center lg:text-left">
                MCP：GET /api/knowledge/mcp
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
