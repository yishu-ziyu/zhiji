# T-20：首批来源登记、授权回执与检索留痕最小合同

状态：D-29 / Q-05 的研究与合同预备；已纳入 D-41/D-42 修正。它定义来源边界和可审字段，**不**选择 Q-06 的关键词、语义、排序、图遍历、重排或 Agent 编排方法；不构成生产接入授权。

## 0. D-41 / D-42：检索服务于状态与变迁重建，可信来自可追溯字段

检索产品首先要为一件事项重建**项目状态与状态变迁**，而不是返回“文档命中”或“最高分 Card”（D-42 · Q-06–Q-08）：

| 状态问题 | 合同必须能返回 |
|---|---|
| `current` | 当前状态（state@t）：来源 revision、事实/判断/决定、未知、行动、结果。 |
| `historical` | 指定过去时间或精确 revision 时的状态。 |
| `what_changed` | 两个状态之间的变更（transition 的 change）。 |
| `why` | 导致变化的 source event、决定、冲突和证据。 |
| `what_depends` | 被影响的事项、判断、行动、结果及反向链接。 |
| `what_evidence` | 支持每个状态/转变的不可变 source/evidence revision。 |

**transition** 必须可审并保留 **before / change / after**。D-31 的关键词/元数据、一层关系、语义 chunk、授权外部 API/GitHub、浏览器回退只是在带 reason/scope/receipt 的前提下帮助回答上述问题的工具。它们不是产品定义；向量或 rank 也不能成为真相层。

可信答案（D-41）必须暴露：**来源种类 + 精确 revision**、**推导或 Owner 决定**、**last checked**、**冲突/缺口**、**下游使用**。任何 confidence/score 仅能是可诊断的检索信号，不能替代这些 trace。

**Q-11 / OA-18（未批准）：** 新结果不得覆盖旧理解；应建可审 transition（before · 触发/结果/证据 · 提议 after · 受影响依赖 · 谁批准）；current 指针仅在确认/规则后移动；历史保留。

## 1. 合同要解决的事

Owner 需要能回看一次检索的四件事：

1. 查的是哪个项目、为什么查；
2. 当时允许查哪些明确来源和资源边界；
3. 实际读到了哪些对象、哪个 revision、何时完成；
4. 结果仍是命中/候选，还是后来被明确用作项目依据。

因此分成三类记录，而不是把它们混进一张 Card：

| 记录 | 回答的问题 | 不代表什么 |
|---|---|---|
| 来源登记 `SourceRegistryEntry` | 这是什么来源、可读边界和风险分类是什么？ | 不代表已授予访问、已读取内容或已成为知识。 |
| 授权回执 `AuthorizationReceipt` | 谁在何时为哪个来源边界授权了哪些只读能力？ | 不存 token/密码，不代表每一次检索成功。 |
| 检索留痕 `RetrievalTrace` | 这次为什么、何时、在何范围内读了哪些精确对象，结果如何处置？ | 不代表命中已被接受为项目知识。 |

## 2. D-29 首批来源分类

`stage` 只表达 D-29 的产品批次，不表达技术实现成熟度；`sourceClass` 用于 D-10 的授权判断。

| 来源 | `stage` | `sourceClass` | 资源边界示例 | 能力边界 |
|---|---|---|---|---|
| 当前项目真相（项目 Card、Material、Relation、WorkEvent） | `first` | `internal_project` | `project:<projectId>` | 项目内读/检索；不隐式跨项目。 |
| Owner 选定的本地文件夹或代码仓 | `first` | `owner_selected_local` | `local-folder:<selectionId>` / `local-repo:<selectionId>` | 仅选中的根及其明确包含项；不扫磁盘其他位置。 |
| 公开网页 | `first` | `public_web` | `web:public`，可再加域名/URL 约束 | 只读公开对象；结果需 URL 与抓取时间。 |
| 一个 Owner 选定 GitHub 仓 | `first` | `selected_github_repo` | `github:<owner>/<repo>` | 只读 commits/files/issues/comments/PR/reviews/events 的明确对象集；无 create/update/merge/delete。 |
| Drive Picker 选定文件 | `later_selected_file` | `picker_selected_drive_file` | `drive-file:<fileId>` | 仅经 Picker 选中的文件；不是 Drive 搜索或账户同步。 |
| Gmail、Calendar、Messages、整账号同步 | `deferred` | `account_private` | 不建立可用边界 | 不读取、不连接、不索引；未来须独立决定。 |

`sensitive` 与 `paid` 不是来源类别；它们是每一条来源登记都可附加的风险标识。任何 `sensitive=true`、`paid=true` 或尚未有有效授权的外部来源，依 D-10 必须在调用前取得确认。

## 3. 最小字段合同

