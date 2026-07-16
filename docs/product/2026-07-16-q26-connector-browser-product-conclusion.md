# Q-26 产品结论：Connector 与浏览器各自做什么

- 日期：2026-07-16
- 依据：D-10、D-13、D-15～D-18；G3/G4/G5/G6 的 T-15 只读证据。
- 边界：这是产品分工与安全结论，**不是实现规格，也不授权账号接入、adapter/spike、生产代码或外部动作**。

## 一句话结论

主 Agent 先使用项目内真相；外部资料优先走有稳定对象与只读 API 的 Connector；只有 API 不够且确实需要用户既有网页登录态或渲染页面时，才由浏览器作为显式、Owner 可见的回退。

Connector 解决“从明确的数据对象稳定读取”；浏览器解决“没有适合 API 时观察网页”。二者都不能替产品决定授权、把结果确认为知识，或绕过外部写入确认。

## Owner 可见的分工

| 场景 | 先用什么 | Owner 应看见 | 不应发生 |
|---|---|---|---|
| 解释项目为何变化 | 项目内材料、事件与依据 | 检索原因、项目范围、命中材料 | 先开外网或把命中当结论 |
| 查已选 GitHub 仓的提交、文件、Issue、PR、仓库活动 | GitHub 只读 API / Connector | 仓库名、只读范围、对象 ID/链接、时间；结果标候选 | 浏览器抓整页、换仓或扩范围而不问 |
| API 没有字段、必须看渲染页面 | 浏览器回退，默认观察 | 为什么 API 不够、URL、时间、回退/高噪声标签 | 静默使用登录态、点击提交或外发 |
| 查私人文档 | D-18 后续的 Owner 选定 Drive 文件 | 文件范围与只读授权 | 整个 Drive 或邮箱同步 |
| 邮件、创建 Issue、发送/修改/删除/支付 | 以后才讨论 | 清楚的待确认动作卡 | 作为首批能力或自动执行 |

## D-18 的首批产品边界

1. 公开只读网络检索：保留为候选来源，补足 D-17 授权/范围/期限/撤销与 D-16 检索轨迹后才能称为完整产品路径。
2. 一个 Owner 选定的 GitHub 仓：仅读取 code、Issue、PR 和相关仓库活动；先按需查询，不做全量同步。
3. 随后才试点 Owner 选定的 Google Drive 文件；Gmail 全量同步和所有外部写入继续后置。

“仓库活动”在当前 OpenConnector 源码中是 API 轮询读取，不是入站 webhook feed；产品不应把它描述成已具备实时推送。

## 对两个候选的产品判断

| 候选 | 可作为什么 | 不能被当作什么 | 当前事实 |
|---|---|---|---|
| OpenConnector | GitHub 等稳定 SaaS API 的凭证隔离、受限 action transport 与对象读取的**候选** | 产品授权记录、Owner 确认、知识升格、外写幂等责任的替代品 | 当前源码 `1fc404feeb76`（Apache-2.0）有 GitHub 按需读 actions；private repo scope 声明偏宽，必须在产品层限定选仓/只读 action。未获采用批准、未做真实 smoke。 |
| Chijie 浏览器插件 | 用户现有浏览器会话中的观察/回退，以及其内部的动作确认和页面观察结果 | 本产品已经可调用的 Connector，或绕开 D-15 的网页动作通道 | 扩展内已有观察、动作、审批与完成观察；没有给 fc-opc-ibot 的外部调用 API。当前只能是 Owner 主动使用后再带回结果的回退，不是产品一体能力。 |

未来若 Owner 授权可编程浏览器桥，边界应仍由产品持有、调用范围限本地且凭证化，并保持 Chijie 内的外部提交审批；不能把网页来源开放为广泛 `externally_connectable` 控制面。这是后续安全门，不是本结论的实现设计。

## 不可跨越的产品门

- **D-10 / D-17：** 每次外部读取要能显示来源、资源范围、有效期、撤销状态；敏感、付费、未授权和扩范围先确认。
- **D-15：** 外部发送、创建、修改、删除、支付和敏感操作都必须有绑定 Owner 的确认；Agent 不能确认自己的候选或结果。
- **D-16：** 外部命中先是候选；只有实际用于判断/行动的稳定对象链接、摘录和时间才进入项目依据。动作结果只是新依据，不能自动关闭工作项或升格为已确认知识。
- **D-13：** 将任何候选变成 adapter/spike 之前，必须完成 T-11 的固定版本/源码符号、许可、行为映射、验证、差异和退出边界记录。

旧的 `github.create_issue` 实验不符合这些门：它是 D-18 禁止的首批外写，且 UI 确认可被 API 绕过、hash 只证明内容新鲜而非 Owner 同意、重新 prepare 可生成新 attempt，亦没有 D-17 授权记录。因此它不构成 Connector 已接入或可复用的产品证明。

## 当前产品事实

- `shared/anysearch/client.ts` 与 `app/api/knowledge/web-search/route.ts` 存在，但主页面尚未接通 `WebSearchPanel`；并且缺少 D-16 完整证据链和 D-17 授权记录。
- 当前工作分支不存在 `shared/openconnector/`；拒绝的 OpenConnector 实验不在当前分支。
- 当前 Chijie manifest 没有外部 call-in 接口；fc-opc-ibot 不能向它直接发起浏览器任务。
- 当前产品没有 Owner 可用的“已选 GitHub 仓只读”面，也不能声称有浏览器回退的一体写回。

## 尚待 Owner 指定，才可转下一步研究/规格

1. 首个 GitHub 仓及最小只读对象集合（例如是否确需 commits、contents、Issues、PR、repository events）。
2. 随后的 Drive 试点文件范围；不得由“连接了 Drive”扩大为整盘读取。
3. 是否在首个真实场景后授权 T-11 级别的隔离 spike；在此之前不进入实现规格。

## 证据

- G3：`docs/research/2026-07-16-openconnector-current-source-audit.md`；`.ship/handoffs/G3-openconnector-current-source-audit-DONE.md`
- G4：`.ship/research/grok-followups/G4-openconnector-browser-boundary-falsification.md`；`.ship/handoffs/G4-openconnector-browser-boundary-falsification-DONE.md`
- G5：`docs/research/2026-07-16-chijie-integration-seam.md`；`.ship/handoffs/G5-chijie-integration-seam-DONE.md`
- G6：`docs/product/2026-07-16-agent-external-tools-owner-scenario.md`；`.ship/handoffs/G6-openconnector-browser-owner-scenario-DONE.md`

