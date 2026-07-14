# `02b-china-product-map.md` 架构交叉审查

范围：只审查 Agent / 人 / 确定性程序边界、代码改造图和 180 秒 Golden Path；不改产品决策。

## P0

### P0-1｜“客户本人确认 / 服务方不能代点”目前没有被身份系统证明

**问题**

当前实现只有路由和状态角色分离，没有身份授权：provider 的 `slips` 写接口无登录校验；client action 只凭 URL token；服务方创建并拿到该 URL，因此也能打开客户页。`clientToken` 目前不绑定提案版本、没有过期/单次消费，并在重发时复用。现状只能证明“provider API 不能声明 client actor”，不能证明点击者就是客户本人。

**修改建议**

- 决策稿在未加身份验证前，将“客户本人确认”“服务方不能代点”收窄为“独立客户能力链接执行 client 状态；provider 路由不能执行 client transition”。
- 若比赛必须证明客户身份，引入最小客户验证：预绑定手机号/邮箱 OTP，或已登录客户账户；单纯 bearer link 不能证明身份。
- 新增 `ClientGrant { proposalId, proposalRevision, baseVersion, expiresAt, nonce, consumedAt }`；修改提案、重发、过期或成功消费后立即失效。
- Provider 端至少增加比赛可用的 session/secret；不要只信请求体中的 actor。
- 必测：未登录 provider 写入、provider 调 client action、过期 token、旧 revision、重放、确认后再编辑。

### P0-2｜提案状态机没有定义“逐项权威”和混合批准的聚合规则

**问题**

文档同时要求每个 impact 有 `requiredAuthority` 和逐项批准，却只给出线性的 proposal 状态：`draft → provider_approved → pending_client → client_confirmed → applied`。一张提案可能同时包含 provider-only、client-required、未知/弃权和被拒绝 impact；目前没有定义哪些 impact 能进入下一步、客户确认的是哪一版、服务方编辑后旧确认是否失效。

**修改建议**

- 将状态放到两个层级：`ChangeImpact.reviewState/authorityState` 与 `ChangeProposal.aggregateState`。
- 明确守卫：只有被服务方选中且 schema 有效的 impacts 能发送；需要客户权威的 impacts 必须确认同一 `proposalRevision`；任一发送后编辑都生成新 revision 并使旧确认失效。
- `request_changes` 不修改原提案，而是关闭当前 revision，创建新 revision 回到 provider review。
- provider-only impacts 可直接进入待应用集合；mixed proposal 只有所有被选 impacts 满足各自 authority 后才可整体应用，或明确支持分批应用，二者只能选一个。

### P0-3｜“原子应用”必须是基线版本 CAS，而不只是先检查再写

**问题**

文档提到 `baseVersion`、旧版失效和幂等，但没有把它们收敛为唯一写入命令。若“检查当前版本”和“写入新版本”分散在 route/repository，多请求仍可能让旧提案覆盖新基线；现有 `Map` 也没有 proposal revision 或 apply idempotency。

**修改建议**

- 建立唯一领域命令 `applyApprovedProposal(proposalId, revision, expectedBaseVersion, idempotencyKey)`；所有 route 都只能调用它。
- 同一临界区内执行：校验当前 baseline version、权限/批准、token/revision、幂等键 → 创建新 baseline → 标记旧 baseline 只读 → 生成派生 effect/event。
- stale 返回明确的 `409`，重复 apply 返回第一次结果，不再次创建任务。
- 比赛内存实现可声明“单进程 all-or-nothing”；“生产级原子”必须等关系数据库事务/唯一约束完成后再声称。

### P0-4｜原文证据目前仍可能是模型生成的伪引用

**问题**

现有 `sourceExcerpt` 是普通字符串，代码没有证明它逐字存在于不可变 `SourceEvent`。新 prompt 即使要求引用原文，模型仍可能改写或拼接。若证据不可机器校验，核心卖点“带原文证据的 diff”不成立。

