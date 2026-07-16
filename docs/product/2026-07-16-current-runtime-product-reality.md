# 当前运行时产品现实审计（2026-07-16）

只读审计范围：`AGENTS.md`、`CONTEXT.md`、`docs/product/CODE_READOUT_2026-07-16.md`、`PRODUCT_DEV_TASKS.md` 的 Q-09/Q-12/Q-14/Q-15/Q-17/Q-27/Q-28、`app/track/knowledge/page.tsx`、knowledge 领域/仓储/Agent Bridge 与 `app/api/knowledge/**`。

本文只描述当前代码和当前仓库数据能支持的事实，不提出产品建议。除专门标出的 T-16 集成分支外，“当前运行时”指本次审计所在 `feature/first-user-real-entry` 工作树；审计时 HEAD 为 `87152b14`。

## 0. 当前主运行时与 T-16 集成分支的边界

T-16 的集成提交 `2130ea0f` 位于 `no-mistakes/g2/t16-integration`，不是当前 HEAD `87152b14` 的祖先（`git merge-base --is-ancestor 2130ea0f HEAD` 返回 1），因此不能把 T-16 行为当成当前 `/track/knowledge` 已运行行为。

T-16 分支相对共同基线 `2e0e29ad` 的已集成领域/API行为是：

1. 材料引用卡增加 `sourceContentHash`，创建时写入、旧卡一次性回填但之后不覆盖；`assertMaterialCitationFresh` 可判断当前材料内容与引用 stamp 的 fresh/stale。证据：T-16 分支 `shared/types/knowledge.ts`、`shared/knowledge/repository.ts` 的 `sourceContentHash` / `assertMaterialCitationFresh` / `ensureMaterialCitationCard`。
2. `project-reviewer` 写 result 后不再自行把工作项切到 `confirmed`，工作项保持人的待确认门之前状态。证据：T-16 分支 `app/api/knowledge/work-items/[id]/agent-run/route.ts`。
3. 内置 Agent 的 result event 会经 `ensureResultCandidateCard` 幂等生成一张 `identity: "candidate"`、带 `resultEventLocator` 的项目候选卡，不自动晋升为已确认知识。证据：T-16 分支 `shared/knowledge/result-candidate.ts`、`shared/knowledge/repository.ts:ensureResultCandidateCard`、`agent-run/route.ts`。

这些行为在 `2130ea0f` 的独立记录中为领域/API PASS，但 ship/no-mistakes 未完成，且前端没有显示 immutable revision、Agent candidate、Owner-confirmed、stale/superseded 或 result-pending-writeback 身份。已记录的 T-16 residual 还包括：没有旧字节 blob 留存、公共 events `POST type=result` 不生成 candidate、没有全局 `patchWorkItem` Agent 禁止确认。证据：`.ship/handoffs/G2-T16-production-ledger.md`、`.ship/handoffs/G4-T16-red-gap-recheck-DONE.md`、`PRODUCT_DEV_TASKS.md:F-04`。

下文除明确写“T-16 分支”外，均为当前主运行时事实。

## 1. `/track/knowledge` 今天实际展示什么

