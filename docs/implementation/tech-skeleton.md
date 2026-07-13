# 技术骨架 · 杀手锏「小掌柜」Agent 编排层 · v2

> **配套**:spec v2 / DEMO_SCRIPT v2 / 7-day-plan
> **基础**:code audit + spike runbook 已确认
> **状态**:可直接 D2 开工用
> **2026-07-04 21:55 修订**:本文件原计划由 subagent 产出,因 127.00.0.1:15721 上游 502 失败,改为手写
> **本文档替代**:`/Users/mahaoxuan/.claude/projects/-private-tmp/34b694c0-231b-4dc4-a49a-5045f83c23f3/workflows/scripts/plan-wave-fc-opc-ibot-wf_89fca61c-a0c.js` 第 3 阶段 tech-skeleton 缺失产物

---

## 0 · 真实代码事实(从 code audit)

| 事实 | 位置 |
|---|---|
| 协议:Anthropic Messages `/v1/messages` | `shared/llm/adapter.ts:57` |
| `tools` 字段**完全没有** | `shared/llm/adapter.ts:48-55` |
| `tool_use` 解析**完全没有** | `shared/llm/adapter.ts:81-83`(只 filter `type === "text"`) |
| Model 硬编码 `step-3.7-flash` | `shared/llm/adapter.ts:6`(改 env 需重启 dev server) |
| 5 个 API route | `/api/ecommerce/analyze` + `/api/ecommerce/script` + `/api/efficiency/minutes` + `/api/llm/completions` + `/api/llm/health` |
| **Kanban state 在 efficiency 页面,localStorage 持久化,无 zustand** | `app/track/efficiency/page.tsx:173` |
| **会议纪要 → 看板自动流转已存在** | `app/track/efficiency/page.tsx:213-227` |
| Task 接口 | `id/title/status/priority/assignee/deadline/isMock` |
| 5 个 status 列 | `todo/in-progress/blocked/done/cancelled` |
| **layout.tsx 干净,没有 Provider 包裹** | `app/layout.tsx:1-22` |
| 暗色主题 | Tailwind v4 + `bg-background` / `text-foreground` / `border-border` |

**重要约束**(决定 D2-D7 怎么改):
1. **不要新建 zustand store** — 复用 efficiency 页面的 `tasks` state,通过 `window.__addTasksByShopkeeper` 暴露
2. **不要新建 Kanban** — 用现有 KanbanBoard
3. **不要动 layout.tsx 太多** — 加 1 层 `<AgentRuntime>` 即可
4. **不动 5 个 API route 的主流程** — 只在 D4 adapter 升级时改

---

## 1 · 目录结构(新增部分,全部标 NEW)

```
lib/
  utils.ts                          (已有,保留)

shared/                             
  components/
    chat/ChatInterface.tsx          (已有,不动)
    layout/Sidebar.tsx              (已有,不动)
    shopkeeper/                     [NEW]
      ShopkeeperAvatar.tsx          # 右下角常驻 emoji + 状态灯
      ShopkeeperPanel.tsx           # 点击展开的早报 + 对话面板
    trace-panel/                    [NEW]
      TracePanel.tsx                # 主面板(默认折叠)
      TraceCard.tsx                 # 单张卡片(支持点击展开)
      TraceStepBadge.tsx            # 类型 badge
    agent-runtime/                  [NEW]
      AgentRuntime.tsx              # 顶层 Provider,挂载早报触发
      BriefSkeleton.tsx             # 加载中 fallback
      BriefMock.tsx                 # mock 数据兜底
      BriefLive.tsx                 # 真接 LLM
  llm/
    adapter.ts                      (D4 升级:加 tools 透传 + tool_use 解析)
    prompts/
      analyze.ts                    (已有)
      script.ts                     (已有)
      minutes.ts                    (已有)
      morning-brief.ts              [NEW] # 早报生成 prompt
  agent/                            [NEW] (新目录,7 天倒排里 D3-D4 落地)
    loop.ts                         # Agent Loop 核心循环(本期用简化版)
    trace/
      types.ts                      # TraceStep 类型定义
      parser.ts                     # CoT 文本 → TraceStep[]
    brief/
      types.ts                      # MorningBrief 接口
      provider.ts                   # BriefProvider 抽象
      mock-provider.ts              # mock 实现
      live-provider.ts              # live 实现(本期 D6 实现)
      mock-brief.json               # 硬编码场景数据
    decisions/
      types.ts                      # PendingDecision 类型
      store.ts                      # 简化版:本地 React state + zustand 可选
      withdraw.ts                   # 5 秒撤回机制状态机
    tools/                          [D4 落地]
      index.ts                      # tools registry
      promote-sku.ts                # 真决策工具
      generate-scripts.ts           # 真决策工具
      create-task.ts                # 真决策工具
      notify.ts                     # 真决策工具

app/
  layout.tsx                        (D2 改:加 <AgentRuntime> 包裹)
  track/
    ecommerce/page.tsx              (已有,不动)
    efficiency/page.tsx             (D5 改:暴露 __addTasksByShopkeeper)
```

