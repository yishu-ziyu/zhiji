# 主 Agent 运行时架构：源码级候选比较与隔离 spike 方案

> 日期：2026-07-16
> 状态：D-13 / T-22 调研与接口预备；**不是采用、schema freeze、spike 执行或生产实现授权**
> 范围：TypeScript / Next.js 主 Agent；外部 Coding-Agent gateway 明确排除在核心之外

## 0. 结论

当前最小、可退出、最符合产品真相的方向是：

**产品自有的持久化显式状态机 / event reducer + Vercel AI SDK `ai@7.0.29` 的模型与工具循环，后者只放在窄 `AgentModelLoop` port 后。**

这不是把 AI SDK 当工作流引擎。来源授权、变更事件、事项、项目记忆、Owner 决策、幂等、审计和恢复都继续由产品拥有；AI SDK 只负责一次有界的模型/本地工具循环。这样最直接地满足：

- 项目记忆不进入框架 state；
- 来源变化与用户问题走同一条产品触发入口；
- Owner 停点可跨进程恢复；
- 真正可重放的是产品事件和记录过的模型/工具结果，不是假装实时 LLM 可确定重放；
- 删除或替换模型循环 adapter 后，产品真相、审计和待审 proposal 仍然存在。

**LangGraph JS `1.4.8` 是有条件的第二选择**：只有隔离 spike 证明显式状态机无法清楚表达实际需要的嵌套分支、fan-out 或多个并发人工停点时，才引入它的 graph/checkpointer/interrupt 子集。

**Temporal TS `1.20.3` 暂缓**：它的 durable execution、signal、history replay 和测试能力最强，但在当前“本地/Next + 单主 Agent + 产品自有记忆”条件下，需要独立 Temporal Server、worker 和部署纪律，成本远高于已确认需求。只有真实出现跨多日计时、多个 worker、持续外部调用和部署安全 replay 的硬需求时才重新评估。

OpenAI Agents SDK 与 Mastra 都能做工具审批和暂停/恢复，但前者把长期恢复耦合到序列化 `RunState` 与包版本，后者的默认执行引擎并不提供 Temporal 级 durable operation，且依赖与框架所有权面更大；两者都不是当前更好的核心基础。

---

## 1. 产品约束：先决定“运行时不能拥有什么”

本报告以以下本地权威为边界，而不是从框架能力倒推产品：

- [D-35–D-39 与 T-22](../../.ship/tasks/first-user-real-entry-015/control/PRODUCT_DEV_TASKS.md)：主 Agent 只观察 Owner 授权项目来源；维护有来源、可修订的项目理解；影响/缺口/冲突/过期只形成候选；外部 Coding-Agent 编排非核心；T-22 仅调研/接口预备。
- [CONTEXT.md](../../CONTEXT.md)：项目记忆是授权原始材料、变化事件、当前理解及其历史；Agent 是持续推进事项的主体。
- [Agent definition product facts](./2026-07-16-agent-definition-product-facts.md)：项目仓库仍是产品真相；Owner 是高风险动作的唯一确认者；不得让 Agent 自我确认；检索需留下紧凑轨迹。
- [G3 T-22 interface analysis](../../.ship/research/grok-followups/G3-T22-memory-revision-analysis-interface.md)：`AnalysisRun` 是幂等、项目级的派生/流程记录；接受 proposal 后形成新的理解 revision。
- [G4 T-22 fail gates](../../.ship/research/grok-followups/G4-T22-project-memory-fail-gates.md)：D-40 真相层是 immutable/versioned originals、append-only exact/replayable events、Owner-gated understanding revisions；索引可重建；任何单一 vendor 不得成为唯一真相。

因此，所有候选都必须接受同一条所有权界线：

| 产品拥有，框架不可取代 | 框架最多拥有 |
|---|---|
| source grant、watch set、source revision、matter、change event | 一次运行的短期控制游标 |
| current-understanding revision、proposal、Owner decision receipt | 可删除的 checkpoint / serialized run cache |
| `AnalysisRun` 状态、attempt、幂等键、错误与恢复规则 | 模型调用与本地工具调度细节 |
| 工具授权策略、工具输入/输出 receipt、审计记录 | 可关联但非权威的 telemetry |

关键推论：**“框架能记住对话/graph state”不等于“它能成为项目记忆”。** 产品必须能在框架 checkpoint、trace、session 全部被删除后，用产品真相恢复当前理解、待审 proposal 和审计历史。

---

## 2. 调研方法、版本与许可快照

### 2.1 方法