### 3.1 来源登记 `SourceRegistryEntry`

一条登记只代表一个可解释的来源边界；同一 GitHub 仓、同一选定本地根或同一 Drive 文件各是一条，不用“所有外部来源”这种全局条目。

| 字段 | 必填 | 含义与约束 |
|---|---:|---|
| `id` | 是 | 稳定、不可复用的来源登记 ID。 |
| `projectId` | 是 | 这条来源归属的唯一项目；不得以空值表达全局发现。 |
| `stage` | 是 | `first` / `later_selected_file` / `deferred`。`deferred` 不可用来发起检索。 |
| `sourceClass` | 是 | 上表六类之一，决定 D-10 默认/确认策略。 |
| `displayName` | 是 | Owner 能看懂的名称，例如“fc-opc-ibot GitHub 仓（只读）”。 |
| `resourceBoundary` | 是 | 机器可比较的选择边界，例如 `project:<id>`、`github:owner/repo`、`drive-file:<id>`；不接受 `all`、`*` 或账号根。 |
| `selectedResourceIds` | 是 | 被 Owner/Picker 明确选择的根、仓或文件 ID；项目内为当前 `projectId`。 |
| `capabilities` | 是 | 仅允许 `read`、`list`、`metadata`；首批不含写能力。GitHub 必须列出允许对象类型。 |
| `sensitive` / `paid` | 是 | 布尔风险标记；任一为真不能仅靠预授权自动调用。 |
| `credentialRef` | 否 | 仅 vault/connector 内部引用 ID；绝不保存 access token、refresh token、cookie、密码或 API key。公开匿名读取为 `null`。 |
| `createdAt` / `createdBy` | 是 | 登记的时间与人类 actor。 |
| `updatedAt` | 是 | 边界、能力或风险标识最后变动时间。 |

来源登记没有 `content`、抓取正文或“已确认”字段。实际对象只进入检索留痕；被实际选用的内容再走 D-16 的候选/依据/Owner 确认链。

### 3.2 授权回执 `AuthorizationReceipt`

回执与来源登记分离，便于同一来源在撤销、重新授权或改变范围后保留历史。

| 字段 | 必填 | 含义与约束 |
|---|---:|---|
| `id` / `sourceId` / `projectId` | 是 | 稳定回执 ID，且必须指向同项目的来源登记。 |
| `decision` | 是 | `automatic_internal`、`preauthorized_external`、`confirmed_external`、`denied`、`revoked`、`expired`。 |
| `approvedCapabilities` | 是 | 回执实际允许的 `read`/`list`/`metadata` 子集，不能超过登记的 `capabilities`。 |
| `approvedBoundary` | 是 | 对 `resourceBoundary` 的精确或更窄限制；绝不允许扩大。 |
| `grantActor` / `grantedAt` | 是 | 人类 Owner 或明确系统策略身份与时间。 |
| `expiresAt` | 条件必填 | 非内部来源必须有；内部可为 `null`，但仍受项目状态约束。 |
| `noticeRequired` / `noticeShownAt` | 是 | 预授权外部读取要求可见告知；内部可为 `false` / `null`。 |
| `confirmationRef` | 条件必填 | 敏感、付费、未授权或扩展范围时，记录本次调用前确认的关联 ID。 |
| `revokedAt` / `revokedBy` / `revokeReason` | 否 | 一旦撤销立即写入；后续调用必须拒绝，旧 trace 保留。 |
| `credentialRef` | 否 | 只能等于/细化来源登记的安全引用，绝不包含秘密本身。 |

有效性判定固定为：`decision` 属于可允许值、未过期、`revokedAt` 为空、能力和边界均为登记的子集；任何一项不成立即不调用外部来源。该判定不涉及如何搜索。

### 3.3 检索留痕 `RetrievalTrace`

一次 trace 描述一次 Owner/Agent 发起的检索意图及其结果；它可以有零个命中，也必须保留失败事实。

