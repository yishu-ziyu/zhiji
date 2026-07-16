# 本地 Coding Agent 调度与结果回收：真实集成面研究

日期：2026-07-16

范围：Codex CLI / App Server / SDK、Claude Code / Agent SDK、Grok Build CLI / ACP，以及当前仓库的 Agent Bridge、cmux、treehouse、firstmate。

模式：只读、未来集成证据。未登录账号、未创建凭据、未启动远端会话、未运行 Agent 任务、未修改产品代码。**外部 Coding Agent execution gateway 当前不属于产品核心，也不构成本文的采用或实施优先级建议。**

## 结论先行：保留证据，不建议当前采用

本研究确认：如果未来重新立项“由 Web 产品启动、监控并回收本机外部 Coding Agent 结果”，三个 vendor 都有真实接口，最完整的候选形态会是 **execution companion/launcher + vendor adapter + run ledger + 可选 hooks/outbox** 的 hybrid。

这不是当前产品方案。必须先把两个本机能力分开：

| 能力 | 目的 | 是否启动 Agent | 本报告立场 |
|---|---|---:|---|
| **A. Authorized source-observation companion** | 只观察 Owner 已授权项目目录/git 变化，形成 candidate change/evidence trace | 否 | 属于 D-37/D-38 的独立来源观察边界；见 [`2026-07-16-d37-local-companion-watchers-research.md`](2026-07-16-d37-local-companion-watchers-research.md) |
| **B. External coding-agent execution gateway** | 启动/恢复/审批/取消 Codex、Claude、Grok，并回收执行结果 | 是 | 当前非核心；本文只保存未来可行性、协议差异和安全门槛 |

A 不能因“也在本机运行”就扩权为 B；B 也不能借来源目录授权自动获得执行权限。两者需要不同的 Owner grant、进程权限、审计和退出开关。以下结论只适用于未来 B 的独立立项：

1. Web 产品本身不能可靠或安全地直接启动用户机器上的 CLI。一个用户明确安装、仅监听 loopback 的本机 companion 应负责：发现确切 CLI/版本、继承本机已有登录、分配 worktree、启动/恢复/取消进程、处理审批、持久化断线期间事件。
2. 富集成优先使用真正承载 Agent loop 的接口：

   - Codex：`codex app-server`（stdio）优先；简单一次性任务可用 SDK 或 `codex exec --json`。
   - Claude：Claude Agent SDK 优先；简单一次性任务可用 `claude -p --output-format stream-json`。
   - Grok Build：`grok agent stdio` 的 ACP 优先；简单一次性任务可用 `grok -p --output-format streaming-json`。

3. MCP 不能被当作统一 Agent 协议：Codex 的 `mcp-server` 暴露可继续对话的 Codex 工具；Claude 的 `mcp serve` 只暴露 View/Edit/LS 等工具、客户端自己承担逐工具确认；Grok 的 `grok mcp` 是 MCP **客户端**配置面，Grok 的 Agent 服务面是 ACP。
4. Hooks/callback 只能做补充 telemetry、唤醒和兼容回执，不能单独承担 launch、liveness、cancel、approval、worktree 或最终结果真相。尤其 Grok 明确规定 hook timeout/crash/malformed output 为 fail-open；Codex 也将 `PreToolUse` 定义为 guardrail 而非完整执行边界。
5. 当前 `agent-bridge.ts` 是可靠的、文件型 Q&A/grant primitive，不是 Agent runner。它没有 HTTP/UI、不会启动 Agent、不会跟踪进程或把结果写回产品。可以复用其 realpath confinement、hash/revision、stale、capability、幂等和锁纪律，但不应扩张成第二套 run truth。

若 B 将来获准，推荐的数据真相是：**execution run ledger 是任务/尝试/状态的唯一真相；vendor session/thread 是可恢复的执行句柄；Git/worktree/产物 hash 是结果证据；hooks 是旁路信号。** 它不得取代 A 的 `SourceRegistryEntry / AuthorizationReceipt / candidate source change` 真相。

## 1. 本机与仓库实证

### 1.1 已安装的真实执行面

