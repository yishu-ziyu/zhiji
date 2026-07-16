# Project-state Agent：架构与模型一手源合成

- **日期:** 2026-07-16  
- **席位:** G1 · surface:63  
- **Assign:** `.ship/handoffs/ASSIGN-G1-project-state-agent-architecture-research.md`  
- **状态:** 研究合成 · **非** 采用决定 · **非** 产品改码授权  
- **权威边界:** D-48 栈阶段已定（node:sqlite + FS CAS + watcher + reducer + 现有 ports；本波不引 LangGraph/Mastra/Temporal；AI SDK 后置）；D-49 研究结论交 G2  
- **单路径:** 本文件为唯一合成物；G5 live-path audit 并入 §5

---

## 0. 问题与结论（可转产品/工程判断）

**项目状态 Agent 要稳，关键不是「选哪个最大 context 模型」，而是把「模型能干什么」和「产品运行时拥有什么」拆开：模型只负责有界推理与候选 JSON；授权来源、CAS 修订、事项过滤、候选落库、Owner 决议必须留在产品端口之后。**

可直接用的判断：

1. **模型层（capability）**  
   主流商用模型在官方文档上均声明：function/tool calling、结构化/JSON schema 输出、长上下文、多语言。  
   窗口大小是 **vendor 规格**，不是 grounding 质量证明。  
   中文能力目前只有「multilingual」级官方声明，**没有** 本仓可用的一手中文 grounding 基准。  
   本产品真正需要的是：**工具读授权修订 + 强制 schema 的六问 JSON + 拒绝无锚点 `supported`**，不是裸堆 token。

2. **编排层（orchestration）**  
   稳定形状与既有研究一致：**产品显式状态机 / reducer 拥有真相**；模型环只通过可替换 `AgentModelLoop`。  
   AI SDK `ToolLoopAgent`、LangGraph、Temporal 等都最多做 **port 内** 的 tool/step 循环；**不得** 持有 grant/event/understanding。  
   D-48 已冻结：MVP **不** 引入新编排框架；AI SDK **后置**。

3. **当前运行时（G5 @ `3b6c33a1`）**  
   已有完整观测→分析→候选路径，但模型输入是 **事件元数据 + 已接受理解体 + 可选 quote 字符串**，**没有** 原始 CAS 字节、**没有** tool loop、**没有** 原生 structured-output API。  
   缺口分模型侧与编排侧，见 §5–§6。

**未采用赢家。** Owner/Lead 仍需对：是否在 `AgentModelLoop` 内引入 tool loop、是否升级 adapter 到 schema-enforced structured output、默认模型/网关是否从 `step-3.7-flash` 迁移，做产品决策。

---

## 1. 方法与证据等级

| 来源类型 | 用途 | 等级 |
|---|---|---|
| 官方模型页 / tool / structured-output 文档（2026-07-16 抓取） | 能力声明、API 形状 | **A** vendor primary |
| 本仓 tip `3b6c33a1` 代码 + G5 live-path audit | 当前 runtime 事实 | **A** code-observed |
| 既有仓内一手比较 `2026-07-16-main-agent-runtime-architecture.md`（SDK pin / 许可扫描） | 编排候选与退出边界 | **A/B** prior primary (same-day repo) |
| D-48 / MVP PRD 合同 | 阶段约束 | **A** product authority |
| Vendor 营销句（“minimal hallucinations” 等） | 仅标注，不入决策 | **C** claim |

约束：

- 不把 context window 当架构质量。  
- 不调用模型、不改产品代码、不推荐未钉版本的「采用」。  
- 中文质量：无独立公开一手 benchmark 写入本报告 → 标 **MISSING**。  
- 默认 `LLM_MODEL=step-3.7-flash`：仅代码默认；阶跃官方模型页本次抓取 404 → 能力矩阵中标 **gateway-local / thin primary**。

官方 URL 钉（抓取日 2026-07-16）：

