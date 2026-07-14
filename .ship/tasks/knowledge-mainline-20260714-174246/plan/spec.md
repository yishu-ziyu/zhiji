# plan/spec.md · 工作项与共享情境

**Canonical full spec:** `docs/SPEC-work-item-shared-situation.md`
**Date:** 2026-07-14

> **2026-07-15 revision:** The work-item specification below is implemented foundation, not the current product surface. The current design contract is the “项目画布” revision appended after it. Preserve the work-item behavior while rebuilding the user experience around projects, focus, evidence, attention, and execution.

## Goal

效率 = 沟通一致 + 沟通可见。
产品主对象从「仅卡+薄待办」推进为 **工作项**（状态、负责人、下一步、时间线），依据卡挂在工作项上。
检索与来源能力不回退。

## Acceptance (P0 must)

1. 可创建工作项；详情顶栏：状态、负责人、下一步
2. 进入 doing 时无负责人或无下一步 → 被拒绝
3. 评论与状态变更进入时间线；重启不丢
4. 可标阻塞并见原因
5. 工作项可关联带来源的依据卡
6. 现有检索「检索 来源」仍可用
7. 可筛选「我的」未完成项并见下一步
8. API 可 POST agent result 事件并持久化

## Out of scope

微信同步、客户改约定、Multica 全套 runtime、向量库卖点、多租户、P0 的 Goal 看板复杂态。

## Tests

- Unit: work item validation + event write on patch + repository
- API: create / bad doing / block / link evidence / result event
- E2E: 建项 → 负责人+下一步 → doing → 评论 → 挂卡 → 刷新

## Done when

Full spec §10 A1–A8 checked; units + e2e green; CONTEXT wording updated without banned jargon.

---

# 2026-07-15 修订 · 持续生长的项目画布

**调查基线：** `a34bc9a352cbf86a78af9c598f764e3f47c3a730`
**视觉基准：** `docs/design/project-canvas-selected.png`
**状态：** 已与独立调查稿对照并合并

## 1. 要解决的问题

一个人同时推进多个项目、阅读多份材料、让多个 Agent 工作。重新进入项目时，他不知道项目现在处于什么状态、哪些变化影响了原计划、现在最该关注什么，因此可能在信息不完整时启动错误工作。

产品必须减少四种劳动：

1. 回忆上次做到哪里。
2. 查找离开后发生了什么。
3. 判断哪些变化会影响当前决定和下一步。
4. 把决定交给人或 Agent 后继续追踪执行结果。

## 2. 已确认的产品行为

1. 用户打开项目后，中央显示项目当前状态；Agent 主动突出最多三个值得关注的对象，并逐条说明原因。
2. 用户点击任意对象后，该对象成为新的中心；界面只展开一层直接相关的材料、关系、工作项和执行记录。
3. 右侧始终解释当前中心：它是什么、为什么现在重要、依据是什么、影响什么、可以采取什么行动。
4. 用户可以继续查看依据、修改决定、自己执行或交给 Agent。
5. 状态变化、决定、Agent 开始执行、阻塞、结果和验证都写入时间线，并重新计算当前重点。
6. 搜索用于快速选择关注对象；不是传统的“问一句、返回一页结果”。

四个连续界面状态：

| 状态 | 用户看见什么 | 用户动作 | 系统变化 |
|---|---|---|---|
| 进入项目 | 项目居中；Agent 突出三个重点并说明原因 | 选择一个重点或其他节点 | 当前中心改变 |
| 聚焦对象 | 新中心与一层直接关系；无关对象淡出或收起 | 查看某条依据或继续选择相邻节点 | 只请求新中心的一层数据 |
| 作出决定 | 右侧显示依据、影响、建议和动作 | 自己处理、调整下一步或交给 Agent | 写入决定、负责人、下一步或执行请求 |
| 执行写回 | 时间线显示开始、过程、阻塞、结果和验证 | 查看结果或继续处理新重点 | 写入事件并重新计算重点 |

## 3. 当前代码事实

