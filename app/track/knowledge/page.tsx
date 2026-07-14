"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/shared/components/layout/Sidebar";
import type {
  ActionItem,
  ActionStatus,
  ActionSuggestion,
  FootprintLitEntry,
  FootprintViewMode,
  KnowledgeCard,
  KnowledgeRelation,
  KnowledgeSearchHit,
  KnowledgeSource,
  LibraryNode,
  RelationNeighborEdge,
  RelationType,
  WorkEvent,
} from "@/shared/types/knowledge";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";
import { CapturePanel } from "./components/CapturePanel";
import { CardList } from "./components/CardList";
import {
  CardRelationsPanel,
} from "./components/CardRelationsPanel";
import { KnowledgeFootprintMap } from "./components/KnowledgeFootprintMap";
import { KnowledgeSearch } from "./components/KnowledgeSearch";
import { WorkItemsPanel } from "./components/WorkItemsPanel";

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

async function patchJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

type WorkDetail = {
  item: ActionItem;
  events: WorkEvent[];
  evidence: KnowledgeCard[];
};

export default function KnowledgePage() {
  const defaultUser = DEFAULT_ACTOR;
  const [query, setQuery] = useState("检索 来源");
  const [sourceFilter, setSourceFilter] = useState<KnowledgeSource | "all">("all");
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [filterMine, setFilterMine] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("手记");
  const [transcript, setTranscript] = useState(
    "今天对齐了知识工作者 demo：先检索再沉淀。小王负责补验收标准，本周五前完成。决定采用带来源的卡片列表。",
  );
  const [goal, setGoal] = useState("两天内做出能演示的检索、卡片和待办");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [querySessionId, setQuerySessionId] = useState<string | null>(null);
  const [footprintMode, setFootprintMode] =
    useState<FootprintViewMode>("current_query");
  const [libraryNodes, setLibraryNodes] = useState<LibraryNode[]>([]);
  const [footprintLit, setFootprintLit] = useState<FootprintLitEntry[]>([]);
  const [litCount, setLitCount] = useState(0);
  const [dimCount, setDimCount] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [relationEdges, setRelationEdges] = useState<RelationNeighborEdge[]>(
    [],
  );
  const [islandEdges, setIslandEdges] = useState<KnowledgeRelation[]>([]);
  const [pathHint, setPathHint] = useState<{
    nodes: string[];
    length: number;
  } | null>(null);
  const [allCards, setAllCards] = useState<KnowledgeCard[]>([]);

  const refreshLibraryMap = useCallback(async () => {
    const res = await fetch("/api/knowledge/library-map");
    if (!res.ok) return;
    const data = (await res.json()) as { nodes?: LibraryNode[] };
    setLibraryNodes(data.nodes ?? []);
  }, []);

  const refreshFootprint = useCallback(
    async (
      mode: FootprintViewMode,
      sessionId?: string | null,
      workId?: string | null,
    ) => {
      const params = new URLSearchParams({ mode });
      if (mode === "current_query") {
        const sid = sessionId ?? querySessionId;
        if (!sid) {
          setFootprintLit([]);
          setLitCount(0);
          return;
        }
        params.set("querySessionId", sid);
      }
      if (mode === "work_item") {
        const wid = workId ?? selectedId;
        if (!wid) {
          setFootprintLit([]);
          setLitCount(0);
          return;
        }
        params.set("workItemId", wid);
      }
      if (mode === "window") params.set("sinceDays", "7");
      const res = await fetch(`/api/knowledge/footprint?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        lit?: FootprintLitEntry[];
        litCount?: number;
        dimCount?: number;
      };
      setFootprintLit(data.lit ?? []);
      setLitCount(data.litCount ?? data.lit?.length ?? 0);
      setDimCount(data.dimCount ?? 0);
    },
    [querySessionId, selectedId],
  );

  const refreshActions = useCallback(async () => {
    const qs = filterMine
      ? `?assignee=${encodeURIComponent(defaultUser)}&openOnly=1`
      : "";
    const res = await fetch(`/api/knowledge/work-items${qs}`);
    const data = (await res.json()) as { items?: ActionItem[] };
    setActions(data.items ?? []);
  }, [filterMine, defaultUser]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/knowledge/work-items/${id}`);
    if (!res.ok) {
      setDetail(null);
      setIslandEdges([]);
      return;
    }
    const data = (await res.json()) as WorkDetail;
    setDetail(data);
    const islandRes = await fetch(`/api/knowledge/work-items/${id}/island`);
    if (islandRes.ok) {
      const island = (await islandRes.json()) as {
        edges?: KnowledgeRelation[];
      };
      setIslandEdges(island.edges ?? []);
    } else {
      setIslandEdges([]);
    }
  }, []);

  const loadNeighbors = useCallback(async (cardId: string | null) => {
    if (!cardId) {
      setRelationEdges([]);
      setPathHint(null);
      return;
    }
    const res = await fetch(`/api/knowledge/cards/${cardId}/neighbors`);
    if (!res.ok) {
      setRelationEdges([]);
      return;
    }
    const data = (await res.json()) as { edges?: RelationNeighborEdge[] };
    setRelationEdges(data.edges ?? []);
  }, []);


  const runSearch = useCallback(
    async (q?: string, source?: KnowledgeSource | "all") => {
      setLoading(true);
      setError(null);
      setSearchedOnce(true);
      const nextQuery = q ?? query;
      const nextSource = source ?? sourceFilter;
      try {
        const data = await postJson<{
          hits: KnowledgeSearchHit[];
          querySessionId?: string;
        }>("/api/knowledge/search", {
          query: nextQuery,
          filters:
            nextSource === "all"
              ? { limit: 20 }
              : { source: nextSource, limit: 20 },
        });
        setHits(data.hits);
        setAllCards((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          for (const h of data.hits) map.set(h.id, h);
          return [...map.values()];
        });
        if (data.querySessionId) {
          setQuerySessionId(data.querySessionId);
          setFootprintMode("current_query");
          await refreshLibraryMap();
          await refreshFootprint("current_query", data.querySessionId);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "检索失败");
      } finally {
        setLoading(false);
      }
    },
    [query, sourceFilter, refreshLibraryMap, refreshFootprint],
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
        const [searchData, itemsRes, suggestData, mapRes] = await Promise.all([
          postJson<{
            hits: KnowledgeSearchHit[];
            querySessionId?: string;
          }>("/api/knowledge/search", {
            query: "检索 来源",
          }),
          fetch("/api/knowledge/work-items").then((r) => r.json()) as Promise<{
            items?: ActionItem[];
          }>,
          postJson<{ suggestions: ActionSuggestion[] }>("/api/knowledge/state", {
            action: "suggest",
            context: "检索 来源",
          }),
          fetch("/api/knowledge/library-map").then((r) => r.json()) as Promise<{
            nodes?: LibraryNode[];
          }>,
        ]);
        if (!alive) return;
        setHits(searchData.hits);
        setAllCards(searchData.hits);
        setActions(itemsRes.items ?? []);
        setSuggestions(suggestData.suggestions ?? []);
        setLibraryNodes(mapRes.nodes ?? []);
        setSearchedOnce(true);
        if (searchData.querySessionId) {
          setQuerySessionId(searchData.querySessionId);
          const fp = await fetch(
            `/api/knowledge/footprint?mode=current_query&querySessionId=${searchData.querySessionId}`,
          ).then((r) => r.json());
          setFootprintLit(fp.lit ?? []);
          setLitCount(fp.litCount ?? 0);
          setDimCount(fp.dimCount ?? 0);
        }
        const firstCard = searchData.hits[0];
        if (firstCard) {
          setSelectedCardId(firstCard.id);
          await loadNeighbors(firstCard.id);
        }
        const first = itemsRes.items?.[0];
        if (first) {
          setSelectedId(first.id);
          await loadDetail(first.id);
        }
      } catch {
        // First paint can stay empty; user can retry via buttons.
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadDetail, loadNeighbors]);

  useEffect(() => {
    void refreshActions();
  }, [filterMine, refreshActions]);

  useEffect(() => {
    void loadNeighbors(selectedCardId);
  }, [selectedCardId, loadNeighbors]);

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
      setNotice("已保存卡片");
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
        `纪要「${data.title}」：${data.cards.length} 卡 · ${data.actionItems.length} 工作项${data.offline ? "（离线）" : ""}`,
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
        `已拆 ${data.actionItems.length} 条工作项${data.offline ? "（离线）" : ""}`,
      );
      await refreshActions();
      await refreshSuggestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "拆解失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(id: string) {
    setSelectedId(id);
    setError(null);
    try {
      await loadDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载详情失败");
    }
  }

  async function handlePatch(
    id: string,
    patch: Partial<{
      status: ActionStatus;
      assignee: string;
      nextStep: string;
      blockedReason: string;
    }>,
  ) {
    setLoading(true);
    setError(null);
    try {
      await patchJson(`/api/knowledge/work-items/${id}`, patch);
      await refreshActions();
      await loadDetail(id);
      setNotice("工作项已更新");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(input: {
    title: string;
    assignee: string;
    nextStep: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ item: ActionItem }>(
        "/api/knowledge/work-items",
        {
          title: input.title,
          description: input.title,
          assignee: input.assignee,
          nextStep: input.nextStep,
          status: "todo",
        },
      );
      await refreshActions();
      setSelectedId(data.item.id);
      await loadDetail(data.item.id);
      setNotice("已创建工作项");
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEvent(
    id: string,
    type: "comment" | "decision" | "result" | "block",
    body: string,
  ) {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/knowledge/work-items/${id}/events`, {
        type,
        body,
        actor: defaultUser,
      });
      await refreshActions();
      await loadDetail(id);
      setNotice(type === "block" ? "已标记阻塞" : "已写入时间线");
    } catch (e) {
      setError(e instanceof Error ? e.message : "写入失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkEvidence(workItemId: string, cardId: string) {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/knowledge/work-items/${workItemId}/evidence`, {
        cardId,
        actor: defaultUser,
      });
      await loadDetail(workItemId);
      await refreshFootprint(footprintMode, querySessionId, workItemId);
      setNotice("已关联依据");
    } catch (e) {
      setError(e instanceof Error ? e.message : "关联失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleFootprintMode(mode: FootprintViewMode) {
    setFootprintMode(mode);
    setError(null);
    try {
      await refreshFootprint(mode, querySessionId, selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "足迹加载失败");
    }
  }

  async function handleCreateRelation(input: {
    fromCardId: string;
    toCardId: string;
    relationType: RelationType;
    evidenceSentence: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/knowledge/relations", {
        ...input,
        createdBy: defaultUser,
      });
      await loadNeighbors(input.fromCardId);
      if (selectedId) await loadDetail(selectedId);
      setNotice("已保存关系");
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建关系失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleRelationStatus(
    relationId: string,
    status: "confirmed" | "rejected",
  ) {
    setLoading(true);
    setError(null);
    try {
      await patchJson(`/api/knowledge/relations/${relationId}`, { status });
      await loadNeighbors(selectedCardId);
      if (selectedId) await loadDetail(selectedId);
      setNotice(status === "confirmed" ? "已确认关系" : "已否决建议");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新关系失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectCard(cardId: string) {
    setSelectedCardId(cardId);
    // After neighbors load (effect), optionally compute path to first neighbor.
    // Here: path to first island peer if any.
    const islandPeer = islandEdges.find(
      (e) => e.fromCardId === cardId || e.toCardId === cardId,
    );
    const other = islandPeer
      ? islandPeer.fromCardId === cardId
        ? islandPeer.toCardId
        : islandPeer.fromCardId
      : null;
    if (!other) {
      setPathHint(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/knowledge/path?from=${encodeURIComponent(cardId)}&to=${encodeURIComponent(other)}&maxDepth=3`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          path?: { nodes: string[]; length: number } | null;
        };
        setPathHint(data.path ?? null);
      }
    } catch {
      setPathHint(null);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
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
              className={`rounded-[12px] border px-3 py-2 text-sm max-w-3xl mx-auto font-serif-cn ${
                error
                  ? "border-destructive/50 bg-destructive/10 text-[#f5c4c0]"
                  : "border-primary/40 bg-primary/10 text-foreground"
              }`}
            >
              {error || notice}
            </div>
          )}

          {answerLine && (
            <div className="max-w-3xl mx-auto paper-card paper-grain p-4 animate-rise no-shadow">
              <p className="mono-label text-[#1a1a1a]/70 mb-2">
                Answer · {answerLine.count} sources · {answerLine.source}
              </p>
              <p className="font-hand text-[28px] leading-tight text-[#1a1a1a]">
                {answerLine.title}
              </p>
              <p className="font-serif-cn text-[13px] text-[#1a1a1a]/80 mt-2 leading-relaxed">
                {answerLine.blurb}
              </p>
            </div>
          )}

          <KnowledgeFootprintMap
            nodes={libraryNodes}
            lit={footprintLit}
            mode={footprintMode}
            litCount={litCount}
            dimCount={dimCount}
            selectedCardId={selectedCardId}
            loading={loading}
            workItemModeAvailable={Boolean(selectedId)}
            onModeChange={(m) => void handleFootprintMode(m)}
            onSelectCard={(id) => void handleSelectCard(id)}
          />

          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
            <section className="space-y-5 min-w-0">
              <CardList
                hits={hits}
                query={query}
                selectedCardId={selectedCardId}
                onSelectCard={(id) => void handleSelectCard(id)}
              />
              <CardRelationsPanel
                cardId={selectedCardId}
                edges={relationEdges}
                linkableCards={allCards.length > 0 ? allCards : hits}
                loading={loading}
                onSelectCard={(id) => void handleSelectCard(id)}
                onCreate={(input) => void handleCreateRelation(input)}
                onConfirm={(id) => void handleRelationStatus(id, "confirmed")}
                onReject={(id) => void handleRelationStatus(id, "rejected")}
                pathHint={pathHint}
              />
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
              <div className="surface-card p-4">
                <WorkItemsPanel
                  items={actions}
                  selectedId={selectedId}
                  detail={detail}
                  suggestions={suggestions}
                  filterMine={filterMine}
                  defaultUser={defaultUser}
                  loading={loading}
                  onSelect={(id) => void handleSelect(id)}
                  onFilterMineChange={setFilterMine}
                  onRefreshSuggestions={() => void refreshSuggestions()}
                  onCreate={(input) => void handleCreate(input)}
                  onPatch={(id, patch) => void handlePatch(id, patch)}
                  onAddEvent={(id, type, body) =>
                    void handleAddEvent(id, type, body)
                  }
                  onLinkEvidence={(wid, cid) =>
                    void handleLinkEvidence(wid, cid)
                  }
                  linkableCards={hits}
                  islandEdges={islandEdges}
                />
              </div>
              <p className="mono-label mt-2 px-1 text-center lg:text-left">
                API · /api/knowledge/work-items
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