- 唯一产品页是 `/track/knowledge`；`/` 只是落地页并链接到工作台。仓库没有其他业务 page。证据：`app/page.tsx:HomePage`；`app/track/knowledge/page.tsx:KnowledgePage`；`find app -name page.tsx` 仅这两页。
- 工作台默认打开最近活动项目；当前数据中是 `scion`，有 22 个带 `sourceFileId` 的材料卡、没有工作项、事件、关系、checkpoint 或 Agent Bridge 数据。因此今天默认可见的是“现在怎样”材料判断、最近材料依据、一层材料画布和材料预览；当前真实数据上看不到“交给 Agent”、Agent 结果或工作流时间线。证据：`KnowledgePage` 初始化与 `loadSnapshot`；`shared/knowledge/project-review-agent.ts:reviewProjectNow`；`data/knowledge/projects.json`、`data/knowledge/cards.json`，且当前没有 `actions.json`、`events.json`、`relations.json`、`project-checkpoints.json` 或 `agent-bridge/`。
- 页面现有可见功能：项目列表/切换与 ⌘P、当前项目关键词搜索、文件/文件夹拖入上传、材料列表与文/图/音频预览、材料自动生成可引用卡、“现在怎样”、一条优先 attention、一层焦点画布、Inspector 的概览/依据/影响/动态、规则提议关系并由人确认/否决、人工创建工作项/卡/状态 checkpoint、人工改状态/下一步/评论、底部时间线。证据：`app/track/knowledge/page.tsx`；`ProjectCanvas`、`ProjectInspector`、`ProjectNavigator`、`ProjectTimeline`。
- 顶栏/侧栏的 “AI Copilot” 只跳到首条 attention，不是聊天或命令入口。证据：`KnowledgePage` 顶栏 `copilotButton`；`ProjectNavigator` 的 `copilotCard`。
- 其他已存在但非独立产品页的 HTTP 面：项目/画布/材料/checkpoint；卡片/搜索/足迹；关系/邻居/路径/抽取；工作项/事件/依据/island/agent-run；以及 `minutes`、`dissect`、`mcp`、`state`、`web-search`、LLM health/completions。证据：`app/api/knowledge/**/route.ts`、`app/api/llm/**/route.ts`。
- `KnowledgeSearch`、`WebSearchPanel`、`CapturePanel`、`WorkItemsPanel` 等旧组件仍在磁盘，但当前 `page.tsx` 没有 import/mount，不能算今天的可见产品表面。

## 2. 今天代码里的 “Agent” 是什么、谁调用、能做什么

- 主 UI 唯一可调用的 Agent 是一次性 `project-reviewer`：用户聚焦未结束工作项后点“交给 Agent”，前端 POST `/api/knowledge/work-items/:id/agent-run`。没有工作项时按钮不存在；没有 `nextStep` 或至少一条 evidence 时路由拒绝。证据：`ProjectInspector` 的 `run-agent`；`KnowledgePage.handleRunAgent`；`app/api/knowledge/work-items/[id]/agent-run/route.ts:POST`。
- 它做的是复核，不是执行工作：读取工作项、关联卡片和最近事件，输出 `judgment/gaps/nextStep/evidenceIds`。默认 `AGENT_RUN_MODE` 非 `model` 时走确定性规则；设为 `model` 才调用 LLM。它没有调用外部工具、修改文件、发消息或完成任务。证据：`shared/knowledge/project-review-agent.ts:deterministicReview/reviewWorkItem`。
- “现在怎样”也不是持续 Agent：画布每次 GET snapshot 时同步调用确定性 `reviewProjectNow`，主要按材料数、最近材料、阻塞/开放工作项、关系数拼判断；`reviewProjectNowAsync` 的模型版本没有生产调用者。证据：`shared/knowledge/project-canvas.ts:buildProjectCanvasSnapshot`；全仓仅测试和自身引用 `reviewProjectNowAsync`。
- `agent-bridge.ts` 是独立磁盘协议：绑定项目到本地目录、仅读取授权目录下 Markdown、带文件 hash/revision 创建选择题/可编辑草稿请求，并管理 `pending → answered → delivered/cancelled/expired/stale`、capability、锁和 ACK。它不执行任务，也不写卡片/工作项/WorkEvent。生产 `app/`、`scripts/`、`shared/` 没有调用者；当前只有测试与文档引用。证据：`WorkspaceBinding` / `AgentRequest`、`readMarkdownContext`、`bindWorkspace`、`create/respond/get/acknowledge/cancelAgentRequest`；全仓调用检索仅命中 `agent-bridge.test.ts` 和 docs。
- `/api/knowledge/mcp` 暴露 search/add/dissect/update-status/suggestions 工具，但它们是无统一身份的同步工具调用面，不构成持续主 Agent。证据：`shared/knowledge/mcp-tools.ts:KNOWLEDGE_MCP_TOOLS/invokeKnowledgeMcpTool`。

## 3. 工作流今天在哪里、状态是什么

