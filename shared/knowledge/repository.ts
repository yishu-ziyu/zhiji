import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ActionItem,
  ActionStatus,
  KnowledgeCard,
  KnowledgeSource,
} from "@/shared/types/knowledge";

type NewCardInput = {
  content: string;
  source?: KnowledgeSource;
  tags?: string[];
  links?: string[];
  title?: string;
  id?: string;
  timestamp?: string;
};

type NewActionInput = {
  description: string;
  assignee?: string;
  deadline?: string;
  status?: ActionStatus;
  verificationCriteria?: string;
  cardId?: string;
  id?: string;
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

function actionsPath(): string {
  return path.join(resolveDataDir(), "actions.json");
}

function ensureDataDir(): void {
  const dir = resolveDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonMap<T>(file: string): Map<string, T> {
  try {
    if (!fs.existsSync(file)) return new Map();
    const raw = fs.readFileSync(file, "utf-8");
    if (!raw.trim()) return new Map();
    const data = JSON.parse(raw) as Record<string, T>;
    return new Map(Object.entries(data));
  } catch (error) {
    console.error(`Failed to load ${file}`, error);
    return new Map();
  }
}

function writeJsonMap<T>(file: string, map: Map<string, T>): void {
  ensureDataDir();
  const obj = Object.fromEntries(map);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf-8");
}

function loadCards(): Map<string, KnowledgeCard> {
  ensureDataDir();
  return readJsonMap<KnowledgeCard>(cardsPath());
}

function loadActions(): Map<string, ActionItem> {
  ensureDataDir();
  return readJsonMap<ActionItem>(actionsPath());
}

function saveCards(cards: Map<string, KnowledgeCard>): void {
  writeJsonMap(cardsPath(), cards);
}

function saveActions(actions: Map<string, ActionItem>): void {
  writeJsonMap(actionsPath(), actions);
}

function copyCard(card: KnowledgeCard): KnowledgeCard {
  return structuredClone(card);
}

function copyAction(item: ActionItem): ActionItem {
  return structuredClone(item);
}

function buildSeedCards(now: string): KnowledgeCard[] {
  return [
    {
      id: "kc-seed-1",
      title: "知识工作者主路径",
      content:
        "资料检索 → 沉淀成可复用卡片 → 接到协作动作。入口不必依赖个人微信私聊读取。",
      source: "doc",
      tags: ["产品", "知识工作", "主路径"],
      timestamp: now,
      links: [],
    },
    {
      id: "kc-seed-2",
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
      title: "协作状态四态",
      content:
        "行动项状态：todo → doing → confirmed → done。confirmed 表示对方或自己已确认验收标准。",
      source: "manual",
      tags: ["协作", "状态机", "行动项"],
      timestamp: now,
      links: [],
    },
    {
      id: "kc-seed-4",
      title: "Demo 金句",
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
    {
      id: "ka-seed-1",
      description: "用一条真实问题跑通知识检索并展示带来源的卡片",
      assignee: "自己",
      deadline: "待确认",
      status: "doing",
      verificationCriteria: "搜索结果至少 1 条相关卡片且能点开看全文",
      cardId: "kc-seed-2",
      updatedAt: now,
    },
    {
      id: "ka-seed-2",
      description: "把会议粘贴文本整理成卡片并生成行动项",
      assignee: "自己",
      deadline: "待确认",
      status: "todo",
      verificationCriteria: "minutes 接口返回 cards 与 actionItems",
      cardId: "kc-seed-1",
      updatedAt: now,
    },
  ];
}

function seedIfEmpty(
  cards: Map<string, KnowledgeCard>,
  actions: Map<string, ActionItem>,
): void {
  if (cards.size > 0) return;
  const now = new Date().toISOString();
  for (const card of buildSeedCards(now)) {
    cards.set(card.id, card);
  }
  for (const item of buildSeedActions(now)) {
    actions.set(item.id, item);
  }
  saveCards(cards);
  saveActions(actions);
}

/** Load cards from disk, seed when empty, return working map. */
function workingCards(): Map<string, KnowledgeCard> {
  const cards = loadCards();
  const actions = loadActions();
  seedIfEmpty(cards, actions);
  return cards;
}

function workingActions(): Map<string, ActionItem> {
  const cards = loadCards();
  const actions = loadActions();
  seedIfEmpty(cards, actions);
  return actions;
}

export function listCards(): KnowledgeCard[] {
  return [...workingCards().values()].map(copyCard);
}

export function getCard(id: string): KnowledgeCard | null {
  const card = workingCards().get(id);
  return card ? copyCard(card) : null;
}

export function addCard(input: NewCardInput): KnowledgeCard {
  const content = input.content?.trim();
  if (!content) throw new Error("卡片内容不能为空");

  const cards = workingCards();
  const now = new Date().toISOString();
  const card: KnowledgeCard = {
    id: input.id ?? randomUUID(),
    content,
    source: input.source ?? "manual",
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    timestamp: input.timestamp ?? now,
    links: input.links ?? [],
    title: input.title?.trim() || undefined,
  };
  cards.set(card.id, card);
  saveCards(cards);
  return copyCard(card);
}

export function addCards(inputs: NewCardInput[]): KnowledgeCard[] {
  return inputs.map((input) => addCard(input));
}

export function listActions(): ActionItem[] {
  return [...workingActions().values()].map(copyAction);
}

export function getAction(id: string): ActionItem | null {
  const item = workingActions().get(id);
  return item ? copyAction(item) : null;
}

export function addAction(input: NewActionInput): ActionItem {
  const description = input.description?.trim();
  if (!description) throw new Error("行动项描述不能为空");

  const actions = workingActions();
  const now = new Date().toISOString();
  const item: ActionItem = {
    id: input.id ?? randomUUID(),
    description,
    assignee: input.assignee?.trim() || "待定",
    deadline: input.deadline?.trim() || "待确认",
    status: input.status ?? "todo",
    verificationCriteria:
      input.verificationCriteria?.trim() || "完成描述中的工作并可核对结果",
    cardId: input.cardId,
    updatedAt: now,
  };
  actions.set(item.id, item);
  saveActions(actions);
  return copyAction(item);
}

export function addActions(inputs: NewActionInput[]): ActionItem[] {
  return inputs.map((input) => addAction(input));
}

export function updateActionStatus(
  id: string,
  status: ActionStatus,
): ActionItem {
  const actions = workingActions();
  const item = actions.get(id);
  if (!item) throw new Error("行动项不存在");
  const updated: ActionItem = {
    ...item,
    status,
    updatedAt: new Date().toISOString(),
  };
  actions.set(id, updated);
  saveActions(actions);
  return copyAction(updated);
}

/**
 * Test helper: wipe store files and re-seed.
 * Prefer setting KNOWLEDGE_DATA_DIR to a temp dir in tests.
 */
export function resetKnowledgeStoreForTests(): void {
  ensureDataDir();
  const cPath = cardsPath();
  const aPath = actionsPath();
  if (fs.existsSync(cPath)) fs.unlinkSync(cPath);
  if (fs.existsSync(aPath)) fs.unlinkSync(aPath);
  const cards = new Map<string, KnowledgeCard>();
  const actions = new Map<string, ActionItem>();
  seedIfEmpty(cards, actions);
}

export function getKnowledgeDataDirForTests(): string {
  return resolveDataDir();
}