| 产品 | 本机版本 | 已验证命令/能力 |
|---|---:|---|
| Codex | `codex-cli 0.144.4` | `exec` JSONL、JSON Schema、resume；SDK；`mcp-server`；`app-server` stdio/unix/ws；hook lifecycle |
| Claude Code | `2.1.204` | `-p` text/json/stream-json、JSON Schema、resume/fork/session-id、permission modes、`--worktree`、`--background`、`mcp serve` |
| Grok Build | `0.2.101 (5bc4b5dfadcf)` | `-p` JSON/streaming-json/JSON Schema、resume/fork、permission modes、`--worktree`；ACP stdio；loopback WebSocket agent server；leader/relay |
| cmux | `0.64.17 (97) [9ed29d81a]` | 终端/工作区编排和事件，不是跨 Agent 共享上下文或结果协议 |
| treehouse | `v2.0.0` | worktree lease/隔离；当前仓库可见多条 lease，不是 Agent 会话协议 |
| firstmate | 本机 commit `1811b8914c159b4a4f2e931c9358bb4369cb6cb5` | 基于终端 backend、worktree、watcher/hook 的多 Agent 监督；是有价值的运维参照，不是稳定 vendor API |

本机没有发现名为 `core` 的可执行文件，也没有发现可对应的 “Core” 应用。可以确定的是 Grok Build 已安装且拥有真实 Agent 协议。因而本文将用户口述的 “Core” 标为**未解析名称，可能是语音转写误差**；在没有产品名/二进制/官方文档前，不对它虚构集成能力。

### 1.2 当前产品 Agent Bridge 的真实边界

[`shared/knowledge/agent-bridge.ts`](../../shared/knowledge/agent-bridge.ts) 已提供：

- project → workspace realpath binding、递增 revision、轮换 capability；
- `pending → answered → delivered`，以及 `cancelled | expired | stale`；
- `sessionId / turnId / clientRequestId` 幂等键；
- Markdown 根目录约束、SHA-256 content pin、rebind/file drift stale；
- capability-protected agent read、delivery challenge/ACK、项目/请求锁及恢复。

但 repo-wide 搜索显示它只在模块与测试中使用，没有 `app/` import、HTTP route 或 UI；它不会启动进程、消费 Codex/Claude/Grok 事件、接管 approval，也不会形成统一 Agent outcome。现有审计也把它定性为 **request-protocol-only**：[`G3-D37-agent-bridge-source-audit.md`](../../.ship/research/grok-followups/G3-D37-agent-bridge-source-audit.md)。当前可见 Agent surface 的碎片与缺口见 [`G3-current-agent-surface.md`](../../.ship/research/grok-followups/G3-current-agent-surface.md)。

### 1.3 cmux / treehouse / firstmate 应处的位置

- cmux 适合作为可见终端 backend、发送/读取 pane、状态/通知承载；它不合并 Agent 的 session brain。仓库自己的 [`TEAM_CMUX.md`](../product/TEAM_CMUX.md) 也把 durable handoff 放在文件中。
- treehouse 适合统一发放/回收 worktree lease，防止并行 Agent 写同一 checkout；它不描述 prompt、approval、result 或 session resume。
- firstmate 已经证明不同 harness 需要不同 supervision 策略：Claude/Grok 可借助 tracked background wake，Codex 使用 bounded foreground checkpoint。这个差异反而说明未来 B 不应以屏幕抓取或单一 watcher 假装通用协议。若 B 被重新批准，firstmate 才可作为可选 launcher/backend 或运维参考，且执行 API 仍应落在 vendor 官方协议和独立 run ledger 上。

## 2. Vendor 能力矩阵

| 维度 | Codex | Claude Code | Grok Build |
|---|---|---|---|
| 简单 headless | `codex exec` | `claude -p` | `grok -p` |
| 流式机器输出 | `--json` JSONL：thread/turn/item/error | `--output-format stream-json`，可含 partial/hook events | `--output-format streaming-json` |
| 结构化终值 | `--output-schema FILE` + `-o FILE` | `--json-schema`；SDK result/structured output | `--json-schema`，隐含 JSON output |
| 富 Agent 接口 | App Server JSONL/stdio；Codex SDK | Claude Agent SDK async message stream | ACP JSON-RPC/stdio；另有 loopback WS server |
| 会话连续性 | thread/session ID；exec/app-server/SDK resume；fork | session ID；resume/continue/fork；SDK `resume`/`forkSession` | session ID；resume/continue/fork；ACP `session/new` + prompt |
| 审批接管 | App Server server request：command/file/MCP approval | SDK `canUseTool` + permission mode；CLI permission modes | ACP/CLI permission policy；细粒度 allow/deny + sandbox |
| cwd | exec `-C`、SDK working directory、App Server `cwd` | CLI/SDK `cwd`、additional directories | CLI `--cwd`、ACP `session/new.cwd` |
| worktree | CLI 无通用 `--worktree`；桌面 App 功能；可外部分配后传 cwd | 当前 CLI 原生 `--worktree`；也可外部分配后传 cwd | 当前 CLI 原生 `--worktree`/ref + worktree registry；也可外部分配 |
| MCP 定位 | 既是 MCP client，也能以 `mcp-server` 暴露 Agent tools | 既是 MCP client，也能 `mcp serve`，但后者只暴露底层工具 | `grok mcp` 是 MCP client；Agent server 是 ACP，不是 MCP |
| hooks | session/tool/prompt/permission/stop 等；PreToolUse 非完整边界 | 丰富 lifecycle，含 permission、stop、worktree、session 等 | command/HTTP hooks；只有 PreToolUse 可阻塞，失败 fail-open |
| 未来 B 的接口首选 | App Server stdio；小任务 `exec --json` | Agent SDK；小任务 `-p stream-json` | ACP stdio；小任务 `-p streaming-json` |

