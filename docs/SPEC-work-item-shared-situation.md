# SPEC · 工作项与共享情境

**Status:** P0 implemented (2026-07-14)  

**Date:** 2026-07-14  
**Product:** FC-OPC 效率 Agent（知识工作台演进）  
**Related:** `CONTEXT.md` · `docs/PRD-iBot-Knowledge-Efficiency-Agent.md` · 现有 `shared/types/knowledge.ts`

---

## 1. Goal

让用户在产品内稳定回答三句话：

1. 现在在哪  
2. 依据是什么  
3. 下一步是谁的、卡在哪  

效率定义为：**沟通一致 + 沟通可见**。  
本 spec 把该定义落成可验收的对象、界面、接口与测试。

---

## 2. Problem

| 现状 | 后果 |
|------|------|
| 卡与待办有状态，缺共享历史 | 对话停在聊天窗，产品内看不见沟通过程 |
| 待办可点状态，缺强制「下一步」语义 | 「在做」是气氛，不是事实 |
| 有 `assignee` 字段，UI/规则未当一等公民 | 不知道是谁的 |
| 无阻塞事件 | 假进度 |
| 多窗 agent 输出不写回同一对象 | 人机各聊各的 |

知识检索与来源仍然需要。  
它们是 **依据层**，挂在工作项下，不再单独充当「效率」的全部形态。

---

## 3. Non-goals

- 不做微信私聊同步  
- 不做客户改约定产品线  
- 不做完整 Multica（多 runtime daemon、Squad、Cloud）  
- 不做向量库当卖点  
- 不做多租户 ACL  
- 本阶段不要求 agent 真跑 CLI；只要求 **预留写回事件** 的接口形状  

---

## 4. Definitions

| 词 | 意思 |
|----|------|
| 工作项 WorkItem | 一件要推进到结束的事；产品主对象 |
| 依据 Evidence（现 KnowledgeCard） | 一条可引用事实/结论，必须带来源 |
| 事件 Event | 挂在工作项上的一条历史：说话、决定、状态、阻塞、结果、指派 |
| 下一步 nextStep | 当前唯一要做的一句话动作（不是长描述） |
| 负责人 assignee | 人显示名或 agent id；未完成项应有负责人 |
| 状态 status | 固定枚举，全局同一套词 |

Map ≠ territory：  
「状态=进行中」不是真的在推进，除非时间线里有近期事件或下一步仍有效。

---

## 5. Domain model

### 5.1 WorkItem

扩展现有 `ActionItem`，逻辑上升为工作项。  
存储可继续放在 `data/knowledge/actions.json`（或改名为 `work-items.json`，需迁移说明）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 稳定 ID，可进 URL |
| title | string | 是 | 短标题；可由 description 首行迁移 |
| description | string | 否 | 背景说明 |
| status | Status | 是 | 见枚举 |
| assignee | string | 条件 | `todo` 可空；进入 `doing` 起必填（或 UI 强提示 + API 校验可配置，默认 **强校验**） |
| nextStep | string | 条件 | 非 `done`/`cancelled` 时必填一句 |
| goalId | string | 否 | 所属目标/里程碑（P1） |
| evidenceIds | string[] | 否 | 关联依据卡 ID |
| verificationCriteria | string | 否 | 怎样算做完（保留现字段） |
| blockedReason | string | 否 | status=blocked 时必填 |
| createdAt | string ISO | 是 | |
| updatedAt | string ISO | 是 | |

### 5.2 Status 枚举（全局字典）

| 值 | 展示文案 | 含义 |
|----|----------|------|
| todo | 待开始 | 已建项，未开工 |
| doing | 进行中 | 有负责人与下一步 |
| blocked | 阻塞 | 无法推进；须有 blockedReason |
| confirmed | 待确认 | 产出待人确认（保留现语义） |
| done | 完成 | 结束 |
| cancelled | 取消 | 结束，不做 |

迁移：现有无 `blocked`/`cancelled` 的数据保持原状；新 UI 写入新枚举。  
`todo → doing → confirmed → done` 主路径保留；任意未结束态可进 `blocked`。