1. 以 2026-07-16 npm `latest` 和官方 Git tag 为版本锚；annotated tag 使用解引用后的 commit。
2. 克隆对应 commit，直接定位实际 TypeScript symbol，而不是只复述营销文档。
3. 在隔离临时目录执行 `npm install --ignore-scripts --no-audit --no-fund`，扫描安装后每个唯一 `name@version` 的 `package.json.license`。
4. 只使用官方文档、官方仓库、npm 包元数据作为外部证据。

许可数字只是本次解析出的 **package-manifest 快照**，不是法律意见、完整 SBOM 或生产批准。caret/optional/platform 依赖会随 lockfile、Node 与 OS 改变；真正采用前仍需锁文件、完整 SBOM、原始 LICENSE/NOTICE 与漏洞扫描。

### 2.2 精确 pin 与传递依赖

| 候选 | 精确版本 / commit | 上游许可 | 本次隔离安装的传递许可快照 |
|---|---|---|---|
| LangGraph JS | `@langchain/langgraph@1.4.8` + `@langchain/langgraph-checkpoint-sqlite@1.0.3`; tag commit [`3dccad1`](https://github.com/langchain-ai/langgraphjs/tree/3dccad1391e173eead64f9e2d6dd977fdc345f7d) | [MIT](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/LICENSE) | 60：MIT 49、ISC 6、Apache-2.0 2、BSD-3-Clause 1、复合 permissive 2；含 native `better-sqlite3@12.11.1` |
| Temporal | TS SDK `@temporalio/{client,worker,workflow,testing}@1.20.3`, commit [`ae823d7`](https://github.com/temporalio/sdk-typescript/tree/ae823d7f9dd513f3b90aeba8c66854c59c39a359)；当前 Server `v1.31.2`, commit [`19a7743`](https://github.com/temporalio/temporal/tree/19a774302c613da9adc4436ab14278ccdca8e0a5) | TS SDK [MIT](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/LICENSE)，Server [MIT](https://github.com/temporalio/temporal/blob/19a774302c613da9adc4436ab14278ccdca8e0a5/LICENSE) | 155：MIT 88、Apache-2.0 34、BSD-3-Clause 16、ISC 7、BSD-2-Clause 5、其他 permissive/复合 4、`CC-BY-4.0` 1、manifest `UNKNOWN` 1；后两项分别为 webpack 链的 `caniuse-lite` 与 worker 链的 `unionfs`，采用前需单独复核 |
| Vercel AI SDK | `ai@7.0.29`, commit [`6427ca9`](https://github.com/vercel/ai/tree/6427ca9273c6167641b4a12e41b3b0f67c0baee7)；对比扫描另含 `@ai-sdk/openai@4.0.15`, commit [`b8241a6`](https://github.com/vercel/ai/tree/b8241a6e5592066c0ee1772c32d3ef47d7d7595e) | [Apache-2.0](https://github.com/vercel/ai/blob/6427ca9273c6167641b4a12e41b3b0f67c0baee7/LICENSE) | 11：Apache-2.0 7、MIT 3、`AFL-2.1 OR BSD-3-Clause` 1 |
| OpenAI Agents SDK JS | `@openai/agents@0.13.4`, commit [`4e1f842`](https://github.com/openai/openai-agents-js/tree/4e1f842f63673db59018a7fa4a441c64c274caf2) | [MIT](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/LICENSE) | 101：MIT 90、ISC 7、BSD-3-Clause 2、BSD-2-Clause 1、Apache-2.0 1；仍是 pre-1.0 API |
| Mastra（成熟挑战者筛查） | `@mastra/core@1.51.0`, commit [`dfaf448`](https://github.com/mastra-ai/mastra/tree/dfaf448cebd7614a78bcb2df8510dbb59a4f81ff) | [Apache-2.0](https://github.com/mastra-ai/mastra/blob/dfaf448cebd7614a78bcb2df8510dbb59a4f81ff/LICENSE.md) | 231：MIT 194、Apache-2.0 16、ISC 10、BSD-3-Clause 5、BSD-2-Clause 3、BlueOak-1.0.0 2、复合 permissive 1；安装树同时出现多个 AI SDK provider 世代 |

Temporal 的 package 扫描不包含独立 Server/CLI 二进制依赖；其运维与供应链面必须另算。Mastra 的 231 包也只是 `@mastra/core` 当前解析结果，并非全套 deployment 包。

---

## 3. 一页比较

| 维度 | 产品状态机 + AI SDK | LangGraph JS | Temporal TS + model/tool loop | OpenAI Agents SDK | Mastra |
|---|---|---|---|---|---|
| 项目记忆外置 | 天然；SDK 无持久化主张 | 可行，但必须只把 ID/游标放 graph state | 可行，只把 refs 放 workflow history | 可行，但 session/serialized state 容易被误当记忆 | 可行，但 workflow/storage/memory 所有权面重叠较大 |
| durable resume | 产品在每个非确定边界前后提交 event；精确但需自建 | checkpointer + thread + interrupt | 最强；event history + worker recovery | `RunState.toString/fromString` 可跨进程等待，任意崩溃恢复仍由应用补齐 | snapshot/suspend/resume；默认 engine 的 operation/sleep 不具 Temporal 级 durability |
| Owner pause | 产品 `awaiting_owner` + Owner command | `interrupt()` + `Command({resume})` | Signal + `condition()` | tool approval interruption + serialized RunState | workflow suspend/resume / tool approval |
| 来源事件触发 | 产品 queue/claim/idempotency | 外部 caller 启图；无内建 source listener | `signalWithStart` 很强 | 外部 caller；无 scheduler/source listener | 外部 caller；默认 workflow 本身不是来源 watcher |
| 工具策略 | 产品 gateway 包住本地 tools | `ToolNode` 外再包产品 policy | Activity 外再包产品 policy | SDK approval 外再包 Owner/receipt policy | framework tools 外再包产品 policy |
| “重放”语义 | 产品 reducer + 已记录模型/工具 outcome；确定 | checkpoint 后节点会重新执行；不是审计 replay | workflow history replay 最强；Activity 结果来自历史 | 无确定 event replay；恢复序列化 run state | snapshot/restart；默认 engine 不提供确定 history replay |
| 确定性测试 | 纯 reducer + `MockLanguageModelV3` | fake model + in-memory checkpointer；需防节点重跑副作用 | history replay、mock Activity、time skipping | 自实现 `Model` fake；SDK 内部 fake 未作为公共测试 API | 可 fake step/model；默认执行语义仍需应用验证 |
| Next / 本地匹配 | 最佳；一个 Node 应用 + 产品 DB/queue | 好；SQLite addon/部署需处理 | 差；Next 只应是 client/control surface，另有 Server + worker | 好；仍需应用持久化/任务 runner | Node 可用，但依赖/框架面最大 |
| 运维复杂度 | 低—中 | 中 | 高 | 低—中 | 中—高 |
| 退出边界 | 最清楚 | graph/checkpoint schema 需迁移 | workflow history/versioning 与服务需迁移 | serialized RunState 与 SDK 版本耦合 | workflow/storage/agent abstractions 耦合 |
| 当前判断 | **推荐进入隔离对比 spike** | **第二 spike arm** | 条件触发后才 spike | 不作为核心 | 未证明更优 |

---

## 4. 推荐基线：产品状态机 + Vercel AI SDK

### 4.1 源码事实

- [`ToolLoopAgent`](https://github.com/vercel/ai/blob/6427ca9273c6167641b4a12e41b3b0f67c0baee7/packages/ai/src/agent/tool-loop-agent.ts#L39) 只是围绕 `generateText` / `streamText` 的模型工具循环；默认 stop condition 是 20 steps。产品应显式设置更小、按 use case 决定的上限。
- [`Agent` interface](https://github.com/vercel/ai/blob/6427ca9273c6167641b4a12e41b3b0f67c0baee7/packages/ai/src/agent/agent.ts#L181) 暴露 `generate`/`stream`，没有 checkpoint、event scheduler 或 durable resume 契约。这恰好迫使 durable truth 留在产品层。
- [`ToolLoopAgentSettings`](https://github.com/vercel/ai/blob/6427ca9273c6167641b4a12e41b3b0f67c0baee7/packages/ai/src/agent/tool-loop-agent-settings.ts#L44) 提供 tools、`prepareStep`、tool approval 和 step/tool callbacks，但 callbacks 只能做 telemetry/receipt 辅助，不能成为唯一产品审计。
- 公共 [`MockLanguageModelV3`](https://github.com/vercel/ai/blob/6427ca9273c6167641b4a12e41b3b0f67c0baee7/packages/ai/src/test/mock-language-model-v3.ts#L9) 与 [`simulateReadableStream`](https://github.com/vercel/ai/blob/6427ca9273c6167641b4a12e41b3b0f67c0baee7/packages/ai/src/util/simulate-readable-stream.ts#L12) 可构造确定模型/stream fixture。

官方文档确认：

- [ToolLoopAgent 是可重用 agent 配置](https://ai-sdk.dev/docs/agents/overview)，不是持久化工作流。
- [manual tool approval](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) 会先返回 `tool-approval-request`；稍后把 `tool-approval-response` 加入消息并再次调用模型。它不要求 HTTP 请求一直挂起。
- 同一文档也明确：**provider-executed tools 不受 AI SDK `needsApproval` 控制**。因此本产品不得把外部副作用委托给 provider-hosted tool；只能把产品 policy 包装过的本地 tool 暴露给模型。

### 4.2 它在本产品中应该只做什么

建议的唯一采用 slice：

```ts
interface AgentModelLoop {
  run(input: AgentLoopInput): Promise<AgentLoopOutcome>;
}
```

`AgentLoopInput` 只携带 revision-pinned refs 解析出的最小上下文、当前接受理解 revision、prompt spec/hash、允许的本地工具目录与 step budget。`AgentLoopOutcome` 只返回有 schema 的 findings/proposals、待 Owner 批准的工具意图、完成或可重试错误。

以下能力明确留在 adapter 外：

- `AgentTrigger`：`source_change | owner_question | owner_resume | retry`；
- `AnalysisRun` 状态：`queued | running | awaiting_owner | completed | cancelled | failed`；
- 事件 claim、coalesce、幂等、attempt 与 lease；
- source grant/watch/revision、matter matching、current understanding；
- Owner actor 验证、expected revision、防 stale approve；
- 工具权限、receipt、redaction 与结果写回；
- product audit 与 replay。

### 4.3 恢复与重放

运行时必须在每个非确定边界前后提交产品事件：

1. `AnalysisRunClaimed`；
2. `ModelAttemptStarted`；
3. `ModelOutcomeRecorded`（结构化结果或错误，不含 hidden reasoning）；
4. `ToolIntentRecorded` → 如需 Owner，进入 `awaiting_owner`；
5. `OwnerDecisionRecorded`；
6. `ToolExecutionStarted/Completed`，以 product idempotency key 去重；
7. `ProposalRecorded` / `RunCompleted`。

崩溃恢复由 reducer 根据最后一条持久事件决定下一 command。已记录的模型 outcome 不再调用模型；已完成的工具 receipt 不再执行工具。若模型请求在响应到达前中断，则新 attempt 是**新调用**，而不是“继续同一 token stream”，并必须显式关联前一次 attempt。

这里的“确定重放”只表示：把 append-only product events 与固定的 recorded model/tool outcome fixtures 重放给纯 reducer，得到相同状态/hash。再次访问实时模型是新运行，不能冒充 replay。

### 4.4 Next / 本地运行形态

- Next.js route/server action 负责接收本地 companion/source connector 的授权变更事件、Owner 问题和审批命令。
- 一个产品自有的 durable claim loop/worker 处理 `AnalysisRun`；不能依赖一次请求存活到循环结束。
- 如果首版是单机本地 Node，产品 DB 中的 lease + attempt 即可作为 spike 假设；部署到 request-limited/serverless 环境前必须重新验证 worker 生命周期。
- AI SDK 不拥有 queue，也不解决 crash window；这是显式状态机 spike 必须被 falsify 的核心，而不是隐藏的限制。

### 4.5 退出边界

替换 AI SDK 时只重写 `AgentModelLoop` adapter 和 provider mapping。prompt spec、tool descriptor、product events、proposal schema 与 audit schema 不得引用 AI SDK 的 `ModelMessage`、`ToolCall` 或内部 step 类型。验收必须证明：删除 AI SDK checkpoint（实际上没有）和内部消息缓存后，仍能显示来源、当前理解、待审 proposal 与恢复下一 command。

---

## 5. LangGraph JS：第二选择，不是项目记忆层

### 5.1 源码事实

- [`StateGraph`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/langgraph-core/src/graph/state.ts#L404) 提供 graph 编排。
- [`BaseCheckpointSaver`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/checkpoint/src/base.ts#L113) 定义 `getTuple/list/put/putWrites/deleteThread`；[`SqliteSaver`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/checkpoint-sqlite/src/index.ts#L90) 是本地持久化实现；[`MemorySaver`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/checkpoint/src/memory.ts#L104) 只适合测试/短期内存。
- [`interrupt()`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/langgraph-core/src/interrupt.ts#L63) 借助 checkpointer 暂停；[`Command`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/langgraph-core/src/constants.ts#L540) 携带 `resume/update/goto`。
- [`ToolNode`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/langgraph-core/src/prebuilt/tool_node.ts#L210) 调用工具并将普通错误转成 `ToolMessage`，但产品仍需在节点外做授权与 receipt。
- Pregel 层提供 [`getStateHistory`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/langgraph-core/src/pregel/index.ts#L1120)、[`bulkUpdateState`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/langgraph-core/src/pregel/index.ts#L1192) 和 [`updateState`](https://github.com/langchain-ai/langgraphjs/blob/3dccad1391e173eead64f9e2d6dd977fdc345f7d/libs/langgraph-core/src/pregel/index.ts#L1803)。

[官方 persistence 文档](https://docs.langchain.com/oss/javascript/langgraph/persistence)说明每个 super-step 形成 checkpoint，并支持 thread、pending writes 与 fault recovery。[interrupt 文档](https://docs.langchain.com/oss/javascript/langgraph/interrupts)明确指出：resume 后节点从头重新执行；interrupt 前副作用必须幂等或移到独立节点。[time-travel 文档](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel)也明确未来节点会重新执行，包括 LLM、API、tool 和 interrupt。

### 5.2 对当前产品的真实含义

优点：

- 人工停点与分支是第一等概念；
- checkpoint/history 可用于一次 Agent run 的诊断和恢复；
- 单 Node/本地进程能运行；相较 Temporal 运维轻。

风险：

- 它没有本地 source watcher/event ingestion；来源事件仍由产品入队并用 `thread_id` 调 graph。
- LangGraph 的 “replay/time travel” 会重做节点，不等于 D-40 append-only product event replay。把 tool/LLM 放错节点会重复副作用。
- checkpoint 很容易膨胀成第二套项目记忆。graph state 必须只保存 `projectId/matterId/runId/revisionIds/proposalIds` 与控制游标。
- SQLite saver 依赖 native `better-sqlite3`，本地桌面 Node 可接受，但 Next 打包、跨平台分发、serverless 与共享多进程都需 spike；生产还要比较 Postgres saver。

### 5.3 允许的采用 slice 与退出边界

若它胜出，只允许采用：`StateGraph + checkpointer + interrupt/Command`。source ingestion、product state、tools、policy、audit 与 memory schema 全部继续在 graph 外。

退出测试：导出一个 `AnalysisRun` 的产品 events，删除 LangGraph checkpoint DB，用另一个 runner 从产品状态生成同一下一 command；已接受理解、待审 proposal、Owner receipt 和 tool receipt 必须零损失。做不到即表明边界失败。

---

## 6. Temporal TS：语义最强，当前运维不匹配

### 6.1 源码事实

- workflow 代码通过 [`proxyActivities`](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/packages/workflow/src/workflow.ts#L664) 调非确定的模型、网络和工具 Activity；这些调用不能直接发生在 deterministic workflow code 中。
- [`defineSignal`](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/packages/workflow/src/workflow.ts#L1274)、[`setHandler`](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/packages/workflow/src/workflow.ts#L1307) 与 [`condition`](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/packages/workflow/src/workflow.ts#L1190) 能表达 Owner resume。
- [`WorkflowClient.signalWithStart`](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/packages/client/src/workflow-client.ts#L610) 能把来源事件发给已有 workflow，或原子地启动新 workflow，是五个候选中最完整的事件触发原语。
- [`Worker.runReplayHistory`](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/packages/worker/src/worker.ts#L603) 可对历史运行 workflow code，发现 determinism violation。
- [`TestWorkflowEnvironment`](https://github.com/temporalio/sdk-typescript/blob/ae823d7f9dd513f3b90aeba8c66854c59c39a359/packages/testing/src/testing-workflow-environment.ts#L54) 支持 local 与 time-skipping 测试环境。

官方 TS 指南分别覆盖 [workflow/activity](https://docs.temporal.io/develop/typescript)、[message passing](https://docs.temporal.io/develop/typescript/message-passing)、[测试](https://docs.temporal.io/develop/typescript/testing-suite) 与 [replay debugging](https://docs.temporal.io/develop/typescript/debugging)。

### 6.2 若采用，正确模型是什么

- 每个项目/事项可有长寿命 workflow，或每个 `AnalysisRun` 一个 workflow；来源变更通过 `signalWithStart`。
- workflow 只存 IDs、phase 和等待条件；source body、项目记忆和 proposal 在产品 DB。
- 模型调用、检索与工具执行都是 Activity；Owner approval 是带 actor/expected revision 的 Signal，经产品 API 先鉴权。
- workflow history 可能包含 Activity 输入/结果，必须只放 refs 或使用 payload codec/redaction；它不能直接充当产品审计。

### 6.3 为什么现在不选

- 需要独立 Temporal Server、持久存储、namespace、worker、task queue、版本部署与监控；Next 只能是 client/control surface，不能把长期 worker 塞进短命 route。
- 本地 companion 分发要多一个服务生命周期；故障面和 onboarding 显著增加。
- Temporal 的确定 replay 解决的是 workflow orchestration code，不会让 LLM 本身确定；模型/工具结果靠历史 Activity event 固定。
- 当前确认需求没有证明多 worker、跨多日 timer、复杂 compensation 或部署期间运行数万长流程。为未证实规模付出运维成本违背当前最小边界。

### 6.4 重新评估的硬触发器

满足任一项才打开 Temporal spike：

1. 一个 Owner 停点必须可靠存活多日/多次部署，并同时管理多个 timer 或外部 callback；
2. 至少两个并发 worker 必须竞争同一队列且需要平台级 lease/retry；
3. 真实事故表明产品状态机的 crash window 无法用 transaction/outbox/idempotency 修复；
4. 法规/运营要求用 workflow history 做部署兼容 replay，并接受额外服务成本。

---

## 7. OpenAI Agents SDK JS：可恢复 HITL，但版本/状态耦合偏大

### 7.1 源码事实

- [`Runner`](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/packages/agents-core/src/run.ts#L413) 执行 Agent loop；其 [constructor defaults](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/packages/agents-core/src/run.ts#L437) 默认开启 tracing，且默认 `traceIncludeSensitiveData: true`。本产品若 spike，必须显式禁用 tracing 或关闭 sensitive data，并让产品审计单独负责。
- [`RunState`](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/packages/agents-core/src/runState.ts#L476) 提供 interruptions、approve/reject；[`toString/fromString`](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/packages/agents-core/src/runState.ts#L1003) 可把等待中的 run 跨进程序列化和恢复。
- [`Session`](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/packages/agents-core/src/memory/session.ts#L27) 是 conversation history 接口；[`MemorySession`](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/packages/agents-core/src/memory/memorySession.ts#L20) 明确是内存实现，不适合生产。
- 公共 [`Model`](https://github.com/openai/openai-agents-js/blob/4e1f842f63673db59018a7fa4a441c64c274caf2/packages/agents-core/src/model.ts#L602) interface 可注入测试 double；仓库的 `FakeModel` 是内部 test stub，不是承诺的公共测试 API。

[HITL 指南](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/)展示 serialize/restore `RunState`，同时提醒长期 pending state 要处理应用/Agent 版本，必要时并行保留旧 package 版本。[sessions 指南](https://openai.github.io/openai-agents-js/guides/sessions/)说明 session 是运行间 conversation history，不是 event scheduler 或项目 truth store。[tracing 指南](https://openai.github.io/openai-agents-js/guides/tracing/)说明可关闭 tracing 或敏感数据采集。

### 7.2 判断

它比 AI SDK 提供更完整的 agent/HITL run abstraction，但这也让持久恢复更直接耦合 `RunState` 序列化格式、Agent 定义和 pre-1.0 包版本。它没有来源事件 listener/queue；任意 crash window、幂等与产品 replay 仍需应用实现。对当前需求，这些额外抽象没有减少产品必须拥有的核心代码，却扩大了替换面。

若未来只做 OpenAI-first、多 Agent handoff 且愿意接受其 tracing/run-state 模型，可以重评；当前不作为主 Agent 核心 runtime。

---

## 8. Mastra：已筛查的成熟 OSS 挑战者，未证明更优

Mastra 是本次额外源码筛查的“是否存在明显更优一体化 OSS”候选。

### 8.1 源码事实

- [`createWorkflow`](https://github.com/mastra-ai/mastra/blob/dfaf448cebd7614a78bcb2df8510dbb59a4f81ff/packages/core/src/workflows/create.ts#L26)、[`Workflow`](https://github.com/mastra-ai/mastra/blob/dfaf448cebd7614a78bcb2df8510dbb59a4f81ff/packages/core/src/workflows/workflow.ts#L1544) 与 [`Run.resume`](https://github.com/mastra-ai/mastra/blob/dfaf448cebd7614a78bcb2df8510dbb59a4f81ff/packages/core/src/workflows/workflow.ts#L3883) 提供 snapshot、suspend/resume 与 workflow DSL。
- [`ExecutionEngine`](https://github.com/mastra-ai/mastra/blob/dfaf448cebd7614a78bcb2df8510dbb59a4f81ff/packages/core/src/workflows/execution-engine.ts#L59) 是可替换引擎 seam。
- 但默认 [`DefaultExecutionEngine.wrapDurableOperation`](https://github.com/mastra-ai/mastra/blob/dfaf448cebd7614a78bcb2df8510dbb59a4f81ff/packages/core/src/workflows/default.ts#L165) 直接执行 callback，默认 sleep 也是进程内 timer；因此默认引擎的 snapshot/resume 不等于 Temporal 的 durable operation/event-history replay。

[workflow snapshot 说明](https://mastra.ai/blog/mastra-workflows-enhanced)支持持久化 workflow state；Mastra 自己的 [Temporal workflows 介绍](https://mastra.ai/blog/introducing-temporal-workflows)把可跨 worker restart、外部 API 和 durable timer 的工作交给 Temporal 集成。这实际上说明：若当前需求真的需要 Temporal 语义，叠加 Mastra 不会减少 Temporal 运维，只会再加一层 framework ownership。

### 8.2 判断

Mastra 有完整 Agent/workflow/storage/memory surface，但当前 `@mastra/core` 隔离安装已达 231 个唯一 package 版本，并同时解析多个 AI SDK provider 世代。它与本产品自有 memory/workflow/audit 的边界重叠最多；默认执行引擎又没有比推荐方案更强的故障语义。故它不是“明显更优”的成熟 OSS 基础，不进入首轮 spike。

---

## 9. 审计：记录可复核的决策输入/输出，不记录 chain-of-thought

框架 trace、完整 prompt transcript 或 provider raw response 都不能直接成为产品审计。建议产品自有 append-only `AgentRunEvent` / receipt 记录以下内容：

### 9.1 记录

**输入 provenance**

- `projectId/matterId/runId/attemptId/triggerId`；
- source grant 与精确 source revision IDs、hash、locator；
- 接受中的 current-understanding revision ID；
- 触发原因、watch match reason、检索 scope 与授权 decision；
- prompt spec ID + version/hash，tool catalog/policy version；
- model/provider identifier、可影响结果的参数、step/token budget。

**输出与动作 receipt**

- 有 schema 的 finding/proposal/unknown/evidence refs；
- 工具意图、规范化参数的 redacted form/hash；
- Owner decision actor、时间、expected revision、批准范围；
- 工具 status、output locator/hash、错误分类、idempotency key；
- model finish reason、usage、latency、重试/取消关系；
- proposal/understanding revision IDs 与验证结果。

### 9.2 不记录

- hidden reasoning token、private chain-of-thought、provider `thinking` 原文；
- secret、未授权来源 metadata/content；
- 可以由 revision ref 取回的整份原始材料副本；
- 未 redacted 的任意框架 trace；
- 把模型自述的“推理过程”当作事实或 Owner decision。

模型可以输出给 Owner 阅读的**简短、结构化解释**：结论、依据 refs、未知、冲突、为什么建议下一步。这是受 schema/证据约束的产品输出，不是 hidden chain-of-thought。若 provider 返回 reasoning summary，也只能作为候选说明，按普通模型输出处理。

框架 telemetry 若保留，只能通过 `runId/attemptId` 关联、有限留存、默认敏感字段关闭；删除 telemetry 后产品审计必须完整。

---

## 10. 隔离、可证伪 spike 方案（提案，未执行）

### 10.1 范围与结构

在获得单独授权后，创建不连接真实项目数据、不写生产 schema 的 `tmp/agent-runtime-spike/`：

```text
fixtures/                  # 固定授权/source/model/tool/Owner events
product-core/              # 纯 reducer、ports、audit schema、hash assertions
adapters/ai-sdk/           # 推荐 arm
adapters/langgraph/        # 第二 arm；独立 checkpoint
tests/contract/            # 两个 adapter 跑同一套契约
results/                   # 命令、版本、失败、指标；不是采用决策
```

首轮只比较 **AI SDK + 产品状态机** 与 **LangGraph**。Temporal 只在 §6.4 任一硬触发器已由真实场景证明后开第三 arm。OpenAI Agents/Mastra 不进入首轮，因为源码比较尚未显示它们能消除任何产品必需能力。

### 10.2 共享 fixture / contract

两 arm 必须通过完全相同的测试，且所有模型/工具结果由固定 fixture 提供：

1. **授权与去重**：同一 authorized source event 投递两次，只生成一个 run/proposal；unauthorized/revoked event 不生成 run，也不泄露 metadata。
2. **统一触发**：source change 与 Owner question 都形成同一 `AgentTrigger → AnalysisRun` 管道，只在 input kind 上不同。
3. **模型 crash window**：`ModelOutcomeRecorded` 后、`ProposalRecorded` 前杀进程；恢复后只产生一个 proposal，模型不重调。
4. **工具 exactly-once effect**：工具完成后、receipt commit 响应前杀进程；重启以 idempotency key 查询/恢复，外部效果不重复。
5. **Owner pause**：进入 `awaiting_owner` 后停止全部进程；重启后非 Owner/stale expected revision 被拒绝，正确 Owner approval 只恢复一次。
6. **等待期间新变化**：待审时收到新 source revision；旧 proposal 标 stale 或新建 queued run，绝不静默覆盖 current understanding。
7. **retry/cancel/budget**：模型 timeout、tool failure、step budget、Owner cancel 都产生确定 phase 与可复核 attempt relation。
8. **确定 product replay**：只重放 product events + recorded model/tool outcomes，live model/tool invocation count 必须为 0，最终 state/hash 完全一致。
9. **无 CoT**：audit schema snapshot 拒绝 `reasoning`、`thinking`、raw provider response 与 secret；保留 revision refs、prompt hash、tool receipt、structured outcome。
10. **框架删除/替换**：删除 adapter 私有 state/checkpoint，用 product events 恢复下一 command；已接受理解、待审 proposal 与 receipts 不丢失。

### 10.3 观测指标

- 每 arm 的额外进程/服务/DB/native addon；
- lockfile 唯一 package 数、安装体积、冷启动、一次 mock run 延迟；
- adapter 私有持久字段数与字节数；
- product-core 外的框架专属代码/迁移数量；
- 每个 crash point 的重复 model/tool 调用计数；
- 同 fixtures 运行 100 次后的 state/audit hash；
- 从零删除框架 state 到可恢复下一 command 的时间与人工步骤。

性能只作二级指标；任何权限、幂等、Owner actor、replay、CoT 或退出边界失败都是硬失败。

### 10.4 可证伪规则

**AI SDK + 产品状态机被否决，如果：**

- 任一 crash fixture 产生重复副作用、重复 proposal 或无法判断下一 command；
- 为表达已确认的一个真实流程，必须把 product truth 复制到 SDK message/内部 state；
- Owner pause 需要保持请求/进程存活；
- 纯 reducer 无法在不调用模型/工具时得到稳定 state hash。

**LangGraph 被否决，如果：**

- `interrupt` 节点重跑导致 tool/model 重复，且拆节点/幂等仍不能消除；
- 删除 checkpoint 后产品 events 无法恢复；
- graph state 开始承载 source body/current understanding/proposal 唯一副本；
- native SQLite/Next 打包或 checkpoint migration 成为首版必须承担的新平台工作。

**LangGraph 胜出，只在同时满足：**

- 两 arm 都通过全部硬测试；
- 至少一个已确认、非假设的嵌套/并发 pause 或 fan-out 场景，在 LangGraph 中显著降低状态转移与恢复歧义；
- 该收益不要求扩大 framework-owned truth，且 checkpoint 可丢弃。

**Temporal 晋级，只在：** §6.4 的真实触发器成立，且三 arm 的故障注入证明它以可接受的独立 Server/worker 成本消除了产品状态机无法安全关闭的缺口。

### 10.5 spike 输出

输出只能是一份 adoption decision record 候选，包含：固定 versions/commits、lockfile/SBOM、测试命令/原始结果、所有失败、运维拓扑、退出演练和剩余未知。未获得新的 Owner/Lead 实现授权前，不把 spike adapter、schema 或 runtime 合并进产品。

---

## 11. 最终推荐的可撤销边界

```text
authorized source event / Owner question
                 │
                 ▼
     product trigger + idempotent claim
                 │
                 ▼
       product AnalysisRun reducer
          │                 ▲
          │ refs            │ structured outcome / receipt
          ▼                 │
       AgentModelLoop port ─┘
        (AI SDK adapter)
          │
          ├─ local ProductToolGateway ── policy / Owner stop / receipt
          └─ model provider

product truth: originals + change events + understanding revisions
framework-private state: disposable execution detail only
```

推荐不是“手写所有 agent 能力”，而是把真正属于产品的 durable state、policy 与 truth 保持显式，把可替换的模型/tool-loop 交给小型 OSS slice。当前 AI SDK 最符合这条切分；LangGraph 是复杂控制流被真实证明后的升级；Temporal 是 durable orchestration 需求被真实证明后的升级。三者都不得成为项目记忆本身。
