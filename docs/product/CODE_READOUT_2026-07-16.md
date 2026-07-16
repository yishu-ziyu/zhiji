# 代码通读纪要（2026-07-16）

**目的：** 停止猜产品；以仓库事实对齐「高效率传递局面 → 判断 → 下一步」。  
**范围：** `fc-opc-ibot` 业务源码（约 22k 行 TS/TSX，主路径在 knowledge）。

---

## 1. 仓库实际是什么

| 层 | 路径 | 事实 |
|----|------|------|
| 入口 | `app/page.tsx` → `/track/knowledge` | 效率轨知识工作台是主产品页 |
| 主 UI | `app/track/knowledge/page.tsx`（~2000 行） | 项目列表、拖/传材料、材料面板、挂 `ProjectCanvas` 等 |
| 领域 | `shared/knowledge/*` | 项目、卡、材料、关系、工作项、事件、画布快照、足迹、检索、Agent 桥 |
| 持久化 | `shared/knowledge/repository.ts` + `data/knowledge/*.json` + `files/` | 本地 JSON + 按项目落盘文件 |
| API | `app/api/knowledge/**` | REST 形态；画布、材料、关系、工作项、检索、MCP |
| 类型 | `shared/types/knowledge.ts` | 单一领域语言：Project / Card / Material / Relation / ActionItem / Event / CanvasSnapshot / ProjectNowView |
| LLM | `shared/llm/adapter.ts` + `project-review-agent.ts` | 可选模型；大量 **deterministic 兜底** |
| 外 Agent | `agent-bridge.ts`（大） | 工作区绑定、请求锁、写回形状；偏协议不是聊天 UI |

**不是：** 电商轨（叙事旧稿里有，主代码已以 knowledge 为主）。  
**不是：** 完整 Multica / 全盘监听 / 向量库本体。

---

## 2. 领域对象（代码里真有）

| 对象 | 作用（白话） | 关键实现 |
|------|--------------|----------|
| Project | 一摊工作的壳 | `addProject` / `listProjects` / `lastOpenedAt` |
| Material | 项目下真实文件（可 base64） | `materials.ts` + materials API；可链 `sourceFileId` |
| KnowledgeCard | 可引用依据 | `addCard`；B-1 `ensureMaterialCitationCard` |
| Relation | 卡↔卡，带类型+来源句 | `relations.ts` + extract API |
| ActionItem（工作项） | 状态/负责人/下一步/截止 | `work-item-rules` 硬规则 |
| WorkEvent | 时间线事实 | comment / status / agent_result… |
| ProjectCanvasSnapshot | 打开项目时的整包局面 | `getProjectCanvasSnapshot` → UI 画布 |
| ProjectNowView | 「现在怎样」+ 可点依据 | `reviewProjectNow` 进 snapshot |
| AttentionItem | 「请先看」排序 | 阻塞/待确认/过期/最近变更等 |
| Footprint | 知识被摸过的痕迹 | `footprint.ts` + 地图组件 |
| Checkpoint | 目标/已完成/未解/下一步拍板 | checkpoints API |

---

## 3. 主用户路径（代码接线）

1. **进料：** 拖文件 / 拖夹 / 顶栏选夹 / 粘贴加卡（`page.tsx` + folder-import + materials）。  
2. **项目：** 夹→多项目（A5）；成功后进新项目（A6）；打开记 `lastOpenedAt`。  
3. **打开项目：** `GET .../canvas` → `getProjectCanvasSnapshot`：  
   - attention（请先看）  
   - **projectNow**（现在怎样 + evidence 卡）  
   - 一层关系边、inspector、timeline  
4. **材料：** 列表/预览（文/图/音）；M1 不强制弹大面板。  
5. **工作项：** 状态机 + 事件 + 可挂证据。  
6. **关系：** 创建/邻居/路径/规则抽取。  
7. **Agent：** 工作项 agent-run；project review 可模型可规则；bridge 给外进程写回。

---

## 4. 与「高效率传递」的对应（文档 + 代码）

已有调研对齐（`docs/research/2026-07-14-content-structure-task-audit-alignment.md`）：

| 段 | 意思 | 代码落点 |
|----|------|----------|
| 内容 → 结构 | 散材料连成可点关系 | relations + extract；材料→citation 卡 |
| 结构 → 任务 | 接到下一步/工作项 | ActionItem + nextStep 规则；画布 actions |
| 过程 → 可审 | 看得见发生过什么 | WorkEvent + timeline + footprint |

美军相关、你们语境里更贴的是 **BLUF（结论在前）** 与 **共同态势（大家看同一局面再决定）**——不是抄一套军用软件：

| 原则 | 产品里该长什么样 | 代码是否已有 |
|------|------------------|--------------|
| 结论在前 | 打开先「现在怎样 / 请先看」，不是先文件树 | **有** `projectNow` + `attention` |
| 依据可下钻 | 判断点回卡/材料 | **有** evidence refs；材料链卡在推进 |
| 同一局面 | 人与助手写进同一工作项/事件 | **有** events / agent 写回形状 |
| 下一步明确 | nextStep 强制语义 | **有** work-item-rules |
| 最高效传递 | 按**注意力排序 + 一层展开**，不是字少 | **有模型**；UI 是否始终以它为中心仍参差 |

效率定义在 SPEC 里曾写：**沟通一致 + 沟通可见**。  
与联席边界一致：**不是多存文件，是局面传得快、传得准、能决定。**

---

## 5. 诚实差距（通读后）

| 已有 | 仍弱 / 易变成「网盘感」 |
|------|------------------------|
| 材料进出、多项目、预览 | 默认注意力仍可能被文件列表/大面板抢走 |
| 画布 snapshot 模型完整 | 「现在怎样」大量 deterministic，材料一多仍像摘要模板 |
| 关系模型 + 源句 | 自动从「刚拖进来的夹」提出关系，未成默认主路径 |
| 工作项+事件 | 与「本地文件夹变迁」未自动对齐；改期故事弱 |
| agent-bridge 很重 | 用户主路径几乎不感知；偏工程协议 |
| 旧 PRD/叙事双轨电商 | 与当前 knowledge 主代码部分脱节，勿当现状 |

**一句话：** 仓库**已经按「局面/依据/下一步」建模**；最近冲的是进料诚实。  
若 UI 与默认路径仍以「文件堆」为中心，用户正确性质疑成立——那是**路径优先级**问题，不是「完全没写理解层」。

---

## 6. 通读结论（给联席）

产品满足需求的方式（应用代码语言）：

> 人把真实项目材料放进 **Project** → 系统维护 **同一可点局面**（projectNow / attention / 一层关系 / 时间线）→ 人用最少注意力做判断并改 **nextStep/状态** → 过程进 **Event** 可回看。

与本地文件夹的差别，**只有在这条链默认发生时才成立**；否则代码再多对象，体验仍是网盘。
