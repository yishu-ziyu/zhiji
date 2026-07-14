# SPEC · 知识关系（卡↔卡显式网络）

**Status:** P0 implemented (0a+0b+0c extract API; 2026-07-14)  

**Date:** 2026-07-14  
**Product:** FC-OPC 知识工作台  
**Related:**  
`CONTEXT.md` ·  
`docs/SPEC-work-item-shared-situation.md` ·  
`docs/SPEC-knowledge-footprint.md` ·  
`docs/DEV_COLLAB.md` ·  
灵感参照（非依赖）：[SignalGraph](https://github.com/zhiliscope/SignalGraph) 的「规则抽关系 + 源句可指回 + 路径/邻居」；[mindwalk](https://github.com/cosmtrek/mindwalk) 的「空间可见」只作呈现启发  

---

## 1. Goal

让用户在产品内能稳定回答：

1. **这两张卡凭什么连在一起？**（不是「感觉相关」，而是可指回的一句来源）  
2. **从这张卡出发，一跳 / 几跳能走到哪些依据？**  
3. **这件事挂的几条依据之间，有没有一条可解释的链？**  

效率定义仍是：**沟通一致 + 沟通可见**。  
工作项解决「事」；足迹解决「用过哪些卡」；本功能补 **卡与卡之间的结构可见**。

一句话产品说法：

> 边 = 两张依据之间可解释的关系；每条边带一句能点回原文的来源。

产品野心（本 spec 不因交件日砍掉目标，只分阶段交付）：

- 关系是 **一等对象**（有 id、可持久化、可查询、可展示），不是卡片上的字符串列表装饰。  
- 解释优先于规模：宁可边少而可指回，不要密网不可读。  
- 人工建边与规则抽边共用同一数据模型；抽边可关、可审。  

---

## 2. Problem

| 现状 | 后果 |
|------|------|
| `KnowledgeCard.links` 仅是 id 数组 | 无关系类型、无方向语义、无来源句 |
| 检索返回列表 | 只见「命中」，不见「命中之间如何连」 |
| 足迹点亮多卡 | 知道摸过哪些点，不知道点与点的结构 |
| 工作项挂多条依据 | 依据岛是集合，不是可解释的网 |
| UI 有时显示 “N links” | 用户点不开「为什么链」 |
| 若靠聊天口述「这和那有关」 | 产品内不可复现、不可验收 |

**不是** 检索排序不准（足迹/search 管触达与召回）。  
**是** 已有多张卡之间缺少 **带证据的显式边、邻居与路径**。

---

## 3. Non-goals

- 不硬集成 SignalGraph Python CLI / 整仓图谱引擎作为交件硬依赖  
- 不做通用知识图谱产品叙事（实体百科、跨库本体治理）  
- 不做向量「相似即连边」当主路径（可作 P2 建议边候选，须人工确认）  
- 不替代工作项时间线（行动层）  
- 不替代知识足迹的亮/暗（使用层）  
- 不做多租户 ACL、跨用户协同编辑图  
- P0 不做全库力导向大图当默认首页（易密不可读）  
- P0 不要求 LLM 必在线抽边（规则 + 人工优先；LLM 可选增强见 Phase 1）  
- 不把「关系」做成第二个工作项系统  

---

## 4. Definitions

| 词 | 意思 |
|----|------|
| **依据 / 卡** | 现有 `KnowledgeCard`；图上的 **点** |
| **关系 / 边** | 两张卡之间的一条显式连接；一等对象 `KnowledgeRelation` |
| **关系类型 relationType** | 边的语义标签（见 §5.3）；有限枚举，产品内统一用词 |
| **来源句 evidenceSentence** | 支持这条边的一句可指回文本（来自某卡正文、会议摘录或用户填写） |
| **锚点 anchor** | 可选：边锚定到哪张卡的哪段（cardId + 可选字符偏移/段落 id） |
| **邻居 neighbors** | 从一张卡出发、沿边一跳可达的卡集合 |
| **路径 path** | 有序的卡序列，相邻对之间存在边；可带边序列 |
| **抽边 extract** | 从卡正文按规则（或可选模型）提出候选边，默认进入待审或直接入库（可配置） |
| **已确认 confirmed** | 人点过「算」的边；演示与默认查询优先展示 |
| **建议 suggested** | 系统提出、尚未确认的边；须视觉弱化且可一键否决 |

**科日布斯基提醒：**  
边存在 ≠ 世界里因果为真；只表示 **系统里存了一条可解释的连接声明**。  
来源句是声明的依据，不是真理认证。

---

## 5. Domain model

### 5.1 与现有对象关系

```text
KnowledgeCard（点）          已有
KnowledgeRelation（边）      本 spec 新增一等对象
WorkItem.evidenceIds         挂「事用了哪些点」；不替代边
FootprintEvent               触达历史；不替代边
Card.links[]                 遗留邻接；迁移见 §14
```

四层（产品心智，不是四个菜单）：

```text
点（卡）     ████  已有
边（关系）   ░░░░  本 spec
使用（足迹） ████  已有
事（工作项） ████  已有
```

### 5.2 KnowledgeRelation

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 稳定 ID |
| fromCardId | string | 是 | 起点卡 |
| toCardId | string | 是 | 终点卡 |
| relationType | RelationType | 是 | 见 §5.3 |
| evidenceSentence | string | 是 | 可展示的一句来源；P0 **必填**（空句不可入库） |
| anchorCardId | string | 否 | 默认 = from 或 to 中提供句的那张 |
| status | RelationStatus | 是 | `confirmed` \| `suggested` \| `rejected` |
| directed | boolean | 是 | 是否有向；默认 true（由类型决定，见下） |
| confidence | number | 否 | 0–1；规则/模型置信；人工确认后可固定 1 |
| source | RelationSource | 是 | 边从哪来 |
| createdBy | string | 是 | 人显示名或 `agent:…` 或 `system:rule:…` |
| createdAt | string ISO | 是 | |
| updatedAt | string ISO | 是 | |
| workItemId | string | 否 | 可选：在某工作项语境下建的边 |
| meta | object | 否 | 规则名、匹配片段、模型名等 |

**不变量：**

1. `fromCardId ≠ toCardId`  
2. `from` / `to` 必须已存在于库  
3. `evidenceSentence.trim().length ≥ 1`（建议上限 280 字，截断策略写实现注释）  
4. 同一 `(from, to, relationType, evidenceSentence)` 不得重复 confirmed（规范化后去重）  
5. `rejected` 边不参与邻居/路径默认查询  

### 5.3 RelationType（有限枚举）

产品文案用中文；存储用稳定英文 key。

| key | 展示 | 默认有向 | 含义（白话） |
|-----|------|----------|--------------|
| `supports` | 支持 | 是 | A 给 B 提供依据或佐证 |
| `contradicts` | 矛盾 | 是 | A 与 B 说法冲突 |
| `depends_on` | 依赖 | 是 | 理解/落实 A 需要先看 B |
| `derived_from` | 出自 | 是 | A 从 B 提炼/摘出 |
| `same_topic` | 同题 | 否 | 同一议题，无主从 |
| `follows` | 后续 | 是 | 时间或流程上 A 在 B 之后 |
| `mentions` | 提及 | 是 | A 正文点到 B 所指对象（弱；建议边常用） |
| `custom` | 其他 | 是 | 须配 `meta.label` 短标签（P1 开放；P0 可先禁用 custom） |

P0 **必须实现且可手选：**  
`supports` · `contradicts` · `depends_on` · `derived_from` · `same_topic` · `follows`  

P0 可暂缓：`mentions` / `custom`（有则实现，无则文档写明延后）。

### 5.4 RelationStatus / RelationSource

| status | 含义 |
|--------|------|
| `confirmed` | 人确认，或规则高置信且配置为 auto-confirm |
| `suggested` | 系统建议，默认查询可「含建议」开关 |
| `rejected` | 人否决；保留记录防重复建议（P1 可清） |

| source | 含义 |
|--------|------|
| `manual` | 用户在 UI 创建 |
| `rule` | 本地规则抽边 |
| `import` | 迁移自 `card.links` 等 |
| `model` | 可选 LLM（Phase 1+） |

### 5.5 运行时查询视图（可非持久）

**NeighborView**

| 字段 | 说明 |
|------|------|
| cardId | 中心卡 |
| edges | 与中心相连的 Relation 列表（已展开对端摘要） |
| neighborCards | 对端卡简要（id, title, source） |

**PathView**

| 字段 | 说明 |
|------|------|
| nodes | cardId[] 有序 |
| edges | relationId[] 与相邻步对应 |
| length | 边数 |

路径算法 P0：BFS，最大深度默认 **3**，同层边数上限可配置（防爆炸）。

### 5.6 与 `card.links` 的关系

- **写入路径：** 新逻辑只写 `KnowledgeRelation`。  
- **读取兼容：** API/UI 展示边时以 Relation 为准。  
- **迁移：** 见 §14；可将旧 `links` 导入为 `same_topic` + 占位来源句（须标记 `source=import`，`status=suggested` 或 confirmed 策略二选一，默认 **suggested**）。  

---

## 6. 抽边规则（可检验、可关）

### 6.1 原则

1. **可解释：** 每条自动边必须带 `evidenceSentence`（匹配到的原句或模板填空后的句）。  
2. **可关闭：** 环境变量或设置 `RELATIONS_AUTO_EXTRACT=off` 时只手建。  
3. **可审：** 默认 `status=suggested`；配置 `RELATIONS_AUTO_CONFIRM=on` 时高置信规则可直接 confirmed（演示种子可开）。  
4. **不靠外部服务做 P0 主路径。**  

### 6.2 P0 规则集（最小）

| 规则 id | 触发 | 产出类型 | 来源句 |
|---------|------|----------|--------|
| `R-explicit-ref` | 卡正文含另一卡 id、稳定标题全文、或 `[[title]]` 式引用 | `mentions` 或 `derived_from` | 含引用的那一句 |
| `R-support-cue` | 同工作项下两卡；或同 tags 交集 ≥2 且一句含「因此/所以/依据/说明」类线索（中英可扩展表） | `supports` | 含线索的那一句 |
| `R-seed-pair` | 种子数据声明的配对表（实现用固定 JSON 夹具） | 指定类型 | 种子提供的句 |

说明：

- 规则是 **确定性** 的：同输入同输出。  
- 中文线索词表放 `shared/knowledge/relation-cues.ts`（或等价），可单测。  
- **不做** P0：开放域 NER、共指消解、跨语言实体对齐。  

### 6.3 SignalGraph 对齐（语义，非代码依赖）

| SignalGraph 思路 | 我们落点 |
|------------------|----------|
| 规则抽实体关系 | §6.2 规则 + 可选 Phase 1 增强 |
| 边带源句 | `evidenceSentence` 必填 |
| 内存图路径/邻居 | NeighborView / PathView + API |
| 零外部 AI | P0 默认路径 |

硬集成整仓引擎：**非目标**；若未来嵌入，须另开集成 spec，且不能破坏本模型字段。

---

## 7. User-visible surfaces

路径：仍在 `/track/knowledge`（不新开产品名）。

### 7.1 卡详情 / 展开区：关系条（P0）

**块标题（平常话）：**「相关依据」或「和哪些卡有关」。  

内容：

- 列表：对端标题 · 关系类型文案 · 来源句（最多两行，可展开）  
- 操作：添加关系 ·（若 suggested）确认 / 否决  
- 空态：一句「还没有连到其他依据」+ 添加按钮  

### 7.2 添加关系（P0）

1. 选对端卡（搜索或从当前检索 hits 选）  
2. 选关系类型  
3. **必填** 来源句（可从本卡正文点选一句预填）  
4. 保存 → `status=confirmed` · `source=manual`  

### 7.3 邻域小图（P0 建议有 / 可与 0b 同交付）

- 中心 = 当前选中卡  
- 一跳邻居 + 边标签（短）  
- 点击邻居 = 切换选中卡  
- **不做** 默认全库大网  

### 7.4 工作项语境（P0/P1）

- 工作项详情内：「这些依据怎么连」  
- 仅展示 `evidenceIds` 诱导子图（点集限制在证据岛 + 岛内边）  
- 无边时诚实空态，不伪造连线  

### 7.5 与足迹的同屏关系

- 足迹：回答「亮不亮」（用没用过）  
- 关系：回答「连不连、凭哪句」  
- P1：足迹图上可选叠加 **已确认边**（细线）；P0 可不叠，分开展示即可  

### 7.6 演示话术（给评委）

1. 打开一张依据卡  
2. 指「相关依据」：类型 + **念出来源句**  
3. 点邻居跳到另一张卡  
4. （若有）工作项上多条依据之间有一条 supports 链  
5. 一句话差异：  
   > 不只搜到列表，还能看见依据之间怎么连、凭哪句话连。  

---

## 8. Core flows

### F1 手建关系（P0）

1. 用户在卡 A 点「添加关系」  
2. 选卡 B、类型、填来源句  
3. POST 创建 Relation  
4. A/B 两侧邻居刷新  

**验收：** 刷新后仍在；两边都能看到（无向类型双边对称展示；有向按 from→to 语义展示，对端显示反向文案如「被…支持」可选 P1，P0 可两侧都列边并标方向）。

### F2 看邻居（P0）

1. 打开卡 A  
2. GET neighbors(A)  
3. UI 列出边与对端  

### F3 路径（P0 最小）

1. 用户指定起点 A、终点 B（或从工作项两证据）  
2. GET path?from=&to=&maxDepth=3  
3. 有则展示节点链 + 每步类型与来源句；无则明确「3 跳内没有」  

### F4 规则抽边（P0 可选开关，种子可预置）

1. 写入/更新卡后触发 extract（或手动「扫描关系」）  
2. 产生 suggested 边  
3. 用户确认/否决  

### F5 否决建议（P0）

1. 用户点否决  
2. status → rejected  
3. 默认邻居列表不再出现；「显示已否决」为 P1  

### F6 工作项证据岛（P0/P1）

1. 打开工作项  
2. 取 evidenceIds 为点集  
3. 列出岛内边；可提示「缺边」  

---

## 9. API

在现有 knowledge API 旁扩展；不破坏 search / work-items / footprint 契约。

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/knowledge/relations` | query: `cardId`, `status`, `type`, `workItemId` |
| POST | `/api/knowledge/relations` | 创建边；校验不变量 |
| GET | `/api/knowledge/relations/:id` | 单条 |
| PATCH | `/api/knowledge/relations/:id` | 改 status、类型、来源句 |
| DELETE | `/api/knowledge/relations/:id` | 硬删或软删（P0 建议软删= rejected + archived 标记） |
| GET | `/api/knowledge/cards/:id/neighbors` | NeighborView |
| GET | `/api/knowledge/path` | query: `from`, `to`, `maxDepth`, `status` |
| POST | `/api/knowledge/relations/extract` | 对 cardId 或全库跑规则；返回新建 suggested 数 |

### 9.1 POST body（建议）

```json
{
  "fromCardId": "kc-1",
  "toCardId": "kc-2",
  "relationType": "supports",
  "evidenceSentence": "会议纪要写明：交付日以邮件确认函为准。",
  "status": "confirmed",
  "source": "manual",
  "createdBy": "自己",
  "workItemId": "optional"
}
```

### 9.2 GET neighbors 响应（建议）

```json
{
  "cardId": "kc-1",
  "edges": [
    {
      "id": "rel-1",
      "relationType": "supports",
      "direction": "out",
      "evidenceSentence": "…",
      "status": "confirmed",
      "otherCard": {
        "id": "kc-2",
        "title": "…",
        "source": "meeting"
      }
    }
  ]
}
```

### 9.3 持久化

| 文件 | 内容 |
|------|------|
| `data/knowledge/relations.json` | id → KnowledgeRelation |

与 `cards.json`、`actions`/`work-items`、`footprint-events`、工作项 `events` **分文件**，概念不混。

### 9.4 类型扩展位置

- `shared/types/knowledge.ts`：Relation 类型与枚举  
- `shared/knowledge/relations.ts`：校验、邻居、路径、抽边  
- `shared/knowledge/repository.ts`：读写 relations  

---

## 10. Acceptance criteria

### A1 一等边（P0）

- [ ] 可创建带 `relationType` + 非空 `evidenceSentence` 的边  
- [ ] 缺来源句 → API 4xx，UI 有明确提示  
- [ ] 持久化到 `relations.json`；进程重启后仍在  

### A2 邻居可见（P0）

- [ ] 打开卡 A，能看到与 A 相连的 confirmed 边及对端  
- [ ] 展示关系类型中文文案 + 来源句  

### A3 手建闭环（P0）

- [ ] UI 完成 F1：选对端 → 类型 → 来源句 → 保存 → 列表出现  
- [ ] 对端卡侧也能查到该边（查询不丢方向）  

### A4 路径（P0）

- [ ] 存在 A-r1-B-r2-C 时，path(A,C) 在 maxDepth≥2 返回该链  
- [ ] 无路径时返回空并说明，不 500  

### A5 建议边治理（P0）

- [ ] suggested 与 confirmed 视觉可区分  
- [ ] 确认 / 否决改变 status 且影响默认邻居列表  

### A6 不破坏既有主线（P0）

- [ ] 检索、工作项、足迹原验收仍通过  
- [ ] 无边时产品可正常使用（关系是增强，不是硬门）  

### A7 文案（P0）

- [ ] 无禁用黑话；用「关系 / 相关依据 / 来源句 / 邻居」  
- [ ] 不声称「AI 理解了全部知识」；只声称「保存并可展示可解释的连接」  

### A8 信息守恒（P0）

- [ ] 边上 from/to 必为真实 cardId  
- [ ] 禁止为动画随机连线  
- [ ] 工作项证据岛子图的点集 ⊆ evidenceIds（若开岛视图）  

### A9 种子与演示（P0）

- [ ] 至少 1 组演示用 confirmed 边（≥2 边或 1 边+路径故事），带来源句  
- [ ] 演示步骤可 60 秒内指认「类型 + 念句」  

---

## 11. Metrics

| 指标 | 门槛 |
|------|------|
| 边可解释率 | 100% confirmed 边有非空来源句（自动化） |
| 邻居正确率 | neighbors 返回的边端点必含查询 cardId |
| 路径正确率 | 返回路径上每步在库中存在对应边 |
| 演示可指认 | 60 秒内完成 §7.6 话术 |
| 与列表产品的差异句 | 「我们能看见依据之间怎么连、凭哪句，而不只是多标签」 |

**质量闸（产品野心优先于日期）：**

1. 只有 id 互链、无来源句 → **不算** 本功能完成  
2. 全库大图密到不可读且无邻域/列表降级 → 先修信息架构  
3. 自动边不可关、不可否决 → 不得默认开启 auto-confirm  
4. 与足迹/工作项故事打架（假装关系=用过或=任务）→ 回 §14 边界文案  

（交件日可只交付 Phase 0a；**不得** 用交件日把 Goal 改写成「links 数组够了」。）

---

## 12. Phased delivery

### Phase 0a — 模型 + API + 手建（最小可讲故事）

- `KnowledgeRelation` 类型与 `relations.json`  
- CRUD + neighbors  
- 卡详情关系列表 + 添加关系  
- 种子 ≥1 条 confirmed 边  
- 单测：校验不变量、邻居  

### Phase 0b — 路径 + 建议态 + 证据岛

- path API + 简单 UI  
- suggested / confirmed / rejected  
- 工作项内证据岛边列表  
- 从 `card.links` 迁移为 suggested（可选开关）  

### Phase 0c — 规则抽边（仍无硬依赖外部引擎）

- §6.2 规则 + extract API  
- 设置开关  
- 单测：同输入同边  

### Phase 1

- 邻域小图可视化（与足迹同屏可选叠线）  
- 正文点选一句作来源句  
- `mentions` / `custom`  
- 可选 LLM 建议边（须 suggested，不得静默 confirmed）  
- 反向展示文案（「被支持」）  

### Phase 2

- 与 SignalGraph 类引擎对照/导入导出  
- 更大图布局、过滤、多跳探索器  
- Agent 写回关系事件（actor 可追溯）  

**实现顺序约定：**  
先 0a 可演示「有边有句」；0b 补路径与治理；0c 自动化。  
规格接受后允许一次做完 0a+0b；**不可** 跳过来源句做「漂亮连线」。  

---

## 13. Testing

| 层 | 内容 |
|----|------|
| Unit | 创建校验（自环、空句、缺卡）；邻居；BFS 路径；规则确定性 |
| API | POST 拒绝空句；GET neighbors；path 有/无；PATCH status |
| E2E | 开卡 → 加关系 → 刷新仍见类型与来源句 →（0b）否决建议边后默认列表消失 |

E2E 演示步骤（平常话）：

1. 打开 `/track/knowledge`  
2. 打开带关系的种子卡（或新建边）  
3. 看到类型与来源句  
4. 点对端卡  
5. （0b）对两张卡查路径或看工作项证据岛  

---

## 14. 与足迹 / 工作项的边界

| | 工作项 Spec | 足迹 Spec | **本 Spec** |
|--|-------------|-----------|-------------|
| 主对象 | WorkItem + 行动事件 | Card + 触达事件 | Card + **Relation** |
| 回答 | 谁、下一步、沟通写回 | 用了哪一片知识 | 卡与卡如何连、凭哪句 |
| 时间 | 时间线 | 观察窗口 | 边的创建/确认时刻（次要） |
| 图 | 无强制 | 库图亮暗 | 邻域/路径/证据岛 |

互补一句话：

> **工作项**管事；**足迹**管摸过哪些点；**关系**管点与点之间可解释的边。

禁止混用：

- 不要把 `linked` 足迹当成关系边  
- 不要把 `evidenceIds` 自动画成无来源句的边（可提示「建议建关系」，须人确认或规则带句）  

---

## 15. Migration

| 现有 | 迁移 |
|------|------|
| `KnowledgeCard.links: string[]` | 读路径逐步废弃；写路径新代码不依赖 |
| 已有 links 数据 | 脚本/启动迁移：每条 link → Relation(`same_topic`, sentence=「由旧 links 导入，待补来源句」, status=`suggested`, source=`import`) |
| UI “N links” | 改为关系条真实计数（confirmed 默认） |
| 种子卡 | 补至少一组真正的 confirmed 边与可读来源句 |

兼容期：`links` 字段可继续存在于卡 JSON，避免旧客户端炸；**产品验收以 Relation 为准**。

---

## 16. Open questions（默认取值）

| # | 问题 | 默认 |
|---|------|------|
| Q1 | 无向类型是否存两条边？ | **否**；存一条，`directed=false`，查询双向展开 |
| Q2 | 自动抽边默认开吗？ | **演示种子可预置边**；运行时 auto-extract **默认关**，手动「扫描」或开发开 |
| Q3 | 路径 UI 放哪？ | P0：卡详情「查到另一张卡的路径」或 API-only + 工作项岛；完整探索器 P1 |
| Q4 | 删除边还是否决？ | 手建允许 DELETE；建议边用 rejected |
| Q5 | 来源句是否必须来自卡正文子串？ | P0 **不强制**子串（允许用户概括）；规则边必须是正文截取 |
| Q6 | 与 Multica 关系？ | 无关；关系层是知识结构，不是 runtime 总线 |

---

## 17. Done when

### Spec 完成（本轮「开 Spec」）

- [x] 本文档落入 `docs/SPEC-knowledge-relations.md`  
- [x] `CONTEXT.md` / `DEV_COLLAB.md` 挂上入口与用词  
- [ ] 你点头或提出修改项  

### 实现完成（以后「按 spec 实」）

- [x] A1–A9 按 Phase 0a+0b+extract API 勾完（邻域力导向大图仍属 P1）  
- [x] 单测与相关 e2e 绿  
- [x] 演示能指认：类型 + 来源句 + 证据岛（有 ≥2 依据时）  

---

## 18. 对照检查表（实现时用）

| 条目 | 做到 | 未做 | 偏差 |
|------|------|------|------|
| 边一等 + 来源句必填 | | | |
| 邻居 API/UI | | | |
| 路径 | | | |
| suggested 治理 | | | |
| 不破坏检索/工作项/足迹 | | | |
| 无黑话文案 | | | |
| 种子可演示 | | | |