---

## 2 · 关键接口契约

### 2.1 TraceStep(v2 折叠式)

```typescript
// shared/agent/trace/types.ts

export type TraceStep =
  | {
      id: string;
      ts: number;
      kind: 'thought';
      summary: string;          // 默认折叠:1 句话
      fullText?: string;        // 点击展开:全文 CoT
    }
  | {
      id: string;
      ts: number;
      kind: 'tool_call';
      name: string;
      args: Record<string, unknown>;
      result?: unknown;
    }
  | {
      id: string;
      ts: number;
      kind: 'observation';
      summary: string;
      raw?: unknown;
    }
  | {
      id: string;
      ts: number;
      kind: 'decision';
      action: string;
      reversible: boolean;
      withdrawDeadline?: number; // 5 秒后不可撤回
      confidence: number;
    };

export interface TraceStepWithMeta extends TraceStep {
  whyBadge?: string;            // 悬停问号的 1 句话理由
}
```

### 2.2 MorningBrief(v2 数据契约)

```typescript
// shared/agent/brief/types.ts

export interface CustomerMessage {
  from: string;
  intent: string;
  autoReplied: boolean;
  templateId?: string;
}

export interface HotSearch {
  keyword: string;
  matchSkuId?: string;
  trend: 'rising' | 'stable' | 'falling';
}

export interface SkuPerformance {
  skuId: string;
  addToCartRate: number;
  avgRate: number;
  recommendation?: 'main_push' | 'observe' | 'discard';
}

export interface BriefActionItem {
  id: string;
  source: 'morning_brief';
  description: string;             // e.g. "采纳建议,主推 SKU-12"
  oneClickExecute: () => Promise<void>;
}

export interface MorningBrief {
  id: string;
  generatedAt: number;
  customerMessages: CustomerMessage[];
  hotSearches: HotSearch[];
  skuPerformance: SkuPerformance[];
  actionItems: BriefActionItem[];
}
```

### 2.3 PendingDecision(真决策状态机)

```typescript
// shared/agent/decisions/types.ts

export interface ToolCallSpec {
  tool: string;
  args: unknown;
  expectedSideEffect: string;
}

export interface PendingDecision {
  id: string;
  source: 'morning_brief' | 'meeting_minutes' | 'cs_trigger';
  description: string;
  actionChain: ToolCallSpec[];
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
  withdrawDeadline: number;        // Date.now() + 5000
  confidence: number;
  // 状态机
  state: 'PENDING' | 'EXECUTING' | 'COMPLETED_WITH_GRACE' | 'LOCKED_IN' | 'ROLLED_BACK';
}
```

---

## 3 · Tool Schema(4 个真决策动作)

### 3.1 promote_sku