| 事实 | 证据 | 影响 |
|---|---|---|
| 现有页面把检索、足迹、卡片、关系、写入和工作项都集中在一个 831 行客户端页面 | `app/track/knowledge/page.tsx:59-385,416-668,670-831` | 不能只换 CSS；需要按参考图的四个稳定区域重新组织页面，同时复用现有操作函数 |
| 知识卡、工作项、事件和卡片关系已经存在并持久化 | `shared/types/knowledge.ts:5-71,159-181,234-289`；`shared/knowledge/repository.ts:92-207,494-854,1026-1180` | 不另建平行的数据系统；项目画布从这些对象生成 |
| 现有关系只连接卡片；工作项通过 `evidenceIds` 连卡片；事件通过 `workItemId` 连工作项 | `shared/types/knowledge.ts:38-44,63-70,249-265` | 画布需要把三种现有连接投影为统一的显示关系，但不修改其原始含义 |
| 现有邻居查询已经支持中心卡的一层关系 | `shared/knowledge/relations.ts:183-212`；`app/api/knowledge/cards/[id]/neighbors/route.ts:11-26` | 卡片重新居中可直接复用一层邻居逻辑 |
| 现有知识足迹是按来源排列的固定五列，不是可重新居中的画布 | `shared/knowledge/footprint.ts:20-59`；`app/track/knowledge/components/KnowledgeFootprintMap.tsx:114-162` | 保留触达深度语义，替换它的主要呈现方式 |
| 现有建议只按未完成工作项顺序生成，原因仅复述状态和验收标准 | `shared/knowledge/mcp-tools.ts:132-168` | 不能直接称为 Agent 当前重点；需要独立、可测试的排序与理由 |
| 现有类型没有项目，也没有任何 `projectId` | `shared/types/knowledge.ts:5-47` | 多项目问题无法成立；必须增加项目及旧数据归属迁移 |
| Agent 已能通过事件接口写回结果，但没有真正的“执行一次并写回”动作 | `app/api/knowledge/work-items/[id]/events/route.ts:21-42`；`shared/knowledge/repository.ts:736-792` | 保留事件接口；增加受控的 Agent 执行动作，不伪造通用数字员工 |
| 已有 Anthropic 兼容 LLM 调用、重试与离线兜底模式 | `shared/llm/adapter.ts:3-17,36-112`；`app/api/knowledge/minutes/route.ts:49-123` | Agent 分析可复用同一调用方式；自动测试使用确定性模式 |
| 当前浏览器测试只覆盖检索、工作项推进和卡片关系 | `tests/e2e/app.spec.ts:14-116` | 新界面必须补四个连续状态，旧能力还要有回归检查 |

## 4. 数据对象

### 4.1 项目

新增 `Project`：

```ts
type Project = {
  id: string;
  name: string;
  summary: string;
  status: "active" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
};
```

- `KnowledgeCard` 和 `ActionItem` 增加 `projectId`。
- 旧 JSON 没有 `projectId` 时，读取时归入默认项目 `project-fc-opc-ibot`。
- `WorkEvent` 继续通过 `workItemId` 得到项目，不重复保存 `projectId`。
- 卡片关系通过两端卡片得到项目；首版不在画布展示跨项目关系。

### 4.2 画布引用

画布不复制原始对象，只保存当前关注对象的引用：

```ts
type CanvasNodeKind = "project" | "card" | "work_item" | "event";

type CanvasNodeRef = {
  kind: CanvasNodeKind;
  id: string;
};
```

`event.actor` 以 `agent:` 开头时，界面把它显示为 Agent 执行记录；不额外复制一份 AgentRun 数据。

### 4.3 用户确认的工作状态

仅靠最新事件无法知道用户离开时认定的目标和原下一步。这个状态属于项目，不属于任意一个工作项，因此用户明确确认时，系统保存一条项目状态记录：

```ts
type ProjectCheckpoint = {
  id: string;
  projectId: string;
  goal: string;
  completed: string[];
  unresolved: string[];
  nextStep: string;
  confirmedBy: string;
  createdAt: string;
};
```

第一阶段通过明确按钮触发确认，不猜测用户何时离开。记录写入独立的 `project-checkpoints.json`；不能塞进 `WorkEvent`，因为 `WorkEvent` 必须属于一个工作项。没有用户确认记录时，恢复说明标为“根据现有事件整理”，不能表现成确定事实。

### 4.4 原计划判断

```ts
type PlanAssessment = {
  status: "continue" | "adjust" | "insufficient";
  reason: string;
  evidence: CanvasNodeRef[];
};
```

- `continue`：没有已知变化改变原下一步的前提，或用户重新确认继续。
- `adjust`：出现明确阻塞、决定变更、冲突证据或失败结果。
- `insufficient`：出现新材料或结果，但现有信息无法判断影响。

每个判断必须引用事件或卡片。没有引用时只能返回 `insufficient`。

### 4.5 当前重点

```ts
type AttentionReasonCode =
  | "blocked"
  | "awaiting_confirmation"
  | "overdue"
  | "recent_change"
  | "agent_result"
  | "stale";

type AttentionItem = {
  target: CanvasNodeRef;
  reasonCode: AttentionReasonCode;
  reason: string;
  evidenceEventIds: string[];
  score: number;
};
```

每条重点必须指向真实对象；凡是由事件触发，必须带事件 ID。LLM 可以把理由改写得更易读，但不能创造没有数据支持的重点。

### 4.6 一次画布读取

