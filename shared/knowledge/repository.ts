import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ActionItem,
  ActionStatus,
  CanvasNodeRef,
  FootprintEvent,
  FootprintLitEntry,
  FootprintViewMode,
  KnowledgeCard,
  KnowledgeRelation,
  KnowledgeSearchFilters,
  KnowledgeSearchHit,
  KnowledgeSource,
  LibraryNode,
  NeighborView,
  PathView,
  Project,
  ProjectCanvasSnapshot,
  ProjectCheckpoint,
  ProjectSearchHit,
  QuerySession,
  RelationStatus,
  RelationType,
  WorkEvent,
  WorkEventType,
} from "@/shared/types/knowledge";
import {
  ACTION_STATUSES,
  DEFAULT_ACTOR,
  DEFAULT_PROJECT_ID,
  KNOWLEDGE_SOURCES,
  UNDIRECTED_RELATION_TYPES,
} from "@/shared/types/knowledge";
import type {
  CrossProjectReference,
  ProjectSourceGrant,
  RedactedCrossProjectHint,
} from "@/shared/types/knowledge";
import { REDACTED_CROSS_PROJECT_HINT_MESSAGE } from "@/shared/types/knowledge";
import {
  listProjectMaterials,
  materialCardSummary,
  materialContentHash,
  readProjectMaterial,
} from "@/shared/knowledge/materials";
import {
  projectResultToCandidateCard,
  type ResultCandidateInput,
} from "@/shared/knowledge/result-candidate";
import {
  assertOwnerApprover,
  ProjectAccessError,
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

export { DEFAULT_PROJECT_ID } from "@/shared/types/knowledge";
export {
  ProjectAccessError,
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

/** Demo seed is off by default. Only inject when SEED_DEMO=1. */
export function isDemoSeedEnabled(): boolean {
  return process.env.SEED_DEMO === "1";
}

import {
  assertCanPatchTo,
  assertWorkItemForStatus,
  WorkItemValidationError,
} from "@/shared/knowledge/work-item-rules";
import {
  aggregateLit,
  buildLibraryMap,
  daysAgoIso,
  depthForKind,
  litFromHits,
} from "@/shared/knowledge/footprint";
import {
  assertRelationShape,
  buildNeighborView,
  CreateRelationInput,
  extractRelationCandidates,
  filterRelationsForQuery,
  findPath,
  islandEdges,
  relationDedupKey,
  RelationValidationError,
} from "@/shared/knowledge/relations";
import { buildProjectCanvasSnapshot } from "@/shared/knowledge/project-canvas";
import { rankProjectsByActivity } from "@/shared/knowledge/recent-project";

type NewCardInput = {
  content: string;
  projectId?: string;
  source?: KnowledgeSource;
  tags?: string[];
  links?: string[];
  title?: string;
  id?: string;
  timestamp?: string;
  sourceFileId?: string;
  sourceContentHash?: string;
  sourceCitedAt?: string;
  identity?: KnowledgeCard["identity"];
  resultEventLocator?: string;
};

type NewActionInput = {
  description: string;
  projectId?: string;
  title?: string;
  assignee?: string;
  deadline?: string;
  status?: ActionStatus;
  verificationCriteria?: string;
  cardId?: string;
  evidenceIds?: string[];
  nextStep?: string;
  blockedReason?: string;
  id?: string;
};

type PatchWorkItemInput = {
  title?: string;
  description?: string;
  assignee?: string;
  deadline?: string;
  status?: ActionStatus;
  verificationCriteria?: string;
  nextStep?: string;
  blockedReason?: string | null;
  cardId?: string | null;
};

type NewEventInput = {
  type: WorkEventType;
  actor?: string;
  body?: string;
  meta?: Record<string, unknown>;
};

function resolveDataDir(): string {
  if (process.env.KNOWLEDGE_DATA_DIR) {
    return path.resolve(process.env.KNOWLEDGE_DATA_DIR);
  }
  return path.join(process.cwd(), "data", "knowledge");
}

function cardsPath(): string {
  return path.join(resolveDataDir(), "cards.json");
}

function projectsPath(): string {
  return path.join(resolveDataDir(), "projects.json");
}

function projectCheckpointsPath(): string {
  return path.join(resolveDataDir(), "project-checkpoints.json");
}

function actionsPath(): string {
  return path.join(resolveDataDir(), "actions.json");
}

function eventsPath(): string {
  return path.join(resolveDataDir(), "events.json");
}

function workStateTransactionPath(): string {
  return path.join(resolveDataDir(), "work-state-transaction.json");
}

function footprintEventsPath(): string {
  return path.join(resolveDataDir(), "footprint-events.json");
}

function querySessionsPath(): string {
  return path.join(resolveDataDir(), "query-sessions.json");
}

function relationsPath(): string {
  return path.join(resolveDataDir(), "relations.json");
}

function crossProjectRefsPath(): string {
  return path.join(resolveDataDir(), "cross-project-refs.json");
}

function projectSourceGrantsPath(): string {
  return path.join(resolveDataDir(), "project-source-grants.json");
}

function ensureDataDir(): void {
  const dir = resolveDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonMap<T>(file: string): Map<string, T> {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw new Error(`无法读取数据文件：${file}`, { cause: error });
  }
  if (!raw.trim()) return new Map();
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("顶层必须是对象");
    }
    return new Map(Object.entries(data as Record<string, T>));
  } catch (error) {
    throw new Error(`无法读取数据文件：${file}`, { cause: error });
  }
}

function writeJsonMap<T>(file: string, map: Map<string, T>): void {
  ensureDataDir();
  const obj = Object.fromEntries(map);
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(obj, null, 2), "utf-8");
    fs.renameSync(temporary, file);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // The original write error is the actionable failure.
    }
    throw error;
  }
}

type PendingWorkState = {
  actions: Record<string, ActionItem>;
  events: Record<string, WorkEvent>;
};

function recoverPendingWorkState(): void {
  const file = workStateTransactionPath();
  const transaction = readJsonMap<PendingWorkState>(file).get("pending");
  if (!transaction) return;
  writeJsonMap(actionsPath(), new Map(Object.entries(transaction.actions)));
  writeJsonMap(eventsPath(), new Map(Object.entries(transaction.events)));
  fs.rmSync(file, { force: true });
}

function loadCards(): Map<string, KnowledgeCard> {
  ensureDataDir();
  const raw = readJsonMap<Partial<KnowledgeCard> & { id?: string }>(cardsPath());
  const cards = new Map<string, KnowledgeCard>();
  for (const [id, card] of raw) {
    cards.set(id, normalizeCard({ ...card, id: card.id ?? id }));
  }
  return cards;
}

function loadProjects(): Map<string, Project> {
  ensureDataDir();
  return readJsonMap<Project>(projectsPath());
}

function loadProjectCheckpoints(): Map<string, ProjectCheckpoint> {
  ensureDataDir();
  return readJsonMap<ProjectCheckpoint>(projectCheckpointsPath());
}

function loadActionsRaw(): Map<string, ActionItem> {
  ensureDataDir();
  recoverPendingWorkState();
  const raw = readJsonMap<Partial<ActionItem> & { description?: string}>(
    actionsPath(),
  );
  const out = new Map<string, ActionItem>();
  for (const [id, item] of raw) {
    out.set(id, normalizeAction({ ...item, id: item.id ?? id }));
  }
  return out;
}

function loadEvents(): Map<string, WorkEvent> {
  ensureDataDir();
  recoverPendingWorkState();
  return readJsonMap<WorkEvent>(eventsPath());
}

function saveCards(cards: Map<string, KnowledgeCard>): void {
  writeJsonMap(cardsPath(), cards);
}

function saveProjects(projects: Map<string, Project>): void {
  writeJsonMap(projectsPath(), projects);
}

function saveProjectCheckpoints(
  checkpoints: Map<string, ProjectCheckpoint>,
): void {
  writeJsonMap(projectCheckpointsPath(), checkpoints);
}

function saveActions(actions: Map<string, ActionItem>): void {
  writeJsonMap(actionsPath(), actions);
}

function saveEvents(events: Map<string, WorkEvent>): void {
  writeJsonMap(eventsPath(), events);
}

function saveWorkState(
  actions: Map<string, ActionItem>,
  events: Map<string, WorkEvent>,
): void {
  const pending: PendingWorkState = {
    actions: Object.fromEntries(actions),
    events: Object.fromEntries(events),
  };
  writeJsonMap(
    workStateTransactionPath(),
    new Map([["pending", pending]]),
  );
  saveActions(actions);
  saveEvents(events);
  fs.rmSync(workStateTransactionPath(), { force: true });
}

function loadFootprintEvents(): Map<string, FootprintEvent> {
  ensureDataDir();
  return readJsonMap<FootprintEvent>(footprintEventsPath());
}

function saveFootprintEvents(map: Map<string, FootprintEvent>): void {
  writeJsonMap(footprintEventsPath(), map);
}

function loadQuerySessions(): Map<string, QuerySession> {
  ensureDataDir();
  return readJsonMap<QuerySession>(querySessionsPath());
}

function saveQuerySessions(map: Map<string, QuerySession>): void {
  writeJsonMap(querySessionsPath(), map);
}

function loadRelations(): Map<string, KnowledgeRelation> {
  ensureDataDir();
  return readJsonMap<KnowledgeRelation>(relationsPath());
}

function saveRelations(map: Map<string, KnowledgeRelation>): void {
  writeJsonMap(relationsPath(), map);
}