### 5.3 Evidence（KnowledgeCard，基本不变）

保留：id, content, source, tags, timestamp, links, title。  
新增可选：`workItemIds: string[]` 反链（P1，或仅 WorkItem.evidenceIds 单向）。

### 5.4 Event

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | |
| workItemId | string | 所属工作项 |
| type | EventType | 见下 |
| actor | string | 人显示名或 `agent:<id>` 或 `system` |
| body | string | 正文；status_change 可为空 |
| meta | object | 可选：fromStatus, toStatus, evidenceId, url… |
| createdAt | string ISO | 事件时间；序按此排 |

**EventType：**

| type | 何时产生 |
|------|----------|
| comment | 用户评论 |
| decision | 用户点「记决定」 |
| status_change | 任何状态变更（系统自动） |
| assign | 负责人变更（系统自动） |
| next_step_change | 下一步文案变更（系统自动） |
| block | 进入 blocked 或更新阻塞原因 |
| unblock | 离开 blocked |
| result | 产出/结果链接或摘要（人 or agent） |
| evidence_link | 关联/取消关联依据 |

规则：

- 状态、负责人、下一步的变更 **必须** 写事件，禁止只改字段无历史。  
- 事件默认不可物理删除；P0 不做编辑；P1 可软删并留痕。

### 5.5 Goal（P1，可选）

| 字段 | 说明 |
|------|------|
| id, title, dueAt? | 本周交付等 |
| workItemIds | 或反向 WorkItem.goalId |

P0 可不建 Goal 表；详情顶栏用自由文本 `goalLabel` 亦可（若加字段）。  
为减范围：P0 **不做 Goal 对象**，顶栏只显示 status + assignee + nextStep + blockedReason。

---

## 6. Product principles（可检验）

| 原则 | 产品规则 |
|------|----------|
| 沟通一致 | 讨论锚 WorkItem 链接；状态只来自字典 |
| 沟通可见 | 评论/决定/阻塞/结果进 Event，不进私人记忆 |
| 知道处在哪 | 列表/详情固定展示 status（+ 阻塞原因） |
| 知道做过什么 | 详情时间线按 createdAt 倒序 |
| 知道下一步 | 非结束态展示 nextStep + assignee；缺则标不合格 |

---

## 7. User-visible surfaces

### 7.1 工作项详情（P0 主界面）

路径建议：`/track/knowledge/work/[id]`  
或知识页右侧升级为详情（P0 可同页抽屉/主栏切换）。

**顶栏固定：**

- 标题  
- 状态  
- 负责人  
- 下一步  
- 若 blocked：阻塞原因  

**主体：**

- 描述 / 验收标准（可折）  
- 关联依据列表（标题 + 来源 chip + 链到卡）  
- **时间线**（主阅读区）  
- 输入：评论；快捷「记决定」「报阻塞」「记结果」  

**动作：**

- 改状态  
- 改负责人  
- 改下一步  
- 关联依据  
- 推进（快捷：按主路径跳下一状态，并校验负责人/下一步）

### 7.2 列表 / 板（P0 列表，P1 看板）

- 列表列：标题、status、assignee、nextStep 摘要、updatedAt  
- 筛选：我的（assignee=当前用户）、未完成、阻塞  
- P1：按 status 分列看板  

### 7.3 知识检索（保留）

- 现有搜卡、来源筛选保留  
- 命中卡上可「链到工作项」或「从卡创建工作项」（P0 至少一个）  

### 7.4 首页

- 仍进知识工作台  
- 文案可强调：看得见状态与下一步（不出现黑话）  

---

## 8. Core flows

### F1 创建工作项

1. 用户输入标题（必填）、可选描述、负责人、下一步、关联卡  
2. 系统创建 WorkItem status=todo  
3. 写 Event `comment` 或系统 `status_change` 创建态  
4. 打开详情  

**验收：** 有 id 链接；刷新仍在。

### F2 开始推进