| 主题 | URL |
|---|---|
| Anthropic models | https://platform.claude.com/docs/en/about-claude/models/overview |
| Anthropic tool use | https://platform.claude.com/docs/en/build-with-claude/tool-use/overview |
| Anthropic structured outputs | https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| OpenAI models | https://platform.openai.com/docs/models |
| xAI models | https://docs.x.ai/docs/models （跳转 developers/models） |
| xAI function calling | https://docs.x.ai/developers/tools/function-calling |
| xAI structured outputs | https://docs.x.ai/developers/model-capabilities/text/structured-outputs |
| Gemini long context | https://ai.google.dev/gemini-api/docs/long-context |
| Gemini function calling | https://ai.google.dev/gemini-api/docs/function-calling |
| Gemini structured output | https://ai.google.dev/gemini-api/docs/structured-output |
| AI SDK agents | https://ai-sdk.dev/docs/agents/overview |
| G5 audit | `.ship/research/grok-followups/G5-agent-runtime-live-path-audit.md` |

---

## 2. 产品需求映射（project-state Agent）

来自 MVP 合同 / D-39–D-43 / 六问重建（now/then/changed/why/depends/evidence）：

| 需求 | 属于 | 成功形状 |
|---|---|---|
| 只读 Owner 授权项目来源 | 编排（grant/watch） | 越权路径拒绝；模型不得见未授权字节 |
| 跨长代码/文档/历史推理 | 模型 + 编排检索 | 输入是 revision-pinned 摘录/工具结果，不是整仓盲塞 |
| 结构化、有来源的当前理解 / unknown / conflict | 模型 schema + 产品校验 | `supported` 必须 revisionId+path+quote+lastVerifiedAt |
| 中文交互与候选文案 | 模型 multilingual + 产品文案 | UI/候选可中文；证据 quote 保持原文 |
| 可替换模型缝 | 编排 port | 换 provider 不改 grant/event/understanding schema |

---

## 3. 模型能力比较（与编排拆开）

### 3.1 维度说明

| 维度 | 产品含义 | 不意味着 |
|---|---|---|
| **Tool calling** | 模型可发出 schema 化工具请求，由**本地**执行 `read_revision` / `list_events` 等 | 可信任 provider-hosted 副作用工具代替产品 policy |
| **Long context** | 单次可装更多材料 | 自动 grounding、自动不丢中段事实 |
| **Structured / grounded** | API 强制 JSON schema；产品再做 revision 白名单与 quote 校验 | 只要 JSON 就等于有来源 |
| **Chinese** | 指令/输出可用中文 | 已通过中文代码/文档引用评测 |
| **Replaceable seam 友好** | 走标准 messages + tools + response_format，少绑定专有 agent runtime | 专有 server-side agent 循环不可替换 |

### 3.2 官方规格快照（vendor claim · 2026-07-16）

| 家族 / 代表 ID | Context（官方） | Tools | Structured output | Multilingual/中文 | 备注 |
|---|---|---|---|---|---|
| **Claude** Sonnet 5 / Opus 4.8 / Fable 5 | **1M** tokens；Haiku 4.5 **200k** | Client + server tools；`tool_use` 往返 | GA structured outputs（JSON format + tool schema 校验） | 官方写 multilingual | 适合 agentic coding / 企业；extended/adaptive thinking 因型号而异 |
| **OpenAI** GPT-5.6 Sol/Terra/Luna | **1.05M** context；max output 128k | Functions, web/file search, computer use（型号页） | 官方 structured output 指南（产品栈常用） | 官方 multilingual | 工具面最广；注意 provider tools 与产品 policy 边界 |
| **Gemini** 3.x / 2.x 长上下文线 | **1M+**（long-context 文档） | Function calling；可与 structured 组合 | JSON Schema structured outputs | 多语言用例在 long-context 文中强调 in-context learning | 社区记录 tools+strict schema 偶发循环（论坛，非 A 级）→ 工程上宜 tool 阶段与 final schema 阶段分离 |
| **Grok** 4.5 | **500k** | Client function calling + server agentic tools | Structured outputs；tool args 默认 strict | 未在模型页单独钉中文评测 | Knowledge cutoff 2026-02-01；实时事件需 search tools |
| **本仓默认** `step-3.7-flash` via Anthropic-shaped gateway | **未知（官方页 404）** | **adapter 未传 tools** | **仅 prompt 要 JSON + `extractJson`** | 候选中文文案已在确定性路径使用 | 当前 live path 实际模型；能力未钉一手卡 |

