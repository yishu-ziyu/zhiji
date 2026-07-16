# 前端证据工作台模式：来源、候选、确认、结果与复查

- 日期：2026-07-16
- 范围：只读产品研究。比较 NotebookLM、Perplexity、Linear、Granola 的官方帮助/产品页面，结合本产品真实 e2e 界面截图与现有代码事实。
- 非结论：不表示这些产品的模型或信息架构已被采用；不授权生产改动。

## 结论先行：可复制的是“每个结论都能回点”，不是聊天旁再堆一个来源列表

| 需要让用户看懂的事 | 可复制的界面模式 | 本产品应避免 |
|---|---|---|
| 回答依据什么 | 结论内嵌紧邻引用；点引用即到原文定位或源对象 | 把来源集中在页面底部、让用户猜哪句对应哪条材料 |
| Agent 说的是建议还是已定 | 将“候选/待确认/已确认”做成对象级状态与明确人类操作 | 用 work item 的 `confirmed` 或 Agent 时间线代替“Owner 已确认知识” |
| 结果如何回到项目 | 项目概览展示最新状态，历史按时间可追溯；每条结果可继续讨论/关联 | 结果只存在内部日志或刷新后消失；读到一次结果就自动完结任务 |
| 来源变了怎么办 | 源对象显示同步/失效状态；下游显示“需要复查”，不静默改写旧判断 | 用“最后搜索时间”冒充来源版本；更新原件后让旧结论继续看起来确定 |

## 本产品今天的真实界面：已有“依据”和“确认”外壳，缺少贯通状态

本次查看了真实 e2e 截图：

- [检索与项目画布](/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/tasks/first-user-real-entry-015/e2e/artifacts/g5-agent/04-search-retrieval.png)：左侧有项目和搜索，中间“现在怎样”显示一条材料依据，右侧 inspector 有「依据」页签，底部有时间线。
- [项目 inspector](/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/tasks/first-user-real-entry-015/e2e/artifacts/g5-agent/06-inspector.png)：已经显示“根据现有材料事件整理”“信息不足，先校对”与「确认当前状态」动作。

这说明界面已有正确方向：**当前项目 + 依据卡 + 下一步 + 时间线**。但它还不能让用户连续看懂以下四件事：

1. 搜索/Agent 回答中的每一个判断具体由哪一段材料支撑；
2. Agent result 是候选，还是 Owner 已确认的知识/决定；
3. 执行结果是否改变了某条项目知识、改变前后是什么；
4. 原材料更新后，哪些现有判断因此需要复查。

现有 `ProjectInspector` 已能显示直接依据、关系证据句和 Agent result 的引用数；但 `agent-run` 仍会以 Agent actor 写 work status `confirmed`，Card 没有候选/已确认/待复查身份，结果不会写回成结构化候选知识。外部 WebSearchPanel 也未挂到主工作台。因而不能把今天的“依据/确认”文案包装成完整闭环。

## 1. 回答对应来源：把引用放在判断旁边，允许回到原文

### 高信号实践