1. 用户设 assignee + nextStep（若空）  
2. 状态 → doing  
3. 自动 Event：assign（若变）、next_step_change（若变）、status_change  

**验收：** 无 assignee 或无 nextStep 时 API 返回 400（P0 强校验）。

### F3 评论 / 决定 / 结果

1. 用户提交 body + type  
2. 追加 Event  
3. updatedAt 更新  

**验收：** 时间线顶格可见新事件。

### F4 阻塞

1. 用户报阻塞 + reason  
2. status → blocked，blockedReason=reason  
3. Event type=block  
4. nextStep 建议改为「等待：…」（可自动预填，允许改）  

**验收：** 列表能筛出阻塞；顶栏见原因。

### F5 状态推进到完成

1. 主路径或手动 → done  
2. status_change 事件  
3. nextStep 可清空  

**验收：** 结束后列表「未完成」不可见。

### F6 检索依据并挂上

1. 搜「检索 来源」得卡  
2. 关联到当前工作项  
3. Event evidence_link  

**验收：** 详情依据区可见来源 chip。

### F7 Agent 写回（P0 接口，P1 UI 自动化）

1. `POST` 事件 type=result actor=`agent:…`  
2. 可选同时改 status/nextStep  

**验收：** curl 写回后时间线可见；P0 不要求真 CLI。

---

## 9. API（建议）

