"use client";

import {
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  FilePlus2,
  Filter,
  Plus,
  Search,
  Sparkles,
  Upload,
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
import {
  mergeProjectsForA6Enter,
  pickA6EnterProjectId,
} from "@/shared/knowledge/a6-enter";
import {
  classifyTopLevelDrop,
  classifyWebkitRelativeFiles,
  type FolderProjectImport,
} from "@/shared/knowledge/folder-import";
import { dropOverlayHint } from "./lib/folder-drop";
import { readDataTransferItems } from "./read-drop-entries";
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
    Array<{
      id: string;
      name: string;
      kind: string;
      updatedAt: string;
      sizeBytes?: number;
    }>
  >([]);
  const [materialView, setMaterialView] = useState<{
    name: string;
    html?: string;
    content: string;
    preview: boolean;
    previewMode?: "text" | "image" | "audio" | "unsupported";
    typeLabel?: string;
    dataUrl?: string;
    sizeLabel?: string;
    sizeBytes?: number;
    unsupportedMessage?: string;
  } | null>(null);
  const [projectJumpOpen, setProjectJumpOpen] = useState(false);
  const [projectJumpQuery, setProjectJumpQuery] = useState("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSummary, setNewProjectSummary] = useState("");
  /** A3: files received before a project exists; ingested after create confirms. */
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const workspaceUploadRef = useRef<HTMLInputElement>(null);
  const workspaceFolderUploadRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const snapshotRequestRef = useRef(0);
  const cardsRequestRef = useRef(0);
  const workRequestRef = useRef(0);
  const materialsRequestRef = useRef(0);
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

  /** E1/P1: know whether project has materials so empty guide can de-escalate. */
  const loadProjectMaterials = useCallback(async (nextProjectId: string) => {
    const requestId = ++materialsRequestRef.current;
    try {
      const data = await apiJson<{
        materials: Array<{ id: string; name: string; kind: string; updatedAt: string }>;
      }>(`/api/knowledge/projects/${nextProjectId}/materials`);
      if (requestId === materialsRequestRef.current) {
        setMaterials(data.materials);
      }
    } catch {
      if (requestId === materialsRequestRef.current) setMaterials([]);
    }
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
            loadProjectMaterials(selected.id),
            loadMyOpenWork(selected.id),
            loadFootprint(),
          ]);
        } else {
          // Honest empty: no seed project masquerading as user work.
          activeProjectIdRef.current = "";
          setProjectId("");
          setSnapshot(null);
          setMaterials([]);
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
  }, [loadFootprint, loadMyOpenWork, loadProjectCards, loadProjectMaterials, loadSnapshot]);

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
      setMaterials([]);
      setMyOpenWork([]);
      setFootprint([]);
      navigationRequestRef.current += 1;
      searchRequestRef.current += 1;
      if (selected.id !== requestedId) updateUrl(selected.id, focus, true);
      void Promise.all([
        loadSnapshot(selected.id, focus),
        loadProjectCards(selected.id),
        loadProjectMaterials(selected.id),
        loadMyOpenWork(selected.id),
        loadFootprint(),
      ]);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadFootprint, loadMyOpenWork, loadProjectCards, loadProjectMaterials, loadSnapshot, projects]);

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

  function materialKindLabel(kind: string): string {
    switch (kind) {
      case "markdown":
      case "text":
      case "html":
        return "文档";
      case "image":
        return "图片";
      case "audio":
        return "音频";
      case "binary":
        return "文件";
      default:
        return "其他";
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
        previewMode?: "text" | "image" | "audio" | "unsupported";
        typeLabel?: string;
        dataUrl?: string;
        sizeLabel?: string;
        sizeBytes?: number;
        unsupportedMessage?: string;
      }>(
        `/api/knowledge/projects/${projectId}/materials?file=${encodeURIComponent(fileId)}`,
      );
      setMaterialView({
        name: data.file.name,
        content: data.content ?? "",
        html: data.html,
        preview: data.preview,
        previewMode: data.previewMode ?? (data.preview ? "text" : "unsupported"),
        typeLabel: data.typeLabel,
        dataUrl: data.dataUrl,
        sizeLabel: data.sizeLabel,
        sizeBytes: data.sizeBytes,
        unsupportedMessage: data.unsupportedMessage,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "打开文件失败");
    }
  }

  /** Image/binary → base64 (A7 preserve bytes); text → utf8 (A8). */
  function isBinaryUploadName(name: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|ico|pdf|zip|gz|tar|rar|7z|woff2?|ttf|eot|mp3|mp4|webm|mov|avi|wasm|bin)$/i.test(
      name,
    );
  }

  async function fileToMaterialPayload(file: File): Promise<{
    name: string;
    content: string;
    encoding?: "utf8" | "base64";
  }> {
    if (isBinaryUploadName(file.name) || (file.type && !file.type.startsWith("text/") && file.type !== "application/json" && !file.type.includes("xml"))) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return {
        name: file.name,
        content: btoa(binary),
        encoding: "base64",
      };
    }
    return { name: file.name, content: await file.text(), encoding: "utf8" };
  }

  async function uploadFileToProject(targetProjectId: string, file: File) {
    const payload = await fileToMaterialPayload(file);
    const data = await apiJson<{
      material: { id: string; name: string; projectId: string };
      card: KnowledgeCard;
    }>(`/api/knowledge/projects/${targetProjectId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ...data, content: payload.encoding === "base64" ? "" : payload.content };
  }

  /**
   * A6: force left nav + center snapshot + materials onto one project id.
   * Does not clear busy mid-flight (caller owns busy).
   */
  async function enterProjectAfterImport(project: Project) {
    const id = project.id;
    navigationRequestRef.current += 1;
    mutationRequestRef.current += 1;
    const navToken = navigationRequestRef.current;
    activeProjectIdRef.current = id;
    const focus = { kind: "project" as const, id };
    setProjectId(id);
    setSnapshot(null);
    setProjectCards([]);
    setMyOpenWork([]);
    setFootprint([]);
    setQuery("");
    setSearchResults([]);
    setSearching(false);
    setMaterialView(null);
    setCheckpointOpen(false);
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
    if (
      navToken !== navigationRequestRef.current ||
      activeProjectIdRef.current !== id
    ) {
      return;
    }

    // M1: A6 enter project must NOT force-open materials panel.
    // Materials stay available via manual openMaterialsPanel.
  }

  /**
   * A5 UI: each top-level folder → create project + post materials (relative path).
   * A6: after ≥1 success, actively enter first created project (not stay on old shell).
   */
  async function handleFolderProjectImports(imports: FolderProjectImport[]) {
    if (imports.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created: Project[] = [];
      const fileCounts: number[] = [];
      let skipped = 0;
      for (const folder of imports) {
        const name = folder.projectName.trim();
        if (!name) continue;
        const data = await apiJson<{ project: Project }>(
          "/api/knowledge/projects",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              summary: `由文件夹「${name}」接入`,
            }),
          },
        );
        created.push(data.project);
        let n = 0;
        for (const entry of folder.files) {
          try {
            await apiJson(`/api/knowledge/projects/${data.project.id}/materials`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: entry.relativePath,
                content: entry.content,
                encoding: entry.encoding === "base64" ? "base64" : "utf8",
              }),
            });
            n += 1;
          } catch {
            // One bad file: skip, do not abort whole folder.
            skipped += 1;
          }
        }
        fileCounts.push(n);
      }
      if (created.length === 0) {
        // A6: whole batch failed → do not force-switch current project.
        setBusy(false);
        setError("未能从文件夹创建项目");
        return;
      }

      const enterId = pickA6EnterProjectId(created.map((p) => p.id));
      const enterTarget = created.find((p) => p.id === enterId) ?? created[0];

      // Left nav must include new projects before/as we select them.
      let existing: Project[] = [];
      try {
        const all = await apiJson<{ projects: Project[] }>("/api/knowledge/projects");
        existing = all.projects;
      } catch {
        existing = projects;
      }
      setProjects(mergeProjectsForA6Enter(created, existing));

      // A6: enter first successful project in this batch (not stay on 奕枢 shell).
      await enterProjectAfterImport(enterTarget);

      setBusy(false);
      const names = created.map((p) => p.name).join("、");
      const skipHint = skipped > 0 ? `（跳过 ${skipped} 个无法作为文本接入的文件）` : "";
      setNotice(
        created.length === 1
          ? `已进入新项目「${enterTarget.name}」${fileCounts[0] ? `，并收下 ${fileCounts[0]} 个文件` : ""}${skipHint}`
          : `已接入 ${created.length} 个项目：${names}。已进入「${enterTarget.name}」，可在左侧切换。${skipHint}`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文件夹接入失败");
      setBusy(false);
    }
  }

  /** A1/A2 shared path: with current project → ingest; without → A3 create-first. */
  async function handleIncomingFiles(files: FileList | File[] | null | undefined) {
    const list = Array.from(files ?? []).filter((file) => file && file.name);
    if (list.length === 0) return;

    const targetId = projectId || activeProjectIdRef.current;
    if (!targetId) {
      // A3=甲: hold files, name project, then ingest on confirm.
      setPendingFiles(list);
      setCreateProjectOpen(true);
      setError(null);
      setNotice(
        list.length === 1
          ? `请先新建并命名项目，确认后将收下「${list[0].name}」`
          : `请先新建并命名项目，确认后将收下 ${list.length} 个文件`,
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let lastName = "";
      let lastCardId = "";
      for (const file of list) {
        const data = await uploadFileToProject(targetId, file);
        lastName = data.material.name;
        lastCardId = data.card.id;
      }
      if (targetId === activeProjectIdRef.current) {
        await loadProjectCards(targetId);
        if (lastCardId) {
          await loadSnapshot(targetId, { kind: "card", id: lastCardId });
        }
        // M1: do not force materials panel or auto-open file view.
        if (materialsOpen) {
          const materialList = await apiJson<{
            materials: Array<{
              id: string;
              name: string;
              kind: string;
              updatedAt: string;
              sizeBytes?: number;
            }>;
          }>(`/api/knowledge/projects/${targetId}/materials`);
          setMaterials(materialList.materials);
        }
      }
      setBusy(false);
      setNotice(
        list.length === 1
          ? `已收下「${lastName}」到当前项目`
          : `已收下 ${list.length} 份材料到当前项目`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "加入文件失败");
      setBusy(false);
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
    const filesToIngest = pendingFiles;
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
      setPendingFiles([]);
      setCreateProjectOpen(false);
      await handleSelectProject(data.project.id);

      if (filesToIngest.length > 0) {
        let lastName = "";
        let lastCardId = "";
        for (const file of filesToIngest) {
          const uploaded = await uploadFileToProject(data.project.id, file);
          lastName = uploaded.material.name;
          lastCardId = uploaded.card.id;
        }
        await loadProjectCards(data.project.id);
        if (lastCardId) {
          await loadSnapshot(data.project.id, { kind: "card", id: lastCardId });
        }
        setBusy(false);
        setNotice(
          filesToIngest.length === 1
            ? `项目已创建，并收下「${lastName}」`
            : `项目已创建，并收下 ${filesToIngest.length} 份材料`,
        );
        return;
      }

      setBusy(false);
      setNotice("已创建项目");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "创建项目失败");
      setBusy(false);
    }
  }

  function handleWorkspaceDragEnter(event: DragEvent) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragOver(true);
  }

  function handleWorkspaceDragOver(event: DragEvent) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleWorkspaceDragLeave(event: DragEvent) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  }

  function handleWorkspaceDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragOver(false);
    void (async () => {
      try {
        setError(null);
        const fromEntries = await readDataTransferItems(event.dataTransfer.items);
        const entriesUseful =
          fromEntries &&
          (fromEntries.directories.length > 0 || fromEntries.looseFiles.length > 0);
        if (entriesUseful && fromEntries) {
          const classified = classifyTopLevelDrop({
            directories: fromEntries.directories,
            looseFiles: fromEntries.looseFiles.map((f) => ({
              name: f.name,
              content: f.content,
            })),
          });
          // A5: folders first → one project each (never flatten into one unknown project).
          if (classified.folderProjects.length > 0) {
            await handleFolderProjectImports(classified.folderProjects);
          }
          if (classified.looseFiles.length > 0) {
            // Prefer original File when present so upload reuses same path as A1.
            const files = fromEntries.looseFiles
              .filter((f) =>
                classified.looseFiles.some((c) => c.name === f.name),
              )
              .map((f) => f.file)
              .filter((f): f is File => Boolean(f));
            if (files.length > 0) {
              await handleIncomingFiles(files);
            } else {
              // Content-only fallback: synthesize File for A3/A1 path.
              const synthetic = classified.looseFiles.map(
                (f) => new File([f.content], f.name, { type: "text/plain" }),
              );
              await handleIncomingFiles(synthetic);
            }
          }
          if (
            classified.folderProjects.length === 0 &&
            classified.looseFiles.length === 0
          ) {
            setError("拖入内容无法识别。请改用顶栏「上传文件夹」，或拖入单个文件。");
          }
          return;
        }
        // Fallback: FileList with webkitRelativePath (folder pick / some browsers).
        const flat = Array.from(event.dataTransfer.files ?? []).filter(Boolean);
        if (flat.length === 0) {
          setError(
            "未能读取拖入的文件夹（部分浏览器不支持整夹拖入）。请点顶栏「上传文件夹」。",
          );
          return;
        }
        const hasRelative = flat.some(
          (file) =>
            Boolean(
              (file as File & { webkitRelativePath?: string }).webkitRelativePath,
            ),
        );
        if (hasRelative) {
          await handleWebkitDirectoryFiles(flat);
          return;
        }
        await handleIncomingFiles(flat);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "拖入失败");
      }
    })();
  }

  async function handleUploadMaterialFile(file: File) {
    await handleIncomingFiles([file]);
  }

  /** A5 via webkitdirectory file picker (same project rules as drag folders). */
  async function handleWebkitDirectoryFiles(
    files: FileList | File[] | null | undefined,
  ) {
    // Caller must pass a snapshot array (not a live FileList after input clear).
    const list = Array.from(files ?? []).filter((file) => file && file.name);
    if (list.length === 0) {
      // Cancel usually does not fire onChange; empty snapshot is a soft no-op.
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payloads: Array<{
        name: string;
        content: string;
        encoding?: "utf8" | "base64";
        webkitRelativePath?: string;
      }> = [];
      let readFailed = 0;
      for (const file of list) {
        if (file.size === 0) continue;
        try {
          const material = await fileToMaterialPayload(file);
          payloads.push({
            name: file.name,
            content: material.content,
            encoding: material.encoding,
            webkitRelativePath:
              (file as File & { webkitRelativePath?: string })
                .webkitRelativePath ?? file.name,
          });
        } catch {
          readFailed += 1;
        }
      }
      if (payloads.length === 0) {
        setBusy(false);
        setError(
          readFailed > 0
            ? "文件夹内文件无法读取"
            : "文件夹内没有可接入的文件",
        );
        return;
      }
      const classified = classifyWebkitRelativeFiles(payloads);
      if (classified.folderProjects.length > 0) {
        await handleFolderProjectImports(classified.folderProjects);
        return;
      }
      if (classified.looseFiles.length > 0) {
        // Prefer original File objects so binary upload path stays intact.
        const looseNames = new Set(classified.looseFiles.map((f) => f.name));
        const originalLoose = list.filter((file) => looseNames.has(file.name));
        if (originalLoose.length > 0) {
          await handleIncomingFiles(originalLoose);
          return;
        }
        setBusy(false);
        setError("未能接入所选文件");
        return;
      }
      setBusy(false);
      setError("未能从所选文件夹识别出项目结构");
    } catch (nextError) {
      setBusy(false);
      setError(
        nextError instanceof Error ? nextError.message : "上传文件夹失败",
      );
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
    setMaterials([]);
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
      loadProjectMaterials(id),
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
  /** P1/E1: empty project materials → show place-materials guide (de-escalate when any file). */
  const isEmptyProjectMaterials =
    Boolean(projectId) && !loading && !isEmptyWorkspace && materials.length === 0;

  return (
    <main
      className={styles.workspace}
      data-testid="project-canvas-shell"
      data-drag-over={dragOver ? "true" : "false"}
      onDragEnter={handleWorkspaceDragEnter}
      onDragOver={handleWorkspaceDragOver}
      onDragLeave={handleWorkspaceDragLeave}
      onDrop={handleWorkspaceDrop}
    >
      <input
        ref={workspaceUploadRef}
        type="file"
        data-testid="workspace-upload-file"
        style={{ display: "none" }}
        onChange={(event) => {
          // Snapshot before clearing: FileList is live and empties with value="".
          const list = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (list.length === 0) return;
          void handleIncomingFiles(list);
        }}
      />
      <input
        ref={workspaceFolderUploadRef}
        type="file"
        // @ts-expect-error non-standard but required for A5 folder pick
        webkitdirectory=""
        directory=""
        multiple
        data-testid="workspace-upload-folder"
        style={{ display: "none" }}
        onChange={(event) => {
          // Snapshot before clearing: FileList is live and empties with value="".
          const list = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (list.length === 0) return;
          void handleWebkitDirectoryFiles(list);
        }}
      />
      {dragOver ? (
        <div className={styles.dropOverlay} data-testid="workspace-drop-overlay" aria-hidden="true">
          <span>{dropOverlayHint({ hasProject: Boolean(projectId) })}</span>
        </div>
      ) : null}
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
            className={styles.iconButton}
            data-testid="workspace-upload-button"
            aria-label="上传本地文件"
            title={projectId ? "上传到当前项目" : "上传：将先新建项目再收下"}
            disabled={busy}
            onClick={() => workspaceUploadRef.current?.click()}
          >
            <Upload size={18} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            data-testid="workspace-upload-folder-button"
            aria-label="上传本地文件夹"
            title="每个顶层文件夹变成一个项目"
            disabled={busy}
            onClick={() => workspaceFolderUploadRef.current?.click()}
          >
            <FilePlus2 size={18} />
          </button>
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
                <button
                  type="button"
                  onClick={() => {
                    setNewMenuOpen(false);
                    workspaceUploadRef.current?.click();
                  }}
                >
                  <Upload size={16} /><span><strong>上传本地文件</strong><small>进当前项目；无项目则先命名</small></span>
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
          className={styles.ingestGuide}
          data-testid="empty-workspace"
          aria-label="空工作台：投放区"
        >
          <header className={styles.ingestGuideHeader}>
            <span>首用户接入</span>
            <h2>还没有项目</h2>
          </header>
          <p className={styles.ingestGuideLead}>
            这里是知识工作台，不是任务看板。把本地文件或文件夹放进来，才能开始跟进。
          </p>
          <div
            className={styles.ingestDropZone}
            data-testid="empty-drop-zone"
            data-affordance="drop-upload"
          >
            <Upload size={28} aria-hidden="true" />
            <strong>拖入文件或文件夹到此处</strong>
            <small>
              单文件会先请你命名项目；每个顶层文件夹 = 一个项目。也可点下方按钮。
            </small>
            <div className={styles.ingestGuideActions}>
              <button
                type="button"
                className={styles.newButton}
                data-testid="empty-create-project"
                onClick={() => setCreateProjectOpen(true)}
              >
                <Plus size={18} />新建项目
              </button>
              <button
                type="button"
                className={styles.newButton}
                data-testid="empty-upload-file"
                onClick={() => workspaceUploadRef.current?.click()}
              >
                <Upload size={18} />上传文件
              </button>
              <button
                type="button"
                className={styles.newButton}
                data-testid="empty-upload-folder"
                onClick={() => workspaceFolderUploadRef.current?.click()}
              >
                <FilePlus2 size={18} />上传文件夹
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {isEmptyProjectMaterials ? (
            <section
              className={styles.ingestGuide}
              data-testid="project-next-guide"
              aria-label="下一步：放进资料"
            >
              <header className={styles.ingestGuideHeader}>
                <span>知识工作台</span>
                <h2>下一步：放进资料</h2>
              </header>
              <p className={styles.ingestGuideLead}>
                项目已建好，但还没有材料。先拖入或上传文件/文件夹，再谈跟进与检索——不是先去建任务看板。
              </p>
              <div
                className={styles.ingestDropZone}
                data-testid="project-drop-zone"
                data-affordance="drop-upload"
              >
                <Upload size={28} aria-hidden="true" />
                <strong>拖入文件或文件夹到此处</strong>
                <small>
                  文件进入当前项目；顶层文件夹会各建为新项目。也可点上传。
                </small>
                <div className={styles.ingestGuideActions}>
                  <button
                    type="button"
                    className={styles.newButton}
                    data-testid="guide-upload-file"
                    onClick={() => workspaceUploadRef.current?.click()}
                  >
                    <Upload size={18} />上传文件
                  </button>
                  <button
                    type="button"
                    className={styles.newButton}
                    data-testid="guide-upload-folder"
                    onClick={() => workspaceFolderUploadRef.current?.click()}
                  >
                    <FilePlus2 size={18} />上传文件夹
                  </button>
                  <button
                    type="button"
                    className={styles.newButton}
                    data-testid="guide-open-materials"
                    onClick={() => void openMaterialsPanel()}
                  >
                    <FilePlus2 size={18} />打开材料区
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <ProjectCanvas snapshot={snapshot} loading={loading} onFocus={handleFocus} />
          )}
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
                <h2>{pendingFiles.length > 0 ? "先命名项目再收文件" : "新建项目"}</h2>
              </div>
              <button
                type="button"
                aria-label="关闭新建项目"
                onClick={() => {
                  setCreateProjectOpen(false);
                  if (projects.length === 0) setPendingFiles([]);
                }}
                disabled={projects.length === 0 && pendingFiles.length === 0}
              >
                <X size={16} />
              </button>
            </header>
            {pendingFiles.length > 0 ? (
              <p
                data-testid="pending-files-hint"
                style={{ margin: "0 0 8px", color: "#5c5f66", fontSize: 13, lineHeight: 1.5 }}
              >
                确认创建后，将收下：
                {pendingFiles.map((file) => file.name).join("、")}
              </p>
            ) : null}
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
                onClick={() => {
                  setCreateProjectOpen(false);
                  if (projects.length === 0) setPendingFiles([]);
                }}
                disabled={projects.length === 0 && pendingFiles.length === 0}
              >
                取消
              </button>
              <button type="submit" disabled={busy || !newProjectName.trim()}>
                {pendingFiles.length > 0 ? "创建并收下文件" : "创建项目"}
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
                      const list = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      if (list[0]) void handleUploadMaterialFile(list[0]);
                    }}
                  />
                </label>
                {materials.length === 0 ? (
                  <p style={{ color: "#75787e", fontSize: 12 }}>还没有材料。选择本地文件加入当前项目。</p>
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
                      <small style={{ display: "block", color: "#81848a" }}>
                        {materialKindLabel(file.kind)}
                      </small>
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
                  {materialView.previewMode === "image" && materialView.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      data-testid="material-image-preview"
                      src={materialView.dataUrl}
                      alt={materialView.name}
                      style={{ maxWidth: "100%", height: "auto", display: "block" }}
                    />
                  ) : null}
                  {materialView.previewMode === "audio" ? (
                    <div data-testid="material-audio-preview" style={{ display: "grid", gap: 10 }}>
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 10,
                          background: "#fff",
                          border: "1px solid #e4e4df",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#5c5f66", marginBottom: 6 }}>
                          {materialView.typeLabel || "音频"}
                          {materialView.sizeLabel ? ` · ${materialView.sizeLabel}` : ""}
                        </div>
                        {materialView.dataUrl ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <audio
                            controls
                            src={materialView.dataUrl}
                            style={{ width: "100%" }}
                            data-testid="material-audio-player"
                          />
                        ) : (
                          <p style={{ margin: 0, color: "#5c5f66" }}>
                            已保存为音频材料（当前无法内嵌播放）。
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {materialView.previewMode === "unsupported" ||
                  (materialView.previewMode === "image" && !materialView.dataUrl) ? (
                    <div
                      data-testid="material-unsupported-preview"
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "#fff",
                        border: "1px solid #e4e4df",
                        color: "#3d4047",
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        {materialView.typeLabel || "文件"}
                      </div>
                      <div style={{ fontSize: 12, color: "#5c5f66", lineHeight: 1.5 }}>
                        <div>文件名：{materialView.name}</div>
                        {materialView.sizeLabel ? (
                          <div>大小：{materialView.sizeLabel}</div>
                        ) : null}
                        <div style={{ marginTop: 8 }}>
                          {materialView.unsupportedMessage || "此文件无法在面板内预览。"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {materialView.previewMode === "text" ||
                  (!materialView.previewMode && (materialView.preview || materialView.content)) ? (
                    materialView.html ? (
                      <div dangerouslySetInnerHTML={{ __html: materialView.html }} />
                    ) : (
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{materialView.content}</pre>
                    )
                  ) : null}
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