| 字段 | 必填 | 含义与约束 |
|---|---:|---|
| `id` / `projectId` | 是 | 稳定 trace ID 和唯一项目范围。 |
| `stateQuestion` | 是 | `now/then/what_changed/why/what_depends/what_evidence` 之一；一次普通文本查询也必须声明它辅助回答哪个状态问题。 |
| `stateAnchor` | 条件必填 | 当前事项 ref，或 `then` 的时间/revision、`what_changed` 的两端 revision；没有锚点则明确结果只为 compact trace。 |
| `reason` | 是 | 人能读懂的检索理由；不得只留 query。 |
| `queryOrRequest` | 是 | 原始查询或对象请求；不规定其如何被解析/改写。 |
| `requestedSourceIds` | 是 | 本次允许尝试的来源登记 ID 列表；不得由全局目录隐式补充。 |
| `requestedBoundaries` | 是 | 对每个 source 的实际范围快照，便于以后审计范围变更。 |
| `authorization` | 是 | 每个 source 的 `receiptId`、`decision`、调用时的有效性结果与 `noticeShownAt` 快照。 |
| `startedAt` / `finishedAt` | 是 | 实际开始与结束时间；不以结果创建时间替代。 |
| `actor` | 是 | 发起者（Owner、Agent 或内部系统）；Agent 不能借此确认知识。 |
| `provider` | 是 | `internal`、`local`、`public_web`、`github`、`drive` 等来源执行标签；不是检索算法名称。 |
| `objects` | 是 | 零至多条 `RetrievedObjectReceipt`。 |
| `outcome` | 是 | `completed`、`partial`、`denied_before_call`、`failed`、`cancelled`。 |
| `failure` | 条件必填 | 非 completed 时记录 `code`、安全的 `message`、`at`、`retryable`；不得记录 credential 或敏感正文。 |
| `supersedesTraceId` | 否 | 复查/重检可指向旧 trace；不覆盖旧记录。 |
| `conflicts` | 是 | 已知相互冲突的 object/revision refs 或明确空集；不把冲突藏进分数。 |
| `useHistoryRefs` | 是 | 指向已依赖该对象的 matter/judgment/decision/action/result；可为空，但不能把“未使用”伪装成支持当前状态。 |

`RetrievedObjectReceipt` 的最小字段：

| 字段 | 含义 |
|---|---|
| `sourceId` / `boundary` | 它来自哪条登记与哪一个实际边界。 |
| `objectLocator` | 可复现对象定位：项目 card/material/event ID、本地相对路径+选定根、URL、GitHub `owner/repo` + commit/blob/issue/PR ID、或 Picker file ID。 |
| `revision` | 可用时必须记录：hash、Git SHA/blob SHA、ETag、版本或修改时间；没有则明确 `null`，不能假造新鲜度。 |
| `retrievedAt` / `lastVerifiedAt` | 本次取得与最后成功核对时间；二者可以相同。 |
| `observedAt` / `effectiveAt` / `stalenessReason` | 何时观测、何时生效以及为何需要复查；未知必须显式为 `null`，不能由 score 代填。 |
| `disposition` | `hit`、`opened`、`candidate`、`cited_as_evidence`、`rejected`、`unavailable`。默认是 `hit`；只有实际支撑判断/行动时才转为 `cited_as_evidence`。 |
| `candidateRef` / `evidenceRef` | 可选地指向项目候选或稳定依据；不能因此把结果设为 Owner-confirmed。 |
| `provenanceChain` / `conflictRefs` / `useHistoryRefs` | 到 source/event/receipt 的精确 revision 链、已知冲突与下游使用反链；不能以 opaque rank 替代。 |

### 3.4 D-32 / Q-07：处置复用既有身份，不另立生命周期

`RetrievedObjectReceipt.disposition` 是一次检索中对象的**处置**，不是新的知识状态机。它必须映射到 T-16/T-20 已有的 trace、revision、evidence、candidate、confirmed knowledge 与 review-needed 语义：

| D-32 结果身份 | 本合同中的记录方式 | 复用的既有身份/约束 | 禁止的捷径 |
|---|---|---|---|
| 未使用命中 | `RetrievalTrace.objects[]` 只留 `disposition: "hit"`（或不可用时 `unavailable`）及其 locator/revision。 | 仅是紧凑 trace；没有 `candidateRef`、`evidenceRef`。 | 不创建 Card、Relation、WorkEvent 结论或“已验证”标签。 |
| 被实际使用的结果 | 同一对象改为 `disposition: "cited_as_evidence"`，写 `evidenceRef`，并把当时 `objectLocator + revision + retrievedAt` 固定为证据快照。 | 复用项目现有 evidence/card 引用与 T-20 revision 字段；证据是项目依据，不等于 confirmed knowledge。 | 不能只保存 URL、最新正文或搜索排名；不能用新内容覆盖旧 snapshot。 |
| Agent 基于依据的结论 | 结论记录 `candidateRef`，其输入 evidenceRef/traceId 可回点。 | 复用 T-16 的 `KnowledgeCard(identity: "candidate")` / result-event locator 语义；工作项 `confirmed` 绝不是知识确认。 | Agent 不能把自己的候选设为 evidence confirmed、claim confirmed、relation confirmed 或工作完成。 |
| Owner 确认的主张/决定 | 确认记录只引用既有 candidate/evidence，并写 Owner actor/time；相关 claim 使用现有 `confirmed knowledge` 身份。 | 复用既有 confirmed-knowledge identity；保留候选、依据和确认人的可回链。 | 不创建第二套 `accepted_result`、`promoted_hit` 等平行状态；不能把 trace disposition 本身当 Owner 确认。 |
| 来源改变 | 新 trace/object receipt 记录新 revision，保留旧 `evidenceRef` 的 snapshot；通过既有 `review-needed` / stale 语义标出依赖对象。 | 复用 T-20 `supersedesTraceId` 和既有 review-needed 身份；旧快照、旧结论和当时依据仍可读。 | 不静默替换证据正文、revision 或 confirmed knowledge；不能因新版本自动否决或重新确认 Owner 主张。 |