function copyRelation(rel: KnowledgeRelation): KnowledgeRelation {
  return structuredClone(rel);
}

function copyProject(project: Project): Project {
  return structuredClone(project);
}

function copyProjectCheckpoint(
  checkpoint: ProjectCheckpoint,
): ProjectCheckpoint {
  return structuredClone(checkpoint);
}

function copyCard(card: KnowledgeCard): KnowledgeCard {
  return structuredClone(card);
}

function copyAction(item: ActionItem): ActionItem {
  return structuredClone(item);
}

function copyEvent(event: WorkEvent): WorkEvent {
  return structuredClone(event);
}

function normalizeCard(
  raw: Partial<KnowledgeCard> & { id?: string },
): KnowledgeCard {
  // T-19: never invent DEFAULT_PROJECT_ID on load — missing id stays empty (excluded from scoped lists).
  const projectId = raw.projectId?.trim() || "";
  return {
    id: raw.id ?? randomUUID(),
    projectId,
    content: raw.content?.trim() || "未命名卡片",
    source: raw.source ?? "manual",
    tags: raw.tags ?? [],
    timestamp: raw.timestamp ?? new Date().toISOString(),
    links: raw.links ?? [],
    title: raw.title?.trim() || undefined,
    sourceFileId: raw.sourceFileId?.trim() || undefined,
    sourceContentHash: raw.sourceContentHash?.trim() || undefined,
    sourceCitedAt: raw.sourceCitedAt?.trim() || undefined,
    identity: raw.identity,
    resultEventLocator: raw.resultEventLocator?.trim() || undefined,
  };
}

