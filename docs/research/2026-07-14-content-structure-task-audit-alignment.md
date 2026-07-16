# 对齐备忘：内容→结构→任务→可审

**日期：** 2026-07-14
**用途：** 给 Grok / Codex / 其他 Agent 共用。读完应能复述用户兴趣、外部参照、三层模型、与本仓库已有规格的对应关系。
**范围：** 2026-07-14 一轮对话全文要点（兴趣开源项目共性 → 三层效率模型 → Canvasight 例证 → 要求落入本仓库文档）。
**产品仓：** `fc-opc-ibot`（知识工作台 / 效率 Agent）。
**协作规范：** 以 `docs/DEV_COLLAB.md`、`CONTEXT.md` 为准。本文件不另发明术语。

---

## 0. 给后续 Agent 的读法（先读这段）

1. 用户关心的不是「又一个 Notion / Jira」。
2. 用户关心的是信息效率的三段接口：
   - 材料能不能自己连起来（内容 → 结构）
   - 结构能不能接到动作（结构 → 任务）
   - 动作过程能不能被看见（过程 → 可审）
3. 本仓库**已经在按这三段落代码与规格**（关系 / 工作项 / 足迹），不是空谈。
4. 外部项目（SignalGraph、mindwalk、Multica、Canvasight）是**灵感参照与边界对照**，不是要整仓搬进来当依赖。
5. 说话：平常中文；先结论再证据。

**已定产品一句话（与 CONTEXT 一致）：**

> 搜得到、卡片带来源、看得见用了哪片知识、工作项看得见谁和下一步、时间线能写回；卡与卡怎么连、凭哪句。

**页面：** `/track/knowledge`

---

## 1. 对话背景与用户意图

### 1.1 用户怎么开场

用户提供了感兴趣的开源项目与截图，要求找**共性**。

用户明确的问题域：

- 项目管理
- 知识管理
- 内容管理
- 信息效率传递

### 1.2 用户点名的材料

