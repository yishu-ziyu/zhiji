"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  FilePlus2,
  Filter,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ActionItem,
  ActionStatus,
  CanvasNodeRef,
  FootprintLitEntry,
  FootprintViewMode,
  KnowledgeCard,
  KnowledgeSource,
  Project,
  ProjectCanvasSnapshot,
  ProjectSearchHit,
  RelationType,
} from "@/shared/types/knowledge";
import { SOURCE_CLUSTER_LABELS } from "@/shared/types/knowledge";
import { ProjectCanvas } from "./components/ProjectCanvas";
import { ProjectInspector } from "./components/ProjectInspector";
import { ProjectNavigator } from "./components/ProjectNavigator";
import { ProjectTimeline } from "./components/ProjectTimeline";
import styles from "./project-canvas.module.css";

type ApiError = { error?: string };

async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & ApiError;
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function focusValue(ref: CanvasNodeRef) {
  return `${ref.kind}:${ref.id}`;
}

function focusFromUrl(projectId: string): CanvasNodeRef {
  const value = new URL(window.location.href).searchParams.get("focus");
  if (!value) return { kind: "project", id: projectId };
  const separator = value.indexOf(":");
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (
    !["project", "card", "work_item", "event"].includes(kind) ||
    !id
  ) {
    return { kind: "project", id: projectId };
  }
  return { kind: kind as CanvasNodeRef["kind"], id };
}

