# 技术方案选型复核（代码对照 · 只调研不改代码）

**日期:** 2026-07-16  
**作者:** 秘书1（调研）  
**状态:** **Lead 已答 → D-48 FINAL（S-105）** · 阶段决策关闭 · **无** 再重复提醒  
**范围:** 对照主树 + 当前 MVP 集成/切片 worktree 的真实实现，再与 2026 npm pin、Context7 可用文档、X 公开工程实践交叉。

### Lead 阶段决策（D-48 · 权威）

- MVP **保持** `node:sqlite` + FS CAS + watcher + reducer + 现有 ports  
- **不** 引入新编排框架  
- **JSON / SQLite 双真相本轮不提前合并**  
- **AI SDK 后置**  
- 补充：**AgentModelLoop 已接 `shared/llm` adapter ≠ AI SDK 统一**

---

## 0. 结论（历史调研意见 · 已被 D-48 吸收）

1. **MVP 域模型方向正确，不要换框架当真相层。** 代码已经把「产品自有 SQLite + CAS + pure reducer + 可替换 AgentModelLoop」落成；LangGraph / Mastra / Temporal / Letta / 向量库 **不应** 作为项目记忆核心。 → **Lead 确认保持。**  
2. **双真相与 AI SDK 是后置债，不是本波阻塞。** 主树 JSON knowledge 与 project-memory SQLite **本轮不合并**；**AI SDK 后置**。另：**AgentModelLoop 已接现有 `shared/llm` adapter**，勿再写成「模型环未接线」；接线 ≠ AI SDK 统一。  
3. **库级:** 维持 `@parcel/watcher` + 自建 CAS + `node:sqlite`；AI SDK / MiniSearch / better-sqlite3 均 **后置或故障备用**，不在本波推。

---

## 1. 读过的代码（判断依据）

### 1.1 主树（`fc-opc-ibot` @ 主 cwd）

| 区域 | 路径 | 事实 |
|------|------|------|
| 知识持久化 | `shared/knowledge/repository.ts` (~1.7k 行) | **多份 JSON Map**（cards/projects/actions/events/relations…），tmp+rename 写盘；**不是** SQLite |
| 检索 | `shared/knowledge/search.ts` | **手写 tokenize + score**；**未** 使用 MiniSearch/Orama |
| LLM | `shared/llm/adapter.ts` | `fetch` → Anthropic 兼容 `/v1/messages`；**未** 引入 `ai` 包 |
| 材料 | `shared/knowledge/materials.ts` | 材料/摘要；hash 级能力存在，但不是 MVP CAS 原件仓 |
| Agent Bridge | `shared/knowledge/agent-bridge.ts` (~1.4k) | 自定义 capability / delivery / rebind / CAS 语义（B-01）；与 project-memory **平行** |
| 依赖 | `package.json` | Next 16.2.10 / React 19 / Vitest / Playwright；**无** parcel/watcher、sqlite、ai SDK |

### 1.2 MVP Project Memory（以 G2 集成树为准）

路径: `/Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/16/fc-opc-ibot` · 分支 `g2/mvp-v0-integration`  
（G5 reconstruct、G3B observer、G3 types/store 同源演进）

| 模块 | 文件 | 实现要点 |
|------|------|----------|
| 合同 | `types.ts` | grant / occurrence revision(`orev:`) vs content `sha256` / events / matter / watch / understanding 不可变 / head 指针 / 四端口 |
| CAS | `cas.ts` | 文件系统 SHA-256 blobs；tmp→fsync→rename；orphan blob 允许 |
| Store | `sqlite-store.ts` (~1.4–1.5k) | `DatabaseSync` from **`node:sqlite`**；WAL + **`synchronous=FULL`**；dedupe 命名空间；grant 边界；head 只动指针 |
| Reducer | `reducer.ts` | Owner accept/edit/reject **只 INSERT 新 accepted + 移 head**；证据被替换 → `review_needed`；诚实 why 缺省 |
| Runtime | `runtime.ts` | **进程单例** data-dir；capability 切分：ObservationWriter / AgentMemoryService / OwnerDecisionWriter / Reader |
| Observer | `observer.ts` | **`@parcel/watcher@2.5.6`**；可注入 watcher；grant realpath 边界；稳定读文件（stat 前后一致）；reconcile |
| Model | `agent-model-loop.ts` | **默认 deterministic** 六问 body；`mode:"model"` 可选；sanitize 外键 pin；**无** AI SDK 依赖 |
| Reconstruct | `reconstruct.ts` | AnalysisRun 只经 AgentMemoryService；Owner resolve 另一 port；assert 禁止混写 |