| 材料 | 是什么 | 在对话中的角色 |
|------|--------|----------------|
| [Image #2] / 小红书向截图 | [SignalGraph](https://github.com/zhiliscope/SignalGraph) README 页；作者 @Zhiliscope；标语 *Connect what was never connected* | 用户说「比较感兴趣的几个 idea」之一 |
| [Image #1] | 终端 Flex Layouts 演示（ratatUI / @PinOut）；约束优先级与空间分配 | 与 PM/KM 当前产品**弱相关**；分析时未当重点 |
| https://github.com/cosmtrek/mindwalk | Agent 会话在仓库 3D 地图上回放 | 明确参照 |
| Multica | [multica-ai/multica](https://github.com/multica-ai/multica)；人+Agent 任务平台 | 明确参照 |
| 后续 X 帖 | [@xin_pai88825 谈 Canvasight 画布](https://x.com/xin_pai88825/status/2076504244929306914)；插件仓 [Niall-Young/Canvasight](https://github.com/Niall-Young/Canvasight) | 用户用此强化对「内容→结构→任务→可审」的认同 |

### 1.3 用户后续态度

用户对三层压缩读法明确表示认可（「哇哦，真不错」），并转发 Canvasight 相关讨论作为呼应。

用户要求：

- 把**上面对话的全部内容**记成详细文档
- 放进 `fc-opc-ibot` 项目文件夹
- 给 Codex 读，使 Grok 与 Codex **双方对齐**

本文即该交付物。

---

## 2. 外部项目事实摘要（调研时点 2026-07-14）

### 2.1 SignalGraph（zhiliscope/SignalGraph）

| 项 | 内容 |
|----|------|
| 仓库 | https://github.com/zhiliscope/SignalGraph |
| 一句话 | 把非结构化文本变成可查询、可导出、可复用的关系网络 |
| 口号 | Connect what was never connected. / Turn scattered information into connected knowledge. |
| 技术姿态 | Deterministic · Explainable · Pure Python · Zero External AI Dependencies |
| 能力要点 | 规则抽实体与关系；边带源句；内存图；path / neighbors / subgraph / stats；JSON + Markdown 导出；CLI |
| 示例 | `Microsoft invested in OpenAI` → `Microsoft --invested_in--> OpenAI` 等链式关系 |
| 局限（README 自述） | alpha；规则固定；无代词消解；仅 txt/md；内存图；实体别名合并未做 |
| 与本仓关系 | **灵感**：规则抽边 + 源句可指回 + 路径/邻居。本仓规格：`docs/SPEC-knowledge-relations.md`。**非依赖**：不硬集成其 Python CLI。 |

### 2.2 mindwalk（cosmtrek/mindwalk）

| 项 | 内容 |
|----|------|
| 仓库 | https://github.com/cosmtrek/mindwalk |
| 一句话 | 把 coding-agent 会话在仓库 3D 地图上回放 |
| 问题 | session log 记录「做了什么」，看不出「理解范围」与足迹形状 |
| 做法 | citymap（仓库确定性布局）+ trace（会话归一化触达流）+ 本地回放；亮∝深度×次数 |
| 触达分层 | seen / read / edited / unvisited；摩擦信号（错误率、反复改等） |
| 边界 | 事后足迹可视化；**不是**看板、派活、知识库 |
| 与本仓关系 | **灵感**：「足迹可见」。本仓规格：`docs/SPEC-knowledge-footprint.md`（知识卡点亮，不是代码 3D 城）。**非依赖**：不做 mindwalk 式 Three.js 仓库城为交件硬要求。 |

### 2.3 Multica（multica-ai/multica）

| 项 | 内容 |
|----|------|
| 仓库 | https://github.com/multica-ai/multica |
| 官网 | https://www.multica.ai/ |
| 一句话 | open-source managed agents platform：把 coding agents 当队友派活、跟进度、复用技能 |
| 命名 | Multiplexed Information and Computing Agent（对 Multics 分时的戏仿） |
| 能力要点 | Agents as teammates；Squads；任务生命周期；Autopilots；Reusable Skills；统一 Runtime；多 Workspace |
| 栈（README） | Next.js 前端 + Go 后端 + PostgreSQL/pgvector + 本地 daemon 跑多种 agent CLI |
| 与本仓关系 | **灵感**：任务/负责人/事件写回/技能复用。本仓规格：`docs/SPEC-work-item-shared-situation.md`。**明确非目标**：不做完整 Multica（多 runtime daemon、Squad、Cloud）。 |

### 2.4 Canvasight（对话后半用户补充）

| 项 | 内容 |
|----|------|
| 讨论帖 | https://x.com/xin_pai88825/status/2076504244929306914 |
| 插件仓 | https://github.com/Niall-Young/Canvasight（帖内称为 Scatter 的进阶版 / Codex plugin） |
| 用户痛 | 跟 AI 聊需求，对话越来越长，想法套想法，最后不知道聊到哪 |
| 产品说法 | **AI 负责发散，画布负责收敛**；聊天自动沉淀到画布；思路与调整路径可复盘；可交付 Codex 执行 |
| 截图印象 | 画布节点网 + 任务侧栏（Agent Team / Skill / 已处理节点 / 新标题列表） |
| 与三层映射 | 主打「内容→结构」的前半与「结构→可执行方案」的接口；执行足迹与完整任务平台仍可接 mindwalk / Multica 类能力 |

### 2.5 Image #1（ratatUI Flex）说明

终端约束布局 demo（Length / Percentage / Max 等优先级）。
与「项目管理 / 知识 / 内容 / 信息效率」主问题**弱相关**。
可记作：稀缺空间下的优先级与约束，但**不要**强行写成当前产品重点。

---

## 3. 共性分析（对话结论，完整保留）

### 3.1 总判断

SignalGraph / mindwalk / Multica **不是同一类产品**，而是同一条链路的三段：

1. 散信息 → 可复用结构
2. 工作过程 → 可回看
3. 人与 Agent → 按任务推进

共同在修的事：**信息进了系统，却接不上下一动作**（或接上了但看不见过程）。

### 3.2 各自管哪一截

| 项目 | 解决什么 | 不做什么 |
|------|----------|----------|
| SignalGraph | 散文本 → 实体关系图（路径/邻居/子图，带原文证据） | 不做看板、不做 Agent 调度 |
| mindwalk | Agent 会话 → 仓库足迹回放（摸了哪、有多深） | 不是知识库、不是派活系统 |
| Multica | 人+Agent 的任务层（派活、进度、技能、runtime） | 不负责「散资料怎么连成图」 |

### 3.3 共性（按用户四域）

**（1）信息效率，不是「多存一点」**

原料已经有了（笔记 / 会话 JSONL / issue），人还要二次消化。

- SignalGraph：孤立句子 → 可遍历网络
- mindwalk：原始 session log → 一眼形状
- Multica：复制粘贴 prompt 盯跑 → 板上指派、状态自动走

**（2）把隐性过程变成可查询对象**

关系图、足迹地图、任务生命周期：都是可点、可 scrub、可 assign 的状态，而不是文档堆。

**（3）结构优先，模型可选**

- SignalGraph：规则抽取、可解释、零外部 AI
- mindwalk：trace + citymap 分离，本地、可比对
- Multica：vendor-neutral 管 runtime/任务/技能

共同点：**先固定中间表示和边界，再谈智能**。

**（4）协作工作流的接法不同**

- Multica 直接吃协作（assignee / board / squad / skills）
- mindwalk 吃「协作之后发生了什么」（事后审计）
- SignalGraph 吃「协作前后的事实材料」（入库前的结构化）

因此三者**互补，不是竞品**。

### 3.4 映射到用户四域

| 用户域 | 谁主扛 | 怎么接 |
|--------|--------|--------|
| 知识 / 内容管理 | SignalGraph | 散内容 → 带证据的关系，可 export |
| 信息效率 | mindwalk + SignalGraph | 少读 log / 少翻碎片，先看结构与足迹 |
| 项目管理 / 协作 | Multica | 任务、人/Agent、进度、技能复用 |
| 端到端效率 | 三者串 | 材料成图 → 派活执行 → 会话足迹复盘 |

### 3.5 自然链（对话中的一句话）

**散信息结构化（SignalGraph）→ 接到可指派的动作（Multica）→ 执行痕迹可回看（mindwalk）。**

与本仓长期说法一致：

**检索 → 入库卡片（带来源）→ 接到下一动作。**

### 3.6 选型边界（防误伤）

- SignalGraph：alpha；显式事实连线，不是通用知识库。
- mindwalk：只服务「看懂 Agent 干了啥」，不替代看板。
- Multica：managed agents 平台；不帮你从论文/笔记抽关系图。

---

## 4. 三层模型（用户明确感兴趣并认可）

### 4.1 压缩读法（对话原文结构）

用户真正在找的不是「又一个 Notion/Jira」，而是：

1. **材料能不能自己连起来**（内容 → 结构）
2. **结构能不能接到动作**（结构 → 任务）
3. **动作过程能不能被看见**（过程 → 可审）

### 4.2 为什么三层值得保留

很多人做工具只做其中一截：

| 只做一截 | 典型结果 |
|----------|----------|
| 只做结构 | 图很漂亮，接不上活 |
| 只做任务 | 看板很满，材料仍是一锅粥 |
| 只做回放 | 事后能看，事前仍靠聊天 |

三层把验收钉成三个可问句：

1. 这堆材料**自己连得起来吗**？
2. 连好的结构**能变成可指派动作吗**？
3. 动作跑完，**路径还看得见吗**？

缺任一层，信息效率都会在那个接口漏掉。

### 4.3 链路示意

```text
散想法 / 笔记 / 会话
        ↓  内容→结构
   画布节点 / 关系图 / 卡片
        ↓  结构→任务
   Issue / Agent 指派 / 可执行 Spec
        ↓  过程→可审
   画布 revision / mindwalk 足迹 / 状态流
```

### 4.4 一句可当标准用（对话结论文本）

**信息效率 = 结构是否免费出现 + 结构是否能触发动作 + 动作是否留下可审轨迹。**

### 4.5 Canvasight 如何卡在三层上

| 层 | Canvasight 在干什么 | 仍缺什么 |
|----|---------------------|----------|
| 内容→结构 | 零散想法 / 长对话 → 画布节点与分支 | 关系带不带证据、能否跨材料查询（SignalGraph / 本仓 relations 向） |
| 结构→任务 | 节点可继续展开，并可交付 Codex 执行 | 真正的派活、状态、技能复用（Multica / 本仓 work-item 向） |
| 过程→可审 | 思路、调整路径留在画布上，复盘不用翻聊天 | 执行阶段的足迹（mindwalk / 本仓 footprint：真用了哪些卡） |

对话结论：用户兴奋点不是「又一个画布笔记」，而是**发散与收敛拆开，中间态变成可点的对象**。

---

## 5. 与本仓库 `fc-opc-ibot` 的硬对齐

### 5.1 三层 ↔ 已有规格 / 代码

| 三层 | 本仓规格 | 本仓主要落点（2026-07-14 时） | 外部灵感 |
|------|----------|-------------------------------|----------|
| 内容→结构 | `docs/SPEC-knowledge-relations.md` | 卡↔卡显式边；来源句；path/neighbors API；关系抽取 | SignalGraph |
| 结构→任务 | `docs/SPEC-work-item-shared-situation.md` | WorkItem：状态 / 负责人 / 下一步 / 事件时间线 / 挂依据 | Multica（局部） |
| 过程→可审 | `docs/SPEC-knowledge-footprint.md` | 检索点亮、使用足迹、依据岛；非代码 3D 城 | mindwalk（呈现启发） |

补充：

- **依据层对象**：`KnowledgeCard`（带来源）— 见 `shared/types/knowledge.ts`、`CONTEXT.md` 词表。
- **行动层对象**：`WorkItem` + `Event`。
- **结构层对象**：Relation / 边（必带来源句）。
- **足迹层对象**：检索/使用事件驱动的亮暗与深度，不是「更正确」。

### 5.2 产品已定边界（Agent 不得偷偷改）

来自 `CONTEXT.md` / PRD / SPEC non-goals，与本对话一致：

- 做：检索 + 依据卡片 + 工作项 + 知识足迹 + 关系（按规格演进）
- 不做：当编辑器卖；微信私聊对接；客户改约定产品线
- 不做：完整 Multica；向量库当卖点；通用知识图谱产品叙事
- 模型可帮忙理解、拆任务；**写进库的卡片和状态算数**；人点状态

### 5.3 失败定义（与 CONTEXT 对齐）

失败包括但不限于：

- 结果没来源
- 重启丢数据
- 状态点不动
- 和记笔记软件说不清差别
- 有边无「凭哪句」
- 把足迹亮暗当成「更正确」或当成关系本身

### 5.4 演示步骤（平常话，禁止改名）

1. 打开 `/track/knowledge`
2. 搜「检索 来源」→ 带来源的卡片 + 知识足迹（亮=命中，暗=未用到）
3. 右侧工作项：负责人与下一步；详情时间线
4. 写评论 → 时间线；推进状态
5. （可选）挂依据 → 足迹上该卡更深
6. （可选）看卡与卡的边：怎么连、凭哪句
7. 对评委说：搜得到、有来源、看得见用了哪片知识、谁负责、下一步是什么、依据之间怎么连

### 5.5 与「检索 → 卡片 → 下一动作」旧说法的关系

| 旧说法 | 三层 | 备注 |
|--------|------|------|
| 检索 | 过程→可审 的输入；也触发足迹 | 检索不是终点 |
| 入库卡片（带来源） | 内容→结构 的节点层 | 边是结构的第二刀 |
| 下一动作 / 工作项 | 结构→任务 | 必须有负责人与下一步 |

不要另起一套口号替换已有词表。

---

## 6. 双 Agent（Grok / Codex）对齐协议

### 6.1 本文档的地位

- **对齐用事实与决策备忘**，不是新 PRD、不是替代 SPEC。
- 若与 `CONTEXT.md` / SPEC / PRD 冲突：**以 CONTEXT + 对应 SPEC 为准**；本文若过时，应改本文并在文首注明。
- 实现前先读：`CONTEXT.md` → 相关 SPEC → 本文 §5。

### 6.2 变更时怎么同步

| 变更类型 | 应更新 |
|----------|--------|
| 改产品边界 / 词表 | `CONTEXT.md` + 相关 SPEC + 必要时本文 §5 |
| 改关系/足迹/工作项行为 | 对应 SPEC + 测试；本文只改映射表若语义变了 |
| 仅外部灵感新材料 | 可追加到本文 §2，不必改代码 |

### 6.3 协作语言

- 步骤骨架：意图 → 规格 → 实现 → 对照 → 说明（`docs/DEV_COLLAB.md`）
- 用词：见 `CONTEXT.md`
- 对用户交付：路径、验证状态、剩余风险、下一步

### 6.4 选型时的默认问题（用户认可的断口钉法）

下一刀优先钉「最常断」的那一层：

1. 入库连不起来？（补结构 / relations）
2. 连了派不出去？（补任务 / work-item）
3. 派了看不清？（补足迹 / footprint / 事件时间线）

用**一个具体失败场景**验收，而不是「喜欢哪个 GitHub」。

---

## 7. 对话时间线（便于 Codex 还原语境）

| 序 | 谁 | 内容摘要 |
|----|-----|----------|
| 1 | 用户 | 给 SignalGraph 截图、mindwalk 链接、Flex 截图、Multica；求共性；域=PM/KM/内容/信息效率 |
| 2 | Grok | 调研三项目 README/元数据；得互补三段链；给出四域映射与边界；提出三层压缩读法 |
| 3 | 用户 | 贴 X 帖（Canvasight）；表示对「内容→结构→任务→可审」很感兴趣 |
| 4 | Grok | 拉取帖文与配图；把 Canvasight 映射到三层；给出可当标准的一句话；建议钉「最常断」的一层 |
| 5 | 用户 | 要求把**全部对话内容**写成详细文档，放入 `fc-opc-ibot`，供 Codex 与 Grok 对齐 |
| 6 | Grok | 写本文；并在 `CONTEXT.md` 挂链接（若本轮已改） |

---

## 8. 关键链接（本仓内）

| 文档 | 路径 |
|------|------|
| 共用说法 / 词表 | `CONTEXT.md` |
| 协作步骤 | `docs/DEV_COLLAB.md` |
| 产品说明 | `docs/PRD-iBot-Knowledge-Efficiency-Agent.md` |
| 工作项 SPEC | `docs/SPEC-work-item-shared-situation.md` |
| 知识足迹 SPEC | `docs/SPEC-knowledge-footprint.md` |
| 知识关系 SPEC | `docs/SPEC-knowledge-relations.md` |
| 本文 | `docs/research/2026-07-14-content-structure-task-audit-alignment.md` |

### 外部

| 名 | URL |
|----|-----|
| SignalGraph | https://github.com/zhiliscope/SignalGraph |
| mindwalk | https://github.com/cosmtrek/mindwalk |
| Multica | https://github.com/multica-ai/multica |
| Multica 站 | https://www.multica.ai/ |
| Canvasight 讨论 | https://x.com/xin_pai88825/status/2076504244929306914 |
| Canvasight 仓 | https://github.com/Niall-Young/Canvasight |

---

## 9. 未决 / 下一刀（对话提出但用户尚未拍板）

对话结束时**尚未**要求立刻改产品范围，只要求落文档对齐。

可选后续（需用户再定）：

1. 用真实工作失败场景钉「最常断」的一层
2. 评估是否吸收 Canvasight 式「对话自动沉淀为节点」到本仓 UX（当前非承诺）
3. 关系层 / 足迹层 / 工作项层的下一迭代优先级

在未拍板前，Agent 默认：

- 继续按已有 SPEC 与 `CONTEXT.md` 交付
- 用本文的三层语言解释设计，不另起产品名

---

## 10. 全文关键句存档（可直接引用）

1. 不是又一个 Notion/Jira，而是内容→结构、结构→任务、过程→可审。
2. 三者互补：SignalGraph 管材料成图，Multica 管派活，mindwalk 管执行足迹。
3. 先固定中间表示和边界，再谈智能。
4. AI 负责发散，画布负责收敛（Canvasight 用户侧说法）。
5. 信息效率 = 结构是否免费出现 + 结构是否能触发动作 + 动作是否留下可审轨迹。
6. 本仓落点：relations + work-item + footprint；外部项目是灵感不是整仓依赖。

---

*文档结束。Codex / Grok 读完应能独立复述 §0、§4、§5、§6。*
