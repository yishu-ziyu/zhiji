# `02b-china-product-map.md` 简版交叉审查

审查日期：2026-07-13

总判定：方向比旧 `Waiting-for` 楔子更合理，但当前仍有 **3 个 P0、4 个 P1、2 个 P2**。最严重问题是：现有 guest link 不能证明客户身份；逐项权威与提案级状态机冲突；180 秒声称同步多个下游状态，但开发地图没有相应对象，现场可能只证明一张 AI 变更确认单。

## P0

### P0-1. “双边状态权威”目前只是接口分流，不能证明客户独立确认

- **证据**：决策稿 `02b-china-product-map.md:123-124,147,159,229,243-244` 声称服务方不能代点；但 `app/track/efficiency/use-provider-slips.ts:32-37,143-147` 由服务方保存和复制客户 token，`app/c/[token]/ClientActions.tsx:39-51` 和 `shared/delivery/repository.ts:135-160` 仅凭 token 执行客户动作。`tests/e2e/app.spec.ts:69-106` 只证明 provider API 拒绝 `confirm`，没有阻止持链服务方调用 client API。
- **影响**：当前最核心的“客户本人/双边权威”陈述不可审计；研究 `research/china-agent-mechanisms.md:72,182,294` 自己也把身份不可信列为失败。
- **建议**：若保留免注册 bearer link，就降级表述为“客户动作专用入口”，明确不验证真实身份；若“双边权威”必须成为创新证明，则引入客户控制的 OAuth/OpenID/OTP/渠道回调，并将批准绑定 `actorId + proposalVersion + impactHash`。新增 E2E：服务方即使知道 proposal ID 和发送凭据也不能产生 `client_confirmed`。

### P0-2. 180 秒承诺的多状态同步没有对应数据对象，尚不能证明比提醒器多

- **证据**：决策稿 `02b-china-product-map.md:25-31,148-150,230` 声称新基线会传播到里程碑、任务、Waiting、验收和付款；但首个切片 `:252-263` 只新增 Project/Baseline/SourceEvent/Proposal/Impact，没有 `Milestone`、`Task`、`WaitingItem`、`PaymentMilestone` 或 projection/action。现有 `shared/delivery/types.ts:42-55` 与 `shared/delivery/repository.ts:21-27` 只有独立 `CommitmentSlip`。
- **影响**：按当前地图开发，最后只能更新一份基线/确认记录；普通变更单或提醒器也能完成，无法展示“跨对象旧状态被消除”。
- **建议**：首个切片至少实现两个真实下游消费者，例如 `Milestone(deliveryDate)` 与 `PaymentMilestone(amount, trigger)`，可再加有 `owner/expectedEvidence/escalateAt/blockedObject` 的 `WaitingItem`。Golden Path 先展示两个既有旧对象，再显示 impact 定位与确认后的确定性更新。若不实现，删除“任务/Waiting/验收/付款同步”和“不是提醒器”的承诺，诚实收缩为版本化变更单。

### P0-3. 提案级状态机不能表达逐项权威和部分批准

- **证据**：决策稿 `02b-china-product-map.md:144-150,155-161,256` 要求每个 impact 有所需权威并逐项批准；实现地图 `:255` 却只有全局 `draft → provider_approved → pending_client → client_confirmed → applied`。研究最小结构 `research/china-agent-mechanisms.md:261-276` 原本把 `required_authority` 放在 impact 上，并分开 approval/execution。
- **影响**：一张提案同时含双方确认的价格/范围、仅服务方决定的内部任务、依赖系统回执的外部写回时，`client_confirmed` 无法说明具体批准了什么；客户修改也可能绕过服务方重审。
- **建议**：每个 impact 增加不可变 `impactHash`、`requiredAuthority`、`decisionState` 和审批记录；proposal 的 `applicable` 由所有已选 impact 的权威、当前 `baseVersion` 派生。客户修改必须生成新版本并返回服务方重审，旧链接 stale。若比赛范围过大，只演示一类双方共同确认的变更，不声称混合权威或部分批准。

## P1

### P1-1. 中国证据限制虽已写出，但目标用户和组委会答案仍说过头

- **证据**：`02b-china-product-map.md:10-15,62-68,303-313` 把“同时至少 3 个项目、主要在微信、状态不一致导致损失”写成确定场景；而 `research/china-scene-evidence.md:32-40,49-56,95-99` 明确小样本未观察状态失配，多平台不等于并发项目，T→S→O→L 缺失；`research/china-commercial-competitors.md:226-235` 仍把个人微信使用比例列为未知。
- **建议**：把“目标用户”改为“首轮招募筛选条件”，第 12 节改为“待验证场景假设”。对外只说“正在验证是否存在这样一批中国定制软件服务者”，不能把演示样例当中国发生率或需求证明。

### P1-2. 新方案只是降级 Waiting-for，没有解决“等待被忘记”

