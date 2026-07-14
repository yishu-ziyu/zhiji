# 持续生长的项目画布实现计划

> **执行方式：** 使用 `/yishuship:dev` 按任务逐项实现；每完成一项就在本文件勾选，并同步更新根目录 `WORKFLOW_STATUS.md`。

**目标：** 把现有知识工作台改成可恢复项目状态、沿一层关系查看依据、作出决定并追踪 Agent 结果的项目画布，同时保留已经实现的检索、来源、工作项、关系和持久化能力。

**实现结构：** 现有 JSON 文件继续保存事实；新增项目和项目状态记录。`shared/knowledge/project-canvas.ts` 使用纯函数把项目、卡片、工作项、事件和关系生成一次完整的画布响应。页面的中央、右侧和底部只读取这一个响应，所有决定和 Agent 结果继续写回持久化数据。

**技术：** Next.js 16、React 19、TypeScript、Tailwind CSS 4、JSON 文件存储、Vitest、Playwright、现有 Anthropic 兼容 LLM 适配器。

## 开始开发前必须满足

- 用户已经确认四个连续界面状态：进入项目、聚焦对象、作出决定、执行写回。
- 四张图保持 `docs/design/project-canvas-reference.png` 的整体布局和视觉风格。
- 四张图路径和用户确认日期写入 `docs/design/project-canvas-visual-approval.md`；没有该文件时，任务 6 不开始。
- 若图片确认改变业务动作，先修改 `spec.md` 和本计划，再改代码。

## 文件职责

| 文件 | 职责 |
|---|---|
| `shared/types/knowledge.ts` | 项目、项目状态记录、画布节点、重点、计划判断和响应类型 |
| `shared/knowledge/repository.ts` | 项目、项目状态记录和现有对象的 JSON 持久化与迁移 |
| `shared/knowledge/project-canvas.ts` | 当前重点、原计划判断、一层关系、右侧内容和时间线的纯函数 |
| `shared/knowledge/project-review-agent.ts` | 一个受控 Agent 的输入、确定性测试结果和真实模型结果 |
| `app/api/knowledge/projects/**` | 项目列表、项目状态记录和画布读取接口 |
| `app/api/knowledge/work-items/[id]/agent-run/route.ts` | 启动 Agent、记录结果或阻塞 |
| `app/track/knowledge/components/project-canvas/**` | 左侧、中央、右侧、底部和新建面板 |
| `app/track/knowledge/page.tsx` | 当前项目、当前 focus、URL 和刷新协调 |
| `shared/knowledge/*.test.ts` | 迁移、排序、判断、关系和 Agent 规则 |
| `tests/unit/project-api.test.ts` | 项目接口和 Agent 接口 |
| `tests/e2e/project-canvas.spec.ts` | 四个连续界面状态 |
| `tests/e2e/app.spec.ts` | 已有检索、来源、工作项和关系回归 |

---

### 任务 1：增加项目归属并保护旧数据

**文件：**

- 修改：`shared/types/knowledge.ts:3-71`
- 修改：`shared/knowledge/repository.ts:49-429,494-618,861-882`
- 修改测试：`shared/knowledge/repository.test.ts`
- 修改测试：`shared/knowledge/footprint.test.ts`
- 修改测试：`shared/knowledge/relations.test.ts`

- [ ] **步骤 1：先写旧数据迁移和项目隔离测试**

在 `shared/knowledge/repository.test.ts` 增加两个用例。第一个直接写入没有 `projectId` 的旧卡片和旧工作项，然后断言读取结果属于默认项目；第二个创建两个项目及各自对象，断言过滤结果不串项目。

```ts
it("把没有 projectId 的旧卡片和工作项归入默认项目", async () => {
  fs.writeFileSync(path.join(tmpDir, "cards.json"), JSON.stringify({
    legacyCard: {
      id: "legacyCard", content: "旧材料", source: "doc", tags: [],
      timestamp: "2026-07-14T00:00:00.000Z", links: [],
    },
  }));
  fs.writeFileSync(path.join(tmpDir, "actions.json"), JSON.stringify({
    legacyItem: {
      id: "legacyItem", title: "旧工作", description: "旧工作",
      assignee: "自己", deadline: "待确认", status: "todo",
      verificationCriteria: "可检查", evidenceIds: [], nextStep: "继续",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
  }));
  const repo = await loadRepo();
  expect(repo.listCards({ projectId: repo.DEFAULT_PROJECT_ID })[0].projectId)
    .toBe(repo.DEFAULT_PROJECT_ID);
  expect(repo.listActions({ projectId: repo.DEFAULT_PROJECT_ID })[0].projectId)
    .toBe(repo.DEFAULT_PROJECT_ID);
});

it("按项目隔离卡片和工作项", async () => {
  const repo = await loadRepo();
  repo.resetKnowledgeStoreForTests();
  const other = repo.addProject({ name: "另一个项目", summary: "隔离检查" });
  repo.addCard({ content: "只属于另一个项目", projectId: other.id });
  repo.addAction({ description: "另一个项目的工作", projectId: other.id });
  expect(repo.listCards({ projectId: other.id })).toHaveLength(1);
  expect(repo.listActions({ projectId: other.id })).toHaveLength(1);
  expect(repo.listCards({ projectId: repo.DEFAULT_PROJECT_ID })
    .some((card) => card.content === "只属于另一个项目")).toBe(false);
});
```

- [ ] **步骤 2：运行测试，确认当前代码不支持项目**

运行：`npm run test:unit -- shared/knowledge/repository.test.ts`

预期：失败，错误包含 `addProject is not a function`、`DEFAULT_PROJECT_ID` 不存在或 `projectId` 不存在。

- [ ] **步骤 3：增加类型和最小持久化实现**

在 `shared/types/knowledge.ts` 增加：

```ts
export const DEFAULT_PROJECT_ID = "project-fc-opc-ibot";
export type ProjectStatus = "active" | "paused" | "archived";
export type Project = {
  id: string; name: string; summary: string; status: ProjectStatus;
  createdAt: string; updatedAt: string;
};
```

给 `KnowledgeCard` 和 `ActionItem` 增加必填 `projectId: string`。在 repository 中：

