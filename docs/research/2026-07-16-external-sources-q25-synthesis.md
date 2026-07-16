# T-14 / Q-25：外部来源、授权与首批范围综合

- 日期：2026-07-16
- 状态：供 Owner 决定 Q-25 的产品研究；**不授权连接器、账户访问、adapter/spike 或生产实现**（D-06、D-13 仍生效）。
- 输入：G3 的 [外部来源实践](/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/research/2026-07-16-x-external-source-practices.md)；Google、Microsoft、Slack、GitHub、Notion 的官方权限/事件文档。

## 结论

“外部来源”是项目真相层之外、能为项目提供内容或接收项目操作的任何系统。它不等于“互联网”：已授权的私人文档、推送事件和企业租户数据都是外部来源；**改变外部状态的工具是独立的操作类别，不应伪装成读取来源**。

首批建议只开放两项只读能力：

1. 已有的公开网络检索，增加明确的来源、范围、有效期、撤销和检索留痕产品约束。
2. GitHub App 的已选仓库只读资料与仓库事件 feed；安装范围仅限用户选择的仓库，工具仅限读取/接收事件。

私人账户读取不进入首批普遍开放：在首批验证后，仅选 **一个** 文档型连接器做受限试点（Google Drive Picker + `drive.file`，或 Notion 用户选择的页面），不得同时铺开邮箱、日历、消息和笔记。企业数据库/SaaS 写入、邮件/消息发送、创建/修改/删除、支付均不进入首批。

这是一项范围建议，不是架构批准或采用结论。

### 给用户的简单规则

- **公开搜索**：查公开网页；结果只是候选，引用后才成为项目依据。
- **Drive 等私人资料**：先连接、再选择具体文件或页面；只读授权不包含发送或修改。
- **Gmail**：读信、写草稿、发送是三种不同权限；首批不读整邮箱、不做后台邮箱同步，也不发送邮件。
- **外部动作**：即使已经连接账户，发送、创建、修改、删除和支付仍须逐次由 Owner 确认。

## 五类来源与边界

| 类别 | 具体是什么 | 授权与同步 | 自动与确认 | 进入项目的方式 | 首批结论 |
|---|---|---|---|---|---|
| 公开检索/浏览器 | 搜索索引、公开 URL、官方文档、论文 | 授权对象是检索提供方 + 查询域/域名范围 + 工具；按需拉取 | D-10 下预授权且非敏感/非付费可自动并可见告知；付费、敏感、新域/未授权先确认 | 每次保留 query/reason/scope/sources/time；命中是候选，只有实际引用才成为依据 | **首批**：保留现有公开检索；浏览器抓取限后续显式域名范围 |
| 已连接的私人只读账户 | 用户 OAuth 连接的 Drive、Notion、邮件、日历、消息、笔记 | 连接 + 最小 OAuth 权限 + 用户选择的资源范围；按需读取或有限增量同步 | 已预授权的非敏感只读可自动并告知；扩范围、敏感数据、新账户先确认 | 引用的片段/资源 ID/版本/时间进入依据，绝不整库或整邮箱复制 | **非首批**；只试点一个文档连接器 |
| 入站 feed/webhook | GitHub 事件、RSS、日历推送、邮件规则等主动送达的事件 | 授权 channel + 事件种类 + 资源范围；验签、去重、可重放的原始事件记录 | 已授权 channel 可自动接收；首次 channel、高量/异常、敏感 payload 先停在待审 | 原始事件不是知识；被判断/行动实际引用后才成为项目依据 | **首批仅随 GitHub 选仓库事件**；其余不接 |
| 企业数据库/SaaS | CRM、工单、数据仓库、内部知识库、管理员 API | tenant/admin policy + 用户委派或应用身份 + 查询范围；按需查询优于全量同步 | 批量读常有敏感性和租户风险，应确认；任何写/删始终确认 | 记录查询、tenant、资源、版本/时间与引用结果 | **不进首批** |
| 外部动作 | 发邮件/消息、创建日历或工单、发布、修改、删除、付款 | 这是 operation，不是 source；授权要包含目标、字段、金额/影响和一次性确认 | D-15：每次外发、创建/修改/删除、支付、敏感操作都先明确确认；Agent 不能自确认 | 保存拟议动作、确认人/时间、请求摘要、外部结果/失败；结果再按 D-16 回流复查 | **不进首批** |

OAuth scope、资源选择与运行时操作权限必须分开：scope 表示服务端允许什么；资源范围限定哪一页/文件夹/仓库；运行时操作分类决定是否需要本次确认。任何一项较宽，都不能替代另外两项。

## 首批范围的依据