```ts
type CanvasNode = {
  ref: CanvasNodeRef;
  label: string;
  subtitle?: string;
  state: "neutral" | "active" | "changed" | "confirmed" | "blocked";
  depth: 0 | 1;
  evidence: CanvasNodeRef[];
};

type CanvasEdge = {
  id: string;
  source: CanvasNodeRef;
  target: CanvasNodeRef;
  label: string;
  evidenceSentence?: string;
  status: "confirmed" | "suggested";
};

type CanvasInspector = {
  title: string;
  summary: string;
  whyImportant: string;
  evidence: CanvasNodeRef[];
  impacts: CanvasNodeRef[];
  availableActions: Array<"open_evidence" | "update_next_step" | "confirm_checkpoint" | "run_agent">;
};

type CanvasTimelineEvent = {
  id: string;
  ref: CanvasNodeRef;
  workItemId: string;
  type: WorkEventType;
  actor: string;
  body: string;
  createdAt: string;
  phase: "now" | "history";
  review?: {
    judgment: string;
    gaps: string[];
    nextStep: string;
    evidenceIds: string[];
    mode: "model" | "deterministic";
  };
};

type CanvasTimeline = {
  now: CanvasTimelineEvent[];
  history: CanvasTimelineEvent[];
};

type ProjectCanvasSnapshot = {
  project: Project;
  focus: CanvasNodeRef;
  checkpoint: ProjectCheckpoint | null;
  checkpointSource: "confirmed" | "inferred";
  changesSinceCheckpoint: CanvasTimelineEvent[];
  planAssessment: PlanAssessment;
  attention: AttentionItem[];
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  inspector: CanvasInspector;
  timeline: CanvasTimeline;
};
```

同一次读取同时驱动中央画布、右侧说明和底部时间线，避免三个区域分别请求后互相矛盾。项目为当前中心时，右侧先显示 checkpoint、离开后变化和原计划判断；聚焦其他对象后再显示该对象的说明、依据、影响和动作。

## 5. Agent 如何选择当前重点

先用确定规则保证可解释，再让模型补充语言，不让模型直接决定事实。

按以下顺序评分，同一工作项只保留分数最高的一条，最后最多返回三条：

1. 阻塞中的工作项。
2. 等待用户确认的工作项。
3. 已过截止日期但未结束的工作项。
4. 最近新增的决定、下一步变化或 Agent 结果。
5. 长时间没有变化的进行中工作项。

每条理由必须说明：发生了什么、为什么现在重要、依据是哪条状态或事件。没有任何异常时，显示最接近执行的未完成工作项；不能用空白或通用建议替代。

当前重点和原计划判断是两件事：前者回答“现在先看什么”，后者回答“原下一步是否仍成立”。不能用一个排序结果代替计划判断。

## 6. 一层展开规则

| 当前中心 | 直接展开 |
|---|---|
| 项目 | 最多三个当前重点、最近活动工作项、最近使用材料 |
| 卡片 | 已确认/建议关系的相邻卡片、引用它的工作项、与它有关的事件 |
| 工作项 | 依据卡、时间线中的关键事件、负责人或 Agent 结果 |
| 事件 | 所属工作项、事件引用的卡片、前后相邻关键事件 |

- 默认只返回一层，不在客户端一次下载整个项目图。
- 折叠对象显示数量，例如“另有 12 项”，用户继续点击才展开。
- 卡片关系保留方向、关系词、来源句和确认状态。
- 画布中的连线是原始对象关系的投影，不成为新的事实来源。

## 7. 四个视觉区域的职责

视觉结构严格参照 `docs/design/project-canvas-reference.png`：

1. **左侧：** 项目选择、收件箱、最近使用和参考来源。四个开源项目只能出现在“参考来源”。
2. **中央：** 当前中心、一层关系、Agent 突出的重点；节点可用键盘选择并重新居中。
3. **右侧：** 当前中心的说明、依据、影响、建议和执行动作；不做独立聊天窗口。
4. **底部：** 当前中心相关的时间线；“现在”显示正在执行、阻塞和等待确认，“历史”显示已经结束的工作和旧结果；决定、阻塞、Agent 失败、结果和验证不能被普通活动汇总隐藏。

颜色只表达业务状态：蓝色为当前选中，橙色为变化或风险，绿色为确认或完成，红色为阻塞。其余使用黑、白、灰。禁用紫色渐变和无语义发光。

## 8. Agent 执行动作

“交给 Agent”不是修改负责人文字，也不是播放假动画。

首个可交付动作限定为：

> Agent 阅读当前工作项、直接依据和最近关键事件，输出“当前判断、发现的冲突或缺口、建议的下一步、引用的依据”，并把结果写回该工作项。

执行要求：

1. 开始时写一条 `assign` 或 `status_change` 事件，actor 为用户。
2. 调用现有 LLM 适配器；输入只包含当前项目和当前中心所需材料。
3. 成功后写一条 `result` 事件，actor 为 `agent:project-reviewer`，并把工作项置为 `confirmed` 等待用户确认。
4. 失败或缺少输入时写阻塞事件；不把失败伪装成完成。
5. 自动测试使用确定性输出；界面明确标出真实模型或确定性模式。