```typescript
// shared/agent/tools/promote-sku.ts

export const promoteSkuTool = {
  name: 'promote_sku',
  description: '将 SKU 从一个库挪到另一个库(影响明日算法权重)',
  input_schema: {
    type: 'object',
    properties: {
      skuId: { type: 'string', description: '如 SKU-12' },
      from: { type: 'string', enum: ['observe', 'main_push', 'discard'] },
      to: { type: 'string', enum: ['observe', 'main_push', 'discard'] },
      reason: { type: 'string', description: '为什么这次调整' },
    },
    required: ['skuId', 'from', 'to'],
  },
};

// 实现(本期 mock,真实实现后续接 lib/agent/store/sku-store.ts)
// 在 mock 模式下,执行即"写入 mock 数据" + UI Toast 提示
```

### 3.2 generate_scripts

```typescript
// shared/agent/tools/generate-scripts.ts

export const generateScriptsTool = {
  name: 'generate_scripts',
  description: '为指定 SKU 预生成 3 条不同角度的短视频脚本草稿',
  input_schema: {
    type: 'object',
    properties: {
      skuId: { type: 'string' },
      angles: {
        type: 'array',
        items: { type: 'string', enum: ['卖点', '价格', '口碑'] },
        minItems: 3,
        maxItems: 3,
      },
      duration: { type: 'number', enum: [15, 30, 60] },
    },
    required: ['skuId', 'angles'],
  },
};
```

### 3.3 create_task(已存在,需 wrapper)

```typescript
// shared/agent/tools/create-task.ts

export const createTaskTool = {
  name: 'create_task',
  description: '在 Kanban 创建任务卡片',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
      due: { type: 'string', description: 'ISO date 或相对时间' },
      source: { type: 'string', enum: ['morning_brief', 'meeting_minutes', 'manual'] },
    },
    required: ['title', 'priority'],
  },
};

// 实现:调 window.__addTasksByShopkeeper (D5 在 efficiency/page.tsx 暴露)
```

### 3.4 notify(团队通知)

```typescript
// shared/agent/tools/notify.ts

export const notifyTool = {
  name: 'notify',
  description: '向团队成员发送 mock 通知',
  input_schema: {
    type: 'object',
    properties: {
      recipientRole: { type: 'string', enum: ['运营', '内容', '客服', '合伙人'] },
      message: { type: 'string' },
      link: { type: 'string' },
    },
    required: ['recipientRole', 'message'],
  },
};

// 实现:mock 模式下,显示 Toast + 写入 .progress/notify-log.md
```

---

## 4 · Agent Loop 核心(简化版,不依赖 tool_use 协议)

**关键决策**:Agent Loop 的核心不是 LLM 调用循环,而是**业务流程编排**。每个"决策"在 D5 真接 LLM 之前都是 mock 化的。