**已写进代码的产品不变量（与 D-40/D-41/D-43 对齐）:**

- 理解 revision 不可 UPDATE body  
- Agent 不能 resolve / 自确认  
- why `supported` 必须 quote + revision + path + lastVerifiedAt  
- 观测与写入共享同一 data-dir / store  
- 来源事件 dedupe 按 project+grant 命名空间  

---

## 2. 选型矩阵（对照「现在代码」vs「候选」）

图例: **Keep** = 维持现状 · **Later** = MVP 后可选 · **Reject** = 不做核心 · **Risk** = 已知风险需监控

### 2.1 项目记忆真相层

| 选项 | 与代码关系 | 判断 |
|------|------------|------|
| **产品 SQLite + FS CAS + pure reducer（现状）** | 已实现 | **Keep** · 符合 D-40/D-43 |
| Git 历史当真相 | 未用 | **Reject** · Git 是观测源之一，不是 understanding 真相 |
| lakeFS / 对象版本仓 | 未用 | **Reject for MVP** · 过重；CAS 已够 |
| Letta / Mem0 / 对话记忆框架 | 未用 | **Reject** · 会把 run memory 与 project memory 混为一谈 |
| Graphiti / 向量库当真相 | 未用 | **Reject** · 最多未来 projection |

**X 侧印证（弱证据，只作同向）:** 多条本地 Agent 记忆讨论强调 SQLite/文件日志/结构问题，而非「先上 Pinecone」。与「结构 > embedding」一致；**不** 据此引入任何具体第三方 memory SaaS。

### 2.2 SQLite 驱动

| 选项 | pin / 状态 | 与代码关系 | 判断 |
|------|------------|------------|------|
| **`node:sqlite` `DatabaseSync`** | Node 22.5+；24.x RC/稳化中 | **MVP 已用** | **Keep for MVP** · 零 native 依赖、与「单本地 writer」契合 |
| better-sqlite3 12.11.1 | 生产成熟、同步 API、快 | 未用 | **Later / fallback** · 若 `node:sqlite` 出现并发/打包/语义坑，经 **同一 Store 接口** 换驱动；注意其默认 WAL sync 可能非 FULL，必须显式对齐 |
| libsql / Turso | 0.17.x | 未用 | **Reject for core** · 远程/边缘不是首要场景；本地模式无明确优势 |

**建议:** 不要在 MVP 中途换驱动。在 `SqliteProjectMemoryStore` 外留 **driver port** 的文档边界即可（代码已是 class 封装，换实现点明确）。

### 2.3 文件观测

| 选项 | pin | 与代码关系 | 判断 |
|------|-----|------------|------|
| **@parcel/watcher 2.5.6** | npm 现 pin 一致 | **已用 + 可注入** | **Keep** · 原生递归 + 测试可 fake |
| chokidar 5.0.0 | 纯 JS 友好 | 未用 | **Later comparator only** · 大目录 fd 压力历史问题；无必要替换 |
| 系统 FSEvents/inotify 自写 | — | 未用 | **Reject** |

**硬约束（代码已写）:** watcher 只产 signal；ingest + reconcile 才建 revision。不要让 watcher 成为 exactly-once 历史。

### 2.4 模型 / Agent 运行时

