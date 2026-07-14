import { searchKnowledge } from "./search";
import {
  addAction,
  addCard,
  listActions,
  listCards,
  updateActionStatus,
} from "./repository";
import type {
  ActionItem,
  ActionStatus,
  ActionSuggestion,
  KnowledgeCard,
  KnowledgeSearchFilters,
  KnowledgeSource,
} from "@/shared/types/knowledge";
import { ACTION_STATUSES } from "@/shared/types/knowledge";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const KNOWLEDGE_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "search_knowledge",
    description: "Search knowledge cards by query and optional filters",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        filters: {
          type: "object",
          properties: {
            source: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            limit: { type: "number" },
          },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "add_knowledge",
    description: "Add a knowledge card",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        source: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        title: { type: "string" },
        links: { type: "array", items: { type: "string" } },
      },
      required: ["content"],
    },
  },
  {
    name: "dissect_task",
    description: "Split a goal into action items (rule-based offline path)",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string" },
      },
      required: ["goal"],
    },
  },
  {
    name: "update_collaboration_state",
    description: "Update an action item status",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        newStatus: {
          type: "string",
          enum: ["todo", "doing", "confirmed", "done"],
        },
      },
      required: ["taskId", "newStatus"],
    },
  },
  {
    name: "generate_action_suggestions",
    description: "Suggest next actions from current cards and tasks",
    inputSchema: {
      type: "object",
      properties: {
        context: { type: "string" },
      },
    },
  },
];

function offlineDissect(goal: string): ActionItem[] {
  const clean = goal.trim();
  const chunks = clean
    .split(/[；;。\n]|然后|并且|以及|再/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 6);

  const steps =
    chunks.length > 0
      ? chunks
      : [
          `澄清目标：${clean}`,
          "收集相关资料并写入知识卡片",
          "列出验收标准",
          "执行并更新协作状态",
        ];

  return steps.map((description) =>
    addAction({
      description: description.startsWith("动词")
        ? description
        : description.match(/^(澄清|收集|列出|执行|整理|检索|确认)/)
          ? description
          : `完成：${description}`,
      assignee: "自己",
      deadline: "待确认",
      status: "todo",
      nextStep: `推进：${description.slice(0, 40)}`,
      verificationCriteria: `子任务「${description.slice(0, 40)}」可核对完成`,
    }),
  );
}

function offlineSuggestions(context?: string): ActionSuggestion[] {
  const open = listActions().filter((a) => a.status !== "done");
  const cards = listCards().slice(0, 5);
  const suggestions: ActionSuggestion[] = [];

  for (const item of open.slice(0, 3)) {
    suggestions.push({
      id: `sug-${item.id}`,
      title:
        item.status === "todo"
          ? `开始：${item.description}`
          : item.status === "doing"
            ? `推进并确认：${item.description}`
            : `收尾验收：${item.description}`,
      reason: `当前状态 ${item.status}；验收：${item.verificationCriteria}`,
      suggestedStatus:
        item.status === "todo"
          ? "doing"
          : item.status === "doing"
            ? "confirmed"
            : "done",
      relatedCardIds: item.cardId ? [item.cardId] : [],
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "sug-empty",
      title: "新增一条知识卡片或拆解一个目标",
      reason: context?.trim()
        ? `上下文：${context.slice(0, 80)}`
        : "暂无未完成行动项",
      relatedCardIds: cards.map((c) => c.id).slice(0, 2),
    });
  }

  return suggestions;
}

export type McpInvokeResult = {
  ok: boolean;
  tool: string;
  result?: unknown;
  error?: string;
};

export function invokeKnowledgeMcpTool(
  name: string,
  args: Record<string, unknown> = {},
): McpInvokeResult {
  try {
    switch (name) {
      case "search_knowledge": {
        const query = String(args.query ?? "");
        const filters = args.filters as KnowledgeSearchFilters | undefined;
        return {
          ok: true,
          tool: name,
          result: { hits: searchKnowledge(query, filters) },
        };
      }
      case "add_knowledge": {
        const card = addCard({
          content: String(args.content ?? ""),
          source: (args.source as KnowledgeSource) || "manual",
          tags: Array.isArray(args.tags)
            ? args.tags.map(String)
            : undefined,
          title: args.title ? String(args.title) : undefined,
          links: Array.isArray(args.links)
            ? args.links.map(String)
            : undefined,
        });
        return { ok: true, tool: name, result: { card } };
      }
      case "dissect_task": {
        const goal = String(args.goal ?? "");
        if (!goal.trim()) throw new Error("goal 不能为空");
        const actionItems = offlineDissect(goal);
        return {
          ok: true,
          tool: name,
          result: { goal, actionItems, offline: true },
        };
      }
      case "update_collaboration_state": {
        const taskId = String(args.taskId ?? "");
        const newStatus = String(args.newStatus ?? "") as ActionStatus;
        if (!ACTION_STATUSES.includes(newStatus)) {
          throw new Error("newStatus 无效");
        }
        const action = updateActionStatus(taskId, newStatus);
        return { ok: true, tool: name, result: { action } };
      }
      case "generate_action_suggestions": {
        const context = args.context ? String(args.context) : undefined;
        return {
          ok: true,
          tool: name,
          result: { suggestions: offlineSuggestions(context) },
        };
      }
      default:
        return { ok: false, tool: name, error: `未知工具: ${name}` };
    }
  } catch (error) {
    return {
      ok: false,
      tool: name,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function listKnowledgeMcpTools(): McpToolDefinition[] {
  return KNOWLEDGE_MCP_TOOLS;
}

export type { KnowledgeCard, ActionItem };
