# 一个可问责产品 Agent：当前事实与已定产品关系

日期：2026-07-16。输入为 G3 代码审计、G4 独立证伪与 G6 Owner 可见场景，并由 Owner 通过 D-12、D-14、D-15 确认产品关系与自治边界。本文仍然**不是架构批准、实施派工或验收结论**。

## 当前事实

今天的产品是“有若干 Agent-like 工具的项目工作台”，不是一个 Owner 能识别、授权、追责的效率 Agent。

| 已有表面 | Owner 能看见 | 不能据此宣称 |
|---|---|---|
| 工作项「交给 Agent」复核 | 按钮、复核结果事件、`Agent 项目复核` 标签、状态变化 | 它是持续项目 Agent；它只是一次 work-item review |
| 「现在怎样」/attention | 可点依据、确定性 project-now 判断 | 这是 Agent 在持续观察或负责项目 |
| 搜索、材料入库、拆解、纪要、MCP 工具 | 人触发的检索/写入/建议能力 | 已有 retrieve → judge → propose → ask → track → writeback 的统一 loop |
| Agent Bridge | 主 UI 基本不可见 | Bridge 文件协议就是产品 Agent；代码审计未找到它的 HTTP/UI wiring |

最重要的反例：`app/api/knowledge/work-items/[id]/agent-run/route.ts` 会以 `agent:project-reviewer` 将 work item 写成 `confirmed`。这不是 Owner 验证后的确认，不能被包装为 Agent 已获产品权威。

## Q-15：Agent 在产品里是什么（D-12 已确认）

可供讨论的最低事实边界：若产品最终称它为“一个 Agent”，Owner 至少应能看见并追问同一个身份在**哪个项目**、基于**哪些来源/版本**、用**什么权限**做了什么，并在权限边界停等。

G6 的 Owner 场景把这个可见命题展开为：

1. 记下 Owner 决定且可点回来源，刷新后仍在同一项目；
2. 项目内检索自动；预授权外部源自动但告知；敏感、付费、未授权源先问；
3. 候选知识/行动带依据，且不强迫每条知识变任务；
4. 低风险少打断，高风险先问；
5. 行动、结果、失败与新发现回到同一项目，并可指回输入/输出；
6. D-11 下展示最后核对时间和复查原因；现时任务先重检。

这是一组 Owner 可见行为，不预设多 Agent 拓扑、Python/TypeScript runtime 或某个 OSS 框架。

D-12 现已锁定一个边界：无论内部是否调用专业 Agent、模型或工具，用户面对的是一个负责任的主 Agent；内部调用不能改变 Owner 的最终权力，也不能要求 Owner 理解或管理内部席位拓扑。

## Q-16：产品、Agent 与工作环境的关系（D-14 方案 C 已确认）

当前证据支持的最小表述是：产品首先是保存项目材料、知识、关系、工作项和事件的持久工作台；Agent 若存在，是受该工作台的项目范围、来源、授权、确认与审计约束的 actor。Agent 不运行时，项目仍应可找、可读、可核对。

产品采用聊天 + 项目工作台的组合。聊天承接目标、提问、方向变化和权限决定；工作台承接来源、项目状态、行动、进度和结果。两边必须属于同一个主 Agent、同一个项目记忆，并保持双向同步。当前代码仍未具备这条完整产品路径。

D-13 同时限制后续开源讨论：任何“用某框架实现主 Agent”的主张必须先有 **T-11 adoption record**：固定 upstream tag/commit、指向文件/符号和具体采用行为，映射当前 TypeScript seam，复核直接/传递许可证，以隔离验证证明差异，并写清退出迁移边界。项目名或营销能力表不构成产品建议；在记录完成前只能称 `candidate` 或 `spike`，不能称 `adopted`。

## T-13：主 Agent 的两面行为综合（D-12 / D-14）

| 面 | 主 Agent 在此面承担 | 用户在此面做什么 | 必须与另一面同步的事实 |
|---|---|---|---|
| 聊天 | 接住目标、问题、方向变化与授权决定；说明要做什么、依据什么、何时需要停等 | 给方向、补充上下文、授予/拒绝权限、最终判断 | 当前项目、目标、授权决定、检索/行动意图、引用的知识版本、未决问题 |
| 项目工作台 | 展示可核对的来源、知识/复查状态、行动、进度、事件和结果 | 查看证据、修改项目状态、追踪结果、回到聊天继续判断 | 同一主 Agent 身份、项目记忆、行动/结果 ID、授权记录、复查原因与最后核对时间 |