- 增加 `projects.json` 的 load/save 路径。
- 从 repository 重新导出 `DEFAULT_PROJECT_ID`，让 API 和迁移测试使用同一个常量。
- `normalizeCard` 和 `normalizeAction` 对缺失值使用 `DEFAULT_PROJECT_ID`。
- `NewCardInput`、`NewActionInput` 接受可选 `projectId`。
- `listCards({ projectId? })` 和现有 `listActions` 过滤器接受 `projectId`。
- 导出 `listProjects`、`getProject`、`addProject`。
- 空库种子项目固定使用 `DEFAULT_PROJECT_ID`，种子卡片和工作项全部归入该项目。
- `resetKnowledgeStoreForTests` 同时删除并重建项目文件。
- 给 `footprint.test.ts` 和 `relations.test.ts` 的 `KnowledgeCard` 固定数据增加 `projectId: DEFAULT_PROJECT_ID`，保证新增必填字段后现有领域测试仍能编译。

- [ ] **步骤 4：运行仓库测试**

运行：`npm run test:unit -- shared/knowledge/repository.test.ts shared/knowledge/footprint.test.ts shared/knowledge/relations.test.ts`

预期：该文件全部通过，旧的卡片、工作项、事件、足迹和关系测试不回退。

- [ ] **步骤 5：提交**

```bash
git add shared/types/knowledge.ts shared/knowledge/repository.ts shared/knowledge/repository.test.ts shared/knowledge/footprint.test.ts shared/knowledge/relations.test.ts
git commit -m "feat: add project ownership to knowledge data"
```

### 任务 2：实现项目状态、原计划判断和当前重点

**文件：**

- 修改：`shared/types/knowledge.ts`
- 新建：`shared/knowledge/project-canvas.ts`
- 新建测试：`shared/knowledge/project-canvas.test.ts`

- [ ] **步骤 1：写纯函数测试**

在 `project-canvas.test.ts` 用固定时间 `2026-07-15T10:00:00.000Z` 建立一个项目、三个工作项和对应事件，覆盖以下断言：

```ts
import { describe, expect, it } from "vitest";
import {
  assessPlan,
  buildCanvasTimeline,
  buildProjectCanvasSnapshot,
  rankAttention,
} from "./project-canvas";
import type {
  ActionItem,
  KnowledgeCard,
  Project,
  ProjectCheckpoint,
  WorkEvent,
} from "@/shared/types/knowledge";

const NOW = "2026-07-15T10:00:00.000Z";
const project: Project = {
  id: "p1", name: "项目画布", summary: "测试", status: "active",
  createdAt: NOW, updatedAt: NOW,
};
const checkpoint: ProjectCheckpoint = {
  id: "cp1", projectId: "p1", goal: "完成项目画布",
  completed: [], unresolved: ["交互"], nextStep: "确认交互",
  confirmedBy: "自己", createdAt: "2026-07-15T08:00:00.000Z",
};
const cards: KnowledgeCard[] = [{
  id: "card1", projectId: "p1", title: "交互依据", content: "先确认四个状态",
  source: "doc", tags: [], links: [], timestamp: "2026-07-15T08:10:00.000Z",
}];
const baseItem = {
  projectId: "p1", description: "测试", assignee: "自己",
  verificationCriteria: "可检查", evidenceIds: ["card1"], nextStep: "继续",
  blockedReason: undefined, createdAt: "2026-07-15T08:00:00.000Z",
  updatedAt: "2026-07-15T09:00:00.000Z", cardId: "card1",
};
const workItems: ActionItem[] = [
  { ...baseItem, id: "blocked", title: "阻塞项", deadline: "2026-07-16", status: "blocked", blockedReason: "缺少图片" },
  { ...baseItem, id: "confirmed", title: "待确认项", deadline: "2026-07-16", status: "confirmed" },
  { ...baseItem, id: "overdue", title: "逾期项", deadline: "2026-07-14", status: "todo" },
];
const events: WorkEvent[] = [
  { id: "event-block", workItemId: "blocked", type: "block", actor: "自己", body: "缺少图片", createdAt: "2026-07-15T09:00:00.000Z" },
  { id: "event-confirmed", workItemId: "confirmed", type: "status_change", actor: "agent:project-reviewer", body: "等待确认", meta: { toStatus: "confirmed" }, createdAt: "2026-07-15T09:10:00.000Z" },
  { id: "event-overdue", workItemId: "overdue", type: "status_change", actor: "system", body: "创建工作项", meta: { toStatus: "todo" }, createdAt: "2026-07-14T09:00:00.000Z" },
  { id: "event-result-old", workItemId: "overdue", type: "result", actor: "agent:project-reviewer", body: "旧结果", createdAt: "2026-07-14T09:30:00.000Z" },
  { id: "event-comment", workItemId: "overdue", type: "comment", actor: "自己", body: "普通评论", createdAt: "2026-07-15T09:20:00.000Z" },
];
const fixture = { project, cards, workItems, events, relations: [], checkpoint };
const focusByKind = {
  project: { kind: "project", id: "p1" },
  card: { kind: "card", id: "card1" },
  work_item: { kind: "work_item", id: "blocked" },
  event: { kind: "event", id: "event-block" },
} as const;

describe("project canvas domain", () => {
  it("重点按阻塞、待确认、逾期排序，同一工作项去重且最多三条", () => {
    const result = rankAttention(fixture, NOW);
    expect(result.map((item) => item.reasonCode))
      .toEqual(["blocked", "awaiting_confirmation", "overdue"]);
    expect(new Set(result.map((item) => `${item.target.kind}:${item.target.id}`)).size)
      .toBe(result.length);
    expect(result).toHaveLength(3);
    expect(result.every((item) => item.evidenceEventIds.length > 0)).toBe(true);
  });

  it("明确阻塞使原计划需要调整并指向依据", () => {
    const assessment = assessPlan(checkpoint, fixture.events, fixture.cards);
    expect(assessment.status).toBe("adjust");
    expect(assessment.evidence).toContainEqual({ kind: "event", id: "event-block" });
  });

  it("没有确认记录或依据时只返回信息不足", () => {
    expect(assessPlan(null, [], []).status).toBe("insufficient");
  });

  it("用户重申原下一步且没有冲突时返回继续并引用确认记录", () => {
    const reaffirmed: WorkEvent = {
      id: "event-reaffirm", workItemId: "confirmed", type: "decision", actor: "自己",
      body: "继续确认交互", meta: { reaffirmsNextStep: true },
      createdAt: "2026-07-15T09:30:00.000Z",
    };
    const assessment = assessPlan(checkpoint, [reaffirmed], cards);
    expect(assessment.status).toBe("continue");
    expect(assessment.evidence).toContainEqual({ kind: "event", id: "event-reaffirm" });
  });

  it("关键事件不会被普通评论隐藏", () => {
    const timeline = buildCanvasTimeline(fixture.events);
    expect(timeline.now.map((event) => event.id)).toContain("event-block");
    expect(timeline.history.map((event) => event.id)).toContain("event-result-old");
  });

  it.each(["project", "card", "work_item", "event"] as const)(
    "%s 为中心时只生成一层直接关系",
    (kind) => {
      const snapshot = buildProjectCanvasSnapshot({
        ...fixture,
        focus: focusByKind[kind],
        now: NOW,
      });
      expect(snapshot.nodes.every((node) => node.depth <= 1)).toBe(true);
      expect(snapshot.edges.every((edge) =>
        `${edge.source.kind}:${edge.source.id}` !== `${edge.target.kind}:${edge.target.id}`,
      )).toBe(true);
    },
  );
});
```