/** Migrate legacy action JSON into full work item shape. */
export function normalizeAction(
  raw: Partial<ActionItem> & { description?: string; id?: string },
): ActionItem {
  const now = new Date().toISOString();
  const description = (raw.description ?? raw.title ?? "").trim() || "未命名工作项";
  const title = (raw.title ?? description).trim().slice(0, 80);
  let status = raw.status ?? "todo";
  if (!ACTION_STATUSES.includes(status)) {
    status = "todo";
  }
  const evidenceIds = [
    ...(raw.evidenceIds ?? []),
    ...(raw.cardId && !(raw.evidenceIds ?? []).includes(raw.cardId)
      ? [raw.cardId]
      : []),
  ];
  const nextStep =
    raw.nextStep?.trim() ||
    (status === "done" || status === "cancelled"
      ? ""
      : "确认下一步并开始推进");

  return {
    id: raw.id ?? randomUUID(),
    // T-19: never invent DEFAULT_PROJECT_ID on load
    projectId: raw.projectId?.trim() || "",
    title,
    description,
    assignee: raw.assignee?.trim() || "待定",
    deadline: raw.deadline?.trim() || "待确认",
    status,
    verificationCriteria:
      raw.verificationCriteria?.trim() || "完成描述中的工作并可核对结果",
    cardId: raw.cardId,
    evidenceIds,
    nextStep,
    blockedReason: raw.blockedReason?.trim() || undefined,
    createdAt: raw.createdAt ?? raw.updatedAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

function buildSeedCards(now: string): KnowledgeCard[] {
  return [
    {
      id: "kc-seed-1",
      projectId: DEFAULT_PROJECT_ID,
      title: "知识工作者怎么推进",
      content:
        "资料检索 → 沉淀成可复用卡片 → 接到可推进的工作项。入口不必依赖个人微信私聊读取。",
      source: "doc",
      tags: ["产品", "知识工作"],
      timestamp: now,
      links: [],
    },
    {
      id: "kc-seed-2",
      projectId: DEFAULT_PROJECT_ID,
      title: "检索验收标准",
      content:
        "好的检索结果必须带来源：路径、链接或会议原文片段；没有来源的摘要不当成事实。",
      source: "meeting",
      tags: ["检索", "验收", "溯源"],
      timestamp: now,
      links: ["kc-seed-1"],
    },
    {
      id: "kc-seed-3",
      projectId: DEFAULT_PROJECT_ID,
      title: "工作项状态",
      content:
        "状态：待开始 → 进行中 → 待确认 → 完成；可标阻塞。进行中须有负责人与下一步。",
      source: "manual",
      tags: ["协作", "状态", "工作项"],
      timestamp: now,
      links: [],
    },
    {
      id: "kc-seed-4",
      projectId: DEFAULT_PROJECT_ID,
      title: "Demo 说法",
      content:
        "不是再做一个全能笔记，而是让找过的材料下次还能用，并且能变成可勾选的下一步。",
      source: "chat",
      tags: ["叙事", "demo"],
      timestamp: now,
      links: ["kc-seed-1"],
    },
  ];
}

function buildSeedActions(now: string): ActionItem[] {
  return [
    normalizeAction({
      id: "ka-seed-1",
      projectId: DEFAULT_PROJECT_ID,
      title: "跑通检索并展示带来源的卡片",
      description: "用一条真实问题跑通知识检索并展示带来源的卡片",
      assignee: "自己",
      deadline: "待确认",
      status: "doing",
      nextStep: "搜索「检索 来源」并确认来源标签可见",
      verificationCriteria: "搜索结果至少 1 条相关卡片且能点开看全文",
      cardId: "kc-seed-2",
      evidenceIds: ["kc-seed-2", "kc-seed-1"],
      createdAt: now,
      updatedAt: now,
    }),
    normalizeAction({
      id: "ka-seed-2",
      projectId: DEFAULT_PROJECT_ID,
      title: "会议文本生成卡片与工作项",
      description: "把会议粘贴文本整理成卡片并生成行动项",
      assignee: "自己",
      deadline: "待确认",
      status: "todo",
      nextStep: "粘贴示例会议并生成至少一条工作项",
      verificationCriteria: "minutes 接口返回 cards 与 actionItems",
      cardId: "kc-seed-1",
      evidenceIds: ["kc-seed-1"],
      createdAt: now,
      updatedAt: now,
    }),
  ];
}

function buildSeedRelations(now: string): KnowledgeRelation[] {
  return [
    {
      id: "rel-seed-1",
      fromCardId: "kc-seed-2",
      toCardId: "kc-seed-1",
      relationType: "supports",
      evidenceSentence:
        "好的检索结果必须带来源：路径、链接或会议原文片段；没有来源的摘要不当成事实。",
      status: "confirmed",
      directed: true,
      confidence: 1,
      source: "manual",
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
      workItemId: "ka-seed-1",
    },
    {
      id: "rel-seed-2",
      fromCardId: "kc-seed-4",
      toCardId: "kc-seed-1",
      relationType: "supports",
      evidenceSentence:
        "不是再做一个全能笔记，而是让找过的材料下次还能用，并且能变成可勾选的下一步。",
      status: "confirmed",
      directed: true,
      confidence: 1,
      source: "manual",
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "rel-seed-3",
      fromCardId: "kc-seed-3",
      toCardId: "kc-seed-1",
      relationType: "depends_on",
      evidenceSentence:
        "状态：待开始 → 进行中 → 待确认 → 完成；可标阻塞。进行中须有负责人与下一步。",
      status: "confirmed",
      directed: true,
      confidence: 1,
      source: "manual",
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function seedIfEmpty(
  cards: Map<string, KnowledgeCard>,
  actions: Map<string, ActionItem>,
  events: Map<string, WorkEvent>,
): void {
  // Product honesty: never auto-inject demo work as the user's situation.
  if (!isDemoSeedEnabled()) return;
  if (cards.size > 0) return;
  const now = new Date().toISOString();
  for (const card of buildSeedCards(now)) {
    cards.set(card.id, card);
  }
  for (const item of buildSeedActions(now)) {
    actions.set(item.id, item);
    const ev: WorkEvent = {
      id: randomUUID(),
      workItemId: item.id,
      type: "status_change",
      actor: "system",
      body: `创建工作项，状态 ${item.status}`,
      meta: { toStatus: item.status },
      createdAt: now,
    };
    events.set(ev.id, ev);
  }
  saveCards(cards);
  saveWorkState(actions, events);
  const relations = loadRelations();
  if (relations.size === 0) {
    for (const rel of buildSeedRelations(now)) {
      relations.set(rel.id, rel);
    }
    saveRelations(relations);
  }
}

/** Ensure demo relations exist when cards already seeded without relations file. */
function ensureSeedRelations(): void {
  if (!isDemoSeedEnabled()) return;
  const relations = loadRelations();
  if (relations.size > 0) return;
  const cards = loadCards();
  if (!cards.has("kc-seed-1") || !cards.has("kc-seed-2")) return;
  const now = new Date().toISOString();
  for (const rel of buildSeedRelations(now)) {
    if (cards.has(rel.fromCardId) && cards.has(rel.toCardId)) {
      relations.set(rel.id, rel);
    }
  }
  if (relations.size > 0) saveRelations(relations);
}

function workingRelations(): Map<string, KnowledgeRelation> {
  workingCards();
  ensureSeedRelations();
  return loadRelations();
}

function workingProjects(): Map<string, Project> {
  const projects = loadProjects();
  // Only auto-create the labeled demo project when SEED_DEMO=1.
  if (isDemoSeedEnabled() && !projects.has(DEFAULT_PROJECT_ID)) {
    const now = new Date().toISOString();
    projects.set(DEFAULT_PROJECT_ID, {
      id: DEFAULT_PROJECT_ID,
      name: "【示例】zhiji",
      summary: "示例数据（SEED_DEMO=1），不是用户自建工作局面",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    saveProjects(projects);
  }
  return projects;
}

function workingCards(): Map<string, KnowledgeCard> {
  workingProjects();
  const cards = loadCards();
  const actions = loadActionsRaw();
  const events = loadEvents();
  seedIfEmpty(cards, actions, events);
  return cards;
}

function workingActions(): Map<string, ActionItem> {
  workingProjects();
  const cards = loadCards();
  const actions = loadActionsRaw();
  const events = loadEvents();
  seedIfEmpty(cards, actions, events);
  return actions;
}

function workingEvents(): Map<string, WorkEvent> {
  const cards = loadCards();
  const actions = loadActionsRaw();
  const events = loadEvents();
  seedIfEmpty(cards, actions, events);
  return events;
}

function appendEvent(
  events: Map<string, WorkEvent>,
  workItemId: string,
  input: NewEventInput,
): WorkEvent {
  const event: WorkEvent = {
    id: randomUUID(),
    workItemId,
    type: input.type,
    actor: input.actor?.trim() || DEFAULT_ACTOR,
    body: input.body?.trim() || "",
    meta: input.meta,
    createdAt: new Date().toISOString(),
  };
  events.set(event.id, event);
  return event;
}

function assertCardRefsBelongToProject(
  projectId: string,
  cardIds: Array<string | undefined>,
): void {
  const cards = workingCards();
  for (const cardId of new Set(cardIds.filter((id): id is string => Boolean(id)))) {
    const card = cards.get(cardId);
    if (!card) throw new Error("依据卡不存在");
    if (card.projectId !== projectId) {
      throw new Error("依据卡和工作项必须属于同一项目");
    }
  }
}

function eventEvidenceIds(meta?: Record<string, unknown>): string[] {
  if (!meta) return [];
  const review =
    meta.review && typeof meta.review === "object"
      ? (meta.review as Record<string, unknown>)
      : undefined;
  return [
    ...(typeof meta.cardId === "string" ? [meta.cardId] : []),
    ...(Array.isArray(meta.evidenceIds) ? meta.evidenceIds.map(String) : []),
    ...(Array.isArray(review?.evidenceIds)
      ? review.evidenceIds.map(String)
      : []),
  ];
}

/** True when project has cards, work items, or materials (not an empty shell). */
export function projectHasWorkbenchSubstance(projectId: string): boolean {
  const id = projectId?.trim();
  if (!id) return false;
  if (listCards({ projectId: id }).length > 0) return true;
  if (listActions({ projectId: id }).length > 0) return true;
  try {
    if (listProjectMaterials(id).length > 0) return true;
  } catch {
    // materials store unavailable — treat as no materials
  }
  return false;
}

const EMPTY_SHELL_GRACE_MS = 15 * 60 * 1000;

/**
 * Workbench project list: active only; hide long-lived empty shells
 * (no cards / work / materials) so fixture leftovers do not clutter the nav.
 * Brand-new empty projects stay visible for EMPTY_SHELL_GRACE_MS.
 */
export function listProjects(): Project[] {
  const now = Date.now();
  const projects = [...workingProjects().values()]
    .map(copyProject)
    .filter((project) => project.status === "active")
    .filter((project) => {
      if (projectHasWorkbenchSubstance(project.id)) return true;
      const created = Date.parse(project.createdAt);
      if (!Number.isFinite(created)) return false;
      return now - created < EMPTY_SHELL_GRACE_MS;
    });
  const workItems = listActions();
  const events = [...workingEvents().values()];
  return rankProjectsByActivity(projects, workItems, events);
}

/** Mark project as opened now so entry attention prefers it. */
export function touchProjectOpened(projectId: string): Project {
  const projects = workingProjects();
  const project = projects.get(projectId);
  if (!project) throw new Error("项目不存在");
  const now = new Date().toISOString();
  const next: Project = {
    ...project,
    lastOpenedAt: now,
    updatedAt: now,
  };
  projects.set(projectId, next);
  saveProjects(projects);
  return copyProject(next);
}

export function getProject(id: string): Project | null {
  const project = workingProjects().get(id);
  return project ? copyProject(project) : null;
}

export function addProject(input: {
  name: string;
  summary?: string;
  sensitive?: boolean;
}): Project {
  const name = input.name?.trim();
  if (!name) throw new Error("项目名称不能为空");
  const projects = workingProjects();
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name,
    summary: input.summary?.trim() || "",
    status: "active",
    createdAt: now,
    updatedAt: now,
    sensitive: input.sensitive === true ? true : undefined,
  };
  projects.set(project.id, project);
  saveProjects(projects);
  return copyProject(project);
}

/**
 * Merge glue: ensure a knowledge Project exists with a stable id
 * (folder-connect uses projectIdFromCanonicalFolder). Idempotent.
 *
 * `syncNameFromFolder`: folder connect/continue always aligns display name with
 * the authorized folder basename (fixes stale names after re-authorize).
 */
export function ensureProject(input: {
  id: string;
  name: string;
  summary?: string;
  sensitive?: boolean;
  /** When true, overwrite name if the folder basename changed. */
  syncNameFromFolder?: boolean;
}): Project {
  const id = input.id?.trim();
  const name = input.name?.trim();
  if (!id) throw new Error("项目 id 不能为空");
  if (!name) throw new Error("项目名称不能为空");
  const projects = workingProjects();
  const existing = projects.get(id);
  if (existing) {
    let changed = false;
    if (input.syncNameFromFolder && existing.name !== name) {
      existing.name = name;
      changed = true;
    } else if (!existing.name?.trim() && name) {
      existing.name = name;
      changed = true;
    }
    if (input.summary?.trim()) {
      // Folder-authorized summary should stay truthful; refresh when syncing name.
      if (
        input.syncNameFromFolder ||
        !existing.summary?.trim()
      ) {
        if (existing.summary !== input.summary.trim()) {
          existing.summary = input.summary.trim();
          changed = true;
        }
      }
    }
    // Re-authorize brings empty shells back to active.
    if (existing.status !== "active") {
      existing.status = "active";
      changed = true;
    }
    if (changed) {
      existing.updatedAt = new Date().toISOString();
      projects.set(id, existing);
      saveProjects(projects);
    }
    return copyProject(existing);
  }
  const now = new Date().toISOString();
  const project: Project = {
    id,
    name,
    summary: input.summary?.trim() || "",
    status: "active",
    createdAt: now,
    updatedAt: now,
    sensitive: input.sensitive === true ? true : undefined,
  };
  projects.set(project.id, project);
  saveProjects(projects);
  return copyProject(project);
}

/** T-19: mark project sensitive (Owner isolation). */
export function setProjectSensitive(
  projectId: string,
  sensitive: boolean,
): Project {
  const projects = workingProjects();
  const project = projects.get(projectId);
  if (!project) throw new Error("项目不存在");
  project.sensitive = sensitive ? true : undefined;
  project.updatedAt = new Date().toISOString();
  projects.set(project.id, project);
  saveProjects(projects);
  return copyProject(project);
}

export function addProjectCheckpoint(
  projectId: string,
  input: Omit<ProjectCheckpoint, "id" | "projectId" | "createdAt">,
): ProjectCheckpoint {
  if (!getProject(projectId)) throw new Error("项目不存在");
  const goal = input.goal?.trim();
  const nextStep = input.nextStep?.trim();
  if (!goal || !nextStep) throw new Error("目标和下一步不能为空");
  const checkpoint: ProjectCheckpoint = {
    id: randomUUID(),
    projectId,
    goal,
    completed: input.completed.map((item) => item.trim()).filter(Boolean),
    unresolved: input.unresolved.map((item) => item.trim()).filter(Boolean),
    nextStep,
    confirmedBy: input.confirmedBy?.trim() || DEFAULT_ACTOR,
    createdAt: new Date().toISOString(),
  };
  const checkpoints = loadProjectCheckpoints();
  checkpoints.set(checkpoint.id, checkpoint);
  saveProjectCheckpoints(checkpoints);
  return copyProjectCheckpoint(checkpoint);
}

export function getLatestProjectCheckpoint(
  projectId: string,
): ProjectCheckpoint | null {
  let checkpoint: ProjectCheckpoint | undefined;
  for (const entry of loadProjectCheckpoints().values()) {
    if (entry.projectId !== projectId) continue;
    if (!checkpoint || entry.createdAt >= checkpoint.createdAt) {
      checkpoint = entry;
    }
  }
  return checkpoint ? copyProjectCheckpoint(checkpoint) : null;
}

export function listCards(filter?: { projectId?: string }): KnowledgeCard[] {
  let cards = [...workingCards().values()].map(copyCard);
  if (filter?.projectId) {
    cards = cards.filter((card) => card.projectId === filter.projectId);
  }
  return cards;
}

export function getProjectCanvasSnapshot(
  projectId: string,
  focus: CanvasNodeRef = { kind: "project", id: projectId },
  now: string = new Date().toISOString(),
): ProjectCanvasSnapshot {
  const project = getProject(projectId);
  if (!project) throw new Error("项目不存在");

  // Policy A: old projects that already have materials still get draft work items
  // when the canvas opens (idempotent). Avoids "materials only, work items 0".
  try {
    const { seedWorkItemsFromMaterials } = require(
      "@/shared/knowledge/seed-work-items-from-materials",
    ) as {
      seedWorkItemsFromMaterials: (projectId: string) => unknown;
    };
    seedWorkItemsFromMaterials(projectId);
  } catch {
    // Seed is best-effort; never block canvas read.
  }

  const cards = listCards({ projectId });
  let workItems = listActions({ projectId });
  const cardIds = new Set(cards.map((card) => card.id));
  let workItemIds = new Set(workItems.map((item) => item.id));
  const events = [...workingEvents().values()]
    .filter((event) => workItemIds.has(event.workItemId))
    .map(copyEvent);
  const eventIds = new Set(events.map((event) => event.id));
  const relations = listRelations().filter(
    (relation) =>
      cardIds.has(relation.fromCardId) && cardIds.has(relation.toCardId),
  );

  const agentActors = new Set(
    events
      .map((event) => event.actor)
      .filter((actor) => actor.startsWith("agent:") || actor === "agent"),
  );
  // If focus was a noise seed we just cancelled, fall back to project hub.
  let resolvedFocus = focus;
  const focusBelongs =
    (resolvedFocus.kind === "project" && resolvedFocus.id === projectId) ||
    (resolvedFocus.kind === "card" && cardIds.has(resolvedFocus.id)) ||
    (resolvedFocus.kind === "work_item" &&
      workItemIds.has(resolvedFocus.id)) ||
    (resolvedFocus.kind === "event" && eventIds.has(resolvedFocus.id)) ||
    (resolvedFocus.kind === "agent" && agentActors.has(resolvedFocus.id));
  if (!focusBelongs) {
    if (resolvedFocus.kind === "work_item") {
      resolvedFocus = { kind: "project", id: projectId };
      workItems = listActions({ projectId });
      workItemIds = new Set(workItems.map((item) => item.id));
    } else {
      throw new Error("关注对象不属于当前项目");
    }
  }

  const recentCardIds = [...loadFootprintEvents().values()]
    .filter((event) => cardIds.has(event.cardId) && event.depth > 0)
    .sort((a, b) => b.at.localeCompare(a.at))
    .reduce<string[]>((ids, event) => {
      if (!ids.includes(event.cardId)) ids.push(event.cardId);
      return ids;
    }, []);

  return buildProjectCanvasSnapshot({
    project,
    cards,
    workItems,
    events,
    relations,
    checkpoint: getLatestProjectCheckpoint(projectId),
    focus: resolvedFocus,
    now,
    recentCardIds,
  });
}

export function getCard(id: string): KnowledgeCard | null {
  const card = workingCards().get(id);
  return card ? copyCard(card) : null;
}

/** T-19: get card only if it belongs to projectId; else null (API → 404). */
export function getCardInProject(
  projectId: string,
  cardId: string,
): KnowledgeCard | null {
  const scope = requireProjectId(projectId);
  const card = getCard(cardId);
  if (!card || card.projectId !== scope) return null;
  return card;
}

/** T-19: get action only if it belongs to projectId; else null. */
export function getActionInProject(
  projectId: string,
  actionId: string,
): ActionItem | null {
  const scope = requireProjectId(projectId);
  const item = getAction(actionId);
  if (!item || item.projectId !== scope) return null;
  return item;
}

/** B-1: find the citation card bound to a project material file id. */
export function getCardBySourceFileId(
  projectId: string,
  sourceFileId: string,
): KnowledgeCard | null {
  const fileId = sourceFileId.trim();
  if (!fileId) return null;
  for (const card of listCards({ projectId })) {
    if (card.sourceFileId === fileId) return card;
  }
  return null;
}

export type MaterialCitationFreshness =
  | "fresh"
  | "stale"
  | "missing"
  | "unstamped";

/**
 * Compare a path citation's stamped hash to current material bytes.
 * Does not mutate cards. Missing material → missing; no stamp → unstamped.
 */
export function assertMaterialCitationFresh(input: {
  sourceContentHash?: string;
  currentContentHash?: string | null;
  materialExists: boolean;
}): MaterialCitationFreshness {
  if (!input.materialExists) return "missing";
  const stamped = input.sourceContentHash?.trim();
  if (!stamped) return "unstamped";
  const current = input.currentContentHash?.trim();
  if (!current) return "missing";
  return stamped === current ? "fresh" : "stale";
}

/**
 * B-1: ensure a real KnowledgeCard cites this material (stable material id = sourceFileId).
 * Reuses existing card; never invents materials without a real file id.
 * T-16: stamps sourceContentHash on create; one-time backfill if absent; never rewrites stamp.
 */
export function ensureMaterialCitationCard(input: {
  projectId: string;
  materialId: string;
  title: string;
  contentSummary: string;
  contentHash?: string;
}): KnowledgeCard {
  if (!getProject(input.projectId)) throw new Error("项目不存在");
  const materialId = input.materialId.trim();
  if (!materialId) throw new Error("材料 ID 无效");
  const contentHash = input.contentHash?.trim() || undefined;
  const existing = getCardBySourceFileId(input.projectId, materialId);
  if (existing) {
    // One-time backfill for legacy path-only cards (scion-safe: no id change).
    if (!existing.sourceContentHash?.trim() && contentHash) {
      const cards = workingCards();
      const live = cards.get(existing.id);
      if (live && !live.sourceContentHash?.trim()) {
        const now = new Date().toISOString();
        live.sourceContentHash = contentHash;
        live.sourceCitedAt = now;
        cards.set(live.id, live);
        saveCards(cards);
        return copyCard(live);
      }
    }
    return existing;
  }
  const now = new Date().toISOString();
  return addCard({
    projectId: input.projectId,
    title: input.title.trim() || materialId,
    content: input.contentSummary.trim() || `材料：${materialId}`,
    source: "doc",
    sourceFileId: materialId,
    sourceContentHash: contentHash,
    sourceCitedAt: contentHash ? now : undefined,
    tags: ["material", "citable"],
  });
}

export function addCard(input: NewCardInput): KnowledgeCard {
  const content = input.content?.trim();
  if (!content) throw new Error("卡片内容不能为空");
  // T-19: never silent DEFAULT_PROJECT_ID
  const projectId = requireProjectId(input.projectId);
  if (!getProject(projectId)) throw new Error("项目不存在");
  if (input.source && !KNOWLEDGE_SOURCES.includes(input.source)) {
    throw new Error("卡片来源无效");
  }

  const cards = workingCards();
  const now = new Date().toISOString();
  const sourceContentHash = input.sourceContentHash?.trim() || undefined;
  const card: KnowledgeCard = {
    id: input.id ?? randomUUID(),
    projectId,
    content,
    source: input.source ?? "manual",
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    timestamp: input.timestamp ?? now,
    links: input.links ?? [],
    title: input.title?.trim() || undefined,
    sourceFileId: input.sourceFileId?.trim() || undefined,
    sourceContentHash,
    sourceCitedAt:
      input.sourceCitedAt?.trim() ||
      (sourceContentHash ? now : undefined),
    identity: input.identity,
    resultEventLocator: input.resultEventLocator?.trim() || undefined,
  };
  cards.set(card.id, card);
  saveCards(cards);
  return copyCard(card);
}

export function addCards(inputs: NewCardInput[]): KnowledgeCard[] {
  return inputs.map((input) => addCard(input));
}

/** Persist one project-scoped candidate for a stable result event locator. */
export function ensureResultCandidateCard(
  input: ResultCandidateInput,
): KnowledgeCard {
  if (!getProject(input.projectId)) throw new Error("项目不存在");
  const item = getAction(input.resultEvent.workItemId);
  if (!item || item.projectId !== input.projectId) {
    throw new Error("结果事件和项目不匹配");
  }

  const projected = projectResultToCandidateCard(input);
  const existing = listCards({ projectId: projected.projectId }).find(
    (card) => card.resultEventLocator === projected.resultEventLocator,
  );
  if (existing) return existing;

  return addCard({
    ...projected,
    id: `candidate:${projected.projectId}:${input.resultEvent.id}`,
  });
}

export function listActions(filter?: {
  projectId?: string;
  assignee?: string;
  status?: ActionStatus | ActionStatus[];
  openOnly?: boolean;
}): ActionItem[] {
  let items = [...workingActions().values()].map(copyAction);
  if (filter?.projectId) {
    items = items.filter((item) => item.projectId === filter.projectId);
  }
  if (filter?.assignee) {
    items = items.filter((a) => a.assignee === filter.assignee);
  }
  if (filter?.status) {
    const set = new Set(
      Array.isArray(filter.status) ? filter.status : [filter.status],
    );
    items = items.filter((a) => set.has(a.status));
  }
  if (filter?.openOnly) {
    items = items.filter(
      (a) => a.status !== "done" && a.status !== "cancelled",
    );
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getAction(id: string): ActionItem | null {
  const item = workingActions().get(id);
  return item ? copyAction(item) : null;
}

export function listEventsForWorkItem(workItemId: string): WorkEvent[] {
  return [...workingEvents().values()]
    .filter((e) => e.workItemId === workItemId)
    .map(copyEvent)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** All work events for a project (via work-item membership). */
export function listWorkEventsForProject(projectId: string): WorkEvent[] {
  const id = projectId?.trim();
  if (!id) return [];
  const itemIds = new Set(
    listActions({ projectId: id }).map((item) => item.id),
  );
  return [...workingEvents().values()]
    .filter((e) => itemIds.has(e.workItemId))
    .map(copyEvent)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function searchScore(query: string, title: string, body: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedTitle = title.toLowerCase();
  const normalizedBody = body.toLowerCase();
  let score = normalizedTitle.includes(normalizedQuery) ? 80 : 0;
  if (normalizedBody.includes(normalizedQuery)) score += 45;
  for (const term of terms) {
    if (normalizedTitle.includes(term)) score += 18;
    if (normalizedBody.includes(term)) score += 8;
  }
  return score;
}

export function searchProjectRecords(
  projectId: string,
  query: string,
  limit = 12,
): ProjectSearchHit[] {
  if (!getProject(projectId)) throw new Error("项目不存在");
  const cards = listCards({ projectId });
  const items = listActions({ projectId });
  const itemIds = new Set(items.map((item) => item.id));
  const events = [...workingEvents().values()]
    .filter((event) => itemIds.has(event.workItemId))
    .map(copyEvent);

  const hits: ProjectSearchHit[] = [
    ...cards.map((card) => {
      const label = card.sourceFileId || card.title || "material";
      const summary = materialCardSummary(label, card.content ?? "");
      return {
        ref: { kind: "card" as const, id: card.id },
        title: card.title || "项目材料",
        summary,
        source: card.source,
        score: searchScore(
          query,
          card.title || "项目材料",
          `${summary} ${card.tags.join(" ")} ${card.source}`,
        ),
        updatedAt: card.timestamp,
      };
    }),
    ...items.map((item) => ({
      ref: { kind: "work_item" as const, id: item.id },
      title: item.title,
      summary: `${item.description} · 下一步：${item.nextStep}`,
      score: searchScore(query, item.title, `${item.description} ${item.nextStep} ${item.verificationCriteria} ${item.status}`),
      updatedAt: item.updatedAt,
    })),
    ...events.map((event) => ({
      ref: { kind: "event" as const, id: event.id },
      title: event.type === "result" ? "Agent 结果" : event.body.slice(0, 44) || "项目记录",
      summary: `${event.actor} · ${event.body}`,
      score: searchScore(query, event.body, `${event.actor} ${event.type}`),
      updatedAt: event.createdAt,
    })),
  ];

  return hits
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, Math.min(limit, 24)));
}

export function getWorkItemDetail(id: string): {
  item: ActionItem;
  events: WorkEvent[];
  evidence: KnowledgeCard[];
} | null {
  const item = getAction(id);
  if (!item) return null;
  const events = listEventsForWorkItem(id);
  const evidence = item.evidenceIds
    .map((cid) => getCard(cid))
    .filter(
      (card): card is KnowledgeCard =>
        card !== null && card.projectId === item.projectId,
    );
  return { item, events, evidence };
}

export function addAction(input: NewActionInput): ActionItem {
  const description = input.description?.trim();
  if (!description) throw new Error("工作项描述不能为空");
  // T-19: never silent DEFAULT_PROJECT_ID
  const projectId = requireProjectId(input.projectId);
  if (!getProject(projectId)) throw new Error("项目不存在");
  assertCardRefsBelongToProject(projectId, [
    input.cardId,
    ...(input.evidenceIds ?? []),
  ]);

  const now = new Date().toISOString();
  const item = normalizeAction({
    id: input.id ?? randomUUID(),
    projectId,
    title: input.title,
    description,
    assignee: input.assignee,
    deadline: input.deadline,
    status: input.status ?? "todo",
    verificationCriteria: input.verificationCriteria,
    cardId: input.cardId,
    evidenceIds: input.evidenceIds,
    nextStep: input.nextStep,
    blockedReason: input.blockedReason,
    createdAt: now,
    updatedAt: now,
  });

  if (item.status !== "todo") {
    assertWorkItemForStatus(item, item.status);
  } else if (!item.nextStep.trim()) {
    item.nextStep = "确认下一步并开始推进";
  }

  const actions = workingActions();
  const events = workingEvents();
  actions.set(item.id, item);
  appendEvent(events, item.id, {
    type: "status_change",
    actor: "system",
    body: `创建工作项「${item.title}」`,
    meta: { toStatus: item.status },
  });
  saveWorkState(actions, events);
  return copyAction(item);
}

export function addActions(inputs: NewActionInput[]): ActionItem[] {
  return inputs.map((input) => addAction(input));
}

export function updateActionStatus(
  id: string,
  status: ActionStatus,
  options?: { blockedReason?: string; actor?: string },
): ActionItem {
  return patchWorkItem(id, {
    status,
    blockedReason: options?.blockedReason,
  }, options?.actor);
}

export function patchWorkItem(
  id: string,
  patch: PatchWorkItemInput,
  actor: string = DEFAULT_ACTOR,
  options?: { projectId?: string },
): ActionItem {
  const actions = workingActions();
  const events = workingEvents();
  const item = actions.get(id);
  if (!item) throw new Error("工作项不存在");
  if (options?.projectId !== undefined) {
    const scope = requireProjectId(options.projectId);
    if (item.projectId !== scope) {
      throw new ProjectAccessError("工作项不在当前项目范围内");
    }
  }
  if (patch.cardId) {
    assertCardRefsBelongToProject(item.projectId, [patch.cardId]);
  }

  const next: ActionItem = {
    ...item,
    title: patch.title?.trim() || item.title,
    description: patch.description?.trim() || item.description,
    assignee:
      patch.assignee !== undefined
        ? patch.assignee.trim() || "待定"
        : item.assignee,
    deadline:
      patch.deadline !== undefined
        ? patch.deadline.trim() || "待确认"
        : item.deadline,
    status: patch.status ?? item.status,
    verificationCriteria:
      patch.verificationCriteria?.trim() || item.verificationCriteria,
    nextStep:
      patch.nextStep !== undefined ? patch.nextStep.trim() : item.nextStep,
    blockedReason:
      patch.blockedReason === null
        ? undefined
        : patch.blockedReason !== undefined
          ? patch.blockedReason.trim()
          : item.blockedReason,
    cardId:
      patch.cardId === null
        ? undefined
        : patch.cardId !== undefined
          ? patch.cardId
          : item.cardId,
    updatedAt: new Date().toISOString(),
  };

  if (next.status === "done" || next.status === "cancelled") {
    // allow empty nextStep on terminal
  } else if (!next.nextStep) {
    next.nextStep = item.nextStep || "确认下一步";
  }

  if (next.status === "blocked" && !next.blockedReason) {
    throw new WorkItemValidationError("阻塞状态必须填写原因");
  }
  if (next.status !== "blocked") {
    next.blockedReason = next.status === item.status ? next.blockedReason : undefined;
    if (patch.status && patch.status !== "blocked") {
      next.blockedReason = undefined;
    }
  }

  try {
    assertCanPatchTo(item, {
      status: next.status,
      assignee: next.assignee,
      nextStep: next.nextStep,
      blockedReason: next.blockedReason,
    });
  } catch (e) {
    if (e instanceof WorkItemValidationError) throw e;
    throw e;
  }

  if (item.status !== next.status) {
    appendEvent(events, id, {
      type: next.status === "blocked" ? "block" : item.status === "blocked" ? "unblock" : "status_change",
      actor,
      body:
        next.status === "blocked"
          ? next.blockedReason || "标记阻塞"
          : `状态 ${item.status} → ${next.status}`,
      meta: { fromStatus: item.status, toStatus: next.status },
    });
  }
  if (item.assignee !== next.assignee) {
    appendEvent(events, id, {
      type: "assign",
      actor,
      body: `负责人 ${item.assignee} → ${next.assignee}`,
      meta: { from: item.assignee, to: next.assignee },
    });
  }
  if (item.nextStep !== next.nextStep) {
    appendEvent(events, id, {
      type: "next_step_change",
      actor,
      body: next.nextStep || "（清空下一步）",
      meta: { from: item.nextStep, to: next.nextStep },
    });
  }

  actions.set(id, next);
  saveWorkState(actions, events);
  return copyAction(next);
}

export function addWorkEvent(
  workItemId: string,
  input: NewEventInput,
): WorkEvent {
  const actions = workingActions();
  const action = actions.get(workItemId);
  if (!action) throw new Error("工作项不存在");
  assertCardRefsBelongToProject(action.projectId, eventEvidenceIds(input.meta));

  if (
    input.type === "block" &&
    !input.body?.trim() &&
    !input.meta?.reason
  ) {
    throw new WorkItemValidationError("阻塞事件需要说明原因");
  }

  const events = workingEvents();
  const event = appendEvent(events, workItemId, input);

  if (input.type === "block") {
    const item = actions.get(workItemId)!;
    const reason =
      input.body?.trim() || String(input.meta?.reason ?? "阻塞");
    const updated: ActionItem = {
      ...item,
      status: "blocked",
      blockedReason: reason,
      nextStep: item.nextStep.startsWith("等待")
        ? item.nextStep
        : `等待：${reason}`,
      updatedAt: new Date().toISOString(),
    };
    actions.set(workItemId, updated);
  }

  if (input.type === "unblock") {
    const item = actions.get(workItemId)!;
    if (item.status === "blocked") {
      const updated: ActionItem = {
        ...item,
        status: "doing",
        blockedReason: undefined,
        updatedAt: new Date().toISOString(),
      };
      assertWorkItemForStatus(updated, "doing");
      actions.set(workItemId, updated);
    }
  }

  const item = actions.get(workItemId)!;
  item.updatedAt = new Date().toISOString();
  actions.set(workItemId, item);
  saveWorkState(actions, events);
  return copyEvent(event);
}

export function linkEvidence(
  workItemId: string,
  cardId: string,
  actor: string = DEFAULT_ACTOR,
): ActionItem {
  const card = getCard(cardId);
  if (!card) throw new Error("依据卡不存在");
  const actions = workingActions();
  const events = workingEvents();
  const item = actions.get(workItemId);
  if (!item) throw new Error("工作项不存在");
  if (card.projectId !== item.projectId) {
    throw new Error("依据卡和工作项必须属于同一项目");
  }

  if (item.evidenceIds.includes(cardId)) {
    return copyAction(item);
  }

  const updated: ActionItem = {
    ...item,
    evidenceIds: [...item.evidenceIds, cardId],
    cardId: item.cardId ?? cardId,
    updatedAt: new Date().toISOString(),
  };
  actions.set(workItemId, updated);
  appendEvent(events, workItemId, {
    type: "evidence_link",
    actor,
    body: `关联依据：${card.title || card.content.slice(0, 40)}`,
    meta: { cardId, source: card.source },
  });
  saveWorkState(actions, events);
  recordLinkedFootprint(cardId, workItemId, actor);
  return copyAction(updated);
}

export function unlinkEvidence(
  workItemId: string,
  cardId: string,
  actor: string = DEFAULT_ACTOR,
): ActionItem {
  const actions = workingActions();
  const events = workingEvents();
  const item = actions.get(workItemId);
  if (!item) throw new Error("工作项不存在");

  const updated: ActionItem = {
    ...item,
    evidenceIds: item.evidenceIds.filter((id) => id !== cardId),
    cardId: item.cardId === cardId ? undefined : item.cardId,
    updatedAt: new Date().toISOString(),
  };
  actions.set(workItemId, updated);
  appendEvent(events, workItemId, {
    type: "evidence_link",
    actor,
    body: `取消关联依据 ${cardId}`,
    meta: { cardId, unlinked: true },
  });
  saveWorkState(actions, events);
  return copyAction(updated);
}

/**
 * Test helper: wipe store files.
 * Re-seeds only when SEED_DEMO=1 (same as production path).
 * Prefer setting KNOWLEDGE_DATA_DIR to a temp dir in tests.
 */
export function resetKnowledgeStoreForTests(): void {
  ensureDataDir();
  for (const p of [
    cardsPath(),
    projectsPath(),
    projectCheckpointsPath(),
    actionsPath(),
    eventsPath(),
    workStateTransactionPath(),
    footprintEventsPath(),
    querySessionsPath(),
    relationsPath(),
    crossProjectRefsPath(),
    projectSourceGrantsPath(),
  ]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const filesDir = path.join(resolveDataDir(), "files");
  if (fs.existsSync(filesDir)) {
    fs.rmSync(filesDir, { recursive: true, force: true });
  }
  if (isDemoSeedEnabled()) {
    workingProjects();
    const cards = new Map<string, KnowledgeCard>();
    const actions = new Map<string, ActionItem>();
    const events = new Map<string, WorkEvent>();
    seedIfEmpty(cards, actions, events);
  }
}

export function getKnowledgeDataDirForTests(): string {
  return resolveDataDir();
}

/** After search: persist query session + retrieved footprint events. */
export function recordSearchFootprint(
  query: string,
  hits: KnowledgeSearchHit[],
  filters?: KnowledgeSearchFilters,
  actor: string = DEFAULT_ACTOR,
): { querySessionId: string } {
  const sessions = loadQuerySessions();
  const fp = loadFootprintEvents();
  const now = new Date().toISOString();
  const querySessionId = randomUUID();
  const scores: Record<string, number> = {};
  for (const h of hits) {
    scores[h.id] = h.score;
  }
  const session: QuerySession = {
    id: querySessionId,
    query,
    filters,
    at: now,
    hitCardIds: hits.map((h) => h.id),
    scores,
  };
  sessions.set(querySessionId, session);

  for (const h of hits) {
    const ev: FootprintEvent = {
      id: randomUUID(),
      cardId: h.id,
      at: now,
      kind: "retrieved",
      depth: depthForKind("retrieved"),
      querySessionId,
      score: h.score,
      actor,
      meta: { query: query.slice(0, 80) },
    };
    fp.set(ev.id, ev);
  }
  saveQuerySessions(sessions);
  saveFootprintEvents(fp);
  return { querySessionId };
}

export function recordLinkedFootprint(
  cardId: string,
  workItemId: string,
  actor: string = DEFAULT_ACTOR,
): void {
  const fp = loadFootprintEvents();
  const ev: FootprintEvent = {
    id: randomUUID(),
    cardId,
    at: new Date().toISOString(),
    kind: "linked",
    depth: depthForKind("linked"),
    workItemId,
    actor,
  };
  fp.set(ev.id, ev);
  saveFootprintEvents(fp);
}

export function recordOpenedFootprint(
  cardId: string,
  actor: string = DEFAULT_ACTOR,
): void {
  if (!getCard(cardId)) throw new Error("卡片不存在");
  const fp = loadFootprintEvents();
  const event: FootprintEvent = {
    id: randomUUID(),
    cardId,
    at: new Date().toISOString(),
    kind: "opened",
    depth: depthForKind("opened"),
    actor,
  };
  fp.set(event.id, event);
  saveFootprintEvents(fp);
}

export function getLibraryMapData(projectId: string): {
  nodes: LibraryNode[];
  layout: string;
} {
  const scope = requireProjectId(projectId);
  if (!getProject(scope)) throw new Error("项目不存在");
  return buildLibraryMap(listCards({ projectId: scope }));
}

export function getFootprintData(options: {
  mode: FootprintViewMode;
  /** T-19: required project scope */
  projectId: string;
  querySessionId?: string;
  workItemId?: string;
  sinceDays?: number;
}): {
  mode: FootprintViewMode;
  querySessionId?: string;
  workItemId?: string;
  lit: FootprintLitEntry[];
  litCount: number;
  dimCount: number;
} {
  const scope = requireProjectId(options.projectId);
  if (!getProject(scope)) throw new Error("项目不存在");
  const cards = listCards({ projectId: scope });
  const allIds = new Set(cards.map((c) => c.id));
  const events = [...loadFootprintEvents().values()];

  if (options.mode === "current_query" && options.querySessionId) {
    const session = loadQuerySessions().get(options.querySessionId);
    if (session) {
      const lit = litFromHits(
        session.hitCardIds.map((id) => ({
          id,
          score: session.scores?.[id],
        })),
      ).filter((e) => allIds.has(e.cardId));
      return {
        mode: options.mode,
        querySessionId: options.querySessionId,
        lit,
        litCount: lit.length,
        dimCount: Math.max(0, cards.length - lit.length),
      };
    }
  }

  let evidenceIds: string[] | undefined;
  if (options.mode === "work_item" && options.workItemId) {
    const item = getAction(options.workItemId);
    evidenceIds = item?.evidenceIds ?? [];
  }

  const since =
    options.mode === "window"
      ? daysAgoIso(options.sinceDays ?? 7)
      : undefined;

  const map = aggregateLit(events, {
    mode: options.mode,
    querySessionId: options.querySessionId,
    workItemId: options.workItemId,
    evidenceIds,
    since,
  });

  const lit = [...map.values()].filter((e) => allIds.has(e.cardId) && e.depth > 0);
  return {
    mode: options.mode,
    querySessionId: options.querySessionId,
    workItemId: options.workItemId,
    lit,
    litCount: lit.length,
    dimCount: Math.max(0, cards.length - lit.length),
  };
}

export function getQuerySession(id: string): QuerySession | null {
  const s = loadQuerySessions().get(id);
  return s ? structuredClone(s) : null;
}

// --- Knowledge relations ---

export function listRelations(filter?: {
  cardId?: string;
  status?: RelationStatus | RelationStatus[];
  type?: RelationType | RelationType[];
  workItemId?: string;
  includeRejected?: boolean;
  /** T-19: when set, only relations whose both endpoints live in this project */
  projectId?: string;
}): KnowledgeRelation[] {
  let all = [...workingRelations().values()];
  if (filter?.projectId?.trim()) {
    const scope = requireProjectId(filter.projectId);
    const cardIds = new Set(
      listCards({ projectId: scope }).map((c) => c.id),
    );
    all = all.filter(
      (r) => cardIds.has(r.fromCardId) && cardIds.has(r.toCardId),
    );
  }
  return filterRelationsForQuery(all, filter).map(copyRelation);
}

export function getRelation(id: string): KnowledgeRelation | null {
  const rel = workingRelations().get(id);
  return rel ? copyRelation(rel) : null;
}

export function createRelation(
  input: CreateRelationInput,
  actor: string = DEFAULT_ACTOR,
): KnowledgeRelation {
  const cards = workingCards();
  const cardIds = new Set(cards.keys());
  const shape = assertRelationShape(input, cardIds);
  const fromCard = cards.get(shape.fromCardId)!;
  const toCard = cards.get(shape.toCardId)!;
  if (fromCard.projectId !== toCard.projectId) {
    throw new RelationValidationError("关系两端必须属于同一项目");
  }
  const relations = workingRelations();
  const key = relationDedupKey(shape);
  for (const existing of relations.values()) {
    if (existing.status === "rejected") continue;
    if (relationDedupKey(existing) === key && existing.status === "confirmed") {
      throw new RelationValidationError("相同确认关系已存在");
    }
  }

  const now = new Date().toISOString();
  const rel: KnowledgeRelation = {
    id: input.id ?? randomUUID(),
    fromCardId: shape.fromCardId,
    toCardId: shape.toCardId,
    relationType: shape.relationType,
    evidenceSentence: shape.evidenceSentence,
    anchorCardId: input.anchorCardId?.trim() || shape.fromCardId,
    status: shape.status,
    directed: shape.directed,
    confidence: input.confidence,
    source: shape.source,
    createdBy: input.createdBy?.trim() || actor,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    workItemId: input.workItemId,
    meta: input.meta,
  };
  relations.set(rel.id, rel);
  saveRelations(relations);
  return copyRelation(rel);
}

export function patchRelation(
  id: string,
  patch: Partial<{
    status: RelationStatus;
    relationType: RelationType;
    evidenceSentence: string;
    workItemId: string | null;
  }>,
): KnowledgeRelation {
  const relations = workingRelations();
  const rel = relations.get(id);
  if (!rel) throw new RelationValidationError("关系不存在");

  const next: KnowledgeRelation = {
    ...rel,
    updatedAt: new Date().toISOString(),
  };
  if (patch.status) {
    if (
      patch.status !== "confirmed" &&
      patch.status !== "suggested" &&
      patch.status !== "rejected"
    ) {
      throw new RelationValidationError("关系状态无效");
    }
    next.status = patch.status;
  }
  if (patch.relationType) {
    next.relationType = patch.relationType;
    next.directed = !UNDIRECTED_RELATION_TYPES.includes(patch.relationType);
  }
  if (patch.evidenceSentence !== undefined) {
    const sentence = patch.evidenceSentence.replace(/\s+/g, " ").trim();
    if (!sentence) {
      throw new RelationValidationError("来源句不能为空");
    }
    next.evidenceSentence = sentence.slice(0, 280);
  }
  if (patch.workItemId === null) {
    next.workItemId = undefined;
  } else if (patch.workItemId !== undefined) {
    next.workItemId = patch.workItemId;
  }

  relations.set(id, next);
  saveRelations(relations);
  return copyRelation(next);
}

export function deleteRelation(id: string): boolean {
  const relations = workingRelations();
  if (!relations.has(id)) return false;
  relations.delete(id);
  saveRelations(relations);
  return true;
}

export function getNeighbors(
  cardId: string,
  options?: {
    status?: RelationStatus | RelationStatus[];
    /** T-19: required project scope — foreign card id under another project is deny */
    projectId?: string;
  },
): NeighborView {
  const projectId = requireProjectId(options?.projectId);
  const focusCard = getCardInProject(projectId, cardId);
  if (!focusCard) {
    throw new ProjectAccessError("卡不存在或不在当前项目范围内");
  }
  const cards = new Map(
    listCards({ projectId }).map((card) => [card.id, card]),
  );
  const projectRelations = [...workingRelations().values()].filter(
    (relation) =>
      cards.has(relation.fromCardId) && cards.has(relation.toCardId),
  );
  return buildNeighborView(cardId, projectRelations, cards, options);
}

export function getPathBetween(
  fromCardId: string,
  toCardId: string,
  options?: {
    maxDepth?: number;
    status?: RelationStatus | RelationStatus[];
    /** T-19: required project scope — path cannot escape via foreign ids */
    projectId?: string;
  },
): PathView | null {
  const projectId = requireProjectId(options?.projectId);
  const fromCard = getCardInProject(projectId, fromCardId);
  const toCard = getCardInProject(projectId, toCardId);
  if (!fromCard || !toCard) {
    throw new ProjectAccessError("起点或终点卡不存在或不在当前项目范围内");
  }
  const cards = new Map(
    listCards({ projectId }).map((card) => [card.id, card]),
  );
  const projectRelations = [...workingRelations().values()].filter(
    (relation) =>
      cards.has(relation.fromCardId) && cards.has(relation.toCardId),
  );
  return findPath(fromCardId, toCardId, projectRelations, options);
}

export function getEvidenceIsland(
  workItemId: string,
  options?: { projectId?: string },
): {
  workItemId: string;
  cardIds: string[];
  edges: KnowledgeRelation[];
} {
  const projectId = requireProjectId(options?.projectId);
  const item = getActionInProject(projectId, workItemId);
  if (!item) throw new ProjectAccessError("工作项不存在或不在当前项目范围内");
  const projectCardIds = new Set(
    listCards({ projectId }).map((c) => c.id),
  );
  const cardIds = item.evidenceIds.filter((id) => projectCardIds.has(id));
  const edges = islandEdges(cardIds, [...workingRelations().values()])
    .filter(
      (e) => projectCardIds.has(e.fromCardId) && projectCardIds.has(e.toCardId),
    )
    .map(copyRelation);
  return { workItemId, cardIds, edges };
}

export function extractRelations(options?: {
  cardId?: string;
  projectId?: string;
}): { created: KnowledgeRelation[]; count: number } {
  const pool = options?.projectId
    ? listCards({ projectId: options.projectId })
    : listCards();
  const existing = [...workingRelations().values()];
  const candidates = extractRelationCandidates(pool, existing).filter((c) => {
    if (!options?.cardId) return true;
    return c.fromCardId === options.cardId || c.toCardId === options.cardId;
  });
  const created: KnowledgeRelation[] = [];
  for (const c of candidates) {
    try {
      created.push(
        createRelation({
          ...c,
          status: "suggested",
          source: "rule",
          createdBy: c.createdBy ?? "system:rule",
        }),
      );
    } catch {
      // skip duplicates / invalid
    }
  }
  return { created, count: created.length };
}

// --- T-19 cross-project references (Owner-approved, revision-pinned) ---

function loadCrossProjectRefs(): Map<string, CrossProjectReference> {
  return readJsonMap<CrossProjectReference>(crossProjectRefsPath());
}

function saveCrossProjectRefs(map: Map<string, CrossProjectReference>): void {
  writeJsonMap(crossProjectRefsPath(), map);
}

function copyCrossProjectRef(ref: CrossProjectReference): CrossProjectReference {
  return structuredClone(ref);
}

function resolveSourceContentHash(input: {
  sourceProjectId: string;
  sourceKind: "card" | "material";
  sourceObjectId: string;
}): { hash: string; title?: string } {
  if (input.sourceKind === "card") {
    const card = getCardInProject(input.sourceProjectId, input.sourceObjectId);
    if (!card) throw new Error("源卡片不存在或不在源项目中");
    const hash =
      card.sourceContentHash?.trim() ||
      materialContentHash(card.content ?? "");
    return { hash, title: card.title || card.content.slice(0, 80) };
  }
  const read = readProjectMaterial(
    input.sourceProjectId,
    input.sourceObjectId,
  );
  if (!read) throw new Error("源材料不存在或不在源项目中");
  const hash =
    read.meta.contentHash?.trim() ||
    materialContentHash(
      read.content ||
        (read.dataUrl ? Buffer.from(read.dataUrl.split(",")[1] ?? "", "base64") : ""),
    );
  return { hash, title: read.meta.name };
}

/**
 * Create Owner-approved cross-project reference.
 * Pins source revision (client pin or computed content hash).
 * Sensitive sources never store title on host side.
 */
export function createCrossProjectReference(input: {
  hostProjectId: string;
  sourceProjectId: string;
  sourceKind: "card" | "material";
  sourceObjectId: string;
  approvedBy: string;
  /** Explicit pin (G5: sourceRevision). Prefer over live hash when provided. */
  sourceRevision?: string;
}): CrossProjectReference {
  const hostProjectId = requireProjectId(input.hostProjectId);
  const sourceProjectId = requireProjectId(input.sourceProjectId);
  if (hostProjectId === sourceProjectId) {
    throw new ProjectScopeError("跨项目引用的源项目不能与宿主项目相同");
  }
  if (!getProject(hostProjectId)) throw new Error("宿主项目不存在");
  const sourceProject = getProject(sourceProjectId);
  if (!sourceProject) throw new Error("源项目不存在");
  const approvedBy = assertOwnerApprover(input.approvedBy);
  const objectId = input.sourceObjectId.trim();
  if (!objectId) throw new Error("sourceObjectId 无效");
  if (input.sourceKind !== "card" && input.sourceKind !== "material") {
    throw new Error("sourceKind 无效");
  }

  // Ensure source object exists in source project (fail closed).
  const { hash, title } = resolveSourceContentHash({
    sourceProjectId,
    sourceKind: input.sourceKind,
    sourceObjectId: objectId,
  });
  const pin =
    input.sourceRevision?.trim() ||
    hash ||
    `${input.sourceKind}:${objectId}:v1`;
  const now = new Date().toISOString();
  const ref: CrossProjectReference = {
    id: randomUUID(),
    hostProjectId,
    sourceProjectId,
    sourceKind: input.sourceKind,
    sourceObjectId: objectId,
    sourceContentHash: pin,
    approvedBy,
    approvedAt: now,
    lastVerifiedAt: now,
    reviewRequired: false,
    sourceTitle: sourceProject.sensitive ? undefined : title,
  };
  const map = loadCrossProjectRefs();
  map.set(ref.id, ref);
  saveCrossProjectRefs(map);
  return copyCrossProjectRef(ref);
}

export function listCrossProjectReferences(
  hostProjectId: string,
): CrossProjectReference[] {
  const host = requireProjectId(hostProjectId);
  return [...loadCrossProjectRefs().values()]
    .filter((r) => r.hostProjectId === host)
    .map(copyCrossProjectRef)
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

/**
 * Re-check source hash; marks reviewRequired when source bytes/content changed.
 */
export function verifyCrossProjectReference(
  refId: string,
): CrossProjectReference {
  const map = loadCrossProjectRefs();
  const live = map.get(refId);
  if (!live) throw new Error("跨项目引用不存在");
  try {
    const { hash } = resolveSourceContentHash({
      sourceProjectId: live.sourceProjectId,
      sourceKind: live.sourceKind,
      sourceObjectId: live.sourceObjectId,
    });
    live.reviewRequired = hash !== live.sourceContentHash;
    live.lastVerifiedAt = new Date().toISOString();
  } catch {
    live.reviewRequired = true;
    live.lastVerifiedAt = new Date().toISOString();
  }
  map.set(live.id, live);
  saveCrossProjectRefs(map);
  return copyCrossProjectRef(live);
}

/**
 * Mark all host refs pointing at a source object as needing review after
 * source revision change. Does not rewrite the pinned sourceContentHash.
 */
export function markCrossProjectSourceChanged(input: {
  sourceProjectId: string;
  sourceObjectId: string;
  newRevision?: string;
}): CrossProjectReference[] {
  const sourceProjectId = requireProjectId(input.sourceProjectId);
  const objectId = input.sourceObjectId.trim();
  if (!objectId) throw new Error("sourceObjectId 无效");
  const map = loadCrossProjectRefs();
  const now = new Date().toISOString();
  const updated: CrossProjectReference[] = [];
  for (const ref of map.values()) {
    if (
      ref.sourceProjectId !== sourceProjectId ||
      ref.sourceObjectId !== objectId
    ) {
      continue;
    }
    // Pinned revision stays; newRevision only proves a change occurred.
    if (
      input.newRevision?.trim() &&
      input.newRevision.trim() !== ref.sourceContentHash
    ) {
      ref.reviewRequired = true;
    } else if (!input.newRevision?.trim()) {
      ref.reviewRequired = true;
    } else {
      ref.reviewRequired = true;
    }
    ref.lastVerifiedAt = now;
    map.set(ref.id, ref);
    updated.push(copyCrossProjectRef(ref));
  }
  if (updated.length > 0) saveCrossProjectRefs(map);
  return updated;
}

/** API-facing view of a cross-project reference (G5 RED contract fields). */
export function toCrossProjectReferenceView(ref: CrossProjectReference): {
  id: string;
  projectId: string;
  hostProjectId: string;
  sourceProjectId: string;
  sourceKind: "card" | "material";
  sourceObjectId: string;
  sourceRevision: string;
  sourceContentHash: string;
  approvedBy: string;
  approvedAt: string;
  verifiedAt: string;
  lastVerifiedAt: string;
  reviewRequired: boolean;
  reviewStatus: "current" | "needs_review";
  sourceTitle?: string;
} {
  return {
    id: ref.id,
    projectId: ref.hostProjectId,
    hostProjectId: ref.hostProjectId,
    sourceProjectId: ref.sourceProjectId,
    sourceKind: ref.sourceKind,
    sourceObjectId: ref.sourceObjectId,
    sourceRevision: ref.sourceContentHash,
    sourceContentHash: ref.sourceContentHash,
    approvedBy: ref.approvedBy,
    approvedAt: ref.approvedAt,
    verifiedAt: ref.lastVerifiedAt,
    lastVerifiedAt: ref.lastVerifiedAt,
    reviewRequired: ref.reviewRequired,
    reviewStatus: ref.reviewRequired ? "needs_review" : "current",
    sourceTitle: ref.sourceTitle,
  };
}

// --- T-19 S2: Owner project/source grants + redacted zero-leak hint ---

function loadProjectSourceGrants(): Map<string, ProjectSourceGrant> {
  return readJsonMap<ProjectSourceGrant>(projectSourceGrantsPath());
}

function saveProjectSourceGrants(map: Map<string, ProjectSourceGrant>): void {
  writeJsonMap(projectSourceGrantsPath(), map);
}

function copyProjectSourceGrant(grant: ProjectSourceGrant): ProjectSourceGrant {
  return structuredClone(grant);
}

/** Pure effective-grant predicate (testable; no I/O). */
export function isEffectiveProjectSourceGrant(
  grant: ProjectSourceGrant,
  nowIso: string,
): boolean {
  if (grant.disabledAt || grant.revokedAt) return false;
  if (grant.expiresAt != null && grant.expiresAt.trim() !== "") {
    if (grant.expiresAt.trim() <= nowIso) return false;
  }
  return true;
}

export function makeRedactedCrossProjectHint(): RedactedCrossProjectHint {
  return {
    kind: "approved_source_may_be_relevant",
    message: REDACTED_CROSS_PROJECT_HINT_MESSAGE,
  };
}

/**
 * Create Owner-preauthorized host→source grant receipt.
 * Does not store credentials or source content; does not create object refs.
 */
export function createProjectSourceGrant(input: {
  hostProjectId: string;
  sourceProjectId: string;
  approvedBy: string;
  expiresAt?: string | null;
  now?: string;
}): ProjectSourceGrant {
  const hostProjectId = requireProjectId(input.hostProjectId);
  const sourceProjectId = requireProjectId(input.sourceProjectId);
  if (hostProjectId === sourceProjectId) {
    throw new ProjectScopeError("源项目授权的源项目不能与宿主项目相同");
  }
  if (!getProject(hostProjectId)) throw new Error("宿主项目不存在");
  const source = getProject(sourceProjectId);
  if (!source) throw new Error("源项目不存在");
  if (source.sensitive) {
    throw new ProjectScopeError("敏感源项目不可创建来源授权");
  }
  const approvedBy = assertOwnerApprover(input.approvedBy);
  const now = input.now ?? new Date().toISOString();
  let expiresAt: string | null = null;
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    const exp = String(input.expiresAt).trim();
    if (!exp) throw new Error("expiresAt 无效");
    expiresAt = exp;
  }
  const grant: ProjectSourceGrant = {
    id: randomUUID(),
    hostProjectId,
    sourceProjectId,
    approvedBy,
    approvedAt: now,
    expiresAt,
  };
  const map = loadProjectSourceGrants();
  map.set(grant.id, grant);
  saveProjectSourceGrants(map);
  return copyProjectSourceGrant(grant);
}

/** Host-scoped list for Owner inspect (other hosts see nothing of these). */
export function listProjectSourceGrants(
  hostProjectId: string,
): ProjectSourceGrant[] {
  const host = requireProjectId(hostProjectId);
  return [...loadProjectSourceGrants().values()]
    .filter((g) => g.hostProjectId === host)
    .map(copyProjectSourceGrant)
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export function getProjectSourceGrant(
  hostProjectId: string,
  grantId: string,
): ProjectSourceGrant | null {
  const host = requireProjectId(hostProjectId);
  const id = grantId?.trim();
  if (!id) return null;
  const grant = loadProjectSourceGrants().get(id);
  if (!grant || grant.hostProjectId !== host) return null;
  return copyProjectSourceGrant(grant);
}

export function disableProjectSourceGrant(
  hostProjectId: string,
  grantId: string,
  input?: { disabledBy?: string; now?: string },
): ProjectSourceGrant {
  const host = requireProjectId(hostProjectId);
  const id = grantId?.trim();
  if (!id) throw new Error("grantId 必填");
  const map = loadProjectSourceGrants();
  const live = map.get(id);
  if (!live || live.hostProjectId !== host) {
    throw new ProjectAccessError("授权不存在或不在当前项目范围内");
  }
  if (live.revokedAt) {
    throw new ProjectScopeError("已吊销的授权不能再停用");
  }
  const now = input?.now ?? new Date().toISOString();
  live.disabledAt = now;
  if (input?.disabledBy?.trim()) live.disabledBy = input.disabledBy.trim();
  map.set(live.id, live);
  saveProjectSourceGrants(map);
  return copyProjectSourceGrant(live);
}

export function revokeProjectSourceGrant(
  hostProjectId: string,
  grantId: string,
  input?: { revokedBy?: string; reason?: string; now?: string },
): ProjectSourceGrant {
  const host = requireProjectId(hostProjectId);
  const id = grantId?.trim();
  if (!id) throw new Error("grantId 必填");
  const map = loadProjectSourceGrants();
  const live = map.get(id);
  if (!live || live.hostProjectId !== host) {
    throw new ProjectAccessError("授权不存在或不在当前项目范围内");
  }
  const now = input?.now ?? new Date().toISOString();
  live.revokedAt = now;
  if (input?.revokedBy?.trim()) live.revokedBy = input.revokedBy.trim();
  if (input?.reason?.trim()) live.revokeReason = input.reason.trim();
  map.set(live.id, live);
  saveProjectSourceGrants(map);
  return copyProjectSourceGrant(live);
}

/**
 * Zero-leak redacted hint for host project.
 * - At most one generic hint when any effective grant points at a non-sensitive source.
 * - Consults grant receipts only — no search/cards/relations/materials.
 * - Creates no Card, WorkEvent, evidence, candidate, claim, or CrossProjectReference.
 */
export function getRedactedCrossProjectHint(
  hostProjectId: string,
  now?: string,
): RedactedCrossProjectHint | null {
  const host = requireProjectId(hostProjectId);
  if (!getProject(host)) throw new Error("宿主项目不存在");
  const nowIso = now ?? new Date().toISOString();
  for (const grant of listProjectSourceGrants(host)) {
    if (!isEffectiveProjectSourceGrant(grant, nowIso)) continue;
    const source = getProject(grant.sourceProjectId);
    if (!source || source.sensitive) continue;
    return makeRedactedCrossProjectHint();
  }
  return null;
}

/** Array form for G5 RED surface (0 or 1 element). */
export function listRedactedCrossProjectHints(
  hostProjectId: string,
  now?: string,
): RedactedCrossProjectHint[] {
  const hint = getRedactedCrossProjectHint(hostProjectId, now);
  return hint ? [hint] : [];
}

export { WorkItemValidationError, RelationValidationError };