- **NotebookLM**：官方帮助说明其聊天基于所选 sources，并在回答内给出引用；点引用会跳到引用原文所在位置。用户还能勾选/排除本次回答使用的来源。([Use chat in NotebookLM](https://support.google.com/notebooklm/answer/16179559?hl=en))
- **Perplexity**：官方帮助把“回答附原始来源链接”作为核心透明度；内部知识检索中，文件结论也带 inline citation，能从引用打开文件。([How Perplexity works](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work), [Internal Knowledge Search](https://www.perplexity.ai/help-center/en/articles/10352914-what-is-internal-knowledge-search))
- **Granola**：增强会议纪要的每一个 note 旁有放大镜，可查看其来自 transcript 或 raw notes 的位置。这是“不是只给链接，而是给产生该句的证据片段”的好模式。([AI-enhanced notes](https://help.granola.ai/article/ai-enhanced-notes))

### 对本产品可复制

在“现在怎样”、Agent 候选判断、工作项结果中，每个可判断句旁显示少量**依据锚点**：材料名/外部对象名、定位片段、来源类型、revision/时间。点击应聚焦到本项目材料、GitHub SHA/对象、或 URL 摘录，而不是打开一张脱离上下文的 Card。

建议信息密度：正文中只显示 1–3 个锚点；完整证据链放在 inspector 的「依据」页签。这样既保留工作台的“过滤器”定位，也能让用户核对。

### 应避免

- 不复制“所有来源都在回答末尾列一排”的弱绑定方式。
- 不把搜索 rank、Agent 置信或单个 URL 当作事实确认。
- 不把不可打开的 snippet 当成稳定引用；网页至少显示抓取时间，GitHub 使用 SHA/对象号，本地材料需要 revision/hash（当前仍缺）。

## 2. Agent 候选与 Owner 确认：让状态对象、确认人和确认对象同时可见

### 高信号实践

- **Linear** 将项目更新的当前状态与历史更新分开：项目概览显示最新 update，Updates tab 保留按时间排列的历史和字段变化；更新可在 Linear/Slack 讨论。([Initiative and Project updates](https://linear.app/docs/initiative-and-project-updates))
- **Granola** 明确把增强笔记当成可编辑、可重新生成的产物，并保留 raw notes/transcript 的回点；它不把生成文本伪装成不可更改原件。([AI-enhanced notes](https://help.granola.ai/article/ai-enhanced-notes))

### 对本产品可复制

界面需要将三种语义分开显示，不能只用一个“确认”：

```text
Agent 候选判断       —— 可采纳/否决，带依据和 Agent/时间
Owner 已确认知识/决定 —— 明确是 Owner 在何时确认了哪一条 claim/decision
工作项状态           —— 待办/进行/等待人工/完成，不能等同知识状态
```

最小交互是：Agent result 卡始终有「候选」标签；Owner 的确认动作写明“确认此判断为项目决定/知识”，确认后保留候选版本和确认人。关系边已有“待确认/已确认”的可视化，适合借其**对象级状态**表达方式，但不能把 relation 状态泛化为所有知识已确认。

### 应避免

- 当前 `agent-run → status: confirmed` 的语义混叠：Agent 不得替 Owner 进入人类确认状态。
- 把“查看过”“保存过”“在时间线上出现过”当成 Owner 确认。
- 将工作流完成、知识确认、外部执行成功压成一个绿勾。

## 3. 执行结果回流：在项目当前面与历史面同时可见

### 高信号实践

- **Linear**：项目 Overview 显示最新状态，Updates tab 提供历史；更新与 Slack 讨论同步回同一 update。这个“当前摘要 + 可回看的变化记录”适合工作台，不需要把所有事件塞进主画布。([Initiative and Project updates](https://linear.app/docs/initiative-and-project-updates))
- **Linear**：重复 issue 是独立且可见的 workflow outcome，并有回到 canonical issue 的横幅/链接；这说明“结果归并到已有对象”应显式可见，不是悄悄删掉重复物。([Issue relations](https://linear.app/docs/issue-relations))

### 对本产品可复制

执行结果应形成一张项目内 result 记录，包含：做了什么、得到什么、引用了哪些依据、影响哪条候选判断/工作项。结果若支持或推翻既有判断，应产生一个**待复查/候选更新**，由 Owner 决定是否更新当前状态；主画布只显示最新且最重要的变化，时间线保留完整历史。

这比“运行 Agent 后把 work item 标 confirmed”更诚实：结果是证据，不是自动结案。它也能让聊天与工作台遵守 D-14 的同一身份/同一项目记忆，而不是聊天里有总结、工作台只剩日志。

### 应避免

- 不让 result 自动创建已确认 Card、确认 Relation、完成 work item 或覆盖旧结论。
- 不只在 Agent tab/内部事件里留结果；Owner 应能从项目“现在怎样”看到该结果带来的待复查或更新。
- 不因为一个外部 API 成功就宣称业务目标已完成。

## 4. 来源版本变化与需复查：显示“何时有效、为何失效、影响哪里”

### 高信号实践

- **NotebookLM**：Drive 来源可自动同步，也可手动 sync；若用户失去文件访问权或文件被删，来源不可再交互，Notebook 会停止引用该来源。网页 URL 仅导入 HTML text，付费墙不支持。这些都把“来源可用性”当作显式状态，而不是假设永远新鲜。([Add or discover new sources](https://support.google.com/notebooklm/answer/16215270?hl=en))
- **Perplexity**：区分 thread 的临时文件与组织/项目文件的可持续可访问范围，并让用户选择 Web、Org Files、两者或都不选。可借鉴“来源范围先可见，再回答”的动作，而不照搬其全局组织知识库。([Internal Knowledge Search](https://www.perplexity.ai/help-center/en/articles/10352914-what-is-internal-knowledge-search))

### 对本产品可复制

每个被引用来源至少显示：`来源类型 · locator/revision · 最后核对时间 · 当前状态`。当文件重写、GitHub ref 变化、网页不可访问或证据冲突时，显示**待复查**及其原因，并在 evidence inspector 展开“受影响的判断/工作项/关系”。

当前只能做到部分：材料有 `updatedAt`/路径，Agent Bridge 可把某次请求标 stale；但没有不可变 revision/hash、Card 级 `lastVerifiedAt`、backlinks 或影响 fan-out。因此 UI 不应先添加“已是最新”绿勾。

### 应避免

- 不把页面加载时间、AnySearch elapsed time 或文件 mtime 单独显示成“已核对”。
- 不在源失效后删除或静默改写原判断；保留历史、标记为什么需要重查。
- 不把来源选择器做成隐形全局混搜；范围变化应在回答前后都可见。

## 一页式落地判断：复制什么、避免什么

| 复制 | 避免 |
|---|---|
| NotebookLM/Perplexity 的句内引用 + 原文定位 | 只有链接堆栈、没有 claim-to-evidence 绑定 |
| Granola 的“每句可看其 transcript/raw-note 来源” | Agent 文本没有可回点来源却显示为总结 |
| Linear 的当前状态与历史变更双层呈现 | 将主画布变成全量日志，或让历史取代当前判断 |
| Linear 的显式 duplicate/canonical 关系 | 静默克隆/覆盖依据，用户无法知道复用或合并发生过 |
| 来源可用/同步/失效的显式状态 | 把 mtime、rank、请求耗时伪装成确认或新鲜度 |

## 与本产品四项研究题的直接映射

| 题目 | 下一步界面判断（非实现规格） |
|---|---|
| ① 回答对应来源 | 判断中每个关键 claim 能点回项目 Card/材料或外部稳定 locator；具体证据留在右侧「依据」。 |
| ② Agent候选 vs Owner确认 | Agent result 卡先标候选；Owner 确认的是具体判断/决定，work item 另显示工作状态。 |
| ③ 执行结果回流 | result 进入项目历史，并在“现在怎样”显示待复查/候选更新；不自动确认。 |
| ④ 来源版本变化/需复查 | 依据旁显示 revision、最后核对、复查原因；变化后能列出受影响对象。 |

## 研究限制

- Chrome CDP 未连接，无法在登录态中逐帧操作竞品；本报告使用公开官方帮助/产品页面以及本产品真实 e2e 截图。官方帮助页中所述界面/交互是产品方一手说明，具体版本可能变化。
- 未把任何竞品的连接器、同步策略或后台模型推导为本产品已具备能力。
- Q-02/OA-01 仍决定最终持久化模型；本报告只给出不依赖具体 schema 的 Owner 可见行为。