- [ ] **步骤 2：运行测试，确认模块尚不存在**

运行：`npm run test:unit -- shared/knowledge/project-canvas.test.ts`

预期：失败，错误为无法找到 `shared/knowledge/project-canvas`。

- [ ] **步骤 3：增加领域类型和纯函数**

在 `shared/types/knowledge.ts` 增加 `ProjectCheckpoint`、`CanvasNodeRef`、`AttentionItem`、`PlanAssessment`、`CanvasNode`、`CanvasEdge`、`CanvasInspector`、`CanvasTimelineEvent`、`CanvasTimeline` 和 `ProjectCanvasSnapshot`，逐字段使用 `spec.md` 第 4 节的定义。

在 `project-canvas.ts` 导出：

```ts
export type ProjectFacts = {
  project: Project;
  cards: KnowledgeCard[];
  workItems: ActionItem[];
  events: WorkEvent[];
  relations: KnowledgeRelation[];
  checkpoint: ProjectCheckpoint | null;
};

export type ProjectCanvasInput = ProjectFacts & {
  focus: CanvasNodeRef;
  now: string;
};

export function rankAttention(input: ProjectFacts, now: string): AttentionItem[];
export function assessPlan(
  checkpoint: ProjectCheckpoint | null,
  events: WorkEvent[],
  cards: KnowledgeCard[],
): PlanAssessment;
export function buildCanvasTimeline(events: WorkEvent[]): CanvasTimeline;
export function buildProjectCanvasSnapshot(
  input: ProjectCanvasInput,
): ProjectCanvasSnapshot;
```

实现规则：固定优先级，不调用模型；理由带真实对象和事件；计划判断无依据时返回 `insufficient`；timeline 的 `now` 只含 doing、blocked、confirmed 对应事件，terminal 状态和旧结果进入 `history`，关键事件始终保留。

- [ ] **步骤 4：运行领域测试和全部单元测试**

运行：`npm run test:unit -- shared/knowledge/project-canvas.test.ts`

预期：新测试全部通过。

运行：`npm run test:unit`

预期：全部单元测试通过。

- [ ] **步骤 5：提交**

```bash
git add shared/types/knowledge.ts shared/knowledge/project-canvas.ts shared/knowledge/project-canvas.test.ts
git commit -m "feat: derive project attention and plan assessment"
```

### 任务 3：持久化用户确认的项目状态并生成一层画布

**文件：**

- 修改：`shared/knowledge/repository.ts`
- 修改测试：`shared/knowledge/repository.test.ts`
- 修改测试：`shared/knowledge/project-canvas.test.ts`（任务 2 已创建）

- [ ] **步骤 1：写项目状态和一层关系测试**

```ts
it("保存并读取最新的用户确认项目状态", async () => {
  const repo = await loadRepo();
  repo.resetKnowledgeStoreForTests();
  const saved = repo.addProjectCheckpoint(repo.DEFAULT_PROJECT_ID, {
    goal: "完成项目画布规格",
    completed: ["源码调查"],
    unresolved: ["四个界面状态"],
    nextStep: "确认四张图",
    confirmedBy: "自己",
  });
  expect(repo.getLatestProjectCheckpoint(repo.DEFAULT_PROJECT_ID)?.id).toBe(saved.id);
  expect(fs.existsSync(path.join(tmpDir, "project-checkpoints.json"))).toBe(true);
});

it("工作项为中心时只返回直接依据和关键事件", async () => {
  const repo = await loadRepo();
  repo.resetKnowledgeStoreForTests();
  const snapshot = repo.getProjectCanvasSnapshot(repo.DEFAULT_PROJECT_ID, {
    kind: "work_item", id: "ka-seed-1",
  });
  expect(snapshot.focus).toEqual({ kind: "work_item", id: "ka-seed-1" });
  expect(snapshot.nodes.every((node) => node.depth <= 1)).toBe(true);
  expect(snapshot.nodes.some((node) => node.ref.kind === "card")).toBe(true);
  expect(snapshot.nodes.some((node) => node.ref.kind === "event")).toBe(true);
});
```

- [ ] **步骤 2：运行测试，确认当前实现缺失**

运行：`npm run test:unit -- shared/knowledge/repository.test.ts shared/knowledge/project-canvas.test.ts`

预期：失败，错误指出 `addProjectCheckpoint` 或 `getProjectCanvasSnapshot` 不存在。

- [ ] **步骤 3：实现项目状态文件和画布读取**

在 repository 增加：

```ts
export function addProjectCheckpoint(
  projectId: string,
  input: Omit<ProjectCheckpoint, "id" | "projectId" | "createdAt">,
): ProjectCheckpoint;
export function getLatestProjectCheckpoint(projectId: string): ProjectCheckpoint | null;
export function getProjectCanvasSnapshot(
  projectId: string,
  focus?: CanvasNodeRef,
): ProjectCanvasSnapshot;
```

状态记录写入 `project-checkpoints.json`。画布读取一次性收集该项目的卡片、工作项、事件、关系和最新状态记录，再调用 `buildProjectCanvasSnapshot`。任何 focus 不属于该项目时抛出“关注对象不属于当前项目”。`resetKnowledgeStoreForTests` 必须删除 `project-checkpoints.json`，避免测试之间残留状态。

- [ ] **步骤 4：运行目标测试和全部单元测试**

运行：`npm run test:unit -- shared/knowledge/repository.test.ts shared/knowledge/project-canvas.test.ts`

预期：目标测试全部通过。

运行：`npm run test:unit`

预期：全部单元测试通过。

- [ ] **步骤 5：提交**

```bash
git add shared/knowledge/repository.ts shared/knowledge/repository.test.ts shared/knowledge/project-canvas.test.ts
git commit -m "feat: persist project checkpoints and canvas snapshots"
```

### 任务 4：增加项目、状态记录和画布接口

**文件：**