```typescript
// shared/agent/loop.ts

import type { PendingDecision, ToolCallSpec } from './decisions/types';
import { promoteSku, generateScripts, createTask, notify } from './tools';

export interface AgentInput {
  userAction: string;              // e.g. "采纳建议,主推 SKU-12"
  briefContext: import('./brief/types').MorningBrief;
}

export interface AgentOutput {
  decision: PendingDecision;
  trace: import('./trace/types').TraceStep[];
}

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const trace: TraceStep[] = [];
  const ts = Date.now();
  let idCounter = 0;
  const nextId = () => `step-${ts}-${idCounter++}`;

  // Step 1: Thought — Agent 解释为什么这个决策
  trace.push({
    id: nextId(),
    ts,
    kind: 'thought',
    summary: '判断意图:用户采纳早报建议,需要执行真决策',
  });

  // Step 2: 构造 4 个动作链(本期 mock,未来可由 LLM 决定)
  const actionChain: ToolCallSpec[] = [
    { tool: 'promote_sku', args: { skuId: 'SKU-12', from: 'observe', to: 'main_push', reason: '加购率超阈值' }, expectedSideEffect: '主推库权重↑' },
    { tool: 'generate_scripts', args: { skuId: 'SKU-12', angles: ['卖点', '价格', '口碑'], duration: 30 }, expectedSideEffect: '预生成 3 条脚本' },
    { tool: 'create_task', args: { title: '发布 SKU-12 短视频', priority: 'P0', due: '今天 23:59', source: 'morning_brief' }, expectedSideEffect: '看板出现 1 张新卡片' },
    { tool: 'notify', args: { recipientRole: '内容', message: '小掌柜已预生成 SKU-12 脚本,请审核', link: '/track/ecommerce?sku=SKU-12' }, expectedSideEffect: '运营收到通知' },
  ];

  // Step 3: 逐个执行 + 记录 trace
  for (const call of actionChain) {
    trace.push({ id: nextId(), ts: Date.now(), kind: 'tool_call', name: call.tool, args: call.args });
    
    // 真执行(本期 mock,可接真实实现)
    const result = await executeMockTool(call);
    
    trace.push({ id: nextId(), ts: Date.now(), kind: 'observation', summary: result.summary, raw: result });
  }

  // Step 4: Decision
  const decision: PendingDecision = {
    id: nextId(),
    source: 'morning_brief',
    description: '主推 SKU-12 + 预生成 3 条脚本 + 建看板任务 + 发通知',
    actionChain,
    execute: async () => { /* 同上 */ },
    rollback: async () => { /* mock rollback */ },
    withdrawDeadline: Date.now() + 5000,
    confidence: 0.85,
    state: 'PENDING',
  };

  trace.push({ id: nextId(), ts: Date.now(), kind: 'decision', action: '4 个动作一次完成', reversible: true, withdrawDeadline: decision.withdrawDeadline, confidence: 0.85 });

  return { decision, trace };
}

async function executeMockTool(call: ToolCallSpec): Promise<{ summary: string }> {
  // mock:每个 tool 都返回 1 句 summary
  return { summary: `${call.tool} 已执行,等待 0.5s` };
}
```

---

## 5 · 早报触发时序(v2:进入页面时第一眼看到)

```
User 打开页面
  ↓
AgentRuntime mount(在 layout.tsx 包裹)
  ↓
useEffect 触发 briefProvider.getBrief()
  ↓
  - 200ms timeout → BriefSkeleton
  - 3s timeout → BriefMock
  - 真接 LLM → BriefLive
  ↓
ShopkeeperAvatar 状态灯: 绿 → 黄(工作中)
  ↓
早报滑入动画(可被 prefers-reduced-motion 降级)
  ↓
User 点 "采纳建议" → runAgent(input)
  ↓
4 个动作执行,trace 推送 SSE 或本地 state
  ↓
状态灯: 黄 → 红(决策中) → 绿
  ↓
5 秒撤回倒计时显示
```

**关键代码结构**:

```typescript
// shared/components/agent-runtime/AgentRuntime.tsx

"use client";

import { useEffect, useState } from 'react';
import { ShopkeeperAvatar } from '../shopkeeper/ShopkeeperAvatar';
import { ShopkeeperPanel } from '../shopkeeper/ShopkeeperPanel';
import { BriefSkeleton } from './BriefSkeleton';
import { BriefMock } from './BriefMock';
import { BriefLive } from './BriefLive';
import type { MorningBrief } from '@/shared/agent/brief/types';
import { mockProvider } from '@/shared/agent/brief/mock-provider';

type BriefState = 'loading' | 'skeleton' | 'mock' | 'live' | 'error';

export function AgentRuntime({ children }: { children: React.ReactNode }) {
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [state, setState] = useState<BriefState>('loading');
  const [shopkeeperCollapsed, setShopkeeperCollapsed] = useState(false);
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    
    // 200ms 后切换到 skeleton
    const skeletonTimer = setTimeout(() => {
      if (!cancelled) setState((s) => s === 'loading' ? 'skeleton' : s);
    }, 200);
    
    // 3s 后 fallback 到 mock
    const mockTimer = setTimeout(() => {
      if (!cancelled) setState((s) => s === 'loading' || s === 'skeleton' ? 'mock' : s);
    }, 3000);
    
    // 真接 LLM(本期简化为 mock)
    mockProvider.getBrief()
      .then((b) => {
        if (cancelled) return;
        clearTimeout(skeletonTimer);
        clearTimeout(mockTimer);
        setBrief(b);
        setState('live');
      })
      .catch(() => {
        if (cancelled) return;
        setState('mock');
      });
    
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(skeletonTimer);
      clearTimeout(mockTimer);
    };
  }, []);
  
  // 用 2 次后可折叠
  useEffect(() => {
    if (usageCount >= 2 && !shopkeeperCollapsed) {
      // 不强制折叠,只是允许用户折叠
    }
  }, [usageCount]);
  
  return (
    <>
      {children}
      <ShopkeeperAvatar
        state={state}
        collapsed={shopkeeperCollapsed}
        onToggleCollapse={() => setShopkeeperCollapsed((c) => !c)}
        onIncrementUsage={() => setUsageCount((n) => n + 1)}
      />
      {!shopkeeperCollapsed && (
        <ShopkeeperPanel
          brief={brief}
          state={state}
        />
      )}
    </>
  );
}
```

