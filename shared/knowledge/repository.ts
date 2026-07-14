import { randomUUID } from "node:crypto";
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

const globalStore = globalThis as typeof globalThis & {
  __fcOpcKnowledgeCards?: Map<string, KnowledgeCard>;
  __fcOpcKnowledgeActions?: Map<string, ActionItem>;
  __fcOpcKnowledgeSeeded?: boolean;
};

const cards =
  globalStore.__fcOpcKnowledgeCards ??
  (globalStore.__fcOpcKnowledgeCards = new Map());

const actions =
  globalStore.__fcOpcKnowledgeActions ??
  (globalStore.__fcOpcKnowledgeActions = new Map());

function copyCard(card: KnowledgeCard): KnowledgeCard {
  return structuredClone(card);
}

function copyAction(item: ActionItem): ActionItem {
  return structuredClone(item);
}

function seedIfNeeded(): void {
  if (globalStore.__fcOpcKnowledgeSeeded) return;
  globalStore.__fcOpcKnowledgeSeeded = true;

  const now = new Date().toISOString();
  const seeds: KnowledgeCard[] = [
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

  for (const card of seeds) {
    cards.set(card.id, card);
  }

  const seedActions: ActionItem[] = [
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

  for (const item of seedActions) {
    actions.set(item.id, item);
  }
}

seedIfNeeded();

export function listCards(): KnowledgeCard[] {
  seedIfNeeded();
  return [...cards.values()].map(copyCard);
}

export function getCard(id: string): KnowledgeCard | null {
  seedIfNeeded();
  const card = cards.get(id);
  return card ? copyCard(card) : null;
}

export function addCard(input: NewCardInput): KnowledgeCard {
  seedIfNeeded();
  const content = input.content?.trim();
  if (!content) throw new Error("卡片内容不能为空");

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
  return copyCard(card);
}

export function addCards(inputs: NewCardInput[]): KnowledgeCard[] {
  return inputs.map((input) => addCard(input));
}

export function listActions(): ActionItem[] {
  seedIfNeeded();
  return [...actions.values()].map(copyAction);
}

export function getAction(id: string): ActionItem | null {
  seedIfNeeded();
  const item = actions.get(id);
  return item ? copyAction(item) : null;
}

export function addAction(input: NewActionInput): ActionItem {
  seedIfNeeded();
  const description = input.description?.trim();
  if (!description) throw new Error("行动项描述不能为空");

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
  return copyAction(item);
}

export function addActions(inputs: NewActionInput[]): ActionItem[] {
  return inputs.map((input) => addAction(input));
}

export function updateActionStatus(
  id: string,
  status: ActionStatus,
): ActionItem {
  seedIfNeeded();
  const item = actions.get(id);
  if (!item) throw new Error("行动项不存在");
  const updated: ActionItem = {
    ...item,
    status,
    updatedAt: new Date().toISOString(),
  };
  actions.set(id, updated);
  return copyAction(updated);
}

/** Test helper: clear and re-seed. */
export function resetKnowledgeStoreForTests(): void {
  cards.clear();
  actions.clear();
  globalStore.__fcOpcKnowledgeSeeded = false;
  seedIfNeeded();
}