### 3.3 对 project-state 任务的含义

| 任务 | 模型侧需要 | 编排侧必须补 |
|---|---|---|
| 读授权源 | tool 调用或预置摘录 | grant 边界、revision pin、红acted 路径 |
| 长历史 | 大窗口 **或** 分轮摘要 | 产品只塞 matter-relevant events + accepted body，禁止「最近 20 条全局」 |
| 六问 JSON | structured output 或强 schema tool | `sanitizeModelBody` + `verifySupportedWhyAgainstRevisions` |
| 中文 Owner 文案 | multilingual | 产品固定中文 `nextDecision` / fallback 标记 |
| 换模 | 标准 API | `AgentModelLoop` / `complete` 注入点；禁止 SDK 类型泄漏进 UnderstandingBody |

**稳定高质量选项（模型层，非采用决定）：**

1. **Schema-first 主路径**  
   任一支持 structured outputs 的 frontier 模型（Claude Sonnet/Opus 线、GPT-5.6 线、Gemini 3 线、Grok 4.5）+ 产品 UnderstandingBody schema。  
   优先度：schema 强制 > 窗口大小。

2. **Tool-grounded 主路径**  
   同一模型族 + **本地** tools：`get_revision_excerpt`、`list_matter_events`、`get_accepted_body`（只返回 pin 结果）。  
   Provider server tools（web search 等）默认 **关闭** 于 project-state 分析（除非 Owner 另授权外部源）。

3. **本地/网关兼容路径**  
   保持 Anthropic Messages 形状的 `LLM_BASE_URL`，便于 step 网关与 Claude 兼容后端切换。  
   代价：当前实现未用 tools/structured API，可靠性靠 prompt + 后置校验。

---

## 4. 编排 / 运行时比较（与模型拆开）

### 4.1 不可谈判的产品所有权

| 产品拥有 | 框架最多拥有 |
|---|---|
| grant、watch、CAS revision、change event | 单次 run 的 step 游标 |
| accepted/candidate understanding、Owner resolution | 可删的 checkpoint / 消息缓存 |
| AnalysisRun 状态与幂等 | 模型/工具调度细节 |
| 工具权限与 receipt | telemetry |

删除任何框架 checkpoint 后，仍须从产品 SQLite+CAS 恢复当前理解与待审候选。

### 4.2 候选（保留替代，无赢家）

| 选项 | 角色 | 与 D-48 / 可替换缝 | 风险 |
|---|---|---|---|
| **现状：产品 reducer + 单次 `complete` + sanitize** | MVP 已上线路径 | 完全兼容；缝已在 `AgentModelLoop` | 无 tool loop；模型不见 CAS 字节 |
| **产品状态机 + Vercel AI SDK ToolLoopAgent（后置）** | 仅实现 `AgentModelLoop` 内有界 loop | D-48 允许后置；退出时只重写 adapter | 默认 step 上限需产品收紧；勿当记忆层 |
| **LangGraph JS** | 条件第二：复杂分支/interrupt | D-48 **本波不引**；checkpoint 易变第二记忆 | replay ≠ 产品 event replay |
| **Temporal** | 跨日 durable worker | D-48 **本波不引**；运维重 | 与本地 Next 单 writer 不匹配 |
| **OpenAI Agents SDK / Mastra** | 第三方 agent runtime | 依赖面大；RunState/workflow 易吞所有权 | 不作为核心 |

既有仓内源码级 pin（见 `docs/research/2026-07-16-main-agent-runtime-architecture.md`）：`ai@7.0.29`、LangGraph JS `1.4.8`、Temporal TS `1.20.3` 等。**本波不刷新采用。**

### 4.3 可替换 `AgentModelLoop` 缝（合同）