- GitHub App 默认没有权限，所选权限决定可用 API 与 webhook；安装还能限定到选定仓库，适合“一个来源、一个明确资源范围”的首批读取与 feed。([GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-github-apps/choosing-permissions-for-a-github-app), [webhook scope](https://docs.github.com/en/webhooks/types-of-webhooks))
- Google OAuth scopes 是权限声明；应优先最小、非敏感 scope。Drive 的 `drive.file` 能将范围收窄到用户通过 Picker 打开或共享给应用的文件，适合以后做单一文档连接器试点，而非广泛 Drive 读取。([Google OAuth scopes](https://developers.google.com/identity/protocols/oauth2/scopes), [Drive API authorization](https://developers.google.com/workspace/drive/api/guides/api-specific-auth))
- Notion connection 的能力和用户选择的页面可共同限制访问，亦是可选的后续单连接器试点；不能由“已连接”推导为整 workspace 可读。([Notion capabilities](https://developers.notion.com/reference/capabilities), [Notion public connection authorization](https://developers.notion.com/guides/get-started/public-connections))
- Microsoft Graph 的 delegated permission 代表登录用户行事，而 application permission 代表应用自身且常需管理员同意；这说明企业数据必须在 tenant、主体和读取范围明确后再设计。([Microsoft Graph permissions overview](https://learn.microsoft.com/en-us/graph/permissions-overview))
- Slack Events 是按订阅与 OAuth scopes 投递的事件流，支持 HTTP 或 Socket Mode；事件 channel 仍需被当作独立来源，不能默认等同于消息库读取。([Slack Events API](https://docs.slack.dev/apis/events-api/))
- OpenAI 的官方产品文档也将按需 read/search、预先同步并索引的 sync、以及 create/update 等 write action 分成独立能力；默认“Important actions”允许读取，但对会影响外部世界、暴露敏感信息或难以撤销的动作要求确认。同步连接断开后会停止未来同步与访问，已有对话/记忆中的副本另有删除生命周期。([Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt), [Apps with sync](https://help.openai.com/en/articles/10847137-chatgpt-synced-con))
- Gmail API 将 `gmail.readonly`、`gmail.compose`、`gmail.send` 分为不同 scopes；完整邮箱读取类 scope 属于 Restricted，生产环境可能需要 OAuth 验证与安全评估。因此“私人只读”与“外发”必须是两个授权，首批不应做全邮箱同步。([Gmail OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes))

## D-10 / D-15 / D-16 / D-17 的统一授权记录

每一个外部来源授权至少应可审计地表达：

```text
sourceId, sourceClass, provider, accountOrTenant,
resourceScope, toolScopes, allowedOperations,
grantId, grantedAt, expiresAt, revokedAt,
sensitivity, paid, syncMode,
authorizationDecision, noticeShownAt,
confirmationId, confirmedBy, actor
```

- **D-17**：授权键为 `sourceId + resourceScope + toolScopes + allowedOperations`；必须有 `expiresAt` 和即时 `revokedAt`。有效期由授权时明确选择，不在研究中虚构统一天数。
- **D-10**：在有效且未撤销的授权内，只读预授权外部来源可自动执行，并在聊天/工作台可见告知；敏感、付费、未授权或扩范围先确认。
- **D-15**：动作类请求始终创建待确认项，展示目标与影响；自动输出仅为候选/草稿，不能把候选、结果或工作项标为 confirmed。
- **D-16**：每次检索另外记录 `query, reason, scope, sources, searchedAt, resultLocator`。命中不自动入库；实际支撑判断或行动时，连同来源版本/时间进入稳定项目依据；外部执行结果作为新依据，保留历史并触发需要的复查。

对外来源的撤销须同时停止未来读/同步/事件处理，撤销记录本身保留；已有的项目依据保留其历史来源和当时有效性，不能因撤销被静默抹去。

## 与当前产品的差异

当前 `app/api/knowledge/web-search/route.ts` 和 `shared/anysearch/client.ts` 已能经 AnySearch 做公开搜索；但它们没有 D-17 所需的来源授权、范围、有效期或撤销记录。`WebSearchPanel.tsx` 是独立展示组件，仓库内没有主页面对它的引用；故 **AnySearch client + API 已有，主页面尚未接通此搜索面板**。当前路径也没有完整 D-16 的 reason/scope/sources/time → 候选 → 被引用依据链。

当前仓库没有 OAuth 私人连接器、webhook 事件源或企业数据连接器。`agent-run` 仍会以 `agent:project-reviewer` 写入 `confirmed`；这与 D-15 的“自动输出不得自确认”冲突，不能作为外部来源自动化的基线。

## 首批验收门（供后续规格，不构成实现授权）

1. Owner 能在聊天与工作台看到来源类别、资源范围、有效期、状态及撤销入口；同一主 Agent 身份与项目记忆双向同步（D-14）。
2. 一个已授权 GitHub 仓库之外的读取/事件不会发生；过期或撤销后同一调用被拒绝并留审计记录。
3. 公开搜索与 GitHub 命中均先是候选；只有实际引用到判断/行动的结果才成为带来源定位和时间的项目依据。
4. 所有外部动作停在可读的确认卡片；无确认 ID 的发送、创建、修改、删除、支付请求不可出站，且 Agent 无法自行确认。
5. 每个后续 connector 或 spike 仍须满足 T-11/D-13：固定版本、源码符号、行为与现有 TypeScript seam 的映射、直接/传递许可审查、验证、差异与退出边界。

## 仍需 Owner 在实施前选择

1. 私人文档试点选 Google Drive 的 Picker 文件范围，还是 Notion 的选定页面范围；首批不能并开两者。
2. 授权有效期的具体产品选项与默认值；本研究只确认“必须有 expiry”，未替 Owner 编造期限。
3. GitHub 首批精确只读权限（例如 contents、issues、pull requests）和允许的 webhook 事件列表；均应随首个真实任务最小化。
