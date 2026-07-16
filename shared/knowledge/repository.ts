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

export { DEFAULT_PROJECT_ID } from "@/shared/types/knowledge";
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
  return {
    id: raw.id ?? randomUUID(),
    projectId: raw.projectId ?? DEFAULT_PROJECT_ID,
    content: raw.content?.trim() || "未命名卡片",
    source: raw.source ?? "manual",
    tags: raw.tags ?? [],
    timestamp: raw.timestamp ?? new Date().toISOString(),
    links: raw.links ?? [],
    title: raw.title?.trim() || undefined,
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
    projectId: raw.projectId ?? DEFAULT_PROJECT_ID,
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
  if (!projects.has(DEFAULT_PROJECT_ID)) {
    const now = new Date().toISOString();
    projects.set(DEFAULT_PROJECT_ID, {
      id: DEFAULT_PROJECT_ID,
      name: "fc-opc-ibot",
      summary: "帮助知识工作者恢复项目状态、理解变化并继续执行",
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

export function listProjects(): Project[] {
  const projects = [...workingProjects().values()].map(copyProject);
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
  };
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
  const cards = listCards({ projectId });
  const workItems = listActions({ projectId });
  const cardIds = new Set(cards.map((card) => card.id));
  const workItemIds = new Set(workItems.map((item) => item.id));
  const events = [...workingEvents().values()]
    .filter((event) => workItemIds.has(event.workItemId))
    .map(copyEvent);
  const eventIds = new Set(events.map((event) => event.id));
  const relations = listRelations().filter(
    (relation) =>
      cardIds.has(relation.fromCardId) && cardIds.has(relation.toCardId),
  );

  const focusBelongs =
    (focus.kind === "project" && focus.id === projectId) ||
    (focus.kind === "card" && cardIds.has(focus.id)) ||
    (focus.kind === "work_item" && workItemIds.has(focus.id)) ||
    (focus.kind === "event" && eventIds.has(focus.id));
  if (!focusBelongs) throw new Error("关注对象不属于当前项目");

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
    focus,
    now,
    recentCardIds,
  });
}

export function getCard(id: string): KnowledgeCard | null {
  const card = workingCards().get(id);
  return card ? copyCard(card) : null;
}

export function addCard(input: NewCardInput): KnowledgeCard {
  const content = input.content?.trim();
  if (!content) throw new Error("卡片内容不能为空");
  const projectId = input.projectId ?? DEFAULT_PROJECT_ID;
  if (!getProject(projectId)) throw new Error("项目不存在");
  if (input.source && !KNOWLEDGE_SOURCES.includes(input.source)) {
    throw new Error("卡片来源无效");
  }

  const cards = workingCards();
  const now = new Date().toISOString();
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
  };
  cards.set(card.id, card);
  saveCards(cards);
  return copyCard(card);
}

export function addCards(inputs: NewCardInput[]): KnowledgeCard[] {
  return inputs.map((input) => addCard(input));
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
    ...cards.map((card) => ({
      ref: { kind: "card" as const, id: card.id },
      title: card.title || "项目材料",
      summary: card.content,
      source: card.source,
      score: searchScore(query, card.title || "项目材料", `${card.content} ${card.tags.join(" ")} ${card.source}`),
      updatedAt: card.timestamp,
    })),
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
  const projectId = input.projectId ?? DEFAULT_PROJECT_ID;
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
): ActionItem {
  const actions = workingActions();
  const events = workingEvents();
  const item = actions.get(id);
  if (!item) throw new Error("工作项不存在");
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
 * Test helper: wipe store files and re-seed.
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
  ]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const cards = new Map<string, KnowledgeCard>();
  const actions = new Map<string, ActionItem>();
  const events = new Map<string, WorkEvent>();
  seedIfEmpty(cards, actions, events);
  workingProjects();
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

export function getLibraryMapData(): {
  nodes: LibraryNode[];
  layout: string;
} {
  return buildLibraryMap(listCards());
}

export function getFootprintData(options: {
  mode: FootprintViewMode;
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
  const cards = listCards();
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
}): KnowledgeRelation[] {
  const all = [...workingRelations().values()];
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
  options?: { status?: RelationStatus | RelationStatus[] },
): NeighborView {
  const focusCard = getCard(cardId);
  if (!focusCard) {
    throw new RelationValidationError("卡不存在");
  }
  const cards = new Map(
    listCards({ projectId: focusCard.projectId }).map((card) => [card.id, card]),
  );
  const projectRelations = [...workingRelations().values()].filter(
    (relation) =>
      cards.has(relation.fromCardId) && cards.has(relation.toCardId),
  );
  return buildNeighborView(
    cardId,
    projectRelations,
    cards,
    options,
  );
}

export function getPathBetween(
  fromCardId: string,
  toCardId: string,
  options?: {
    maxDepth?: number;
    status?: RelationStatus | RelationStatus[];
  },
): PathView | null {
  if (!getCard(fromCardId) || !getCard(toCardId)) {
    throw new RelationValidationError("起点或终点卡不存在");
  }
  return findPath(fromCardId, toCardId, [...workingRelations().values()], options);
}

export function getEvidenceIsland(
  workItemId: string,
): {
  workItemId: string;
  cardIds: string[];
  edges: KnowledgeRelation[];
} {
  const item = getAction(workItemId);
  if (!item) throw new Error("工作项不存在");
  const cardIds = item.evidenceIds;
  const edges = islandEdges(cardIds, [...workingRelations().values()]).map(
    copyRelation,
  );
  return { workItemId, cardIds, edges };
}

export function extractRelations(options?: {
  cardId?: string;
}): { created: KnowledgeRelation[]; count: number } {
  const pool = listCards();
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
          createdBy: "system:rule",
        }),
      );
    } catch {
      // skip duplicates / invalid
    }
  }
  return { created, count: created.length };
}

export { WorkItemValidationError, RelationValidationError };