**修改建议**

- 文本证据改为 `EvidenceSpan { sourceEventId, start, end, sha256 }`，服务端校验 `rawText.slice(start,end)`；展示文本由程序截取，不接受模型自填 excerpt。
- 截图先形成带哈希的原图和 OCR block；引用使用 `page/bbox/blockId`，展示时回到原图定位。
- LLM 只产生 draft；schema 明确 `unknown/abstain`。价格、付款、验收等字段在没有精确证据时不得生成可应用值。
- 模型/解析失败只记录 attempt，不产生可批准 impact，更不能修改 baseline。

### P0-5｜180 秒路径目前不是现有代码可执行的验收面

**问题**

当前代码没有 ProjectBaseline、ChangeProposal、proposal revision、原子 apply 或里程碑/任务派生；客户 token 也没有版本失效。Golden Path 还假设手机可访问本机链接、模型稳定返回、旧链接立即失效。若这些条件未做成自动验收，演示只能靠口述。

**修改建议**

在宣布路径可跑前增加一个单一 E2E acceptance：

1. 载入固定 v1 baseline；
2. 提交固定客户文本，模型或明确标注的 deterministic fixture 在超时上限内返回；
3. 验证证据 span、价格 `unknown`、日期冲突和 abstain；
4. provider 生成 `+¥2,000 / 周一` 的**反提案**并发送；
5. 手机/第二 browser context 使用 revision-bound token 确认；
6. CAS 应用得到 v2，v1 只读，旧 token/replay 返回 409；
7. 本地里程碑/任务/Waiting-for 派生一次且只一次。

现场使用已部署 HTTPS 地址或事先验证的局域网地址，并提供二维码；不要在 125 秒时才临时复制 URL 到手机。模型设置短超时并预热，fixture fallback 必须在 UI/日志中明确标识，避免把 fixture 演成实时 Agent。

## P1

### P1-1｜外部写回与本地派生必须在演示中分开命名

**问题**

文档把渠道 adapter、外部写回回执和失败补偿放到“非首个切片”，但 Golden Path 的“里程碑/任务/等待同步”容易让评委理解为已写回飞书/钉钉。

**修改建议**

- 首切片只展示并命名为“本项目内的 deterministic derived effects”。
- 每个 effect 显示 `planned/applied/failed`，并保存本地 receipt；外部系统未接入时不要展示飞书/钉钉成功标识。
- 外部 adapter 完成后再增加 `externalReceipt`、重试与补偿语义。

### P1-2｜不要把新 aggregate 继续塞进 legacy `slips` route 和单一 `types.ts`

**问题**

“逐步迁移 `slips/route.ts`”容易让旧 CommitmentSlip 和新 ChangeProposal 共享一个动作分发器、状态和 token 语义，增加比赛前回归风险；把所有新类型放入 `shared/delivery/types.ts` 也会扩大耦合面。

**修改建议**

- 新建独立 `shared/delivery/change-proposal/`：`types.ts`、`schema.ts`、`state-machine.ts`、`apply.ts`。
- 新建独立 proposal repository/route；legacy slip 只作为兼容展示或 fixture adapter，不承载新写入规则。
- UI 可复用客户页和样式，但 API contract 不复用旧 token/status。
- 共享的只有小型 primitives：actor、event envelope、money/date 类型。

### P1-3｜SourceEvent 创建和模型重试需要单独幂等

**问题**

`impact-diff` 先创建 SourceEvent 再调用模型是对的，但重试可能制造重复事件/提案；“模型失败不修改业务状态”也不应删除原始输入和失败审计。

**修改建议**

- SourceEvent 用调用方 request id 或 `projectId + channel + sourceMessageId/contentHash` 去重。
- 一个 SourceEvent 可有多个 immutable `AnalysisAttempt`，但同一成功 attempt 只能产生一个 proposal revision。
- 保存模型、prompt/schema 版本、耗时、失败类型和 fixture 标记；业务 baseline 始终不受 analysis attempt 影响。