export default function KnowledgePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [snapshot, setSnapshot] = useState<ProjectCanvasSnapshot | null>(null);
  const [projectCards, setProjectCards] = useState<KnowledgeCard[]>([]);
  const [myOpenWork, setMyOpenWork] = useState<ActionItem[]>([]);
  const [footprint, setFootprint] = useState<FootprintLitEntry[]>([]);
  const [footprintMode, setFootprintMode] = useState<FootprintViewMode>("window");
  const [footprintRevision, setFootprintRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProjectSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [createWorkOpen, setCreateWorkOpen] = useState(false);
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [cardContent, setCardContent] = useState("");
  const [cardSource, setCardSource] = useState<KnowledgeSource>("manual");
  const [workTitle, setWorkTitle] = useState("");
  const [workNextStep, setWorkNextStep] = useState("");
  const [workEvidenceId, setWorkEvidenceId] = useState("");
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materials, setMaterials] = useState<
    Array<{ id: string; name: string; kind: string; updatedAt: string }>
  >([]);
  const [materialView, setMaterialView] = useState<{
    name: string;
    html?: string;
    content: string;
    preview: boolean;
  } | null>(null);
  const [projectJumpOpen, setProjectJumpOpen] = useState(false);
  const [projectJumpQuery, setProjectJumpQuery] = useState("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSummary, setNewProjectSummary] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const snapshotRequestRef = useRef(0);
  const cardsRequestRef = useRef(0);
  const workRequestRef = useRef(0);
  const footprintRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const navigationRequestRef = useRef(0);
  const mutationRequestRef = useRef(0);
  const activeProjectIdRef = useRef("");

  const loadSnapshot = useCallback(
    async (nextProjectId: string, focus?: CanvasNodeRef) => {
      const requestId = ++snapshotRequestRef.current;
      setLoading(true);
      setError(null);
      try {
        const ref = focus ?? focusFromUrl(nextProjectId);
        const params = new URLSearchParams({ focus: focusValue(ref) });
        const data = await apiJson<{ snapshot: ProjectCanvasSnapshot }>(
          `/api/knowledge/projects/${nextProjectId}/canvas?${params}`,
        );
        if (requestId === snapshotRequestRef.current) {
          setSnapshot(data.snapshot);
        }
      } catch (nextError) {
        if (requestId === snapshotRequestRef.current) {
          setError(nextError instanceof Error ? nextError.message : "读取项目失败");
        }
      } finally {
        if (requestId === snapshotRequestRef.current) setLoading(false);
      }
    },
    [],
  );

  const loadProjectCards = useCallback(async (nextProjectId: string) => {
    const requestId = ++cardsRequestRef.current;
    const data = await apiJson<{ cards: KnowledgeCard[] }>(
      `/api/knowledge/add?projectId=${encodeURIComponent(nextProjectId)}`,
    );
    if (requestId === cardsRequestRef.current) setProjectCards(data.cards);
  }, []);

  const loadMyOpenWork = useCallback(async (nextProjectId: string) => {
    const requestId = ++workRequestRef.current;
    const params = new URLSearchParams({
      projectId: nextProjectId,
      assignee: "自己",
      openOnly: "1",
    });
    const data = await apiJson<{ items: ActionItem[] }>(
      `/api/knowledge/work-items?${params}`,
    );
    if (requestId === workRequestRef.current) setMyOpenWork(data.items);
  }, []);

  const loadFootprint = useCallback(async (options?: {
    mode?: FootprintViewMode;
    querySessionId?: string;
    workItemId?: string;
  }) => {
    const requestId = ++footprintRequestRef.current;
    const mode = options?.mode ?? "window";
    const params = new URLSearchParams({ mode });
    if (options?.querySessionId) params.set("querySessionId", options.querySessionId);
    if (options?.workItemId) params.set("workItemId", options.workItemId);
    if (mode === "window") params.set("sinceDays", "7");
    const data = await apiJson<{ lit: FootprintLitEntry[] }>(
      `/api/knowledge/footprint?${params}`,
    );
    if (requestId === footprintRequestRef.current) {
      setFootprint(data.lit);
      setFootprintMode(mode);
      setFootprintRevision((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await apiJson<{ projects: Project[] }>(
          "/api/knowledge/projects",
        );
        if (!active) return;
        setProjects(data.projects);
        const url = new URL(window.location.href);
        const urlProjectId = url.searchParams.get("projectId");
        // No project in URL → open the most recently active project (list already ranked).
        const selected =
          data.projects.find((project) => project.id === urlProjectId) ??
          data.projects[0];
        if (selected) {
          activeProjectIdRef.current = selected.id;
          setProjectId(selected.id);
          const focus = urlProjectId
            ? focusFromUrl(selected.id)
            : ({ kind: "project", id: selected.id } as const);
          if (!urlProjectId) {
            updateUrl(selected.id, focus, true);
          }
          void apiJson(`/api/knowledge/projects/${selected.id}/open`, {
            method: "POST",
          }).catch(() => undefined);
          await Promise.all([
            loadSnapshot(selected.id, focus),
            loadProjectCards(selected.id),
            loadMyOpenWork(selected.id),
            loadFootprint(),
          ]);
        } else {
          // Honest empty: no seed project masquerading as user work.
          activeProjectIdRef.current = "";
          setProjectId("");
          setSnapshot(null);
          setLoading(false);
          setCreateProjectOpen(true);
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "读取项目失败");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadFootprint, loadMyOpenWork, loadProjectCards, loadSnapshot]);

  useEffect(() => {
    function handlePopState() {
      const url = new URL(window.location.href);
      const requestedId = url.searchParams.get("projectId");
      const selected = projects.find((project) => project.id === requestedId) ?? projects[0];
      if (!selected) return;
      const focus = selected.id === requestedId
        ? focusFromUrl(selected.id)
        : ({ kind: "project", id: selected.id } as const);
      activeProjectIdRef.current = selected.id;
      mutationRequestRef.current += 1;
      setBusy(false);
      setProjectId(selected.id);
      setSnapshot(null);
      setQuery("");
      setSearchResults([]);
      setSearching(false);
      setProjectCards([]);
      setMyOpenWork([]);
      setFootprint([]);
      navigationRequestRef.current += 1;
      searchRequestRef.current += 1;
      if (selected.id !== requestedId) updateUrl(selected.id, focus, true);
      void Promise.all([
        loadSnapshot(selected.id, focus),
        loadProjectCards(selected.id),
        loadMyOpenWork(selected.id),
        loadFootprint(),
      ]);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadFootprint, loadMyOpenWork, loadProjectCards, loadSnapshot, projects]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setProjectJumpOpen(true);
        setProjectJumpQuery("");
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function openMaterialsPanel() {
    if (!projectId) return;
    setMaterialsOpen(true);
    setMaterialView(null);
    try {
      const data = await apiJson<{
        materials: Array<{ id: string; name: string; kind: string; updatedAt: string }>;
      }>(`/api/knowledge/projects/${projectId}/materials`);
      setMaterials(data.materials);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "读取材料失败");
    }
  }

  async function openMaterialFile(fileId: string) {
    if (!projectId) return;
    try {
      const data = await apiJson<{
        file: { name: string };
        content: string;
        html?: string;
        preview: boolean;
      }>(
        `/api/knowledge/projects/${projectId}/materials?file=${encodeURIComponent(fileId)}`,
      );
      setMaterialView({
        name: data.file.name,
        content: data.content,
        html: data.html,
        preview: data.preview,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "打开文件失败");
    }
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name) {
      setError("项目名称不能为空");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiJson<{ project: Project }>(
        "/api/knowledge/projects",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            summary: newProjectSummary.trim() || undefined,
          }),
        },
      );
      setProjects((prev) => [data.project, ...prev.filter((p) => p.id !== data.project.id)]);
      setNewProjectName("");
      setNewProjectSummary("");
      setCreateProjectOpen(false);
      setBusy(false);
      setNotice("已创建项目");
      await handleSelectProject(data.project.id);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "创建项目失败");
      setBusy(false);
    }
  }

  async function handleUploadMaterialFile(file: File) {
    if (!projectId) return;
    const mutation = beginMutation();
    try {
      const content = await file.text();
      const data = await apiJson<{
        material: { id: string; name: string };
        card: KnowledgeCard;
      }>(`/api/knowledge/projects/${mutation.projectId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, content }),
      });
      if (!mutationIsCurrent(mutation)) return;
      const list = await apiJson<{
        materials: Array<{ id: string; name: string; kind: string; updatedAt: string }>;
      }>(`/api/knowledge/projects/${mutation.projectId}/materials`);
      if (!mutationIsCurrent(mutation)) return;
      setMaterials(list.materials);
      await loadProjectCards(mutation.projectId);
      if (!mutationIsCurrent(mutation)) return;
      setMaterialView({
        name: data.material.name,
        content,
        preview: false,
      });
      setBusy(false);
      setNotice(`已加入项目：${data.material.name}`);
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setError(nextError instanceof Error ? nextError.message : "上传文件失败");
      setBusy(false);
    }
  }

  function updateUrl(nextProjectId: string, focus: CanvasNodeRef, replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set("projectId", nextProjectId);
    url.searchParams.set("focus", focusValue(focus));
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  }

  function beginMutation() {
    const context = {
      id: ++mutationRequestRef.current,
      navigation: navigationRequestRef.current,
      projectId: activeProjectIdRef.current,
    };
    setBusy(true);
    setError(null);
    return context;
  }

  function mutationIsCurrent(context: ReturnType<typeof beginMutation>) {
    return context.id === mutationRequestRef.current &&
      context.navigation === navigationRequestRef.current &&
      context.projectId === activeProjectIdRef.current;
  }

  async function handleFocus(ref: CanvasNodeRef) {
    if (!projectId) return;
    const navigationId = ++navigationRequestRef.current;
    const requestedProjectId = projectId;
    setCheckpointOpen(false);
    updateUrl(requestedProjectId, ref);
    setSearchResults([]);
    const snapshotPromise = loadSnapshot(requestedProjectId, ref);
    if (ref.kind === "card") {
      void apiJson("/api/knowledge/footprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: ref.id }),
      }).then(() => {
        if (navigationId === navigationRequestRef.current) {
          return loadFootprint();
        }
      }).catch(() => undefined);
    }
    await snapshotPromise;
  }

  async function handleSelectProject(id: string) {
    navigationRequestRef.current += 1;
    mutationRequestRef.current += 1;
    activeProjectIdRef.current = id;
    setBusy(false);
    const focus = { kind: "project", id } as const;
    setProjectId(id);
    setSnapshot(null);
    setProjectCards([]);
    setMyOpenWork([]);
    setFootprint([]);
    setQuery("");
    setSearchResults([]);
    setSearching(false);
    searchRequestRef.current += 1;
    updateUrl(id, focus);
    void apiJson(`/api/knowledge/projects/${id}/open`, { method: "POST" }).catch(
      () => undefined,
    );
    await Promise.all([
      loadSnapshot(id, focus),
      loadProjectCards(id),
      loadMyOpenWork(id),
      loadFootprint(),
    ]);
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || !projectId) return;
    setSearching(true);
    setError(null);
    const requestId = ++searchRequestRef.current;
    const requestedProjectId = projectId;
    try {
      const data = await apiJson<{
        projectHits: ProjectSearchHit[];
        querySessionId?: string;
      }>(
        "/api/knowledge/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            filters: { projectId, limit: 8 },
          }),
        },
      );
      if (
        requestId === searchRequestRef.current &&
        requestedProjectId === projectId
      ) {
        setSearchResults(data.projectHits);
        if (data.querySessionId) {
          await loadFootprint({
            mode: "current_query",
            querySessionId: data.querySessionId,
          });
        }
      }
    } catch (nextError) {
      if (requestId === searchRequestRef.current) {
        setError(nextError instanceof Error ? nextError.message : "搜索失败");
      }
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  }

  async function handleUpdateNextStep(value: string) {
    if (!snapshot || snapshot.focus.kind !== "work_item") return;
    const mutation = beginMutation();
    try {
      await apiJson(`/api/knowledge/work-items/${snapshot.focus.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextStep: value }),
      });
      if (!mutationIsCurrent(mutation)) return;
      await Promise.all([
        loadSnapshot(mutation.projectId, snapshot.focus),
        loadMyOpenWork(mutation.projectId),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("下一步已写入时间线");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setError(nextError instanceof Error ? nextError.message : "更新失败");
      setBusy(false);
    }
  }

  async function handleLinkEvidence(cardId: string) {
    if (!snapshot || snapshot.focus.kind !== "work_item") return;
    const mutation = beginMutation();
    try {
      await apiJson(`/api/knowledge/work-items/${snapshot.focus.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (!mutationIsCurrent(mutation)) return;
      await Promise.all([
        loadSnapshot(mutation.projectId, snapshot.focus),
        loadMyOpenWork(mutation.projectId),
        loadFootprint({ mode: "work_item", workItemId: snapshot.focus.id }),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("依据已关联并写入时间线");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setError(nextError instanceof Error ? nextError.message : "关联依据失败");
    }
  }

  async function handleUpdateWork(input: {
    status: ActionStatus;
    blockedReason?: string;
    assignee?: string;
  }) {
    if (!snapshot || snapshot.focus.kind !== "work_item") return;
    const mutation = beginMutation();
    try {
      await apiJson(`/api/knowledge/work-items/${snapshot.focus.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!mutationIsCurrent(mutation)) return;
      await Promise.all([
        loadSnapshot(mutation.projectId, snapshot.focus),
        loadMyOpenWork(mutation.projectId),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("执行结果已写入项目状态和时间线");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setError(nextError instanceof Error ? nextError.message : "写入执行结果失败");
    }
  }

  async function handleAddComment(body: string) {
    if (!snapshot || snapshot.focus.kind !== "work_item") return;
    const mutation = beginMutation();
    try {
      await apiJson(`/api/knowledge/work-items/${snapshot.focus.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "comment", body }),
      });
      if (!mutationIsCurrent(mutation)) return;
      await Promise.all([
        loadSnapshot(mutation.projectId, snapshot.focus),
        loadMyOpenWork(mutation.projectId),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("执行记录已写入时间线");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setError(nextError instanceof Error ? nextError.message : "写入记录失败");
    }
  }

  async function handleCreateRelation(input: {
    toCardId: string;
    relationType: RelationType;
    evidenceSentence: string;
  }) {
    if (!snapshot || snapshot.focus.kind !== "card") return;
    const mutation = beginMutation();
    try {
      await apiJson("/api/knowledge/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCardId: snapshot.focus.id,
          toCardId: input.toCardId,
          relationType: input.relationType,
          evidenceSentence: input.evidenceSentence,
          status: "confirmed",
          source: "manual",
        }),
      });
      if (!mutationIsCurrent(mutation)) return;
      await Promise.all([
        loadSnapshot(mutation.projectId, snapshot.focus),
        loadMyOpenWork(mutation.projectId),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("材料关系已建立");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setError(nextError instanceof Error ? nextError.message : "建立关系失败");
    }
  }

  async function handleReviewRelation(
    relationId: string,
    status: "confirmed" | "rejected",
  ) {
    if (!snapshot || snapshot.focus.kind !== "card") return;
    const mutation = beginMutation();
    try {
      await apiJson(`/api/knowledge/relations/${relationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!mutationIsCurrent(mutation)) return;
      await loadSnapshot(mutation.projectId, snapshot.focus);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice(status === "confirmed" ? "建议关系已确认" : "建议关系已否决");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setError(nextError instanceof Error ? nextError.message : "更新关系失败");
    }
  }

  async function handleRunAgent() {
    if (!snapshot || snapshot.focus.kind !== "work_item") return;
    const mutation = beginMutation();
    try {
      await apiJson(
        `/api/knowledge/work-items/${snapshot.focus.id}/agent-run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!mutationIsCurrent(mutation)) return;
      await Promise.all([
        loadSnapshot(mutation.projectId, snapshot.focus),
        loadMyOpenWork(mutation.projectId),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("Agent 已写回复核结果，等待你确认");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      await Promise.all([
        loadSnapshot(mutation.projectId, snapshot.focus),
        loadMyOpenWork(mutation.projectId),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setError(nextError instanceof Error ? nextError.message : "Agent 执行失败");
    }
  }

  async function handleCheckpoint(input: {
    goal: string;
    completed: string[];
    unresolved: string[];
    nextStep: string;
  }) {
    if (!projectId) return;
    const mutation = beginMutation();
    try {
      await apiJson(`/api/knowledge/projects/${mutation.projectId}/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          completed: input.completed,
          unresolved: input.unresolved,
          confirmedBy: "自己",
        }),
      });
      if (!mutationIsCurrent(mutation)) return;
      setCheckpointOpen(false);
      await loadSnapshot(mutation.projectId, { kind: "project", id: mutation.projectId });
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("已保存你确认的项目状态");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setError(nextError instanceof Error ? nextError.message : "保存失败");
      setBusy(false);
    }
  }

  async function handleCreateWork(event: FormEvent) {
    event.preventDefault();
    if (!workTitle.trim() || !workNextStep.trim()) return;
    const mutation = beginMutation();
    try {
      const data = await apiJson<{ item: { id: string } }>(
        "/api/knowledge/work-items",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: mutation.projectId,
            title: workTitle.trim(),
            nextStep: workNextStep.trim(),
            assignee: "自己",
            cardId: workEvidenceId || undefined,
          }),
        },
      );
      if (!mutationIsCurrent(mutation)) return;
      setCreateWorkOpen(false);
      setWorkTitle("");
      setWorkNextStep("");
      setWorkEvidenceId("");
      mutation.navigation = navigationRequestRef.current + 1;
      await Promise.all([
        handleFocus({ kind: "work_item", id: data.item.id }),
        loadMyOpenWork(mutation.projectId),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("已创建工作项");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setError(nextError instanceof Error ? nextError.message : "创建失败");
      setBusy(false);
    }
  }

  async function handleCreateCard(event: FormEvent) {
    event.preventDefault();
    if (!cardContent.trim() || !projectId) return;
    const mutation = beginMutation();
    try {
      const data = await apiJson<{ card: KnowledgeCard }>("/api/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: mutation.projectId,
          title: cardTitle.trim() || undefined,
          content: cardContent.trim(),
          source: cardSource,
        }),
      });
      if (!mutationIsCurrent(mutation)) return;
      setCreateCardOpen(false);
      setCardTitle("");
      setCardContent("");
      setCardSource("manual");
      mutation.navigation = navigationRequestRef.current + 1;
      await Promise.all([
        loadProjectCards(mutation.projectId),
        handleFocus({ kind: "card", id: data.card.id }),
      ]);
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setNotice("项目材料已加入画布");
    } catch (nextError) {
      if (!mutationIsCurrent(mutation)) return;
      setBusy(false);
      setError(nextError instanceof Error ? nextError.message : "新增材料失败");
    }
  }

  async function requestCheckpoint() {
    if (!projectId) return;
    const projectFocus = { kind: "project", id: projectId } as const;
    if (
      snapshot?.focus.kind !== "project" ||
      snapshot.focus.id !== projectId
    ) {
      await handleFocus(projectFocus);
    }
    setCheckpointOpen(true);
    setNewMenuOpen(false);
  }

  const isEmptyWorkspace = !loading && projects.length === 0;

  return (
    <main className={styles.workspace} data-testid="project-canvas-shell">
      <ProjectNavigator
        key={`${projectId}:${footprintMode}:${footprintRevision}`}
        projects={projects}
        projectId={projectId}
        snapshot={snapshot}
        projectCards={projectCards}
        myOpenWork={myOpenWork}
        footprint={footprint}
        footprintMode={footprintMode}
        onSelectProject={handleSelectProject}
        onOpenSearch={() => searchRef.current?.focus()}
        onFocusAttention={() => {
          const first = snapshot?.attention[0];
          if (first) void handleFocus(first.target);
        }}
        onCreateWork={() => setCreateWorkOpen(true)}
        onOpenMaterials={() => void openMaterialsPanel()}
        onFocus={(ref) => void handleFocus(ref)}
      />

      <header className={styles.topbar}>
        <form className={styles.canvasSearch} onSubmit={handleSearch}>
          <button
            type="submit"
            className={styles.searchSubmit}
            aria-label="搜索当前项目"
            disabled={searching || !query.trim() || !projectId}
          >
            <Search size={20} />
          </button>
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              projectId
                ? "搜索当前项目的材料、任务和记录…"
                : "先新建项目，再搜索材料…"
            }
            aria-label="搜索内容"
            disabled={!projectId}
          />
          <kbd>⌘F</kbd>
          {searching ? <span className={styles.searching}>搜索中</span> : null}
          {searchResults.length > 0 ? (
            <div className={styles.searchResults}>
              {searchResults.map((hit) => (
                <button
                  key={`${hit.ref.kind}:${hit.ref.id}`}
                  type="button"
                  onClick={() => void handleFocus(hit.ref)}
                >
                  <FilePlus2 size={16} />
                  <span>
                    <strong>
                      {hit.title}
                      {hit.source ? <em className={styles.searchSource}>来源：{SOURCE_CLUSTER_LABELS[hit.source]}</em> : null}
                    </strong>
                    <small>{hit.summary}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </form>
        <div className={styles.topbarActions}>
          <button
            type="button"
            className={styles.copilotButton}
            onClick={() => {
              const first = snapshot?.attention[0];
              if (first) void handleFocus(first.target);
            }}
            disabled={!projectId}
          >
            <Sparkles size={17} />AI Copilot
          </button>
          <button type="button" className={styles.iconButton} aria-label="通知" disabled title="当前没有未读通知"><Bell size={18} /></button>
          <button type="button" className={styles.iconButton} aria-label="筛选" disabled title="当前视图已按项目过滤"><Filter size={18} /></button>
          <div className={styles.newMenuWrap}>
            <button
              type="button"
              className={styles.newButton}
              onClick={() => setNewMenuOpen((value) => !value)}
            >
              <Plus size={18} />新建<ChevronDown size={14} />
            </button>
            {newMenuOpen ? (
              <div className={styles.newMenu}>
                <button
                  type="button"
                  data-testid="open-create-project"
                  onClick={() => {
                    setCreateProjectOpen(true);
                    setNewMenuOpen(false);
                  }}
                >
                  <Plus size={16} /><span><strong>新建项目</strong><small>名称必填，真实接入</small></span>
                </button>
                <button type="button" onClick={() => void requestCheckpoint()} disabled={!projectId}>
                  <Bot size={16} /><span><strong>记录当前状态</strong><small>保存目标和下一步</small></span>
                </button>
                <button type="button" onClick={() => { setCreateWorkOpen(true); setNewMenuOpen(false); }} disabled={!projectId}>
                  <FilePlus2 size={16} /><span><strong>新增工作项</strong><small>写入项目和时间线</small></span>
                </button>
                <button type="button" onClick={() => { setCreateCardOpen(true); setNewMenuOpen(false); }} disabled={!projectId}>
                  <FilePlus2 size={16} /><span><strong>新增项目材料</strong><small>加入画布并可被检索</small></span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {isEmptyWorkspace ? (
        <section
          className={styles.createModal}
          data-testid="empty-workspace"
          style={{
            margin: "48px auto",
            maxWidth: 480,
            alignSelf: "center",
            gridColumn: "1 / -1",
          }}
        >
          <header>
            <div>
              <span>首用户接入</span>
              <h2>还没有项目</h2>
            </div>
          </header>
          <p style={{ margin: "0 0 12px", color: "#5c5f66", fontSize: 14, lineHeight: 1.55 }}>
            当前环境是空的：没有预置项目，也没有示例任务。创建你的第一个项目后，再加入本地文件。
          </p>
          <button
            type="button"
            className={styles.newButton}
            data-testid="empty-create-project"
            onClick={() => setCreateProjectOpen(true)}
          >
            <Plus size={18} />新建项目
          </button>
        </section>
      ) : (
        <>
          <ProjectCanvas snapshot={snapshot} loading={loading} onFocus={handleFocus} />
          <ProjectInspector
            key={`${snapshot?.focus.kind ?? "none"}:${snapshot?.focus.id ?? "none"}:${snapshot?.inspector.workItem?.updatedAt ?? "static"}:${checkpointOpen ? "checkpoint" : "view"}`}
            snapshot={snapshot}
            projectCards={projectCards}
            busy={busy}
            checkpointOpen={checkpointOpen}
            onFocus={handleFocus}
            onUpdateNextStep={handleUpdateNextStep}
            onLinkEvidence={handleLinkEvidence}
            onUpdateWork={handleUpdateWork}
            onAddComment={handleAddComment}
            onCreateRelation={handleCreateRelation}
            onReviewRelation={handleReviewRelation}
            onRunAgent={handleRunAgent}
            onCheckpoint={handleCheckpoint}
          />
          <ProjectTimeline snapshot={snapshot} onFocus={handleFocus} />
        </>
      )}

      {notice || error ? (
        <div className={styles.toast} data-error={Boolean(error)}>
          <span>{error ?? notice}</span>
          <button type="button" aria-label="关闭" onClick={() => { setNotice(null); setError(null); }}><X size={15} /></button>
        </div>
      ) : null}

      {createProjectOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <form
            className={styles.createModal}
            data-testid="create-project-form"
            onSubmit={handleCreateProject}
          >
            <header>
              <div>
                <span>真实项目</span>
                <h2>新建项目</h2>
              </div>
              <button
                type="button"
                aria-label="关闭新建项目"
                onClick={() => setCreateProjectOpen(false)}
                disabled={projects.length === 0}
              >
                <X size={16} />
              </button>
            </header>
            <label>
              <span>项目名称（必填）</span>
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                autoFocus
                data-testid="create-project-name"
                aria-label="项目名称"
              />
            </label>
            <label>
              <span>摘要（可选）</span>
              <input
                value={newProjectSummary}
                onChange={(event) => setNewProjectSummary(event.target.value)}
                aria-label="项目摘要"
              />
            </label>
            <footer>
              <button
                type="button"
                onClick={() => setCreateProjectOpen(false)}
                disabled={projects.length === 0}
              >
                取消
              </button>
              <button type="submit" disabled={busy || !newProjectName.trim()}>
                创建项目
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {createWorkOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <form className={styles.createModal} onSubmit={handleCreateWork}>
            <header><div><span>新工作项</span><h2>把决定变成下一步</h2></div><button type="button" aria-label="关闭" onClick={() => setCreateWorkOpen(false)}><X size={18} /></button></header>
            <label><span>工作项</span><input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} autoFocus /></label>
            <label><span>下一步</span><input value={workNextStep} onChange={(event) => setWorkNextStep(event.target.value)} /></label>
            <label>
              <span>直接依据（交给 Agent 时必需）</span>
              <select value={workEvidenceId} onChange={(event) => setWorkEvidenceId(event.target.value)}>
                <option value="">暂不关联</option>
                {projectCards.map((card) => (
                  <option key={card.id} value={card.id}>{card.title || card.content.slice(0, 40)}</option>
                ))}
              </select>
            </label>
            <footer><button type="button" onClick={() => setCreateWorkOpen(false)}>取消</button><button type="submit" disabled={busy || !workTitle.trim() || !workNextStep.trim()}>创建并打开</button></footer>
          </form>
        </div>
      ) : null}

      {createCardOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <form className={styles.createModal} onSubmit={handleCreateCard}>
            <header>
              <div><span>项目材料</span><h2>加入一条可追溯材料</h2></div>
              <button type="button" aria-label="关闭新增材料" onClick={() => setCreateCardOpen(false)}><X size={16} /></button>
            </header>
            <label>
              <span>标题（可选）</span>
              <input value={cardTitle} onChange={(event) => setCardTitle(event.target.value)} />
            </label>
            <label>
              <span>内容</span>
              <textarea value={cardContent} onChange={(event) => setCardContent(event.target.value)} rows={5} autoFocus />
            </label>
            <label>
              <span>来源</span>
              <select value={cardSource} onChange={(event) => setCardSource(event.target.value as KnowledgeSource)}>
                <option value="meeting">会议</option>
                <option value="chat">聊天</option>
                <option value="email">邮件</option>
                <option value="doc">文档</option>
                <option value="manual">手记</option>
              </select>
            </label>
            <footer>
              <button type="button" onClick={() => setCreateCardOpen(false)}>取消</button>
              <button type="submit" disabled={busy || !cardContent.trim()}>加入项目</button>
            </footer>
          </form>
        </div>
      ) : null}

      {materialsOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div
            className={styles.createModal}
            data-testid="project-materials-modal"
            style={{ width: "min(720px, calc(100vw - 40px))", maxHeight: "80vh" }}
          >
            <header>
              <div>
                <span>知识库</span>
                <h2>本项目材料</h2>
              </div>
              <button
                type="button"
                aria-label="关闭材料"
                onClick={() => {
                  setMaterialsOpen(false);
                  setMaterialView(null);
                }}
              >
                <X size={16} />
              </button>
            </header>
            <div style={{ display: "grid", gridTemplateColumns: materialView ? "200px 1fr" : "1fr", gap: 12, minHeight: 240 }}>
              <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: "1px dashed #c9ccd2",
                    borderRadius: 10,
                    cursor: busy ? "not-allowed" : "pointer",
                    fontSize: 12,
                    color: "#3d4047",
                  }}
                >
                  <FilePlus2 size={14} />
                  添加本地文件
                  <input
                    type="file"
                    data-testid="upload-project-file"
                    style={{ display: "none" }}
                    disabled={busy || !projectId}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void handleUploadMaterialFile(file);
                    }}
                  />
                </label>
                {materials.length === 0 ? (
                  <p style={{ color: "#75787e", fontSize: 12 }}>还没有文件。选择本地文件加入当前项目。</p>
                ) : (
                  materials.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      data-testid={`material-file-${file.id}`}
                      onClick={() => void openMaterialFile(file.id)}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        border: "1px solid #e4e4df",
                        borderRadius: 10,
                        background: materialView?.name === file.name ? "#f5f8fd" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <strong style={{ fontSize: 12 }}>{file.name}</strong>
                      <small style={{ display: "block", color: "#81848a" }}>{file.kind}</small>
                    </button>
                  ))
                )}
              </div>
              {materialView ? (
                <div
                  data-testid="material-file-view"
                  style={{
                    overflow: "auto",
                    maxHeight: "56vh",
                    padding: 12,
                    border: "1px solid #e4e4df",
                    borderRadius: 12,
                    background: "#fbfbf9",
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 8 }}>{materialView.name}</strong>
                  {materialView.preview && materialView.html ? (
                    <div dangerouslySetInnerHTML={{ __html: materialView.html }} />
                  ) : (
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{materialView.content}</pre>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {projectJumpOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.createModal} data-testid="project-jump-modal">
            <header>
              <div>
                <span>跳转</span>
                <h2>打开项目</h2>
              </div>
              <button type="button" aria-label="关闭跳转" onClick={() => setProjectJumpOpen(false)}>
                <X size={16} />
              </button>
            </header>
            <label>
              <span>项目名（⌘/Ctrl+P）</span>
              <input
                value={projectJumpQuery}
                onChange={(event) => setProjectJumpQuery(event.target.value)}
                autoFocus
                placeholder="输入项目名称"
              />
            </label>
            <div style={{ display: "grid", gap: 6 }}>
              {projects
                .filter((project) =>
                  project.name.toLowerCase().includes(projectJumpQuery.trim().toLowerCase()),
                )
                .map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    data-testid={`project-jump-${project.id}`}
                    onClick={() => {
                      setProjectJumpOpen(false);
                      void handleSelectProject(project.id);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "1px solid #e4e4df",
                      borderRadius: 10,
                      background: project.id === projectId ? "#f5f8fd" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <strong>{project.name}</strong>
                    {project.summary ? (
                      <small style={{ display: "block", color: "#81848a" }}>{project.summary}</small>
                    ) : null}
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