- 新建：`app/api/knowledge/projects/route.ts`
- 新建：`app/api/knowledge/projects/[id]/canvas/route.ts`
- 新建：`app/api/knowledge/projects/[id]/checkpoints/route.ts`
- 修改：`app/api/knowledge/add/route.ts`
- 修改：`app/api/knowledge/minutes/route.ts`
- 修改：`app/api/knowledge/dissect/route.ts`
- 修改：`app/api/knowledge/search/route.ts`
- 修改：`app/api/knowledge/work-items/route.ts`
- 修改：`shared/types/knowledge.ts`
- 修改：`shared/knowledge/search.ts`
- 修改：`shared/knowledge/mcp-tools.ts`
- 修改测试：`shared/knowledge/search.test.ts`
- 修改测试：`shared/knowledge/mcp-tools.test.ts`
- 新建测试：`tests/unit/project-api.test.ts`

- [ ] **步骤 1：写接口测试**

用 `NextRequest` 直接调用 route handler。测试必须覆盖：创建项目返回 201；保存状态记录返回 201；读取 focus 响应同时包含 nodes、inspector、timeline、attention；新增卡片和工作项接受 `projectId`。

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as createProjectPost } from "@/app/api/knowledge/projects/route";
import { GET as canvasGet } from "@/app/api/knowledge/projects/[id]/canvas/route";
import { POST as checkpointPost } from "@/app/api/knowledge/projects/[id]/checkpoints/route";
import { POST as addCardPost } from "@/app/api/knowledge/add/route";
import { POST as addWorkItemPost } from "@/app/api/knowledge/work-items/route";
import {
  listActions,
  listCards,
  resetKnowledgeStoreForTests,
} from "@/shared/knowledge/repository";
import { DEFAULT_PROJECT_ID } from "@/shared/types/knowledge";
import { searchKnowledge } from "@/shared/knowledge/search";
import { invokeKnowledgeMcpTool } from "@/shared/knowledge/mcp-tools";

