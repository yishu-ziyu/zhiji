# FC-OPC 效率 Agent：创新性与竞品证据报告

> 研究日期：2026-07-13<br>
> 证据范围：2025–2026 年官方产品页、帮助中心、发布公告与开发文档；传统流程部分为基于主流 SaaS 工作方式的重构，不是用户访谈或田野观察。<br>
> 判断对象：`客户新信息 → 结合历史上下文理解 → 判断影响的报价/承诺/项目/任务 → 生成待批准行动 → 执行后验证并回写记忆`。<br>
> 结论边界：本文不把“搭一个工作流”“接入大模型”“做一个 Agent”本身视为创新。

## 一、执行结论

核心链路的绝大多数单点能力已经被商业化：事件触发、组织上下文检索、任务和 CRM 写入、报价生成、人工审批、跨应用工具调用、运行日志、可逆修改，以及持续记忆，均能在至少一家主流产品中找到正式产品证据。

截至 2026-07-13，在本次审阅的官方资料中，**没有发现一款面向项目制个体经营者、开箱即用地把一条客户新信息同时转换成“报价、双边承诺、项目和任务”的显式影响差异，再以独立证据验证执行结果后才写入长期记忆的产品**。这是有边界的资料结论，不等于“市场空白”或“全球首创”：大型平台已经可以通过模块组合实现这条链路的大部分内容，Asana、ClickUp、Salesforce、HubSpot 和 Glean 尤其接近。

因此，FC-OPC 可成立的创新方向不应是“AI 自动做任务”或“全能工作 Agent”，而应收窄为三项可检验的产品机制：

1. **商业承诺影响差异（typed impact diff）**：把客户原话映射为报价、承诺、项目、任务四类有类型的变更候选，并保留原文、置信度、冲突和下游影响。
2. **双边状态权威（bilateral state authority）**：服务方不能代替客户确认承诺或验收交付；客户动作本身是独立证据。
3. **证据门控记忆（evidence-gated memory）**：候选理解只有在审批、外部执行结果或客户确认后，才升级为长期事实；全过程保留来源、操作者、版本和回滚信息。

当前仓库只实现了第二项的一部分，以及第一项的非常窄入口：从一次粘贴的客户对话中提取带原文引用的承诺草稿，人工审阅后生成对齐单，由客户独立确认，服务方标记交付，再由客户独立验收，并记录角色受限的事件历史。它尚未实现历史上下文、报价/项目/任务的跨对象传播、外部系统执行、持久化记忆或完整的证据门控。

## 二、研究口径与判定标准

### 2.1 链路拆解

| 环节 | 本报告的严格定义 | 仅做以下事情不算完成 |
|---|---|---|
| 捕获客户新信息 | 从真实客户渠道、人工粘贴或结构化表单形成可追溯事件 | 只有聊天框，没有来源或事件身份 |
| 历史上下文理解 | 在权限范围内检索客户、项目、历史对话、既有承诺和业务规则 | 只把当前消息发给模型 |
| 跨对象影响判断 | 对报价、承诺、项目、任务分别生成结构化差异和依赖影响 | 只生成一段摘要或笼统建议 |
| 待批准行动 | 对每项写操作给出目标、参数、理由、证据和审批边界 | 只有“确认”按钮，没有可审查的具体写入 |
| 执行 | 在目标系统或客户触点实际创建、更新、发送或撤销 | 只生成可复制文本 |
| 验证 | 从目标系统回执、状态变化或对方动作确认执行结果 | Agent 自己说“已完成” |
| 回写记忆 | 区分候选事实与已验证事实，保留来源、时间、权限、版本和撤销 | 把全部对话无差别塞入向量库 |

### 2.2 产品成熟度标记

- **产品化**：官方资料证明该能力可供客户使用，且有明确的权限、运行或产品边界。
- **组合可得**：平台提供所需组件，但需要管理员、开发者或实施方自行编排；不是开箱即用的领域流程。
- **预览/测试**：官方明确标注 beta、preview、渐进发布或候补名单。
- **无官方证据**：本次审阅的官方资料没有证明；不等于产品一定没有该能力。

### 2.3 传统流程重构的证据边界