| 选项 | pin | 与代码关系 | 判断 |
|------|-----|------------|------|
| **确定性 AgentModelLoop + 可选 model complete** | 自研 | **MVP 主路径** | **Keep as default** · 可测、可离线、符合「无来源不编造 why」 |
| 主树 `shared/llm/adapter.complete` | 手写 Anthropic API | 与 project-memory **未接线** | **Later glue** · 接进 `AgentModelLoopOptions.complete` 即可，不必先引框架 |
| **Vercel AI SDK `ai@7.0.29` ToolLoopAgent** | npm latest 仍 7.0.29；v7 有 toolApproval / runtimeContext | **未引入** | **Later recommended adapter** · 只做有界 tool loop；**不得** 持有 grant/event/understanding |
| LangGraph JS 1.4.8 | 条件第二 | 未用 | **Reject for MVP** · checkpoint 易被误当记忆；native better-sqlite3 额外面 |
| Mastra 1.51 | X 热度高 | 未用 | **Reject for core** · 依赖面大、workflow/memory 所有权易重叠；可借鉴文件约定，不吞框架 |
| OpenAI Agents SDK 0.13 | pre-1.0 | 未用 | **Reject for core** |
| Temporal 1.20 | 最强 durable | 未用 | **Reject until** 真跨日/多 worker 硬需求 |

**与旧报告一致并被代码强化:**  
「产品状态机 + 窄 model port」已经是**正在实现的形状**；AI SDK 是 **port 内实现**，不是架构中心。

### 2.5 检索投影

| 选项 | 与代码关系 | 判断 |
|------|------------|------|
| 主树手写 search | **生产在用** | MVP 六问不依赖它；可先不动 |
| MiniSearch 7.2.0 | 研究推荐 · **代码未用** | **Later** · 从 SQLite events/revisions **重建**；带 projectId 过滤 |
| Orama / Qdrant | 未用 | **Later after** 语料与失败证据 |
| 向量当六问答案 | 未用 | **Reject** |

### 2.6 UI / 应用壳

| 选项 | 判断 |
|------|------|
| Next 16 + React 19 | **Keep** · 与现栈一致 |
| Zustand / TanStack Query | **Keep** · 与 project-memory 正交 |

---

## 3. 代码暴露的真实风险（比「换库」更值得 Lead 管）

| # | 风险 | 证据 | 建议优先级 |
|---|------|------|------------|
| R1 | **双真相层** JSON knowledge vs SQLite project-memory | `repository.ts` vs `sqlite-store.ts` | **P0 架构债** · MVP 后必须定义唯一写入边界与迁移，否则「回到项目」会读错库 |
| R2 | **模型环未统一** | `agent-model-loop` 确定性 vs `llm/adapter` 平行 | P1 · 接 port 时禁止第二套记忆写入 |
| R3 | **进程单例 store** | `runtime.ts` | P1 · Next multi-instance / serverless 会炸；本地 companion 单 writer 是正确方向，文档需钉死 |
| R4 | **node:sqlite 成熟度** | 官方仍在 RC 轨道上演进 | P2 · 准备 better-sqlite3 驱动切换 spike，**不** 预换 |
| R5 | **主树 search 非索引** | O(n) 扫 cards | P2 · MVP 不阻塞；体量起来再 MiniSearch |
| R6 | Agent-bridge 与 project-memory 两套 CAS 语义 | agent-bridge hash vs content CAS | P2 · 命名与边界写清，避免混用 |

---

## 4. 对 Lead 的明确意见（可执行）

### 4.1 MVP 波（现在）

- **不要** 为「更好框架」停 G3B→G2→unit→G4/G6。  
- **不要** 引入 LangGraph / Mastra / Temporal / 向量库 / Letta。  
- **维持** parcel/watcher + node:sqlite + FS CAS + pure reducer + split ports。  
- **保持** Agent 默认 deterministic；模型失败回退已有。

### 4.2 下一波（Owner 验收 MVP 后）

1. **单一真相收敛方案（决策题）:** project-memory 是否吞并/旁路 JSON knowledge 的事项与理解？  
2. **AgentModelLoop ← AI SDK 7:** 仅 adapter；toolApproval 映射 Owner gate；遥测不进真相。  
3. **MiniSearch 投影:** 从 events+revisions 重建；失败可整库删索引。  
4. **node:sqlite 压力 spike:** 崩溃/并发读/大 reconcile；失败则 better-sqlite3 adapter。