### P1-4｜180 秒脚本应压缩等待，突出可审计差异

**问题**

现脚本给 Agent 45 秒，容易把关键时间花在等待；末段只说“同步”，没有给评委一个可核查的闭环数字。

**修改建议**

- 将 Agent 返回目标压到 8–12 秒；多出的时间用于展示证据定位、`unknown` 和 human counterproposal。
- 在末屏固定显示：`baseline v1 → v2`、批准 impacts 数、未批准 impacts 数、派生 effects 数、stale objects `N → 0`、旧 token 已失效。
- 口播明确：“客户说按之前价格/周五；Agent 没有替他解释；服务方提出 +¥2,000/周一，客户确认的是这个新反提案。”

### P1-5｜E2E 应验证边界，而不只验证 happy path

**修改建议**

首切片至少包含：

- 模糊价格保持 unknown；证据不足正确 abstain；
- provider API 不能产生 client actor；
- provider 编辑后旧 client confirmation 失效；
- 同一 apply 请求重放不产生第二版/第二任务；
- baseVersion stale 时无任何部分写入；
- client request changes 后必须产生新 revision；
- 模型超时/坏 JSON 不改变 baseline；
- 手机 viewport Golden Path 可完成。

## P2

### P2-1｜金额、日期和验收字段应尽早采用不可歧义类型

**修改建议**

- 金额使用 `{ currency: "CNY", minorUnits: 800000 }`，不使用浮点或带符号字符串。
- 日期区分 date 与 instant，记录时区；“周五”保留解析依据和不确定性。
- 验收标准至少拆成文本、所需证据和判定方，避免一个自由文本字段承担状态权威。

### P2-2｜“AI 技术分”表述混合了 Agent 能力与软件工程护栏

**修改建议**

把结构化影响推理、冲突检测和正确弃权列为 Agent 能力；把权限状态机、幂等、版本 CAS、E2E 列为可信执行护栏。两者共同构成产品可信度，但不要把普通状态机包装成 AI 技术。

### P2-3｜原始客户证据需要最小保留与脱敏规则

**修改建议**

即使是比赛 Map，也应避免把完整微信文本写入普通日志；SourceEvent 记录创建者、用途、删除/保留策略，公共客户页只暴露该客户和该提案所需片段。生产化前再补租户隔离和正式数据治理。

## Recheck

### Remaining P0

无剩余文档级 P0。更新稿已把身份保证边界、逐 impact 权威、revision 失效、基线 CAS、证据机器校验、显式 fixture、独立新 aggregate、外部写回声明边界和单一 180 秒 E2E 转成明确开发约束。它也明确这些要求尚未实现，不能用设计稿替代运行证据。

### Remaining P1

1. **事实晋级还缺少显式代码落点。** `ProjectBaseline v2` 应保存 `FactProvenance`，至少包含 `sourceEventId`、`proposalId/revision`、`impactHash`、`requiredAuthority`、`actorAssurance`、验证事件和 `supersedes`；E2E 应证明下一次 Agent 只检索已应用 v2，不读取 draft、失败 attempt 或失效 revision。否则当前只证明版本更新，尚未证明“证据门控的可复用记忆”。
2. **权限与 grant 的负向测试仍未完整写进 E2E 清单。** 补充缺失/错误 provider secret、provider route 伪造 client actor、过期 `ClientGrant`、发送后编辑/重发使旧 grant 失效、已消费 grant 重放。现稿定义了这些守卫，但 acceptance list 只明确覆盖旧 token/replay。
3. **180 秒现场传输条件仍需成为验收约束。** 明确使用已部署 HTTPS 或已验证局域网地址、二维码/预打开第二 browser context、模型预热和硬超时；超时只能显示失败或由用户显式切换 fixture，不能在现场静默回退。当前脚本定义了 8–12 秒目标和 fixture 标识，但未约束手机如何可靠拿到链接。