- 工作流实际载体是 `ActionItem + WorkEvent`，没有单独 workflow/run 对象。工作项字段为项目、标题/说明、负责人、截止、验收标准、`evidenceIds`、`nextStep`、`blockedReason`。事件记录评论、决定、状态/负责人/下一步变化、阻塞/解除、结果、依据关联。证据：`shared/types/knowledge.ts:ActionItem/WorkEvent`。
- 状态全集：`todo / doing / blocked / confirmed / done / cancelled`；中文分别是待开始/进行中/阻塞/待确认/完成/取消。开放态是前四个，终态是 done/cancelled。证据：`ACTION_STATUSES`、`STATUS_LABELS`、`OPEN_STATUSES`、`TERMINAL_STATUSES`。
- 规则只校验目标状态字段：doing/confirmed 要负责人；非终态要 nextStep；blocked 要原因。没有允许转换图，因此 PATCH 可在任意合法状态间跳转。证据：`shared/knowledge/work-item-rules.ts:assertWorkItemForStatus/assertCanPatchTo`。
- 工作项可由人从 UI/API 创建，也可由未挂主页面的 `minutes`、`dissect`、MCP 生成；状态变化通过 `patchWorkItem` 追加事件并把 actions/events 一起落盘。证据：`shared/knowledge/repository.ts:addAction/patchWorkItem/saveWorkState`。
- 当前主运行时的 `confirmed` 在类型/UI 中实际表示“待确认”，但 `agent-run` 会由 `agent:project-reviewer` 自己把工作项写成 `confirmed`。证据：当前 `shared/types/knowledge.ts:STATUS_LABELS.confirmed`；当前 `agent-run/route.ts:POST`。T-16 分支已删除这次自切状态，但未进入当前主运行时。

## 4. 今天是谁在执行

- 人：完成真实交互和状态维护——上传/拖入、搜索、创建卡/工作项、关联依据、确认/否决关系、修改下一步/负责人/状态、写评论与 checkpoint；“自己执行”只是人手动写状态。证据：`KnowledgePage` 各 handler；`ProjectInspector.saveWorkUpdate`。
- 产品服务器：完成文件复制入库、引用卡生成、搜索/attention/“现在怎样”计算、规则关系提议、事件与状态持久化，以及一次 work-item review；没有外部世界执行器。
- 外部 Agent：当前没有接线。事件 API 允许任意 HTTP 调用者 POST `type=result`，并硬标 `actor: agent:external`，但代码里没有实际 external agent 发起者。Agent Bridge 也没有 HTTP/UI/CLI 接入。证据：`app/api/knowledge/work-items/[id]/events/route.ts:POST`；Agent Bridge 全仓引用审计。
- MCP/API 调用者理论上可改卡片和状态，但当前没有认证、主 Agent identity、scope 或权限审批对象可证明是谁执行。

## 5. 什么算执行结果、怎样写回

- 领域里“结果”只是 `WorkEvent.type === "result"`，主体是自由文本 `body`，可附任意 `meta`。证据：`shared/types/knowledge.ts:WorkEvent`；`shared/knowledge/repository.ts:addWorkEvent`。
- 当前主运行时的内置 reviewer 成功时写一条 `result`：actor=`agent:project-reviewer`，body=当前判断+建议下一步，`meta.review` 含 judgment/gaps/nextStep/evidenceIds/mode；随后把工作项改为 `confirmed`，同时产生状态/负责人事件。数据写入 `data/knowledge/events.json` 与 `actions.json`，UI 在 attention、Inspector 动态和时间线显示。证据：当前 `agent-run/route.ts:POST`；`project-canvas.ts:reviewFromEvent/buildCanvasTimeline/rankAttention`。T-16 分支改为“不自切 confirmed + 生成 candidate 卡”，但当前主运行时没有这两个行为。
- reviewer 失败写 `block` + `meta.error`；`addWorkEvent` 会把工作项改 blocked、把 nextStep 改成“等待：…”。证据：`agent-run/route.ts:POST` 的 catch；`repository.ts:addWorkEvent`。
- 外部 result API 只要求非空 body，强制 actor=`agent:external`，丢弃调用方 result meta，且不自动更新工作项状态。证据：`work-items/[id]/events/route.ts:POST`。
- 人点“自己执行”只 PATCH 状态/负责人，生成 status/block/unblock/assign 事件，不生成 result 事件、输出物或验证记录。证据：`KnowledgePage.handleUpdateWork`；`repository.ts:patchWorkItem`。
- 当前主运行时的结果没有强制记录精确输入 revision/hash、工具调用、输出 locator、验证结论；也不会生成待确认知识变化或更新知识卡。Agent Bridge 的 answered/delivered JSON 留在独立目录，不进入 repository/timeline。T-16 分支只补了内置 reviewer 的 result→candidate 和材料引用 hash，不覆盖公共 result、工具/输出/验证 schema 或前端身份显示。