双向同步的最低可观察条件：

1. 聊天中确认的目标、方向或授权，在同一项目工作台能找到相应事件/状态及来源；
2. 工作台的行动状态、结果、阻塞、来源变化和待复查，在聊天中可被同一主 Agent 准确解释并引用；
3. 用户从任一面触发高风险外部动作，都回到同一套 D-10/D-11 与 Q-13 权限/新鲜度规则；
4. 聊天不是另一份记忆，工作台也不是聊天的截图：两者都指向同一 project-scoped truth 和不可混淆的 actor/event trail。

T-13 现在的设计边界已明确；它**不**替 Q-13、Q-23 做决定：风险级别与确认矩阵、外部预授权范围/期限/撤销仍待 Owner 继续确定。Q-03/Q-24 的检索→知识生命周期已由 D-16 决定。

### D-14 直接证伪门

以下任一情况都不能通过 T-13，不能以“后续再同步”或“只是内部实现”豁免：

- 聊天和工作台呈现不同 Agent 身份或不同项目记忆；
- 两面状态、来源、行动或结果互相矛盾/不同步；
- 方向、授权、决定只留在聊天，工作台没有可追溯项目记录；
- 结果只停在 server log、Bridge 协议或隐藏事件，没有工作台可见的进度/结果。

当前工作台的材料、来源、工作项、时间线是已存在的半截能力；统一主 Agent 聊天、聊天→工作台落盘与工作台→同一聊天回流仍是 F-03 记录的产品缺口，不得描述为已实现。

## D-15：有边界的自动化（Q-13 已决定）

| 自动执行 | 必须显式确认 | 输出地位 |
|---|---|---|
| 项目内读取、检索、整理、候选内容创建、草稿生成 | 对外发送、删除、付费、敏感操作、未授权访问 | 自动输出始终是 candidate/draft；Agent 不得确认自己的输出 |

这条规则覆盖聊天和工作台同一主 Agent 的全部内部 specialist/tool 调用。确认不是一个可选 UI 提示：高风险调用不得发生在确认之前；确认/拒绝、依据、actor 和结果必须回到同一项目的可见事件链。

以下任一情况直接违反 D-15：Agent 将 candidate/draft/result/work item 标为已确认或等价的人类接受状态；或在未记录显式确认前外发、删除、付费、处理敏感操作、访问未授权来源。当前 `agent-run` 以 `agent:project-reviewer` 写入 `status: "confirmed"`，正是 D-15 的已确认代码反例，不得沿用为主 Agent 的状态语义。

## D-16：检索 → 知识生命周期（Q-03 / Q-24 已决定）

每次检索先留下紧凑轨迹：`query`、`reason`、`scope`、`sources`、`time`。命中本身不是知识；只有实际支撑某个判断或行动的结果，才以稳定定位/版本被保存为项目依据。Agent 的解释、判断和抽取仍是 candidate；只有 Owner 确认，相关 claim/decision 才变为 confirmed knowledge。执行结果以新依据回到同一项目，并触发复查而非静默覆盖旧结论。

可观察状态链为：`检索轨迹 → 候选 → 已引用项目依据 → Owner 已确认知识/决定 → 结果回流 / 待复查 / 被更新`。聊天与工作台必须显示同一条链中的项目记录；不能只在聊天显示结论，也不能把 search hit、Agent output 或执行结果自动越级为已确认知识。

以下任一情况直接违反 D-16：命中自动升格、全部结果灌入知识、Agent 自我确认、执行结果静默覆盖历史、或判断不能回点项目依据。当前产品的 project search / `searchKnowledge` 没有完整的 query/reason/scope/sources/time trace 对象；它是现有能力的缺口，不应被描述成完整 D-16 生命周期。

## 已锁定但当前未进入统一 Agent 路径的约束

| 约束 | 对 Agent 的产品要求 | 代码事实 |
|---|---|---|
| D-10 授权边界 | 项目内自动；预授权外部源告知；敏感/付费/未授权调用前确认；保留授权与查询审计 | G3/G4 均发现 search/connector 没有统一 `sourceClass` / confirmation gate |
| D-11 新鲜度 | 来源有效期优先；变化/冲突/项目变化复查；实时行动强制重检；显示最后核对时间和原因 | 没有产品级知识 freshness policy；Bridge 的 file-drift stale 仅是协议安全，不等于知识新鲜度 |
| 人的终判 | Agent 的结果/关系/置信只能是 proposal，不能自证 | agent-run 自写 `confirmed` 是需重新界定的反例 |
| 不强迫串行 | 检索、知识、行动、回流是可组合能力，不是每次输入必走的仪式 | 旧 PRD 固定串行流与 KAL 固定拓扑已被 G4 证伪 |