### 4.3 不建议「因为 X 热」而做的事

- 为 Mastra file-based agent 改产品目录结构  
- 上链/去中心化 agent memory  
- 多 Agent 共享 JSON brain 当项目真相  

---

## 5. 版本钉死表（2026-07-16 观测）

| 组件 | 代码/计划 pin | npm latest 观测 | 备注 |
|------|---------------|-----------------|------|
| Next | 16.2.10 | （未重测） | 主树 |
| @parcel/watcher | 2.5.6 | 2.5.6 | 一致 |
| ai (Vercel) | 未依赖 | 7.0.29 | 建议未来 pin |
| @langchain/langgraph | 未依赖 | 1.4.8 | 条件候选 |
| minisearch | 未依赖 | 7.2.0 | 投影候选 |
| better-sqlite3 | 未依赖 | 12.11.1 | 驱动备用 |
| @mastra/core | 未依赖 | 1.51.0 | 非核心 |
| @openai/agents | 未依赖 | 0.13.4 | 非核心 |
| Node | 环境 v24.x / 目标 22 | — | node:sqlite 可用 |

---

## 6. 方法与局限

- **读过:** 主树 knowledge/llm/agent-bridge 关键路径；G2 集成树 project-memory 全模块 + G3B observer + G5 reconstruct 同源文件。  
- **未做:** 跑集成测试、改代码、装新依赖、完整 SBOM、法律意见。  
- **外部:** npm view pin；既有 `2026-07-16-main-agent-runtime-architecture.md` / `project-memory-architecture-foundations.md` / `open-source-foundations-matrix.md`；X 语义检索作弱旁证。  
- **Context7（后补 library resolve）:**

| 主题 | Context7 library ID | 用途 |
|------|---------------------|------|
| Vercel AI SDK | `/vercel/ai` · docs site `/websites/ai-sdk_dev` | 未来 `AgentModelLoop` adapter 文档源 |
| MiniSearch | `/lucaong/minisearch` | 后置关键词投影 |
| Orama | `/oramasearch/orama` | 条件混合检索投影（非真相） |
| LangGraph JS | `/websites/langchain_oss_javascript_langgraph` | 条件 orchestration；非记忆真相 |
| libSQL | `/tursodatabase/libsql-client-ts` | 边缘/远程场景对照；非核心 |

  注：对 “parcel watcher” 的 Context7 解析**未**命中 `@parcel/watcher`（命中 Java/Bun 旁系）→ parcel 仍以 npm + 本仓 `observer.ts` 源码为准。

### Context7 文档抽样（不改变 §0 结论）

- **AI SDK (`/vercel/ai`):** `generateText` + `stopWhen`（`isStepCount` / `hasToolCall`）做有界多步 tool loop；存在 **tool-approval-request** 可挂人工确认 → 正好映射「模型环在 port 内、Owner gate 在产品层」，**不** 替代 understanding head。  
- **MiniSearch (`/lucaong/minisearch`):** `addAll` + fielded search + filter → 适合从 domain 行 **重建投影**，不是事件仓。  
- **LangGraph JS:** `interrupt` + checkpointer/thread → 编排/HITL 原语；checkpoint **≠** 项目记忆 CAS/event log（与代码已写的 split ports 冲突风险高）。

---

## 7. 一页决策表（Lead 可直接用）

| 决策 | 现在 | 意见 |
|------|------|------|
| 项目记忆核心 | 自研 SQLite+CAS | **保持** |
| 观测 | parcel/watcher | **保持** |
| 模型 | deterministic loop | **保持默认**；后接 AI SDK 仅 adapter |
| 框架 Agent 栈 | 无 | **继续无** |
| 主树 JSON 库 | 仍在 | **标债 · 验收后收敛** |
| 换 better-sqlite3 | 否 | **仅故障触发** |
| MiniSearch | 否 | **投影后置** |

---

**给 Lead:** 若同意「MVP 不换栈、验收后只做收敛+AI SDK adapter+投影」，则无需新 Owner 决策；若要把 JSON knowledge 与 project-memory 合并时机提前，才需要 Owner/产品拍板。