因此 `disposition` 的允许推进只有：`hit → opened/candidate → cited_as_evidence`；它**不能**推进到 Owner-confirmed knowledge。候选、确认、复查分别仍由既有 T-16/T-20 身份承载。

## 4. 当前代码盘点与合同落点

| 当前 seam | 精确路径/符号 | 事实 | 与本合同的差距 |
|---|---|---|---|
| 内部查询会话 | `shared/types/knowledge.ts#QuerySession` | 现有 `id, query, filters, at, hitCardIds, scores`。 | 缺 `reason`、来源登记/边界、授权快照、开始/结束、对象 revision、处置和失败。 |
| 内部检索足迹 | `shared/knowledge/repository.ts#recordSearchFootprint` | 将内部 Card hit 与 `retrieved` FootprintEvent 写入 `query-sessions.json` / `footprint-events.json`。 | 只能指向已有 Card；不等于 D-16 完整 trace，也不覆盖外部对象。 |
| 项目搜索 API | `app/api/knowledge/search/route.ts` 的 `GET`/`POST` | 项目过滤可选；调用 `searchKnowledge`、`searchProjectRecords` 与 `recordSearchFootprint`。 | 没有强制 reason；没有来源/授权字段；项目 ID 可缺失，不能作为 D-29 外部合同。 |
| 公开网页代理 | `app/api/knowledge/web-search/route.ts`；`shared/anysearch/client.ts#anySearch` | 返回 provider、query、domain、hits、elapsedMs、authMode。 | 没写 QuerySession/footprint，不留原因/范围/授权/对象 revision；不是来源登记或授权回执。 |
| 当前项目范围 | `shared/knowledge/repository.ts#getProjectCanvasSnapshot` | 验证 focus 属于当前项目。 | 这是画布范围检查，不是来源登记或检索授权。 |
| GitHub/Drive/Gmail 运行时 | `shared/github/`、`shared/openconnector/`、Drive connector | 本产品路径不存在。 | D-29 只允许合同预备；不授权安装、账号连接、读取或路由。 |

## 5. 不可违反的规则与可证伪情形

| 不变量 | 直接失败的例子 |
|---|---|
| 没有隐式全局范围 | `projectId` 缺失仍搜索所有项目；`resourceBoundary="*"`；未选定 GitHub 仓却遍历账号仓库。 |
| 首批只读、无外写 | GitHub create/merge/comment、Drive 写入、邮件/日历发送，或任何写 capability 出现在 D-29 回执。 |
| 不做账号级同步 | 以“已连接 Gmail/Drive”为由列举或索引整个账户；Drive 不是 Picker 文件即读取。 |
| 撤销立即生效 | `revokedAt` 后仍允许新调用，或靠旧 receipt 缓存绕过检查。旧 trace 可读但不可续查。 |
| 敏感/付费单独确认 | `sensitive`/`paid` 外部来源仅因先前 read grant 自动执行，或没有 `confirmationRef` 即开始调用。 |
| 来源登记不等于内容已获取 | 仅创建 registry entry 就生成 Card、知识或“已验证”标记。 |
| 检索命中不等于知识被接受 | trace 的 `hit`/`candidate` 自动变 `cited_as_evidence`、Owner-confirmed knowledge、关系 `confirmed` 或工作项 `done`。 |
| 复查不抹历史 | 新 revision 覆盖旧 `objectLocator`/revision/trace，而没有 `supersedesTraceId` 或复查原因。 |
| 凭据不进合同 | token、cookie、密码、API key 或完整 OAuth payload 写进任何三类记录、日志或 failure。 |

## 6. 尚未决定、也不应由 T-20 决定的事

- Q-06：何时用关键词、元数据、关系、语义、混合检索、重排或 Agent 计划。
- 各 provider 的具体 API/SDK、连接器、OAuth scope、凭据保管实现与依赖选择。
- 哪条命中何时可升级为候选、稳定依据、已确认知识或决定的完整 UI/流程；本合同只保留引用点和禁止自动晋升。
- Drive Picker 的具体交互、Gmail/Calendar/Messages 是否及何时开放。

这些问题需要后续单独授权；本合同没有执行外部读取、安装连接器、访问账号或修改产品代码。