## G5 运行时交叉核验（真实数据、只读）

G5 在 dev server 已运行、`/track/knowledge` 与项目 API 返回 200 的真实数据上核验了上述静态结论。

| 现在能看见 | 现在不能在真实数据上看见 | 证据含义 |
|---|---|---|
| 「现在怎样」attention、建议下一步、材料引用；scion 有 22 份材料 | `run-agent` 按钮：三项目均为 0 work items，不能在不写入数据的前提下展示 | 代码里的 reviewer 路由存在，不等于 Owner 当前可体验到一个 Agent |
| 项目搜索；`黑箱` 查询返回 1 个 PDF 卡片命中 | 命中正文是“无法预览此文件”占位，而非完整全文检索 | 当前检索不能被包装成 D-10 下可解释、可授权的 Agent 检索 |
| 项目画布和空项目的诚实 empty/ready 状态 | Agent Bridge 目录、请求与 Owner UI 均未 materialise | Bridge 仍是内部协议，不能作为产品 Agent 证据 |
| 页面有 Agent timeline filter | actions 为空、Agent timeline 为空、没有真实 result/writeback | 结果闭环在当前真实项目上尚未显示 |

另有运行风险：LLM health 曾从 503 timeout 恢复为 200；任何未来“模型 Agent”主张仍需独立运行证据，不能仅凭健康检查或静态路径成立。

G6 以 e2e/source/scion 数据补足了一个**可复现但非当前 live data 已展示**的最短路径：`工作项 + 直接依据 + 运行 Agent + 时间线 Agent 项目复核`。它证明现有碎片可组成一次 sourced work-item review；它不改变 G5 的事实——真实项目当前没有工作项，所以 Owner 还看不到 run-agent、结果或写回。该路径的外部 D-10、D-11 freshness、风险权限矩阵和单一身份仍标为 Gap。

## 仍需 Owner 决定的非工程问题

- Q-23：预授权外部源的授权范围、期限与撤销体验。


## 禁止的产品表述

- 不说“已经有效率 Agent，只差打磨”。
- 不说 project-reviewer 或 Agent Bridge 已是单一产品 Agent。
- 不把 KAL PRD、Temporal、LangGraph、OpenHands、Letta 或其他 OSS 候选当作 Q-15/Q-16 的答案。
- 不以孤儿率、固定相似度阈值、固定 30/90 天周期或固定多 Agent 串行流程替代 Owner 决策与证据。

## 证据

- G3 静态代码审计：`.ship/handoffs/G3-agent-surface-audit-DONE.md`。
- G4 独立证伪：`.ship/handoffs/G4-agent-prd-falsify-DONE.md`。
- G6 Owner 可见剧本：`.ship/handoffs/G6-owner-visible-agent-scenario-DONE.md`。
- G6 真实路径/Gap 对照：`.ship/research/grok-followups/G6-owner-visible-agent-scenario.md`。
- G6 D-14 addendum：`.ship/research/grok-followups/G6-D14-chat-workbench-addendum.md`。
- G4 D-14 falsification gate：`.ship/research/grok-followups/G4-agent-prd-falsification.md` §I。
- G6 D-15 Owner-visible addendum：`.ship/research/grok-followups/G6-D15-permission-boundaries-addendum.md`。
- G4 D-15 no-self-confirm gate：`.ship/research/grok-followups/G4-agent-prd-falsification.md` §J。
- G6 D-16 retrieval-to-result addendum：`.ship/research/grok-followups/G6-D16-retrieval-to-result-loop-addendum.md`。
- G4 D-16 lifecycle gate：`.ship/research/grok-followups/G4-agent-prd-falsification.md` §K。
- G5 真实运行证据：`.ship/handoffs/G5-agent-runtime-evidence-DONE.md` 与 `.ship/handoffs/G5-grok-runtime-agent-evidence-DONE.md`；后者的截图/API artifacts 位于 `.ship/tasks/first-user-real-entry-015/e2e/artifacts/g5-grok-agent-evidence/`。
- OSS 候选边界：`docs/research/2026-07-16-open-source-foundations-matrix.md`。