与现有 `/api/knowledge/*` 并存；工作项可挂在 state 或新路由。

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/knowledge/work-items` | 列表；query: status, assignee, q |
| POST | `/api/knowledge/work-items` | 创建 |
| GET | `/api/knowledge/work-items/:id` | 详情 + events[] |
| PATCH | `/api/knowledge/work-items/:id` | 改字段；服务端写对应 Event |
| POST | `/api/knowledge/work-items/:id/events` | 追加 comment/decision/block/result… |
| POST | `/api/knowledge/work-items/:id/evidence` | body: { cardId } 关联 |
| DELETE | `/api/knowledge/work-items/:id/evidence/:cardId` | 取消关联 |

兼容：

- 现有 `GET/POST /api/knowledge/state` 可委托到 work-items，或渐进迁移  
- 现有 ActionItem 字段映射：description→title/description，保留 verificationCriteria  

校验：

| 条件 | 错误 |
|------|------|
| 设 status=doing 且无 assignee | 400 |
| 非 done/cancelled 且 nextStep 空白 | 400 |
| status=blocked 且无 blockedReason | 400 |
| 非法 status | 400 |

持久化：

- `data/knowledge/work-items.json`  
- `data/knowledge/events.json`（按 workItemId 索引或扁平 map）  
- 或单文件聚合；须进程重启不丢  

---

## 10. Acceptance criteria

### A1 工作项主路径（P0）

- [ ] 可创建工作项并获得稳定 id  
- [ ] 详情顶栏可见：状态、负责人、下一步  
- [ ] 进入 doing 时无负责人或无下一步 → 失败并提示  
- [ ] 改状态后刷新仍保持  

### A2 时间线（P0）

- [ ] 评论出现在时间线  
- [ ] 改状态自动产生 status_change  
- [ ] 改负责人、下一步有对应事件  
- [ ] 重启进程后事件仍在  

### A3 阻塞（P0）

- [ ] 可标阻塞并填写原因  
- [ ] 列表或筛选能看到阻塞项  
- [ ] 时间线有 block 事件  

### A4 依据关联（P0）

- [ ] 工作项可关联至少一张带来源的卡  
- [ ] 详情显示来源类型  

### A5 检索不回退（P0）

- [ ] 现有「检索 来源」仍返回带来源的卡  
- [ ] 首页仍进入知识工作台  

### A6 下一步视图（P0）

- [ ] 「我的」或等价筛选：assignee=当前用户且未完成  
- [ ] 每条展示 nextStep  

### A7 Agent 写回缝（P0 API）

- [ ] POST result 事件成功并持久化  
- [ ] 文档或 README 有一条 curl 示例  

### A8 文案（P0）

- [ ] UI/文档无禁用黑话（金路径、知识经、闭环当产品名等）  
- [ ] 平常中文：工作项、状态、下一步、时间线、负责人  

---

## 11. Metrics

| 指标 | 交件门槛 |
|------|----------|
| 演示完整率 | 一次不中断走完：建项 → 评论 → 推进 → 挂依据 → 看时间线 |
| 顶栏完整率 | 抽 5 条 doing：100% 有 assignee + nextStep |
| 事件覆盖 | 每次 status 变更都有 status_change |
| 持久化 | 重启后工作项与事件仍在 |
| 评委复述 | 能说出：状态、谁、下一步、依据从哪来 |

Kill：

1. 时间线做完但仍无人写回（演示也全靠旁白）→ 叙事降级，先修写回  
2. 强校验导致无法演示 → 允许 demo 种子预填，不取消校验  
3. 与 Notion 无差别且说不清「时间线+负责人+下一步」→ 停加花活  

---

## 12. Phased delivery

### Phase 0（本 spec P0）

- 模型 + JSON 持久化 + API  
- 详情：顶栏 + 时间线 + 评论/决定/阻塞/结果  
- 列表 + 我的筛选  
- 关联依据  
- 保留检索  
- 单测 + 扩展 e2e  

### Phase 1

- 看板分列  
- Goal 对象  
- 事件筛选  
- 从卡一键生成工作项并带关联  
- Agent UI 触发写回  

### Phase 2

- 真 runtime / 外接 Multica 类总线（超出本 spec）  
- 多用户鉴权  

---

## 13. Testing

| 层 | 内容 |
|----|------|
| Unit | WorkItem 校验；Event 在 patch 时生成；repository 持久化 |
| API | 创建、非法 doing、阻塞、挂依据、result 事件 |
| E2E | 建项 → 填负责人与下一步 → doing → 评论 → 时间线可见 → 关联卡 → 刷新仍在 |

E2E 演示步骤（平常话）：

1. 打开工作台  
2. 新建工作项「补验收标准」  
3. 负责人=自己，下一步=「写下三条验收」  
4. 状态改为进行中  
5. 评论「与演示脚本对齐」  
6. 搜卡并关联  
7. 刷新：顶栏与时间线仍在  

---

## 14. Migration from current app

| 现有 | 迁移 |
|------|------|
| ActionItem | → WorkItem；description 作 title；assignee/deadline/verificationCriteria 保留；补 nextStep 默认「确认下一步」若为空 |
| ActionStatus | 扩展 blocked, cancelled |
| KnowledgeCard | 不变；evidenceIds 挂接 |
| `/track/knowledge` 行动板 | 改为工作项列表 + 进详情 |
| 种子数据 | 每条补 nextStep 与至少 1 条创建事件 |

兼容期：旧 API `update` 状态仍可用，服务端走同一 repository 并写事件。

---

## 15. Open questions

| # | 问题 | 默认（可改） |
|---|------|----------------|
| Q1 | 当前用户身份从哪来？ | P0 用本地设置字符串 `defaultUser`，默认「自己」 |
| Q2 | 详情路由独立页还是同页？ | P0 同页主栏切换，少改导航 |
| Q3 | deadline 是否 P0 展示？ | 保留字段，列表次要展示 |
| Q4 | confirmed 是否保留？ | 保留，兼容现种子与演示 |

---

## 16. Done when

- A1–A8 勾完  
- 单测与 e2e 绿  
- `CONTEXT.md` 增补工作项/时间线用词（无黑话）  
- 本文件 status 改为 `accepted` 或实现中注明偏差  

---

## 17. Traceability

| 效率感觉 | Spec 章节 |
|----------|-----------|
| 沟通一致 | §5 WorkItem/Evidence ID；§7 链接；§8 F6 |
| 沟通可见 | §5 Event；§7 时间线；§8 F3/F7 |
| 知道处在哪 | §5 status；§7 顶栏/列表 |
| 知道做过什么 | §5 Event 序；§10 A2 |
| 知道下一步 | §5 nextStep+assignee；§10 A1/A6 |