---

## 6 · 5 秒撤回机制状态机

```
Decision PENDING
  ↓ User 点 "确认执行"
State: EXECUTING(状态灯 红)
  ↓
PendingDecision.withdrawDeadline = Date.now() + 5000
  ↓
执行 4 个 tool calls(本期 mock,真实实现后续接)
  ↓
State: COMPLETED_WITH_GRACE(状态灯 绿 + 倒计时显示)
  ↓
Date.now() > withdrawDeadline → State: LOCKED_IN(撤回按钮消失)
  ↓
如果在 5 秒内 User 点"撤回"
  → State: ROLLED_BACK
  → 执行 rollback 函数(每个 PendingDecision 自带)
```

**关键代码**:

```typescript
// shared/agent/decisions/withdraw.ts

export function startWithdrawCountdown(decision: PendingDecision, onExpire: () => void) {
  const remaining = decision.withdrawDeadline - Date.now();
  if (remaining <= 0) {
    decision.state = 'LOCKED_IN';
    onExpire();
    return;
  }
  
  setTimeout(() => {
    if (decision.state === 'COMPLETED_WITH_GRACE') {
      decision.state = 'LOCKED_IN';
      onExpire();
    }
  }, remaining);
}

export function attemptWithdraw(decision: PendingDecision): boolean {
  if (Date.now() > decision.withdrawDeadline) return false;
  if (decision.state !== 'COMPLETED_WITH_GRACE') return false;
  
  decision.state = 'ROLLED_BACK';
  if (decision.rollback) decision.rollback();
  return true;
}
```

---

## 7 · D2-D7 回归测试矩阵

| 改动 | 必须通过的 E2E | 风险 |
|---|---|---|
| 加 AgentRuntime 全局挂载(D2) | 11/11 原 E2E + 1 个"小掌柜可见"测试 | z-index 冲突 / hydration 不匹配 |
| 加早报触发(D3) | E2E:打开页面看到小掌柜 + 早报 3 秒内出现 | LLM 慢导致白屏 / skeleton 一直显示 |
| Trace Panel 折叠式(D3) | E2E:点开 trace 看到 4 张卡片 + 折叠/展开交互 | parser 崩 / LLM 输出格式不稳定 |
| adapter 升级(D4, Go 时) | 11/11 原 E2E + 4 个 tool schema 测试 | 兼容性破坏现有 4 个 API |
| 真决策动作(D5) | E2E:采纳建议 → 4 个动作执行 → 看板出现新卡 | state 同步错乱 / 5 秒撤回失效 |
| 早报 live provider(D6) | 真实 LLM 调用 < 5 秒 | fallback 切换不工作 |
| D7 polish | build + lint + 11/11 E2E + 视觉效果 QA | 暗色主题一致 / 动画流畅度 |

---

## 8 · 与现有 4 个 API route 的对接方式(本期简化)

**重要**:本期不真接 tool_use 协议,只 mock 化执行。后续 D4 升级时再真接。

| 现有 API | 接入 Agent 方式 |
|---|---|
| `/api/ecommerce/analyze` | `runAgent` 中识别到用户问"选品分析" → 调该 API |
| `/api/ecommerce/script` | `runAgent` 中识别到用户问"生成脚本" → 调该 API |
| `/api/efficiency/minutes` | `runAgent` 中识别到用户问"会议纪要" → 调该 API |
| `/api/llm/completions` | 通用 LLM 入口,Agent Loop 可直接调 |