## 9. 接口与实现位置

### 领域逻辑

- 修改 `shared/types/knowledge.ts`：项目、项目归属、画布读取类型。
- 新建 `shared/knowledge/project-canvas.ts`：重点排序、一层关系投影、右侧说明和时间线投影。所有核心判断通过纯函数测试。
- 修改 `shared/knowledge/repository.ts`：项目与项目状态记录持久化、旧数据迁移、按项目过滤、生成画布读取。

不增加只有一个实现的 repository interface；当前 JSON 存储仍是唯一实现。

### 服务端接口

- 新建 `GET/POST /api/knowledge/projects`：列出和创建项目。
- 新建 `GET /api/knowledge/projects/[id]/canvas?focus=<kind>:<id>`：返回一次完整画布读取。
- 新建 `POST /api/knowledge/projects/[id]/checkpoints`：保存用户明确确认的项目状态。
- 新建 `POST /api/knowledge/work-items/[id]/agent-run`：执行受控 Agent 分析并写回。
- 扩展现有新增卡片、会议、拆解和工作项接口，使新内容写入当前项目。

### 界面

- `app/track/knowledge/page.tsx` 只保留页面级状态和请求协调，删除当前所有功能纵向堆叠的布局。
- 增加项目导航、中央画布、右侧说明和底部时间线组件。
- 复用现有搜索、卡片、工作项和关系操作，不复制第二套实现；低频写入操作通过顶部搜索和“新建”入口打开。
- 中央关系使用 SVG 连线和普通按钮节点；首版不增加图数据库、拖拽画布或新的图形依赖。
- 当前中心写入 URL 查询参数，浏览器前进/后退可以恢复关注对象。

## 10. 不做

- 不做自由拖拽和无限缩放的通用白板。
- 不下载并展示整个项目的全部对象。
- 不做完整 Multica Agent runtime、任务队列或多 Agent 编排。
- 不把四个开源项目的源码或视觉资产复制进产品。
- 不把 LLM 生成文字当作没有来源的项目事实。
- 不为了匹配图片而伪造项目、活动数量、Agent 或执行结果。
- 不删除现有检索、卡片、工作项、关系和持久化能力。

## 11. 验收

### 视觉确认

- [x] 四个连续界面状态保持同一视觉基准：进入项目、聚焦对象、作出决定、执行写回。
- [x] 用户确认整体布局、信息层级和主要交互后才开始大规模界面实现。

### 产品行为

- [x] 打开项目后，项目位于中央，Agent 显示不超过三个有依据的当前重点。
- [x] 右侧先回答离开时的目标、离开后变化和原计划判断；没有用户确认记录时明确标为根据事件整理。
- [x] 原计划判断只有继续、调整和信息不足三种，并能点回事件或卡片依据。
- [x] 每条重点说明原因，并能一次点击到触发它的状态、事件或依据。
- [x] 点击项目、卡片、工作项或事件后，它成为新中心，URL 同步改变，只展示一层直接关系。
- [x] 右侧内容和底部时间线始终与当前中心一致。
- [x] 用户能从右侧修改下一步或交给 Agent；动作写入时间线。
- [x] Agent 的开始、结果、失败和阻塞都来自真实事件，刷新后仍存在。
- [x] Agent 结果出现后，当前重点自动重新计算。
- [x] 底部把当前执行与历史结果分开，关键事件不因汇总而消失。
- [x] 项目切换后，材料、工作项和画布不串项目。

### 工程检查

- [x] 用户确认状态、原计划判断、重点排序、一层关系投影、关键事件保留和旧数据迁移有单元测试。
- [x] 浏览器测试覆盖四个连续状态和刷新持久化。
- [x] 现有检索、卡片来源、工作项状态、关系来源句仍有回归测试。
- [x] `npm run test:unit`、`npm run test:e2e`、`npm run lint`、`npm run build` 通过；若仓库已有失败，必须明确区分并记录。
- [x] 1440×900 和 1280×800 可完整操作；键盘可选择节点；减少动态效果设置生效。

## 12. 风险与待验证事项

1. 用户已确认总体视觉和四个连续状态；实现后仍需按真实页面复核信息密度。
2. 现有 JSON repository 超过 1200 行；应只增加必要能力，不在本轮顺带替换数据库或重构全部存储。
3. 真实 Agent 只能先交付一个受控动作；泛化为任意数字员工需要后续独立证据。
4. 项目归属是跨类型修改，必须用自动迁移保护现有数据。
5. 参考图的复杂画布在小屏上不能等比例压缩；首版小屏采用列表和右侧内容顺序排列，不承诺手机上的完整画布操作。