## 6. Web App 外持续同步的现有 seam

- 本地文件/文件夹是一次性显式导入：浏览器读取 File/FileSystemEntry，把内容 POST 后复制到 `data/knowledge/files/{projectId}`；顶层文件夹各建一个项目。原目录路径/句柄没有保存。证据：`app/track/knowledge/read-drop-entries.ts`、`shared/knowledge/folder-import.ts`、`KnowledgePage.handleFolderProjectImports/handleIncomingFiles`、`shared/knowledge/materials.ts:writeProjectMaterial`。
- 没有 `fs.watch`、chokidar、定时刷新、源目录 polling 或 webhook；导入后的原文件变化不会回流。服务端每次列/开产品内副本会重新读该副本的 mtime/content，但当前主运行时的 `ensureMaterialCitationCard` 命中已有卡后不会随文件变化更新卡片摘要。
- GitHub/Connector：生产依赖、route、adapter 中均没有 GitHub/OpenConnector；现有仓库/插件文件若被导入，只是普通 Material。`package.json` 也无 connector/browser 依赖。
- 浏览器：没有 Chijie 或浏览器控制调用接口；当前应用只使用浏览器原生上传/拖放能力。
- 唯一外网 seam 是一次性 AnySearch HTTPS MCP 请求 `/api/knowledge/web-search`；主页面不调用它，展示/入库组件未挂载，结果也没有持续同步。证据：`shared/anysearch/client.ts`；`app/api/knowledge/web-search/route.ts`；`KnowledgeSearch/WebSearchPanel` 无调用者。
- Agent Bridge 可在交付请求时校验绑定 revision 和 Markdown file hash，源变更会把未交付请求标 stale；这是请求协议漂移保护，不是文件同步或知识写回。
- 产品代码没有 webhook 接收器或后台 polling。`scripts/collab-events.mjs` 的 polling 只服务协作脚本，不在产品 runtime。

## 7. 与已同意的“检索 → 项目理解 → 行动 → 结果”循环的代码差距

- 检索：主页面仅项目内关键词/标签匹配；`QuerySession` 只有 query/filters/time/hit IDs/scores，没有 reason、来源集合/授权、结果身份转换。AnySearch 与主页面、项目依据链断开。
- 项目理解：主路径是同步确定性模板；关系提议需人点按钮；当前主运行时卡片没有 candidate/confirmed/stale/revision 生命周期，来源变化不会扇出复查。T-16 分支增加 candidate/stale 所需的部分领域身份与材料 hash，但未进入主运行时，且没有前端身份可见性或完整下游扇出。
- 理解到行动：没有把检索命中/判断候选经 Owner 确认转成工作项的统一记录链；当前是人另开工作项，或独立 minutes/dissect/MCP 直接创建。
- 行动执行：内置 Agent 只复核工作项；没有单一持续 Agent、聊天面、工具选择/权限等待、外部执行、交接或多 Agent 共享真相路径。
- 结果回流：当前虽有 result 事件和时间线，但结果未绑定精确输入/输出/工具/验证，也不生成候选知识、不触发旧知识复查；外部结果不改状态，人工状态更新又不形成 result。T-16 分支只使内置 reviewer result 生成候选卡，公共 result 和完整复查链仍缺失。
- 权威边界：当前 reviewer 自己把状态写成 `confirmed`，与“Agent 输出只能 candidate/draft、Owner 最终确认”不一致；Bridge/MCP/外部 result 也未汇入一个可识别、可追责的主 Agent 事件链。T-16 分支修正了内置 reviewer 这一处自确认，但不是全局 actor/权限门，且未 shipped。