- **证据**：`02b-china-product-map.md:54-56,128-136,174,230` 仍生成 Waiting，但输入依赖用户主动粘贴；`:265-282` 没有首版调度、外部事件、回执或完整等待状态。`research/china-scene-evidence.md:85-91` 也只证明等待存在，不证明被忘记。
- **建议**：明确写“首个切片不解决 forgotten waiting；Waiting 仅是已批准变更的 projection”。若保留在演示，定义 `open → responded/overdue → resolved/cancelled`，包含责任方、期待证据、升级时间、阻塞对象和关闭事件；否则从 Golden Path 移除。

### P1-3. Golden Path 假设已有权威基线，但没有创建、导入或预置路径

- **证据**：`02b-china-product-map.md:112-115,140-145,220-227` 从“当前有效基线”开始；开发地图 `:252-263` 没有 baseline seed/import API、UI 或 fixture。当前 `shared/delivery/types.ts:32-55` 无 Project/Baseline，`app/api/efficiency/commitments/route.ts:77-95` 只接收当前 transcript。
- **建议**：比赛切片明确新增 deterministic `project-01` fixture 与 seed/reset；基线显示 version、确认来源和生效时间，E2E 先断言旧基线存在再输入新证据。不得把 fixture 说成已连接用户原系统。

### P1-4. 180 秒只能证明机制，不能单独证明中国场景价值

- **证据**：`02b-china-product-map.md:218-234` 中 Agent 找到范围、日期、价格歧义，随后价格/日期仍由服务方手改；真正“比提醒多发现一个真实后果”的门槛在 `:286-301`，不在演示中。`research/china-agent-mechanisms.md:172,194,205` 明确摘要、已知字段级联和提醒不是 Agent 增量。
- **建议**：路演只声明证明“当前版本检索、对象级 diff、弃权、权威确认、版本安全和确定性传播”；真实工件实验才证明损失与付费价值。现场至少显示两个输入前已存在的受影响对象，以及一个提醒器不能保证的安全条件，例如旧 proposal 因 `baseVersion` 已变化而拒绝应用。

## P2

### P2-1. 需要明确禁止沿用当前 LLM 的静默 mock fallback

- **证据**：决策稿 `02b-china-product-map.md:143-145,258-259` 要求弃权且模型失败不改状态；现有 `app/api/efficiency/commitments/route.ts:24-27,90-95` 会把非法 kind 默认成 `hard`，并在空结果/异常时静默返回 mock。
- **建议**：新 impact route 仅在显式 fixture 模式使用 mock；普通输入遇到超时、无效 schema、证据引用越界或空结果时返回 `abstain/error`。补 malformed、timeout、empty、out-of-evidence 测试。

### P2-2. 进程内 `Map` 只能证明演示内 all-or-nothing，不能暗示跨系统原子事务

- **证据**：`02b-china-product-map.md:148-150,256-257` 使用“原子应用”；`:278-284` 承认无持久化。`shared/delivery/repository.ts:21-27,49-56,101-108` 只是普通内存写入。
- **建议**：首版改称“单聚合、校验后提交”，用 failure injection 测试演示内不半应用；外部写回只报告 `succeeded/failed/partial` 与补偿，不宣称跨系统原子事务。

无其他 P0/P1。以下判断通过：证据稿没有用诉讼金额推市场；不再把 Waiting/自动优先级作为楔子；Agent/人/程序总体分工正确；没有声称静默读取个人微信或把确认页称为电子签；现有状态机、fixture、E2E 和 LLM seam 的复用判断基本符合仓库。针对当前承诺单运行的 4 个测试文件、17 个单测全部通过，但不覆盖上述新模型和身份缺口。

## Recheck

### Remaining P0

**无剩余文档级 P0。** 更新稿已经把 guest link 的身份限制、逐 impact 权威、revision/CAS、两个本地下游对象、显式 fixture 和非静默 fallback 写入开发要求；Golden Path 也明确只证明机制，不证明中国频率、损失或支付意愿。

### Remaining P1

1. **仍有两处容易脱离上下文变成“已验证”话术。** `product/02b-china-product-map.md:19` 仍写“它解决的不是……”，`:356-357` 仍写“发挥什么作用/解决什么问题”，而核心 T→S→O→L 尚待实物验证。虽然 `:5-10`、`:65-77`、`:91-94`、`:349-359` 已给出充分限制，路演摘句时仍可能丢失这些限定。建议改为“它拟解决/待验证的问题是”以及“假设发挥/拟解决”，或要求路演逐字保留“我们正在验证”。

Waiting 与 Golden Path **无其他剩余 P1**：`:58-61`、`:201`、`:310-315` 已明确首切片不解决 forgotten waiting；`:253-263` 已展示显式 fixture、两个输入前存在的本地对象、guest confirmation 限制、CAS/旧链接 409，并明确演示不是市场证据。