**注**:`runAgent` 本期不真接 LLM 决策,所有动作都是 mock。**真接 LLM 是 D4 升级的事**。

---

## 9 · Kanban 状态注入(避开 zustand)

按 v2 评审,"真决策动作" = 4 个动作一次完成,其中"建看板任务"必须真把卡片注入现有 KanbanBoard。

**实现方式**(参考现有 `__setEfficiencyMode` 模式):

```typescript
// app/track/efficiency/page.tsx (D5 改)

useEffect(() => {
  if (typeof window === "undefined") return;
  (window as unknown as { __setEfficiencyMode?: (m: EfficiencyMode) => void }).__setEfficiencyMode = setMode;
  
  // NEW: 暴露 addTasksByShopkeeper 给 Agent 调用
  (window as unknown as { __addTasksByShopkeeper?: (tasks: Task[]) => void }).__addTasksByShopkeeper = (newTasks) => {
    setTasks((prev) => [...newTasks, ...prev]);
  };
}, []);

// shared/agent/tools/create-task.ts (D5 改)
export async function executeCreateTask(args: { title: string; priority: string; due?: string }): Promise<{ summary: string }> {
  if (typeof window === "undefined") return { summary: 'create_task 在 SSR 不可用' };
  
  const newTask: Task = {
    id: `shopkeeper-${Date.now()}`,
    title: args.title,
    status: 'todo',
    priority: args.priority,
    deadline: args.due,
    // 不设 isMock,标 "由小掌柜创建"
  };
  
  const fn = (window as unknown as { __addTasksByShopkeeper?: (tasks: Task[]) => void }).__addTasksByShopkeeper;
  if (fn) fn([newTask]);
  
  return { summary: `看板已新建 "${args.title}" 卡片` };
}
```

---

## 10 · 风险与缓解(从 review + audit 推出来的)

| 风险 | 概率 | 缓解 |
|---|---|---|
| step-3.7-flash 不支持 tool_use | 30-40% | D1 spike 验证后,No-Go 走 mock,不影响本期 ship |
| 现场 LLM 慢 | 40% | skeleton 200ms + mock 3s 兜底(已在 §5) |
| 早报数据太硬编码 | 60% | mock-brief.json + 3 套场景,UI 标"演示模式"小标签 |
| 小掌柜头像遮挡 | 20% | 用 z-50(z-index 高于 modal) + 不阻挡点击 |
| 5 秒撤回窗口太短 | 30% | 用户测试反馈再调,本期固定 5s |
| 11/11 E2E 回归失败 | 25% | 每个 D 末尾强制跑 E2E,失败立即修 |

---

## 11 · 不做的事(明确砍掉)

- ❌ **不引 zustand**(用 localStorage + window 全局函数,跟现有模式一致)
- ❌ **不引 LangChain / LangGraph**(ARCHITECTURE_ANALYSIS 已砍)
- ❌ **不引 React Context Provider**(AgentRuntime 不用 Context,直接 mount 在 layout)
- ❌ **不建 RAG / 向量数据库**(ARCHITECTURE_ANALYSIS 已砍)
- ❌ **不真接真实淘宝 / 抖店 API**(mock 数据)
- ❌ **不接 Flowith / Coze / Dify 等 Agent 平台**(自建 Loop)
- ❌ **不做第二个真决策动作**(v2 评审砍了,1 个深决策 > 2 个浅决策)
- ❌ **不做流式打字效果**(mock fallback 已经够演示)
- ❌ **不做多语言 / 暗亮主题切换**(中文评审 + 暗色主题已定)
- ❌ **不做用户登录系统**(demo 用硬编码)

---

*本骨架可直接 D2 开工用。所有命名、目录、接口、Tool Schema 跟 spec v2 完全对齐。*
*替代缺失的 subagent tech-skeleton 产物(127.0.0.1:15721 502 失败)。*