```ts
// 产品合同（MVP PRD）— 框架类型不得泄漏
interface AgentModelLoop {
  propose(input: MatterStateReconstructionInput): Promise<UnderstandingBody>;
}
```

扩展（研究建议形状，**未实现 / 未 freeze**）：

```ts
// 仍在同一 port 内；产品事件在 port 外提交
type AgentLoopOutcome =
  | { kind: "body"; body: UnderstandingBody; providerTraceId?: string }
  | { kind: "fallback"; body: UnderstandingBody; reason: "provider_error" | "schema" | "timeout" }
  | { kind: "tool_budget_exhausted"; partial: UnderstandingBody };
```

替换验收：换 provider 后 UnderstandingBody schema、grant/event 表、Owner resolve 路径零迁移；仅 adapter 文件变化。

---

## 5. 当前运行时现实（并入 G5 DONE）

**证据:** `.ship/research/grok-followups/G5-agent-runtime-live-path-audit.md`  
**Tip:** `3b6c33a1` · treehouse slot16

### 5.1 实路径

```text
grant authorize
  → observer reconcile / @parcel/watcher
  → CAS put + SQLite revision/event
  → MatterWatchSet / matched eventIds
  → POST .../analysis-runs
  → createAgentModelLoop (default mode=model)
  → single shared/llm.complete  (/v1/messages)
  → sanitize + verifySupportedWhyAgainstRevisions
  → saveCandidate → awaiting_owner
```

### 5.2 模型实际看见什么

| 内容 | 是否进入模型 | 证据 |
|---|---|---|
| 事件元数据 + revision id + path | 是 | `buildModelPrompt` JSON.stringify(events) |
| accepted UnderstandingBody | 是 | accepted.body |
| raw CAS 文件字节 / 自动摘录 | **否** | 无 propose 前 `readRevision` |
| tool 调用 | **否** | adapter body 仅 model/max_tokens/messages |
| whySourceQuotes | 仅当客户端传 | MVP UI 通常不传 → snippets `[]` |
| open candidate | **否** | 仅 accepted |

### 5.3 Provider 配置（无密钥）

| Env | 默认 |
|---|---|
| `LLM_BASE_URL` | `http://127.0.0.1:15721` |
| `LLM_API_KEY` / `ANTHROPIC_AUTH_TOKEN` | 必需 |
| `LLM_MODEL` | `step-3.7-flash` |
| `AGENT_RUN_MODE` | analysis-runs：仅 `"deterministic"` 强制模板；否则 model |

### 5.4 Fallback 可见性

- `propose` **吞掉** provider 错误 → 确定性 body + 中文「模型不可用…」  
- `AnalysisRun.error` **通常为空**  
- **无** `run.mode=fallback` 一类一等字段  

### 5.5 已扎实 vs 缺口

**已扎实 [O]:** 单例 store；能力切分（Agent 无 OwnerDecisionWriter）；CAS-before-SQL；事项过滤；后置 quote/path 校验；model-first。

**模型侧缺口:** 无 CAS 内容进 prompt；无 revision 读取 tool；structured 仅靠 prompt+extractJson。  
**编排侧缺口:** fallback 非一等；UI 不传摘录；watch 理由不进 prompt；legacy `agent-run` 与 analysis-runs 的 `AGENT_RUN_MODE` 极性相反。

---

## 6. 复用 vs 缺失缝（给 G2 派工用）

| 能力 | 现状 | 缺口类型 | 建议下一动作（非本报告执行） |
|---|---|---|---|
| `AgentModelLoop` port | 有，可注入 `complete` | 无 multi-step / tools | 产品决定是否扩展 outcome 类型 |
| `shared/llm.adapter` | 单次 messages | 无 tools、无 response_format | 后置：tools + structured；保持 Anthropic 兼容或 adapter 分叉 |
| 确定性 fallback | 有 | 可观测性弱 | 在 AnalysisRun 记 `providerStatus` |
| CAS + verify why | 有 | 校验在模型之后 | tool 读摘录可前移 grounding |
| AI SDK / LangGraph | 未引入 | D-48 后置/拒绝 | 仅当 Owner 明确要 tool loop 时做隔离 spike |
| 中文评测 | 无 | 证据缺失 | Owner 场景夹具：中文六问 + 中文代码注释引用 |