let tmpDir = "";
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-project-api-"));
  process.env.KNOWLEDGE_DATA_DIR = tmpDir;
  resetKnowledgeStoreForTests();
});
afterEach(() => {
  delete process.env.KNOWLEDGE_DATA_DIR;
  delete process.env.AGENT_RUN_MODE;
  delete process.env.LLM_BASE_URL;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

it("创建项目、保存状态并读取同一份画布响应", async () => {
  const created = await createProjectPost(new NextRequest("http://test/api/knowledge/projects", {
    method: "POST", body: JSON.stringify({ name: "画布测试", summary: "接口验收" }),
  }));
  expect(created.status).toBe(201);
  const { project } = await created.json();

  const checkpoint = await checkpointPost(
    new NextRequest(`http://test/api/knowledge/projects/${project.id}/checkpoints`, {
      method: "POST",
      body: JSON.stringify({
        goal: "完成画布", completed: [], unresolved: ["交互"],
        nextStep: "确认交互", confirmedBy: "自己",
      }),
    }),
    { params: Promise.resolve({ id: project.id }) },
  );
  expect(checkpoint.status).toBe(201);

  const response = await canvasGet(
    new NextRequest(`http://test/api/knowledge/projects/${project.id}/canvas`),
    { params: Promise.resolve({ id: project.id }) },
  );
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.snapshot).toEqual(expect.objectContaining({
    project: expect.objectContaining({ id: project.id }),
    nodes: expect.any(Array), inspector: expect.any(Object),
    timeline: expect.any(Object), attention: expect.any(Array),
  }));
});

it("新增卡片和工作项写入指定项目", async () => {
  const projectResponse = await createProjectPost(new NextRequest("http://test/api/knowledge/projects", {
    method: "POST", body: JSON.stringify({ name: "隔离项目" }),
  }));
  const { project } = await projectResponse.json();
  await addCardPost(new NextRequest("http://test/api/knowledge/add", {
    method: "POST",
    body: JSON.stringify({ content: "指定项目材料", source: "manual", projectId: project.id }),
  }));
  await addWorkItemPost(new NextRequest("http://test/api/knowledge/work-items", {
    method: "POST",
    body: JSON.stringify({ title: "指定项目工作", nextStep: "继续", projectId: project.id }),
  }));
  expect(listCards({ projectId: project.id }).map((card) => card.content))
    .toEqual(["指定项目材料"]);
  expect(listActions({ projectId: project.id }).map((item) => item.title))
    .toEqual(["指定项目工作"]);
});

it("搜索和离线拆解只读取或写入指定项目", async () => {
  const projectResponse = await createProjectPost(new NextRequest("http://test/api/knowledge/projects", {
    method: "POST", body: JSON.stringify({ name: "搜索隔离项目" }),
  }));
  const { project } = await projectResponse.json();
  await addCardPost(new NextRequest("http://test/api/knowledge/add", {
    method: "POST",
    body: JSON.stringify({ content: "项目专属关键词 北斗七号", projectId: project.id }),
  }));
  const hits = searchKnowledge("北斗七号", { projectId: project.id });
  expect(hits.every((card) => card.projectId === project.id)).toBe(true);

  const dissected = invokeKnowledgeMcpTool("dissect_task", {
    goal: "拆解隔离任务", projectId: project.id,
  });
  expect(dissected.ok).toBe(true);
  expect(listActions({ projectId: project.id }).length).toBeGreaterThan(0);
  expect(listActions({ projectId: DEFAULT_PROJECT_ID })
    .some((item) => item.description.includes("拆解隔离任务"))).toBe(false);
});
```

- [ ] **步骤 2：运行接口测试，确认路由不存在**

运行：`npm run test:unit -- tests/unit/project-api.test.ts`

预期：失败，错误为无法找到 `app/api/knowledge/projects/route`。

- [ ] **步骤 3：实现 route handler 和 projectId 传递**

- `GET /projects` 返回 `{ projects }`；`POST` 校验非空 name 后返回 `{ project }` 和 201。
- canvas route 解析 `focus=kind:id`；非法 kind、对象不存在或跨项目返回 400/404，不回退到其他项目。
- checkpoints route 校验 goal、nextStep、confirmedBy，保存后返回 201。
- add、minutes、dissect、work-items 接口从 body 读取 `projectId`，为空时使用默认项目；LLM 和离线分支必须传同一 projectId。
- `KnowledgeSearchFilters` 增加 `projectId`；`searchKnowledge` 必须先按项目过滤，再评分和软回退，软回退也不能返回其他项目。
- search GET/POST、查询记录和 MCP `search_knowledge` 都传递 projectId；MCP `add_knowledge`、`dissect_task`、`generate_action_suggestions` 的 schema 和实现也接受 projectId。
- `offlineDissect` 和 `offlineSuggestions` 必须调用带 projectId 的 `addAction/listActions/listCards`；`dissect` route 的模型成功和离线分支写入同一项目。

- [ ] **步骤 4：运行接口测试、单元测试和类型构建**

运行：`npm run test:unit -- tests/unit/project-api.test.ts shared/knowledge/search.test.ts shared/knowledge/mcp-tools.test.ts`

预期：接口测试全部通过。

运行：`npm run test:unit && npm run build`

预期：单元测试和生产构建通过。

- [ ] **步骤 5：提交**

```bash
git add app/api/knowledge/projects app/api/knowledge/add/route.ts app/api/knowledge/minutes/route.ts app/api/knowledge/dissect/route.ts app/api/knowledge/search/route.ts app/api/knowledge/work-items/route.ts shared/types/knowledge.ts shared/knowledge/search.ts shared/knowledge/mcp-tools.ts shared/knowledge/search.test.ts shared/knowledge/mcp-tools.test.ts tests/unit/project-api.test.ts
git commit -m "feat: expose project canvas APIs"
```

### 任务 5：实现一个真实、受控、可回看的 Agent 动作

**文件：**

- 新建：`shared/knowledge/project-review-agent.ts`
- 新建测试：`shared/knowledge/project-review-agent.test.ts`
- 新建：`app/api/knowledge/work-items/[id]/agent-run/route.ts`
- 修改测试：`tests/unit/project-api.test.ts`
- 修改：`playwright.config.ts`

- [ ] **步骤 1：写 Agent 结果和失败写回测试**

```ts
// shared/knowledge/project-review-agent.test.ts
import { expect, it } from "vitest";
import { reviewWorkItem } from "./project-review-agent";
import type { ActionItem, KnowledgeCard, WorkEvent } from "@/shared/types/knowledge";

const item: ActionItem = {
  id: "item1", projectId: "p1", title: "复核画布", description: "复核画布规格",
  assignee: "自己", deadline: "2026-07-16", status: "doing",
  verificationCriteria: "结论可回到依据", cardId: "card1", evidenceIds: ["card1"],
  nextStep: "检查交互", createdAt: "2026-07-15T08:00:00.000Z",
  updatedAt: "2026-07-15T09:00:00.000Z",
};
const evidence: KnowledgeCard[] = [{
  id: "card1", projectId: "p1", title: "规格", content: "四个状态先确认",
  source: "doc", tags: [], links: [], timestamp: "2026-07-15T08:30:00.000Z",
}];
const events: WorkEvent[] = [{
  id: "event1", workItemId: "item1", type: "decision", actor: "自己",
  body: "先确认界面", createdAt: "2026-07-15T08:40:00.000Z",
}];
const fixture = { item, evidence, events };

it("确定性模式引用真实依据并返回四段结果", async () => {
  const result = await reviewWorkItem(fixture, { mode: "deterministic" });
  expect(result.judgment).not.toBe("");
  expect(result.gaps).toEqual(expect.any(Array));
  expect(result.nextStep).not.toBe("");
  expect(result.evidenceIds.every((id) => fixture.evidence.some((card) => card.id === id)))
    .toBe(true);
});

// tests/unit/project-api.test.ts 追加以下 imports：
import { POST as agentRunPost } from "@/app/api/knowledge/work-items/[id]/agent-run/route";
import { getWorkItemDetail } from "@/shared/knowledge/repository";

it("Agent 接口写入开始、结果和待确认状态", async () => {
  process.env.AGENT_RUN_MODE = "deterministic";
  const response = await agentRunPost(
    new NextRequest("http://test/api/knowledge/work-items/ka-seed-1/agent-run", {
      method: "POST", body: JSON.stringify({ actor: "自己" }),
    }),
    { params: Promise.resolve({ id: "ka-seed-1" }) },
  );
  expect(response.status).toBe(200);
  const detail = getWorkItemDetail("ka-seed-1")!;
  expect(detail.item.status).toBe("confirmed");
  const resultEvent = detail.events.find((event) =>
    event.type === "result" && event.actor === "agent:project-reviewer");
  expect(resultEvent?.meta?.review).toEqual(expect.objectContaining({
    judgment: expect.any(String), gaps: expect.any(Array),
    nextStep: expect.any(String), evidenceIds: expect.any(Array),
    mode: "deterministic",
  }));
});

it("Agent 失败时写阻塞，不写成功结果", async () => {
  process.env.AGENT_RUN_MODE = "model";
  process.env.LLM_BASE_URL = "http://127.0.0.1:1";
  const response = await agentRunPost(
    new NextRequest("http://test/api/knowledge/work-items/ka-seed-1/agent-run", {
      method: "POST", body: JSON.stringify({ actor: "自己" }),
    }),
    { params: Promise.resolve({ id: "ka-seed-1" }) },
  );
  expect(response.status).toBe(502);
  const detail = getWorkItemDetail("ka-seed-1")!;
  expect(detail.item.status).toBe("blocked");
  expect(detail.events.some((event) => event.type === "block")).toBe(true);
  expect(detail.events.some((event) => event.type === "result")).toBe(false);
});
```

- [ ] **步骤 2：运行测试，确认模块和路由缺失**

运行：`npm run test:unit -- shared/knowledge/project-review-agent.test.ts tests/unit/project-api.test.ts`

预期：失败，错误为找不到 Agent 模块或 agent-run route。

- [ ] **步骤 3：实现 Agent 服务和事件写回**

导出：

```ts
export type ProjectReviewResult = {
  judgment: string;
  gaps: string[];
  nextStep: string;
  evidenceIds: string[];
  mode: "model" | "deterministic";
};

export async function reviewWorkItem(
  input: { item: ActionItem; evidence: KnowledgeCard[]; events: WorkEvent[] },
  options?: { mode?: "model" | "deterministic" },
): Promise<ProjectReviewResult>;
```

确定性模式只从现有字段生成，不虚构依据。模型模式复用 `shared/llm/adapter.ts`，提示词要求 JSON 四字段并在解析后过滤不存在的 evidenceIds。

成功结果的持久化格式固定为：

```ts
addWorkEvent(item.id, {
  type: "result",
  actor: "agent:project-reviewer",
  body: `当前判断：${review.judgment}\n建议下一步：${review.nextStep}`,
  meta: {
    review: {
      judgment: review.judgment,
      gaps: review.gaps,
      nextStep: review.nextStep,
      evidenceIds: review.evidenceIds,
      mode: review.mode,
    },
  },
});
```

`CanvasTimelineEvent.review` 只从这份 `meta.review` 读取；字段缺失时按普通 result 显示 body，不猜测结构。

route 顺序固定：

1. 校验工作项、下一步和依据。
2. 把负责人改为“Agent 项目复核”，状态改为 doing，写 assign/status 事件。
3. 调用 Agent。
4. 成功写 result，actor 为 `agent:project-reviewer`，状态改为 confirmed。
5. 失败写 block，保留错误说明，不写完成事件。

在 `playwright.config.ts` 的 webServer command 中为 build 和 start 都设置 `AGENT_RUN_MODE=deterministic`，浏览器测试不访问真实模型。因为所有浏览器测试共享一个 JSON 目录，同时把 `fullyParallel` 设为 `false`、`workers` 设为 `1`；未实现每个 worker 独立存储前，不并行写同一组文件。

- [ ] **步骤 4：运行 Agent、接口和全部单元测试**

运行：`npm run test:unit -- shared/knowledge/project-review-agent.test.ts tests/unit/project-api.test.ts`

预期：Agent 和接口测试全部通过。

运行：`npm run test:unit`

预期：全部单元测试通过。

- [ ] **步骤 5：提交**

```bash
git add shared/knowledge/project-review-agent.ts shared/knowledge/project-review-agent.test.ts 'app/api/knowledge/work-items/[id]/agent-run/route.ts' tests/unit/project-api.test.ts playwright.config.ts
git commit -m "feat: add evidence-backed project review agent"
```

### 任务 6：按确认图片实现四区界面外壳

**文件：**

- 新建：`app/track/knowledge/components/project-canvas/ProjectCanvasShell.tsx`
- 新建：`app/track/knowledge/components/project-canvas/ProjectSidebar.tsx`
- 新建：`app/track/knowledge/components/project-canvas/ProjectGraph.tsx`
- 新建：`app/track/knowledge/components/project-canvas/CanvasInspector.tsx`
- 新建：`app/track/knowledge/components/project-canvas/CanvasTimeline.tsx`
- 新建：`app/track/knowledge/components/project-canvas/WorkspaceComposer.tsx`
- 新建：`app/track/knowledge/hooks/useKnowledgeWorkspace.ts`
- 修改：`app/track/knowledge/page.tsx`
- 修改：`app/globals.css`
- 新建测试：`tests/e2e/project-canvas.spec.ts`

- [ ] **步骤 1：写进入项目的浏览器测试**

```ts
test("进入项目时看到四区结构、恢复说明和有依据的当前重点", async ({ page }) => {
  await page.goto("/track/knowledge");
  await expect(page.getByTestId("project-sidebar")).toBeVisible();
  await expect(page.getByTestId("project-canvas")).toBeVisible();
  await expect(page.getByTestId("canvas-inspector")).toContainText(/上次|根据现有事件/);
  await expect(page.getByTestId("canvas-timeline")).toBeVisible();
  await expect(page.getByTestId("canvas-center")).toContainText("fc-opc-ibot");
  expect(await page.getByTestId("attention-node").count()).toBeLessThanOrEqual(3);
  await expect(page.getByTestId("attention-node").first()).toHaveAttribute("data-evidence", /.+/);
});
```

- [ ] **步骤 2：运行该测试，确认旧页面不满足四区结构**

运行：`npm run test:e2e -- tests/e2e/project-canvas.spec.ts -g "进入项目"`

预期：失败，缺少 `project-sidebar` 或 `project-canvas`。

- [ ] **步骤 3：实现外壳和响应数据读取**

- `page.tsx` 从项目接口取默认项目，从 canvas 接口取 snapshot，只保存 projectId、focus、snapshot、loading 和 error。
- 把当前 `page.tsx:64-668` 的检索、写入、工作项、足迹和关系状态及 handler 移入 `useKnowledgeWorkspace(projectId)`；所有请求继续调用现有接口，并带上当前 projectId。hook 的返回值固定分成 `search`、`capture`、`workItems`、`relations`、`footprint` 和 `refresh` 六组；原组件只从对应分组取 props。
- `ProjectCanvasShell` 使用 CSS Grid 固定左侧、中央、右侧和底部；1280×800 仍可操作。
- `ProjectSidebar` 从项目接口显示真实项目，提供创建项目和切换项目；参考项目单独放在“参考来源”，不能混成用户项目。
- `ProjectGraph` 用 SVG 线和绝对定位按钮渲染 snapshot.nodes，不增加图形依赖；初次渲染项目为中心。
- `CanvasInspector` 在 project focus 时显示 checkpoint、changesSinceCheckpoint、planAssessment 和 attention。
- `CanvasTimeline` 显示“现在”和“历史”。
- `WorkspaceComposer` 由顶部搜索和“新建”按钮打开，包含四个标签：检索（`KnowledgeSearch`、`CardList`、`WebSearchPanel`）、写入（`CapturePanel`）、工作项（`WorkItemsPanel`）、关系与足迹（`CardRelationsPanel`、`KnowledgeFootprintMap`）。它只调用 `useKnowledgeWorkspace` 返回的状态和 handler，不重新发明请求逻辑。
- `app/globals.css` 增加 `.project-canvas-app` 局部浅色变量；不改变首页等其他页面。颜色只使用蓝、橙、绿、红表达状态，无紫色渐变和无意义发光。

- [ ] **步骤 4：运行进入项目测试和 1280 视口检查**

运行：`npm run test:e2e -- tests/e2e/project-canvas.spec.ts -g "进入项目"`

预期：测试通过。

在同一测试增加 `page.setViewportSize({ width: 1280, height: 800 })` 后再次断言四区可见，预期通过且没有横向滚动条。

- [ ] **步骤 5：提交**

```bash
git add app/track/knowledge/page.tsx app/track/knowledge/components/project-canvas app/track/knowledge/hooks/useKnowledgeWorkspace.ts app/globals.css tests/e2e/project-canvas.spec.ts
git commit -m "feat: build the project canvas workspace"
```

### 任务 7：实现重新居中、URL 恢复和状态确认

**文件：**

- 修改：`app/track/knowledge/page.tsx`
- 修改：`app/track/knowledge/components/project-canvas/ProjectGraph.tsx`
- 修改：`app/track/knowledge/components/project-canvas/CanvasInspector.tsx`
- 修改：`tests/e2e/project-canvas.spec.ts`

- [ ] **步骤 1：写聚焦和确认状态测试**

```ts
test("点击对象后只展开一层并同步中央、右侧、时间线和 URL", async ({ page }) => {
  await page.goto("/track/knowledge");
  await page.getByRole("button", { name: /跑通检索并展示带来源的卡片/ }).click();
  await expect(page).toHaveURL(/focus=work_item%3Aka-seed-1/);
  await expect(page.getByTestId("canvas-center")).toContainText("跑通检索");
  await expect(page.getByTestId("canvas-inspector")).toContainText(/下一步|依据/);
  await expect(page.getByTestId("canvas-timeline")).toContainText(/状态|创建/);
  await expect(page.locator('[data-node-depth="2"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("canvas-center")).toContainText("跑通检索");
});

test("用户确认项目状态后刷新仍存在", async ({ page }) => {
  await page.goto("/track/knowledge");
  await page.getByRole("button", { name: "确认当前状态" }).click();
  await page.getByLabel("当前目标").fill("完成四个界面状态");
  await page.getByLabel("原下一步").fill("确认图片后开始开发");
  await page.getByRole("button", { name: "保存确认" }).click();
  await page.reload();
  await expect(page.getByTestId("canvas-inspector")).toContainText("完成四个界面状态");
  await expect(page.getByTestId("canvas-inspector")).toContainText("用户已确认");
});

test("可以从重点追到依据，项目切换后对象不串项目", async ({ page, request }) => {
  await page.goto("/track/knowledge");
  await page.getByTestId("attention-node").first().click();
  await page.getByRole("button", { name: /查看依据/ }).first().click();
  await expect(page).toHaveURL(/focus=(card|event)%3A/);
  await expect(page.getByTestId("canvas-inspector")).toContainText(/来源|事件/);

  const created = await request.post("/api/knowledge/projects", {
    data: { name: "空白隔离项目", summary: "项目切换检查" },
  });
  expect(created.ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "空白隔离项目" }).click();
  await expect(page.getByTestId("canvas-center")).toContainText("空白隔离项目");
  await expect(page.getByText("跑通检索并展示带来源的卡片")).toHaveCount(0);
});
```

- [ ] **步骤 2：运行两个测试，确认交互尚未实现**

运行：`npm run test:e2e -- tests/e2e/project-canvas.spec.ts -g "点击对象|用户确认|可以从重点"`

预期：失败，URL 不含 focus 或缺少“确认当前状态”。

- [ ] **步骤 3：实现 focus 与状态确认**

- 节点点击调用 `router.push` 更新 `project` 和 `focus=kind:id`，再请求新的 snapshot。
- 点击重点后先聚焦 `AttentionItem.target`。Inspector 的“查看依据”按顺序使用 `AttentionItem.evidenceEventIds[0]`，更新 focus 为 `event:<id>`；若计划判断依据是卡片，则使用 `PlanAssessment.evidence[0]`。没有依据时不显示按钮。
- 浏览器返回、前进和刷新从 URL 恢复 focus。
- 加载新 focus 时保留旧画布并显示局部 loading；失败时恢复上一个有效 focus。
- ProjectGraph 只渲染响应中的 depth 0/1 节点；焦点用轮廓和 `aria-current` 表示，不覆盖节点本来的状态色。
- Inspector 的“确认当前状态”提交 checkpoints 接口；保存成功后重新读取 snapshot。
- ProjectSidebar 创建项目后重新读取项目列表并切到新项目；切换项目时把 focus 重置为该项目自身，不能保留旧项目对象 ID。
- 所有节点是可聚焦的 button，Enter/Space 触发重新居中；动效在 `prefers-reduced-motion` 下关闭。

- [ ] **步骤 4：运行聚焦、确认状态和进入项目测试**

运行：`npm run test:e2e -- tests/e2e/project-canvas.spec.ts`

预期：当前文件所有测试通过。

- [ ] **步骤 5：提交**

```bash
git add app/track/knowledge/page.tsx app/track/knowledge/components/project-canvas/ProjectGraph.tsx app/track/knowledge/components/project-canvas/CanvasInspector.tsx tests/e2e/project-canvas.spec.ts
git commit -m "feat: navigate and confirm project state on the canvas"
```

### 任务 8：实现作出决定、交给 Agent 和执行写回

**文件：**

- 修改：`app/track/knowledge/components/project-canvas/CanvasInspector.tsx`
- 修改：`app/track/knowledge/components/project-canvas/CanvasTimeline.tsx`
- 修改：`app/track/knowledge/page.tsx`
- 修改：`tests/e2e/project-canvas.spec.ts`

- [ ] **步骤 1：写决定与 Agent 执行测试**

```ts
test("修改下一步并交给 Agent 后，结果写回时间线并重新计算重点", async ({ page }) => {
  await page.goto("/track/knowledge?focus=work_item%3Aka-seed-1");
  await page.getByRole("button", { name: "调整下一步" }).click();
  await page.getByLabel("新的下一步").fill("核对当前依据后给出实现建议");
  await page.getByRole("button", { name: "保存下一步" }).click();
  await expect(page.getByTestId("canvas-timeline")).toContainText("核对当前依据");

  const response = page.waitForResponse((value) =>
    value.url().includes("/agent-run") && value.request().method() === "POST" && value.ok(),
  );
  await page.getByRole("button", { name: "交给 Agent" }).click();
  await response;
  await expect(page.getByTestId("canvas-timeline")).toContainText("Agent 项目复核");
  await expect(page.getByTestId("canvas-timeline")).toContainText(/当前判断|建议下一步/);
  await expect(page.getByTestId("canvas-timeline")).toContainText("确定性模式");
  await expect(page.getByTestId("canvas-inspector")).toContainText("待确认");
  await expect(page.getByTestId("attention-node").first()).toContainText(/待确认|Agent 结果/);
  await page.reload();
  await expect(page.getByTestId("canvas-timeline")).toContainText(/当前判断|建议下一步/);
});

test("Agent 请求失败时显示失败原因和重新尝试", async ({ page }) => {
  await page.route("**/api/knowledge/work-items/*/agent-run", async (route) => {
    await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "模型服务不可用" }) });
  });
  await page.goto("/track/knowledge?focus=work_item%3Aka-seed-1");
  await page.getByRole("button", { name: "交给 Agent" }).click();
  await expect(page.getByRole("alert")).toContainText("模型服务不可用");
  await expect(page.getByRole("button", { name: "重新尝试" })).toBeVisible();
  await expect(page.getByText("已完成")).toHaveCount(0);
});
```

- [ ] **步骤 2：运行测试，确认动作尚未连接**

运行：`npm run test:e2e -- tests/e2e/project-canvas.spec.ts -g "修改下一步|Agent 请求失败"`

预期：失败，缺少“调整下一步”或“交给 Agent”。

- [ ] **步骤 3：实现决定和执行状态**

- Inspector 只有 work_item focus 才显示“调整下一步”和“交给 Agent”。
- 调整下一步复用现有 work-item PATCH 接口，成功后刷新 snapshot。
- 交给 Agent 前显示将使用的下一步、验收标准和依据数量；没有下一步或依据时禁用，并显示具体缺失项。
- Agent 调用期间右侧显示正在执行；返回后刷新 snapshot，不在客户端伪造事件。
- Timeline 的“现在”显示 doing/blocked/confirmed，“历史”显示已完成和旧结果；result 展示判断、缺口、下一步和依据入口。
- Agent 失败时显示阻塞原因和重新尝试，不显示完成或成功颜色。

- [ ] **步骤 4：运行四个状态测试**

运行：`npm run test:e2e -- tests/e2e/project-canvas.spec.ts`

预期：进入、聚焦、决定和执行写回全部通过。

- [ ] **步骤 5：提交**

```bash
git add app/track/knowledge/components/project-canvas/CanvasInspector.tsx app/track/knowledge/components/project-canvas/CanvasTimeline.tsx app/track/knowledge/page.tsx tests/e2e/project-canvas.spec.ts
git commit -m "feat: write decisions and agent results back to the canvas"
```

### 任务 9：保住旧能力并完成质量检查

**文件：**

- 修改：`tests/e2e/app.spec.ts`
- 修改：`tests/e2e/project-canvas.spec.ts`
- 修改：`WORKFLOW_STATUS.md`
- 修改：`.ship/tasks/knowledge-mainline-20260714-174246/control/lifecycle-checklist.yaml`
- 新建：`.ship/tasks/knowledge-mainline-20260714-174246/delivery/review-report.md`
- 新建：`.ship/tasks/knowledge-mainline-20260714-174246/delivery/qa-report.md`
- 新建：`.ship/tasks/knowledge-mainline-20260714-174246/delivery/demo-180s.md`

- [ ] **步骤 1：先把旧测试改成新入口下的同一业务断言**

保留原来的结果要求，只改操作入口：顶部搜索打开 `WorkspaceComposer` 后仍能搜“检索 来源”；每条结果仍显示 source；新建面板仍能创建工作项、写评论、推进状态；关系详情仍显示关系词和来源句。禁止删除断言来换取通过。

在 `project-canvas.spec.ts` 增加：

```ts
test("键盘、减少动态效果和两个桌面尺寸可完成主要操作", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/track/knowledge");
    await page.getByTestId("project-canvas").getByRole("button").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("canvas-center")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
```

- [ ] **步骤 2：运行所有浏览器测试并修复真实回归**

运行：`npm run test:e2e`

预期：`tests/e2e/app.spec.ts` 和 `tests/e2e/project-canvas.spec.ts` 全部通过。若旧能力不可达，只在以下对应位置修复，不弱化断言：检索入口改 `WorkspaceComposer.tsx`、检索行为改 `useKnowledgeWorkspace.ts` 或 `KnowledgeSearch.tsx`、写入改 `CapturePanel.tsx`、工作项改 `WorkItemsPanel.tsx`、关系改 `CardRelationsPanel.tsx`、页面协调改 `page.tsx`。

- [ ] **步骤 3：运行全部检查**

依次运行：

```bash
npm run test:unit
npm run test:e2e
npm run lint
npm run build
git diff --check
```

预期：所有命令退出码为 0。若 lint 存在本次修改前已经存在的问题，记录具体文件、行号和基线命令输出；本次新增或修改文件不得有 lint 错误。

- [ ] **步骤 4：运行真实模型检查**

在本地模型服务可用时运行一次非确定性 Agent：

```bash
AGENT_RUN_MODE=model npm run dev
```

在浏览器中打开一个有下一步和依据的工作项，点击“交给 Agent”。预期：时间线出现 `agent:project-reviewer` 的 result，引用的依据 ID 都存在；失败时出现 block，而不是成功状态。将结果和模型不可用情况写入 `WORKFLOW_STATUS.md`。

- [ ] **步骤 5：更新项目管理和流程状态**

在 `WORKFLOW_STATUS.md` 记录每个阶段的完成日期、提交、测试结果、真实模型结果、剩余风险和演示入口。只有四个连续状态、刷新持久化、回归、lint 和 build 都通过后，才把“检查与演示”标为完成。

写三份证据：

- `review-report.md`：检查范围、发现项、修复提交、剩余 P0/P1/P2；存在 P0/P1 时不能完成。
- `qa-report.md`：1440×900、1280×800、键盘、减少动态效果、刷新持久化、Agent 成功/失败、测试命令和结果。
- `demo-180s.md`：按秒写“进入项目 → 聚焦重点 → 查看依据 → 修改下一步 → 交给 Agent → 查看写回”，总计不超过 180 秒。

在 `lifecycle-checklist.yaml` 中把现有 `e2e_knowledge` 更新为真实结果，并追加：

```yaml
  - id: project_canvas_review
    status: required
    state: done
    note: "delivery/review-report.md; no open P0/P1"
  - id: project_canvas_qa
    status: required
    state: done
    note: "delivery/qa-report.md; desktop, keyboard, persistence, agent success/failure verified"
```

只有对应报告已写且检查通过时才能使用 `done`；否则 state 保持 `todo` 或 `partial` 并写原因。

- [ ] **步骤 6：提交**

```bash
git add tests/e2e/app.spec.ts tests/e2e/project-canvas.spec.ts WORKFLOW_STATUS.md .ship/tasks/knowledge-mainline-20260714-174246/control/lifecycle-checklist.yaml .ship/tasks/knowledge-mainline-20260714-174246/delivery/review-report.md .ship/tasks/knowledge-mainline-20260714-174246/delivery/qa-report.md .ship/tasks/knowledge-mainline-20260714-174246/delivery/demo-180s.md
git commit -m "test: verify the project canvas end to end"
```

## 实现完成的检查标准

- `spec.md` 第 11 节的每个验收项都有对应测试或明确手测记录。
- 当前重点和原计划判断都能回到真实依据。
- 项目、右侧、时间线不会因不同请求显示互相矛盾的状态。
- 画布只展开一层，没有自由白板、完整 Agent runtime 或假活动。
- 现有检索、来源、工作项、事件和关系仍可使用。
- 四个连续状态可以在 180 秒内稳定演示。