### 2.1 Codex

官方把 [App Server](https://learn.chatgpt.com/docs/app-server) 定义为 Codex 富客户端使用的接口，覆盖 authentication、history、approvals、streamed agent events；`thread/start` 可带 `cwd`、approval policy、sandbox，支持 resume/fork，`item/completed` 是单个 item 的权威完成事件。其实现也在 [openai/codex](https://github.com/openai/codex/tree/main/codex-rs/app-server) 开源。

本机 `0.144.4` 的 help 仍把 `app-server` 命令标为 experimental；富接口本身有官方文档和开源实现，但未来 adapter 仍需固定版本/capability。v1 候选只应走 child-process stdio；本机 help 暴露的 WebSocket transport 不应被当作已验证的浏览器直连生产合同。

选择建议：

- 需要交互 approval、完整 item/event、恢复线程：本机 companion spawn `codex app-server --stdio`，不要让浏览器直接连接进程。
- 一次性“执行并回结果”：[`codex exec --json`](https://learn.chatgpt.com/docs/non-interactive-mode)，记录 `thread.started` 给出的 ID，并同时使用 schema + final output file；可按 ID resume。
- Node 同进程编排且交互审批不是关键：[`@openai/codex-sdk`](https://learn.chatgpt.com/docs/codex-sdk) 提供 start/resume thread，比 shell parsing 干净。
- 另一个 Agent 已经是 orchestrator：可考虑 [`codex mcp-server`](https://learn.chatgpt.com/docs/mcp-server)，其 `codex`/`codex-reply` 工具可返回 thread ID。产品 Web UI 自己做主控时，App Server 更贴合 UI approval/event 模型。

限制：官方 [worktree 文档](https://learn.chatgpt.com/docs/environments/git-worktrees) 明确当前 worktree UI 仅在 ChatGPT desktop app。Codex CLI 本机帮助也没有 `--worktree`。跨 vendor 产品应先由 companion/treehouse 创建 worktree，再把其 realpath 作为 `cwd` 传入 Codex。

### 2.2 Claude Code

[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) 的 `query()` 返回 async message stream，支持内置文件/shell tools、session resume/fork；[TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript) 暴露 `cwd`、`additionalDirectories`、`resume`、`forkSession`、`mcpServers`、`permissionMode`、`canUseTool`、hooks 和 structured result。它最适合作为产品 adapter 的主接口。

选择建议：

- 需要在产品 UI 里逐步展示、审批、恢复：Agent SDK。
- 一次性任务：`claude -p --output-format stream-json --json-schema ...`，保存 session ID 与最终 result；`--include-hook-events` 只用于 telemetry。
- 当前 CLI 自带 `--worktree` 与 `--background`，可作为 adapter capability；但为保证三家一致的 lease/基线/清理语义，v1 仍建议产品先分配 worktree 再传 `cwd`。

重要限制：[Claude 的 `mcp serve`](https://code.claude.com/docs/en/mcp#use-claude-code-as-an-mcp-server) 只向 MCP client 暴露 View/Edit/LS 等 Claude Code 工具，官方明确要求 client 自己实现逐工具确认。它不是“把 Claude Agent loop 变成远端任务 worker”，不能替代 Agent SDK。

### 2.3 Grok Build

xAI 官方将 Grok Build 描述为可通过 TUI、headless 或 ACP 嵌入其他应用的 coding agent。[Headless & Scripting](https://docs.x.ai/build/cli/headless-scripting) 说明 `grok agent stdio` 是 ACP JSON-RPC：client `initialize`/authenticate，`session/new` 传 `cwd`/MCP，`session/prompt` 返回 completion metadata，assistant 内容通过 `session/update` chunks 到达。

选择建议：

- 富产品集成：companion 以 stdio 管理 ACP。它是 Grok 三种接口里最接近 Codex App Server/Claude SDK 的 Agent 控制面。
- 一次性任务：`grok -p --output-format streaming-json --json-schema ...`，保存 session ID。
- Grok 还提供 `grok agent serve --bind 127.0.0.1:2419 --secret ...`。可作为后续本机多客户端能力，但 v1 用 child-process stdio 更少暴露端口、生命周期也更可控。
- [`--worktree` 与 worktree registry](https://docs.x.ai/build/features/worktrees) 是真实功能；不过产品仍应记录自己的 lease、base SHA 与 cleanup 决策。

重要限制：[`grok mcp`](https://docs.x.ai/build/features/mcp-servers) 管理的是 Grok 要消费的 MCP servers，不是把 Grok Agent 暴露为 MCP server。不要用“都有 MCP”抹平 ACP/MCP 方向差异。

Grok 的 [Hooks](https://docs.x.ai/build/features/hooks) 支持 command/HTTP 和 session/tool/stop/subagent 事件，但官方明确：只有 `PreToolUse` 阻塞；timeout、crash、malformed output 均 fail-open。因此 hook 可把事件 POST 到 companion/outbox，却不能作为安全授权或“任务确已完成”的唯一证明。权限与 sandbox 应使用 [Grok Build enterprise/security settings](https://docs.x.ai/build/enterprise) 的正式 policy path。

## 3. 未来 B 的三种方案比较

### A. 产品管理本地 launcher/relay

流程：Web UI 配对本机 companion → companion 分配 worktree → spawn vendor adapter → 双向 stream/approval → durable result ACK。

优势：可确定 launch、版本、cwd、session、liveness、cancel、approval、worktree 和断线恢复；可以给 Owner 一致的运行视图。

代价：需要签名/升级/loopback 安全、进程回收、版本兼容矩阵、错误诊断；本机 companion 是真正的高权限边界。

### B. 被动 MCP/callback/hook

流程：用户自行启动 Agent；Agent 通过 MCP 调产品工具，或 hook/callback 报状态/结果。

优势：接入轻；适合“用户已经在终端工作，只把结论/问题送回产品”；现有 Agent Bridge 的能力/ACK primitive 能服务这种兼容路径。

缺点：无法保证任务是否被启动、是否还是同一 session、进程是否活着、审批是否卡住、是否在正确 worktree、cancel 是否生效、最终事件是否丢失。三家的 MCP server 语义并不统一，Grok 还没有对应的 Agent MCP server。

结论：只能作为 bring-your-own-agent/manual compatibility，不足以实现 Owner 从 Web 点击“交给 Agent”后的可靠闭环。

### C. Hybrid（仅在未来 B 获准时技术上最完整）

主链走 launcher + 官方 Agent protocol；旁路同时允许：

- hooks 写入本地 durable outbox，作为 UI 通知、wake、diagnostics；
- 产品 MCP tools 供 Agent 主动查知识/提交候选结果；
- 现有 Agent Bridge 处理 capability-protected Q&A、人工回答和 ACK；
- cmux/firstmate 作为可选可见终端/高级调度 backend；
- 任何旁路事件都必须关联已有 `runId/attemptId/providerSessionId`，不能自行创造“成功”状态。

这保留了轻接入路径，又不牺牲 Web 发起任务时的可控性。

## 4. 未来 B 的候选架构（非当前产品方案）

```text
[Web UI / product API]
        │ authenticated pairing + normalized events/commands
        ▼
[Local companion]
  ├─ grant/cwd validation
  ├─ treehouse or git-worktree lease
  ├─ process/session registry + durable outbox
  ├─ Codex adapter: app-server | exec
  ├─ Claude adapter: Agent SDK | print CLI
  └─ Grok adapter: ACP stdio | single CLI
        │
        ├─ vendor raw event log (diagnostics, bounded/retained)
        └─ normalized run events + result evidence
                    │
                    ▼
              [Product run ledger]
```

图中的 Local companion 特指 **execution companion**，不是 authorized source-observation companion。

### 4.1 Canonical run state

建议最小状态机：

```text
created → queued → starting → running
                        ├→ awaiting_approval → running
                        ├→ awaiting_user → running
                        └→ succeeded | failed | cancelled | stale
```

不要把 child exit `0` 等同于 `succeeded`。成功至少需要 vendor 的权威 final/turn result，以及 worktree/产物证据采集完成。进程退出但缺 final event 应为 `failed` 或 `stale`，保留可 resume 的 provider session ID。

### 4.2 Run / attempt / event / result 合同

每次 Owner 调度形成一个不可变 task payload hash；重试产生新 attempt，不覆盖旧事实。

| 对象 | 最小字段 |
|---|---|
| `AgentRun` | `runId`, `projectId`, `taskHash`, `createdBy`, `requestedProvider`, `status`, `createdAt` |
| `AgentAttempt` | `attemptId`, `runId`, `provider`, `adapterKind`, `providerSessionId/threadId`, `agentVersion`, `cwdGrantId`, `cwdRealPathHash`, `worktreeLeaseId`, `baseSha`, `approvalPolicy`, `startedAt`, `endedAt` |
| `AgentRunEvent` | `eventId`, `attemptId`, monotonic `sequence`, `type`, `occurredAt`, `rawProviderEventRef?`, `idempotencyKey` |
| `AgentResultReceipt` | final text/structured output、provider final status、exit/signal、`headSha`、diff summary/hash、artifact relative paths+hashes、verification evidence、permission denials、cost/usage when available |

原始 vendor envelope 应另存为有 retention/size 限制的 diagnostics，产品状态只由版本化 normalizer 生成。每个事件需 sequence + ACK；重连后 companion 从最后 ACK 重放 outbox。这样浏览器关闭或网络中断不会丢最终结果。

### 4.3 Approval

- 默认使用 vendor 的最小权限模式与 sandbox；不要默认 `bypassPermissions`/`always-approve`。
- App Server/Agent SDK/ACP 的 approval request 归一为 `awaiting_approval`，Owner 决定必须绑定精确 `attemptId + provider request/item/toolUse ID`，支持一次/会话/拒绝，但不伪造跨 vendor 等价能力。
- companion 只传结构化允许项，不接受 Web 下发任意 shell 字符串或任意 executable path。
- hooks 的 allow/deny 只能做 defense-in-depth，不能替代 OS sandbox、vendor policy 和产品 grant。

### 4.4 Worktree

v1 统一由产品分配：

1. 验证 project grant 与 git root realpath；
2. treehouse 或 `git worktree` 创建 lease，记录 base SHA、path hash、owner attempt；
3. 把该路径作为 vendor `cwd`；
4. 完成后保留结果/证据，由 Owner 决定 merge/cleanup；
5. stale/crash 不自动删除未审阅 worktree。

Claude/Grok 原生 worktree 可在后续作为 adapter capability，但必须回填同一个 lease/result contract。Codex 也因此不成为例外。

### 4.5 安全边界

- companion 仅监听 `127.0.0.1` 或 Unix socket；随机高熵配对 secret、短时 challenge、严格 Origin/Host 检查、无通配 CORS。
- hosted product 不接收、不复制 Codex/Claude/Grok 登录 token 或 API key。companion 使用用户已安装 CLI 的本机认证；仅向 child 传 allowlisted environment。
- 产品只允许已注册 adapter executable 与已授权 project root/worktree；canonical realpath 后再次校验边界，默认拒绝 symlink escape。
- secret/config 内容不得进入 event/raw log。绝对路径尽量只留本机；云侧记录 grant ID、相对路径和 path hash。
- spawn 参数使用 argv 数组，不经过 shell；prompt 走 stdin/protocol field。限制输出大小、事件速率、单次运行时长与并发数。
- 取消要先走 vendor cancel/interrupt，再有界等待，最后 terminate process group；记录每一步，不把 kill 成功写成 task cancelled-by-agent。
- companion 升级、adapter 兼容和 schema migration 必须版本化；每个 attempt 固定 `agentVersion + adapterVersion`。

## 5. 仅供未来重新立项时使用的验证顺序

以下不是当前 roadmap、采用决定或实现许可。只有当 Owner 以后明确批准 B，并先定义独立 execution grant、风险接受和退出策略时，才适合作为从低风险证据到真实执行的验证顺序。

### Phase 0：合同与假 adapter

先实现 run ledger、event ACK/outbox、result receipt、approval/worktree lease 合同，用 deterministic fake adapter 验证重复事件、断线重放、cancel race、缺 final event、stale worktree。此阶段不调用真实 Agent。

### Phase 1：本机 companion + 一次性 adapter

只支持显式 Owner 发起，且每次一个 worktree：

- Codex `exec --json --output-schema -o`；
- Claude `-p --output-format stream-json --json-schema`；
- Grok `-p --output-format streaming-json --json-schema`。

这能最快验证安装发现、已有登录、cwd、输出 normalization、结果证据和断线恢复。审批模式先选 fail-closed/non-interactive policy；遇到需人工审批则明确失败/暂停，不静默放权。

### Phase 2：富交互 adapter

依次接 Codex App Server、Claude Agent SDK、Grok ACP，补齐 live stream、approval、resume、user follow-up、cancel。每个 adapter 必须通过同一 contract tests，而不是让 UI 直接理解 vendor event。

### Phase 3：兼容入口

开放产品 MCP tools、hooks callback 和 Agent Bridge Q&A，使用户自行运行的 Agent 也能关联/提交到既有 run；未知 run 的 callback 只能成为待关联 candidate，不能自动显示为已成功任务。

### Phase 4：可选高级 backend

在 run contract 稳定后，再评估 cmux 可见终端、firstmate fleet、Claude/Grok 原生 worktree、Grok loopback WS/leader。它们必须是可替换 adapter/backend，移除后不影响产品历史真相。任何阶段都不得把 A 的 watcher grant 直接升级成执行授权。

## 6. 验收门槛

任何一家 adapter 上线前至少应验证：

1. CLI 缺失、版本不支持、未登录、cwd grant 失效都 fail closed 且可诊断；
2. prompt 含引号/换行/命令替换字符不会进入 shell；
3. 两个 attempt 不能写同一 worktree；symlink/`..` 不能逃逸；
4. 浏览器/网络中断后事件可去重重放，final result 不丢；
5. approval request 精确关联，重复/过期决定不会执行到另一 tool call；
6. cancel、Agent 自停、进程 crash、companion crash、机器重启均产生不同、可解释终态；
7. vendor final event、exit code、Git diff/HEAD、artifact hash 不一致时不宣称成功；
8. session/thread resume 后仍绑定原 project/grant/worktree 或显式产生新的 attempt；
9. raw event 中的 secret/token/敏感 env 被过滤；日志和 outbox 有容量上限；
10. MCP/hook/Agent Bridge 旁路无法越权把未知任务标记为成功。

## 7. 主要一手来源

### OpenAI

- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [App Server open-source implementation](https://github.com/openai/codex/tree/main/codex-rs/app-server)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex MCP server](https://learn.chatgpt.com/docs/mcp-server)
- [Codex hooks](https://learn.chatgpt.com/docs/hooks)
- [Codex worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)

### Anthropic

- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)

### xAI

- [Grok Build overview](https://docs.x.ai/build/overview)
- [Grok Build CLI reference](https://docs.x.ai/build/cli/reference)
- [Headless & Scripting / ACP](https://docs.x.ai/build/cli/headless-scripting)
- [Grok Build Hooks](https://docs.x.ai/build/features/hooks)
- [Grok Build MCP servers](https://docs.x.ai/build/features/mcp-servers)
- [Grok Build Worktrees](https://docs.x.ai/build/features/worktrees)
- [Grok Build enterprise permissions and sandbox](https://docs.x.ai/build/enterprise)
- [Grok Build changelog](https://x.ai/build/changelog)

## 8. 事实强度与剩余不确定性

- 高置信：本机版本/help、仓库 source/import 搜索、OpenAI/Anthropic/xAI 官方文档和官方源码。
- 中置信：firstmate/cmux/treehouse 作为长期产品 backend 的稳定性；它们当前能工作，但产品不应把内部 watcher/pane 行为当 vendor contract。
- 未确认：“Core” 的实际产品身份。需要用户给出正式名称、可执行命令或官方 URL 后才能增加第四个 adapter 行。
- Grok 本机 `0.2.101` 比部分公开 changelog/搜索索引更前；本文对已安装 flags 以本机 help 为准，对协议语义只采用当前 xAI 官方文档。生产 adapter 必须做 capability discovery/version gating，不能硬编码本文观察到的所有 flag 永久存在。
- 未发现 xAI 官方公开仓库中的 Grok Build CLI 实现源码；Grok 的实现级判断因此只来自本机 binary help/随附文档与 xAI 官方在线文档/changelog，不把 xAI model SDK 当作 coding-agent runtime 源码。
- 产品优先级：已明确 execution gateway 当前非核心。本文的“推荐”只是在未来 B 被独立批准后的技术选型比较，不是当前 adoption signal。