---

## 7. 选项组合（保留替代）

| 组合 | 模型 | 编排 | 何时合理 | 何时否 |
|---|---|---|---|---|
| **A. MVP 保持** | 网关 `step-3.7-flash` 或任意 messages 兼容模 | 单次 complete + sanitize | Owner 先验收行为；改动面最小 | 需要自动读文件内容 / 多步检索 |
| **B. Schema 升级** | Claude / GPT / Gemini / Grok + structured outputs | 仍单次 propose | 先降 JSON 解析失败 | 仍无 CAS 字节则 grounding 有限 |
| **C. Tool-grounded** | 同上 + client tools | 产品 tool gateway 在 port 内；budget 小（如 ≤5） | 要 source-grounded why | 未先定 tool 白名单与 receipt |
| **D. AI SDK loop 后置** | 任意 AI SDK provider | ToolLoopAgent **只** 填 `AgentModelLoop` | 需要标准 step/tool 循环与 mock | 把 AI SDK 当记忆/工作流引擎 |
| **E. 重编排框架** | 任意 | LangGraph/Temporal | 出现跨日多 worker 硬需求 | MVP / D-48 阶段 |

**推荐叙述（研究意见，非 FINAL）:**  
短期走 **A→B**（不破坏 D-48）；若 Owner 明确要求「依据必须来自文件正文」再 **C**；**D** 仅作为 C 的实现便利且保持后置；**E** 拒绝作为项目记忆核心。

---

## 8. 仍需 Owner / Lead 的决策

1. project-state 分析是否允许模型 **tool 读取** 授权 revision 摘录（默认否 → 保持预置 snippets）。  
2. 默认模型是否离开 `step-3.7-flash` 网关；若换，是否锁定 Claude / OpenAI / Gemini / Grok 之一。  
3. 结构化输出是 **API schema 强制** 还是继续 **prompt + extractJson + sanitize**。  
4. fallback 是否必须在 UI 以一等状态展示（而非埋在中文句子里）。  
5. AI SDK 引入窗口是否打开（D-48 当前 = 后置）。

G1 **不能** 自标 D-* FINAL。

---

## 9. 缺失证据清单

| ID | 缺失 | 影响 | 关闭方式 |
|---|---|---|---|
| M1 | step-3.7-flash 官方能力卡 | 默认模型不可比 | 阶跃官方文档或 gateway 映射表 |
| M2 | 中文 grounding 一手评测 | 无法比较各模中文引用质量 | Owner 夹具 + 盲测 |
| M3 | live 网关成功率/延迟 | 运行时可靠性未知 | G5/G6 授权探测（本 assign 禁模型调用） |
| M4 | tools+structured 同请求在目标网关的兼容性 | 影响组合 C/B | 隔离 spike（非本波） |

---

## 10. 源索引

### 仓内

- G5: `.ship/research/grok-followups/G5-agent-runtime-live-path-audit.md`  
- G5 DONE: `.ship/handoffs/G5-agent-runtime-live-path-audit-DONE.md`  
- 编排先验: `docs/research/2026-07-16-main-agent-runtime-architecture.md`  
- 栈冻结: `docs/research/2026-07-16-tech-stack-code-grounded-selection.md`（D-48）  
- 合同: `docs/product/MVP_V0_PRD_AND_EXECUTION.md` § AgentModelLoop  
- 代码 tip `3b6c33a1`:  
  `shared/project-memory/agent-model-loop.ts`  
  `shared/llm/adapter.ts`  
  `shared/project-memory/reconstruct.ts`

### 外部一手（见 §1 URL 表）

本地抓取缓存（可复核，非权威）: `.firecrawl/g1-psa/`  

---

## 11. 变更记录

| 时间 | 内容 |
|---|---|
| 2026-07-16 | G1 初版：模型/编排拆分比较 + 并入 G5 live-path DONE；无采用决定 |