传统基线不是对某家公司的断言，而是把主流协作软件长期采用的记录模型串起来。官方资料可验证其中的基本动作：HubSpot 仍提供[手工记录电话、邮件、会议、备注、任务和消息，并创建后续任务](https://knowledge.hubspot.com/records/manually-log-activities-on-records)的标准流程；活动与 CRM 记录的关联既可手工也可自动，但有对象和权限限制，见[活动关联说明](https://knowledge.hubspot.com/records/associate-activities-with-records)。Jira 的经典自动化由[触发器、条件和动作](https://support.atlassian.com/cloud-automation/docs/what-are-automation-rules/)构成；Microsoft Approvals 则以[结构化审批流程](https://support.microsoft.com/en-gb/office/what-is-approvals-a9a01c95-e0bf-4d20-9ada-f7be3fc283d3)处理折扣、请假等决定。

## 三、传统工作流基线：人是系统之间的集成层

| 工作面 | 常见旧流程 | 主要人工判断 | 典型断裂点 | Agent 化后仍需保留的控制 |
|---|---|---|---|---|
| 会议纪要 | 录音/转写 → Docs/Word/Notion 整理 → 人工提炼决定和行动 → 邮件或群聊确认 → 再录入任务系统 | 哪句话是决定、承诺或待办；谁负责；何时生效 | 摘要与任务分离；决定没有对方确认；后来变更覆盖旧版本 | 原文引用、参与方确认、决定版本和撤销历史 |
| 文档与数据整理 | 共享盘文件夹、命名规范、表格台账、标签和人工归档 | 文件属于哪个客户/项目；哪个版本有效；哪些字段敏感 | 重复副本、孤儿文件、过期模板、权限继承错误 | 来源、版本、所有者、保留期限和最小权限 |
| 知识库 | 页面模板 → 编辑 → 页面负责人复核 → 发布 → 定期人工审查 | 哪些经验可以升级为组织规则；何时失效 | 会话中的临时判断被当成事实；旧规则仍被检索 | 事实/建议分层、审核人、有效期、引用和废止记录 |
| 客户沟通 | 微信/邮件/电话/会议 → 人工抄录 CRM → 关联联系人和商机 → 建后续任务 | 客户到底提出了需求、异议、承诺还是范围变更 | 渠道上下文丢失；CRM 记录延迟；承诺没有进入交付计划 | 对话原证据、客户身份、关联对象、敏感动作审批 |
| 报价 | Excel/价格表或 CPQ → 选择产品与数量 → 应用折扣规则 → 超阈值审批 → 导出 PDF/邮件 → 人工回填状态 | 范围是否变化；折扣是否合规；旧报价是否作废 | 报价、客户承诺和项目范围分别维护；接受版本不清楚 | 价格规则、审批阈值、报价版本、接受方和生效时间 |
| 项目管理 | 在 Asana/monday/Jira 建项目、里程碑、依赖和负责人 → 例会更新状态 | 新信息改变哪个范围、依赖、时间或资源 | 状态依靠汇报；任务更新但商业承诺未更新 | 依赖影响、变更理由、基线版本和责任人 |
| 任务追踪 | 待办/Kanban/日历/“等待中”清单 → 提醒 → 周期复盘 | 这是自己的下一步还是等待他人；何时升级 | “等待对方”没有证据；完成状态由自己主观填写 | 责任主体、到期规则、外部回执和异常升级 |
| 自动化 | 事件触发 → 字段条件 → 固定动作；异常进入人工队列 | 模糊文本如何解释；冲突时选哪个动作；何时需要审批 | 规则只识别预定义字段；跨系统失败后状态不一致 | 幂等、重试、审批、权限、失败补偿和审计 |

这条传统链路的关键成本不是单次录入，而是同一个人在多个系统之间不断完成五件事：**转录事实、解释含义、判断影响、搬运状态、追问验证**。Agent 可以减少前三项和搬运成本，但不能取消状态权威、权限和独立验证。

## 四、竞品能力矩阵

### 4.1 链路覆盖总览

标记：✅ 官方资料证明已有产品能力；◐ 可通过配置或多个模块组合；β 官方仍标注测试/渐进发布；— 未找到官方证据。

| 产品 | 事件/触发 | 历史上下文 | 报价/承诺/项目/任务影响 | 待批准行动 | 外部或系统执行 | 验证/审计回写 | 持续记忆 | 总体判断 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Asana AI Teammates | ✅ | ✅ | ◐ 项目/任务强，报价与双边承诺弱 | ✅ 选择性审批和检查点 | ✅ Asana 内动作 | ✅ 运行检查点、审计、可逆 | ✅ | 最接近“工作管理中的持久 Agent”；不是客户商业对象全链路 |
| monday Agents | ✅ | ✅ | ◐ board/workflow 强 | ◐ 权限与人工监督，逐动作审批证据不足 | ✅ | ✅ 记录结果与后续 | — | 核心能力已发布但仍渐进铺开；完整链路需自建 |
| Notion Custom Agents | ✅ | ✅ | ◐ 数据库/MCP 自定义 | ✅ 写工具可设 Always ask | ✅ | ✅ 每次运行有日志且修改可逆 | — | Business/Enterprise beta；强编排层，不是领域成品 |
| HubSpot Breeze | ✅ | ✅ | ◐ CRM/客户沟通强，项目/报价组合 | ✅ 工具可要求运行前审批 | ✅ CRM、消息、API | ✅ CRM 写回、来源和 Agent inbox | — | 客户上下文与行动已产品化；自定义 Agent 仍 beta |
| Salesforce Agentforce | ✅ | ✅ | ✅ 报价与运营任务已分别产品化 | ✅ | ✅ | ✅ 永久审计、会话追踪、业务记录 | ◐ 业务状态而非已证明的学习记忆 | 最完整的企业能力组合；不是一体化 OPC 成品 |
| Microsoft Copilot 组合 | ✅ | ✅ | ◐ Sales + Planner + Studio | ✅ | ✅ | ✅ Planner 送人工复核、流程回写 | — | 所有部件可组合；Sales Agent 仍 preview，非单一产品链路 |
| ClickUp Super Agents | ✅ | ✅ | ◐ 项目/任务强，报价与双边承诺弱 | ◐ 可配置关键动作审批，不是统一硬门 | ✅ | ✅ 全动作日志 | ✅ | 与 Asana 一样是直接近邻；权限设计需谨慎 |
| Glean Agents | ✅ | ✅ | ◐ 跨应用自定义 | ✅ 交互式 Web 写操作默认暂停 | ✅ | ✅ 状态输出、审计和 Agent Inbox | — | 横向 Agent 平台；后台写入的审批范围有限 |
| Atlassian Rovo | ✅ | ✅ | ◐ Jira/Confluence 强 | ✅ 对话工具调用确认 | ◐ 自动化中 Agent 只返回文本 | ✅ 自动化/工具记录 | — | 检索和协作成熟；自动化工具能力有明确限制 |

### 4.2 逐项证据、可用性与限制

#### Asana AI Teammates

- **发布日期与可用性**：Asana 在 2026-03-17 发布[AI Teammates 概览](https://asana.com/resources/ai-teammates-overview)；当前[产品页](https://asana.com/product/ai/ai-teammates)将其作为 Starter、Advanced、Enterprise 和 Enterprise+ 的付费附加项销售。官方仍保留旧的 beta 页面，因此对外表述宜用“当前商业产品/附加项”，不额外推断其历史 GA 时间。
- **上下文与执行**：[帮助中心](https://help.asana.com/s/article/ai-teammates)证明它可在 Work Graph 的任务、项目、目标、组合以及 Drive/SharePoint 上下文中工作；可创建、更新、完成任务和子任务，写评论、更新字段、建立依赖和里程碑。
- **触发与人机协同**：[触发说明](https://help.asana.com/s/article/triggering-ai-teammates)覆盖任务分配、@提及、对象更新、规则、表单和周期任务，并推荐草稿—审阅—批准—定稿模式。
- **记忆**：2026-04-02 的[工程说明](https://asana.com/inside-asana/ai-teammates-turn-work-into-reusable-information)称记忆会在执行中形成并与 Work Graph 关联；用户可检查和删除，运行记录会显示使用或创建的记忆。
- **权限与限制**：记忆和动作继承访问边界；删除非 Agent 创建的任务、给无权限用户分配任务等操作会要求审批。官方同时列出不能创建目标和自定义字段、不能发送状态更新、不能创建仪表盘等限制。
- **对 FC-OPC 的意义**：事件、项目上下文、行动、检查点、审计和持续记忆已经是产品能力。可区分空间只剩客户渠道证据、报价/承诺对象，以及执行后的双边验证。

#### monday Agents

- **发布日期与可用性**：2026-05-14 的[官方发布](https://monday.com/blog/product/welcome-to-the-agentic-era-at-monday-com/)称可定制 Agents 已正式可用；但当前[帮助中心](https://support.monday.com/hc/en-us/articles/33347027353746-AI-Agents-on-monday-com)仍说明功能在渐进发布，先覆盖 monday AI，其他产品随后开放。2026-06-08 起 Pro 及以下套餐开始消耗 AI credits，Enterprise 的计费时间另行安排。
- **能力**：Agent 可监听 board 和 workflow 活动，结合 board、数据、文档、流程和外部文件判断，执行创建/更新 item、分配负责人、改变状态、起草消息、记录结果和创建后续等动作。
- **权限与限制**：官方强调自定义权限、边界和人工监督，但本次资料没有证明所有高风险写操作都有统一的逐动作审批门。
- **对 FC-OPC 的意义**：上下文—判断—执行—记录已经产品化；若只是把客户消息接到 board 并更新 item，属于常规平台配置。

#### Notion Custom Agents

- **发布日期与可用性**：2026-02-24 的[发布说明](https://www.notion.com/en-gb/releases/2026-02-24)推出按事件或时间表运行的 Custom Agents；当前[帮助中心](https://www.notion.com/en-gb/help/custom-agents)仍明确标注 beta，面向 Business 和 Enterprise。2026-05-04 起采用 credits，见[产品与计费说明](https://www.notion.com/product/agents)。
- **上下文与执行**：Agent 可读取 Notion 页面和数据库，以及 Slack、Mail、Calendar 和 MCP 来源；[MCP 指南](https://www.notion.com/help/guides/connect-custom-agents-to-mcp-integrations)证明其可以读取 Linear、Jira、GitHub、Stripe 等实时数据并调用写工具。
- **审批与审计**：写工具可设为每次询问或自动运行；支持草稿—人工审阅—执行。每次运行有活动日志，修改可逆。Agent 和资源的权限彼此独立，管理员应特别审查“Agent 能访问而触发用户不能访问”的数据暴露风险，见[共享与权限说明](https://www.notion.com/help/custom-agents-sharing-and-permissions)。
- **限制**：官方没有证明 Custom Agents 会自动学习并形成可治理的持续记忆；跨对象商业影响完全取决于用户自建数据库、提示和工具。
- **对 FC-OPC 的意义**：触发、检索、审批、工具调用和日志都不能单独作为创新主张。

#### HubSpot Breeze

- **发布日期与可用性**：2025-04-10 的[Spring Spotlight](https://www.hubspot.com/company-news/spring-2025-spotlight-breeze-agents)宣布 Customer、Content、Prospecting Agents 全球可用，Knowledge Base Agent 当时为 private beta。2026-04-13 的[定价发布](https://www.hubspot.com/company-news/hubspots-customer-agent-and-prospecting-agent-now-you-pay-when-the-task-is-complete)确认 Customer 和 Prospecting Agent 继续面向 Pro/Enterprise 提供。
- **客户上下文**：Breeze 可结合结构化 CRM、邮件、通话、工单和外部数据。当前[Customer Agent 设置文档](https://knowledge.hubspot.com/customer-agent/set-up-the-customer-agent)说明它可以基于来源回答、追问、转人工，并访问配置后的 CRM 数据和动作。
- **执行与安全**：[Customer Agent 动作文档](https://knowledge.hubspot.com/customer-agent/set-up-actions-for-the-customer-agent)覆盖外部 API GET/POST、身份匹配/邮箱验证和敏感变更的安全链接；[转人工说明](https://knowledge.hubspot.com/customer-agent/set-up-and-customize-the-customer-agents-handoff-process)支持同步、异步或无转人工路径。
- **自定义 Agent 状态**：[Breeze Studio 文档](https://knowledge.hubspot.com/ai/use-assistants-and-agents-in-breeze-studio?LanguageId=1)当前仍标注 beta，可配置输入、工具、知识和触发器，并有运行限额。Breeze 工具默认可要求授权，管理员也可关闭“运行前审阅”，见[工具说明](https://knowledge.hubspot.com/ai/use-breeze-tools)。[Agent output 审阅](https://knowledge.hubspot.com/ai/review-agent-output)提供 Needs approval、成功、运行中和失败等状态及来源。
- **时间边界**：2025-05-08 的[Customer Agent 扩展公告](https://www.hubspot.com/company-news/customer-agent-expansion)把“回忆过去对话、预约会议、更新 CRM”列为当时的后续计划，不能用这篇旧公告反推这些能力在 2025-05 已经全部上线。
- **对 FC-OPC 的意义**：统一客户上下文、渠道行动、审批和 CRM 回写已经商品化；真正未证明的是一条预置的“消息同时影响报价、承诺、项目、任务”的领域链路。

#### Salesforce Agentforce

- **报价能力**：2025-07-16 发布且当日可用的[Agentforce for Revenue](https://www.salesforce.com/news/stories/agentforce-for-revenue-announcement/)可从自然语言生成报价，结合产品、价格、条款、账户、商机和权限政策，覆盖复杂 quote-to-cash 场景。
- **运营与验证**：2026-04-29 GA 的[Agentforce Operations](https://www.salesforce.com/news/stories/agentforce-operations-announcement/)可从邮件和 ERP 事件建立结构化任务、验证数据、发起审批、识别瓶颈，并把每次 AI 动作映射到业务蓝图形成持久审计。生态自动同步和 Salesforce Flow 动作当时预计 2026-05 进入 beta，不能与 GA 主体混为一谈。
- **统一上下文**：[Data Cloud 与 Agentforce 说明](https://www.salesforce.com/news/stories/how-data-cloud-powers-agentforce/)覆盖结构化和非结构化数据、历史邮件、工单、语音等 Customer 360 上下文。[Agentforce 可观测性发布](https://www.salesforce.com/news/stories/agentforce-studio-observability-tools-announcement/)提供会话追踪、输入输出、模型、推理和护栏记录；其中 Health Monitoring 的 GA 时间为 2026 年春季。
- **权限**：Agentforce 脚本支持工具和子 Agent；开发文档明确要求用业务过滤器和验证约束动作，而不是只依赖提示词，见[动作过滤模式](https://developer.salesforce.com/docs/ai/agentforce/guide/ascript-patterns-filtering.html)。
- **对 FC-OPC 的意义**：客户上下文、报价、任务、审批、执行和审计都已分别产品化。差异只能来自 OPC 的低配置领域模型和双边证据，不是“企业没有这条技术链”。

#### Microsoft：Sales Agent、Planner Agent 与 Copilot Studio

- **销售上下文**：Microsoft 在 2025-03-05 宣布[Sales Agent 与 Sales Chat](https://www.microsoft.com/en-us/microsoft-365/blog/2025/03/05/new-sales-agents-accessible-in-microsoft-365-copilot-help-teams-close-more-deals-faster/)，结合 Microsoft 365、Dynamics 365 或 Salesforce CRM、价格表、邮件和会议。它们原计划 2025-05 public preview；当前[Sales Agent 文档](https://learn.microsoft.com/en-us/microsoft-sales-copilot/use-sales-chat)仍标注 prerelease/preview，不应按生产级 GA 宣传。
- **任务执行**：2025-08 的[Planner 更新](https://techcommunity.microsoft.com/blog/plannerblog/what%E2%80%99s-new-in-microsoft-planner-%E2%80%93-august-2025/4449301)把 Planner Agent 集成到已有共享 premium plans。它可以生成计划、更新状态和执行任务；[执行说明](https://support.microsoft.com/en-us/planner/copilot/execute-tasks-with-planner-agent)显示任务进入 queued、couldn’t complete 或 ready for review，并明确 Agent 不会自行标记完成，最终控制留给人。
- **流程与审批**：[Copilot Studio workflow 文档](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-node-workflow)给出客户案例—CRM 历史—起草回复—人工升级—下游流程的组合方式；[AI approvals](https://learn.microsoft.com/en-us/microsoft-copilot-studio/faqs-ai-approvals)可按规则和文档作判断并与人工审批阶段组合。
- **对 FC-OPC 的意义**：这条链的部件几乎齐全，但分散于销售、项目和低代码产品；“把三个微软组件接起来”属于能力组合，不是新原理。

#### ClickUp Super Agents

- **发布日期与可用性**：ClickUp 在 2025-12-28 发布[Super Agents](https://clickup.com/blog/super-agents-launch/)。当前帮助中心将其作为 ClickUp Brain 能力提供，但具体功能和限额依套餐、角色和 AI ClickApp 而异，故宜表述为“当前商业产品”，不额外宣称统一 GA 范围。
- **上下文、触发与动作**：[Super Agents 总览](https://help.clickup.com/hc/en-us/articles/31010910371991-What-are-Super-Agents)说明其读取任务、文档、聊天、会议、日程和连接工具，可经自动或手动触发执行多步工作；[AI tools 列表](https://help.clickup.com/hc/en-us/articles/33032484272023-What-are-ClickUp-Brain-AI-tools)覆盖创建/更新任务、子任务、文档、评论、状态和依赖。
- **记忆**：[Memory 文档](https://help.clickup.com/hc/en-us/articles/37038846655383-What-is-Super-Agent-Memory)区分近期、偏好和 intelligence memory；偏好写入需用户批准，intelligence memory 可由 Agent 自主形成。
- **审批、日志与风险**：[隐私、权限与安全](https://help.clickup.com/hc/en-us/articles/36926065055127-Super-Agent-privacy-security-and-permissions)把 Agent 当作工作区用户，关键动作审批可通过说明或偏好配置；每个动作有日志。需要注意，Agent 可能默认获得公开空间访问权，共享 Agent 也可能让触发者间接接触其无权直接访问的私有内容，部署方必须单独验证权限边界。
- **对 FC-OPC 的意义**：事件、项目上下文、任务执行、日志和学习记忆均已被直接竞品覆盖。只有报价/承诺类型、客户身份和对方验收仍是明显缺口。

#### Glean Agents

- **发布日期与可用性**：2025-05-20 的[官方公告](https://www.glean.com/press/glean-expands-horizontal-agent-platform-delivers-dozens-of-agents-and-open-interoperability-across-the-enterprise)宣布 Glean Agents GA，提供横向 Agent builder、编排、治理和 MCP 互操作。
- **审批与执行**：[Human-in-the-loop 文档](https://docs.glean.com/agents/actions/human-in-the-loop-experience-for-actions)说明交互式 Web 中的写操作默认暂停，用户可检查、编辑、批准；多次写入可以串联并返回 ID 和状态。
- **限制**：上述逐动作确认仅适用于交互式 Web，不覆盖 Slack/Teams。计划任务和后台 Agent 只允许一小部分写操作且没有同步确认；[后台 Agent 安全说明](https://docs.glean.com/security/agents/background-agents)要求以管理员、moderator、审计和 SIEM 等控制补足。
- **权限**：[Agent 访问控制](https://docs.glean.com/administration/managing-agents/agent-access)和[动作角色权限](https://docs.glean.com/administration/actions/managing-actions/managing-role-based-access-actions)分别管理谁能创建、审核、运行 Agent，以及谁能使用动作；下游系统权限仍然生效。
- **对 FC-OPC 的意义**：跨应用上下文、行动和审批是成熟平台能力；若没有领域对象和验证协议，FC-OPC 只是另一个 Glean Agent 配置。

#### Atlassian Rovo

- **发布日期与可用性**：Atlassian 在 2025-04-09 发布[Rovo Search、Chat、Agents 和 Studio](https://www.atlassian.com/blog/announcements/team25-rovo-for-all)，并在 2025-10-07 宣布[向付费 Atlassian Cloud 客户铺开](https://www.atlassian.com/blog/announcements/team25-europe-rovo-everywhere)。后篇同时提到若干“coming soon/waitlist”的 Studio 能力，不能视为当时已上线。
- **上下文与动作**：[Agents 文档](https://support.atlassian.com/rovo/docs/agents/)证明 Agent 可结合 Jira、Confluence 和连接数据，并以运行用户的权限调用工具。[Agent actions](https://support.atlassian.com/rovo/docs/agent-actions/)在对话场景中会要求确认，删除等高风险动作可能二次确认；第三方工具仍有 beta 和批量上限。
- **关键限制**：[自动化中的 Rovo Agent](https://support.atlassian.com/rovo/docs/agents-in-automations/)不能直接使用自身工具，只能把文本结果写入 `{{agentResponse}}`，再交给确定性的 Jira automation 动作执行；没有自动化规则时也不会自主工作。
- **对 FC-OPC 的意义**：知识检索、项目上下文、确认和规则执行已成熟，但跨商业对象影响与持续记忆没有官方证据。

## 五、完整链路：哪些已产品化，哪些只是组合，哪里仍可能有差异

### 5.1 已经产品化，不应作为核心创新

1. **事件触发和后台运行**：Asana、monday、Notion、ClickUp、Rovo 均有事件、规则或周期触发。
2. **基于组织上下文的理解**：Work Graph、Teamwork Graph、CRM/Data Cloud、Microsoft 365 和 Glean 企业搜索都已提供权限感知上下文。
3. **任务和项目写入**：创建/更新任务、负责人、状态、依赖、里程碑是 Asana、monday、ClickUp、Jira 的基础 Agent 动作。
4. **客户沟通和 CRM 动作**：HubSpot Breeze、Salesforce Agentforce、Microsoft Sales Agent 已覆盖客户历史、起草或发送、转人工和 CRM 回写。
5. **自然语言报价**：Salesforce Agentforce for Revenue 已把自然语言报价和 quote-to-cash 产品化。
6. **人工审批和可逆修改**：Notion、Glean、Asana、Rovo、HubSpot、Microsoft 和 Salesforce 均有不同程度的审批、review 或 rollback。
7. **跨应用工具调用/MCP**：Notion、Glean、monday、Salesforce 等均已支持或公布相关工具生态。
8. **日志、状态和可观测性**：Agent inbox、activity log、session tracing、永久审计已是标准治理能力。
9. **持续/学习记忆**：Asana 和 ClickUp 已有明确官方产品证据，不能再以“Agent 会记住”作独特卖点。

### 5.2 目前属于“能力组合”，不能宣称无人做到

以下链路可以由现有平台拼装：

```text
客户邮件/表单/CRM 事件
  → CRM 或企业搜索取历史上下文
  → LLM/Agent 输出结构化判断
  → 低代码流程路由到报价、项目和任务工具
  → 高风险动作进入审批
  → 工具写入并返回状态
  → 日志/CRM/项目系统保存结果
```

Salesforce 可以用 Revenue + Data Cloud + Operations + Flow/Agentforce 组合；HubSpot 可以用 Customer Agent + CRM + Breeze Studio/API 组合；Microsoft 可以用 Sales Agent + Planner Agent + Copilot Studio 组合；Glean、Notion 和 monday 则提供横向编排层。组合成本、权限设计和领域建模可能很高，但“工程上可以拼出来”已经有充分证据。

### 5.3 仍可能形成差异的机制

#### 候选 A：商业承诺影响差异

对每条新信息，不生成泛化摘要，而生成四组明确对象变化：

```yaml
source_event:
  channel: customer_message
  excerpt: "客户原话"
  actor: customer
  occurred_at: timestamp
impact_candidates:
  quote:
    before: ...
    after: ...
    reason: ...
  commitment:
    before: ...
    after: ...
    counterparty_confirmation_required: true
  project:
    scope_or_milestone_delta: ...
  task:
    create_update_cancel: ...
contradictions: [...]
confidence: ...
```

**为什么可能成立**：本次竞品官方资料普遍证明“读取上下文并行动”，但没有证明一个开箱即用的、同时覆盖报价—双边承诺—项目—任务的类型化影响模型。

**成立条件**：必须把对象、关系、冲突规则和版本语义实现成稳定数据模型；用真实案例评测影响召回率、误写率和跨对象一致性。若只是提示词输出 JSON，则仍是普通工作流。

**当前状态**：未实现。现有对齐单只从当前对话抽取承诺候选，没有报价、项目和任务的前后差异，也没有历史基线。

#### 候选 B：双边状态权威

把“服务方认为客户同意”和“客户本人确认”设为不同状态与不同权限：

```text
服务方生成草稿
  → 服务方发送
  → 客户确认 / 请求修改
  → 服务方标记交付
  → 客户接受 / 拒绝
```

**为什么可能成立**：主流 Agent 普遍有内部审批，但内部审批不等于外部交易对手确认。FC-OPC 当前代码已经把客户确认和客户验收限制在独立客户入口，服务方不能代点。

**成立条件**：验证客户身份、令牌有效期、防重放、状态机幂等、审计和争议证据；进一步把确认结果传播到报价、范围和任务。否则它只是一个轻量客户门户。

**当前状态**：部分实现。已有角色受限状态转换和历史，但客户 token、存储耐久性和生产级身份安全仍不能从当前内存实现中得到保证。

#### 候选 C：证据门控记忆

把记忆分成至少三层：

| 层级 | 示例 | 是否可驱动自动执行 |
|---|---|---:|
| 候选理解 | “客户可能把交付期改到周五” | 否 |
| 已审批内部事实 | “项目负责人批准新的计划基线” | 有限 |
| 已验证外部事实 | 客户确认的承诺、目标系统回执、客户验收 | 是，仍受权限控制 |

**为什么可能成立**：Asana 和 ClickUp 已经有持续记忆，但官方资料更强调学习、偏好、运行经验和权限。本次没有找到它们把“独立外部证据”作为事实晋级的通用协议。

**成立条件**：记忆条目必须携带来源、证据类型、状态、适用范围、有效期、审批人、版本和撤销链；检索和行动策略必须根据证据等级降权或阻断。需要离线回放和错误记忆污染测试。

**当前状态**：未实现。当前 repository 是进程内 `Map`；事件历史不等于跨会话、可治理的长期记忆。

#### 候选 D：面向 OPC 的低配置交付

允许个体经营者通过粘贴文本或转发消息开始，而不先部署 CRM、CPQ 和项目管理全套系统，可能形成明显的采用优势。

**判定**：这是产品包装、目标市场和实施成本差异，单独不构成技术创新。只有当低配置入口背后仍能可靠维护上述类型化影响和证据状态时，才会成为有防御力的产品能力。

#### 候选 E：“等待对方”证据异常雷达

从“任务逾期提醒”升级为：识别当前责任在谁、等待哪项外部证据、证据是否与现有承诺矛盾，以及该异常会影响哪个报价、里程碑或客户承诺。

**判定**：普通 overdue、risk alert 和 follow-up 已高度商品化。只有“外部证据 + 责任权威 + 下游义务影响”三者同时成立，才是候选差异。当前未实现。

## 六、不可宣称为创新的内容

以下表述应从路演、文档和产品命名中排除，除非只是描述已有能力而非创新：

- AI 会议纪要、摘要、行动项提取。
- 从会议或聊天自动创建任务。
- RAG、企业搜索、知识库问答。
- 根据 CRM 和历史消息理解客户。
- 后台 Agent、事件触发、定时运行。
- 人工审批、可逆写入、审计日志。
- MCP、API 工具调用、跨应用自动化。
- 自动更新状态、发送跟进、转人工。
- 自然语言生成报价。
- 项目风险、逾期和优先级提醒。
- 持续学习、偏好记忆或共享记忆。
- 无代码 Agent builder 或“用自然语言搭工作流”。
- “首个 AI 队友”“全球首创”“市场无人做”“完整公司操作系统”“替代所有助理”。

尤其不能把“把多个现成能力串成流程”包装为技术创新。它可以是有价值的产品集成，但创新主张必须落到新的对象模型、验证协议、权限结构或可重复证明的效果上。

## 七、当前仓库能力与声明边界

### 7.1 当前可以安全证明

当前演示所支持的精确陈述是：

> 用户粘贴一段客户对齐文本，系统提取带原文引用的承诺草稿；服务方可审阅和编辑后发送对齐单；客户通过独立入口确认或请求修改；服务方标记交付后，客户再独立接受或拒绝；状态转换按角色限制并记录事件历史。

对应代码面：

- `app/track/efficiency/page.tsx`：文本输入、承诺提取、人工勾选/编辑、创建和发送对齐单。
- `shared/delivery/types.ts`：草稿、待客户确认、客户确认/请求修改、服务方交付、客户接受/拒绝等状态及历史事件。
- `shared/delivery/state-machine.ts`：按角色限制状态转换。
- `app/c/[token]/ClientActions.tsx`：客户侧确认、修改请求和验收动作。

### 7.2 当前不能证明

- 读取同一客户的历史会话、公司规则或过往承诺。
- 判断新信息对报价、项目、里程碑、依赖和任务的联动影响。
- 生成并执行跨系统写操作。
- 从微信、邮箱、CRM 或会议工具自动采集客户事件。
- 生产级客户身份、令牌安全和争议证据。
- 持久存储；当前进程内存储重启会丢失。
- 自动执行后的目标系统回执验证。
- 经证据门控的跨会话长期记忆。
- 已经实现“等待对方”异常雷达。
- 完整实现本报告开头的七段链路。

### 7.3 推荐对外表述

当前版本：

> FC-OPC 正在验证一种面向项目制个体经营者的客户承诺对齐机制：把客户原话转成可审阅的承诺草稿，并通过客户独立确认与验收建立可追溯状态。

未来机制通过真实评测后，可升级为：

> FC-OPC 探索一套证据门控的商业影响图，把客户新信息转换为报价、承诺、项目和任务的可审查差异；只有经授权执行并获得独立证据后，变化才升级为长期事实。

不建议使用：

> “首个能理解客户并自动经营公司的 AI Agent。”

## 八、验证创新主张所需的最小证据

要从“有想法”升级为可 defend 的创新主张，至少需要下面的验收面：

| 假设 | 必须实现的产物 | 必须报告的指标 | 失败条件 |
|---|---|---|---|
| 类型化影响图优于摘要 | 报价/承诺/项目/任务 schema、关系和版本规则 | 每类影响 precision/recall、跨对象一致率、遗漏的高风险影响 | 只能靠提示词临时输出；不同运行对象漂移 |
| 双边状态降低误承诺 | 客户身份、独立动作、状态机、审计和撤销 | 代确认阻断率、争议定位时间、客户完成率 | 服务方仍可伪造客户确认；链接无法归属客户 |
| 证据门控减少错误记忆 | 候选/审批/验证三级记忆和来源链 | 错误事实晋级率、污染后的恢复率、来源可追溯率 | 未验证文本可直接驱动高风险写操作 |
| 低配置适合 OPC | 从消息到首个有效对齐单的完整路径 | 首次价值时间、所需配置项、人工修订率 | 仍需先部署完整 CRM/PM/CPQ 才能使用 |
| 等待证据雷达有新增价值 | 责任方、所需证据、矛盾和下游影响模型 | 有效预警率、误报率、挽回的承诺/里程碑 | 只是把逾期任务换一种文案展示 |

建议建立一组脱敏的真实事件回放集，至少覆盖：客户改期、加需求、删范围、口头折扣、模糊确认、互相矛盾的消息、多个项目同名、部分交付、客户拒绝验收、外部系统写入失败。每次回放必须同时检查理解、权限、执行、验证和记忆污染，而不是只看模型生成文本是否“像对的”。

## 九、最终判断

FC-OPC 不具备以“Agent 自动化”本身主张创新的空间。它面对的是已经快速商品化的能力层：Asana 和 ClickUp 已有工作上下文、行动和持续记忆；Salesforce 已有自然语言报价与端到端运营；HubSpot 已有客户上下文、渠道行动和审批；Glean、Notion、monday、Microsoft 和 Rovo 已提供可组合的 Agent 基础设施。

它仍有一个清晰但必须做实的机会：**围绕项目制个体经营者的商业承诺，建立类型化影响、双边状态权威和证据门控记忆三位一体的协议**。这不是“更聪明的摘要”，也不是“更多工具调用”，而是决定什么能成为业务事实、谁有权改变它、以及什么证据足以让变化进入下一次行动的规则系统。

在上述三项机制完成数据模型、权限实现和真实案例评测之前，最诚实的定位是“创新候选与验证方向”，不是已完成的技术创新或市场首创。
