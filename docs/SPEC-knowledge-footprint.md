# SPEC · 知识足迹（检索点亮）

**Status:** P0 implemented (2026-07-14)

**Date:** 2026-07-14
**Product:** FC-OPC 知识工作台
**Related:**
`CONTEXT.md` ·
`docs/SPEC-work-item-shared-situation.md` ·
`docs/DEV_COLLAB.md` ·
灵感参照（非依赖）：[mindwalk](https://github.com/cosmtrek/mindwalk) 的「足迹可见」思路

---

## 1. Goal

让用户在产品内能回答：

1. **这次检索**点亮了知识库的哪一块？
2. **近来**哪些依据常被用到，哪些长期沉睡？
3. **某个工作项**相关的依据岛长什么样？

效率定义仍是：**沟通一致 + 沟通可见**。
本功能补的是 **依据层的使用足迹可见**（不是代码会话足迹，不是第二套搜索算法）。

一句话产品说法：

> 亮 = 被检索命中或被使用过的知识；暗 = 库里有但这次（或观察窗口内）没用到。

---

## 2. Problem

| 现状 | 后果 |
|------|------|
| 检索只有结果列表 | 看不清「相对整库」的形状与范围 |
| 命中与未命中没有统一画面 | 无法一眼感到覆盖面是窄是散 |
| 多次搜索没有叠层 | 不知道哪张卡反复被用、哪片是死知识 |
| 工作项挂了依据，库视图无呼应 | 「这件事相关的知识岛」说不清 |
| 列表滚动即丢语境 | 评委/自己难记住「亮区」 |

**不是** 搜索不准的问题（那是排序/召回）。
**是** 已有 hits 与库全量之间缺少 **空间化、可回放/可叠层的呈现与记录**。

---

## 3. Non-goals

- 不做 mindwalk 式代码仓库 3D 城市 / Three.js 必选项
- 不上传会话到云端「足迹云」
- 不改变检索打分算法本身（本 spec 消费现有 search 结果）
- 不做向量库品牌叙事
- 不做多租户、跨用户热力对比
- P0 不做完整「按时间拖动回放一天」的复杂播放器（P1）
- 不替代工作项时间线（那是行动层；本功能是依据层）

---

## 4. Definitions

| 词 | 意思 |
|----|------|
| **知识库视图 / 库图** | 当前全部（或抽样）依据卡在平面上的布局；位置稳定或按规则可复现 |
| **知识足迹** | 一次或多次「使用」在库图上的投影（哪些节点亮、多亮） |
| **点亮（lit）** | 节点在当前观察模式下被标记为「用过」 |
| **未点亮（dim）** | 库中存在但当前模式下未命中、未使用 |
| **触摸深度** | 使用强度的有序等级（见 §5.3），节点保留最深一档 |
| **检索会话 QuerySession** | 一次用户发起的检索（可含筛选条件） |
| **足迹事件 FootprintEvent** | 一条可持久化的「某卡在某时刻因某原因被触达」 |
| **观察窗口** | 看叠层足迹时的时间范围（如最近 7 天 / 仅当前会话） |

**科日布斯基提醒：**
「亮」不是「重要」或「正确」；只表示 **被系统记录为触达**。
高相关亮、低相关也可亮但更弱——亮度编码的是触达与分数，不是真理。

---

## 5. Domain model

### 5.1 与现有对象关系

```text
KnowledgeCard（依据） ── 库图上的节点
SearchHit             ── 一次检索的触达（含 score）
WorkItem.evidenceIds  ── 工作项绑定触达
FootprintEvent        ── 可持久化的触达历史（本 spec 新增）
QuerySession          ── 可选：一次检索的元数据（本 spec 新增）
```

不新增第二套「卡片正文」存储；卡仍在 `cards.json` / 现有 repository。

### 5.2 FootprintEvent

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | |
| cardId | string | 被触达的依据 |
| at | string ISO | 时间 |
| kind | FootprintKind | 触达类型 |
| depth | TouchDepth | 深度（可由 kind 推导，可冗余存储） |
| querySessionId | string? | 若来自检索 |
| workItemId | string? | 若来自工作项关联/打开 |
| score | number? | 检索相关度，0–1 或沿用现有 score |
| actor | string | 默认「自己」或 `agent:…` |
| meta | object? | 如 query 原文摘要、source filter |

### 5.3 FootprintKind 与 TouchDepth

| kind | 含义 | depth（最深优先） |
|------|------|-------------------|
| `listed` | 出现在某次库浏览/全量布局中（可选，默认不算「用过」） | 0 仅占位，**不点亮** 或极弱轮廓 |
| `retrieved` | 检索结果列表中出现 | 1 **seen** |
| `opened` | 用户点开卡片详情/展开全文 | 2 **read** |
| `linked` | 挂到工作项 evidence | 3 **used** |
| `cited` | 明确「当作依据引用」（P1：一键引用） | 4 **cited** |

P0 最少实现：`retrieved` + `linked`（+ 可选 `opened`）。
节点展示时：**同一卡多事件取 max(depth)**；亮度可叠加 **次数** 与 **最近 score**。

### 5.4 QuerySession（P0 建议有，便于回放「这一次」）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | |
| query | string | 用户输入 |
| filters | object | source 等 |
| at | string ISO | |
| hitCardIds | string[] | 有序，与 hits 一致 |
| scores | Record<cardId, number>? | |

P0 也可不单独建表：
每次 search 成功 → 为每个 hit 写 `FootprintEvent(kind=retrieved)`，并用同一 `querySessionId` 串起来。

### 5.5 库图节点 LibraryNode

运行时/可缓存结构（可非持久化，由 cards 生成）：

| 字段 | 说明 |
|------|------|
| cardId | |
| title | 展示用 |
| source | meeting/doc/… 分区依据 |
| x, y | 布局坐标（0–1 或像素逻辑坐标） |
| clusterKey | 如 source 或首标签 |

### 5.6 观察模式 ViewMode

| 模式 | 点亮规则 |
|------|----------|
| `current_query` | 仅当前这次检索的 hits（默认演示模式） |
| `window` | 观察窗口内所有 FootprintEvent 的 max depth |
| `work_item` | 仅该工作项 evidenceIds（及可选：曾 linked 的历史） |
| `combined` | P1：当前查询 ∪ 窗口热力（双通道配色） |

---

## 6. 点亮与布局规则（可检验）

### 6.1 布局（P0：简单可解释，不做 3D）

**P0 默认：按来源分区的网格 / 气泡墙。**

1. 将卡按 `source` 分成固定列或固定区域：会议 | 文档 | 聊天 | 邮件 | 手记。
2. 区内按 `updated/timestamp` 或标题排序，网格排列。
3. 同一 `source` 内位置在「卡集合不变」时应尽量稳定（按 id 排序即可复现）。

**P1 可选：** 按标签聚类；力导向；mindwalk 式 treemap。
**不做 P0：** 真实 3D 地球/城市。

### 6.2 视觉编码

| 通道 | 编码 |
|------|------|
| 暗 | 当前模式下 depth=0（无触达） |
| 亮度/描边 | depth 与（可选）score |
| 色相 | **来源** 保持可辨（勿只用明暗丢掉 source） |
| 数字角标 | P1：窗口内触达次数 |

无障碍要求：不能仅靠颜色；暗节点仍可见轮廓与来源缩写。

### 6.3 与检索列表关系

- 列表 **仍是** 主操作面（点开、挂工作项）。
- 库图是 **情境面**：解释范围，不取代列表点选（P0 点击图上节点 = 选中卡，与列表联动高亮）。

### 6.4 信息守恒

- 点亮集合必须 ⊆ 库中真实 cardId。
- `current_query` 下 lit 集合必须 = 本次 search 返回的 id 集合（允许 score 下限过滤时 **写明**）。
- 禁止「为了好看」随机点亮。

---

## 7. User-visible surfaces

### 7.1 检索区下方 / 侧旁：足迹图（P0）

路径：仍在 `/track/knowledge`。

**块标题文案（平常话）：**「知识足迹」或「库里哪些被点亮」。

**内容：**

- 模式切换：本次检索 | 最近 7 天（window）
- 图例：暗=未用到；亮=检索命中；更深=已挂到工作项（若 window/linked）
- 节点：短标题或首字 + 来源标记
- 空库：引导先种子/手记

### 7.2 与列表联动

- 列表 hover/选中 → 图上对应节点强调
- 图上点击 → 列表滚动到该卡或打开预览

### 7.3 工作项详情内嵌迷你足迹（P0 或 P1）

- 模式固定 `work_item`
- 仅点亮 `evidenceIds`；可显示「库中其余」极淡轮廓（可选关）
- 文案：这件事用到的依据

### 7.4 演示话术（给评委）

1. 搜「检索 来源」
2. 指列表：带来源的结果
3. 指足迹图：整库大部分仍暗，命中区域亮——「看得见用了哪一片知识」
4. 挂到工作项后：该卡在图上更深一档（若已实现 linked）

---

## 8. Core flows

### F1 单次检索点亮（P0）

1. 用户输入 query，点检索
2. 系统调用现有 search
3. 创建 `querySessionId`，对每个 hit 写 `FootprintEvent(kind=retrieved, score)`
4. 库图 `current_query`：这些 id 点亮，其余 dim
5. 列表展示 hits 不变

**验收：** 亮集 = hit id 集；刷新后若持久化则 window 模式仍可见历史。

### F2 打开卡片（P0 可选 / P1）

1. 用户展开卡
2. 写 `opened` 事件
3. 该节点 depth 至少为 read

### F3 挂到工作项（P0）

1. 用户关联 evidence（已有 API）
2. 写 `linked` 事件（workItemId）
3. `work_item` 模式与 `window` 模式更新

### F4 观察窗口热力（P0）

1. 用户切换「最近 7 天」
2. 聚合事件 max(depth)、可选 count
3. 无事件的卡 dim

### F5 工作项岛（P0/P1）

1. 选中工作项
2. 足迹图切 `work_item` 或详情内迷你图
3. 仅 evidence 亮

---

## 9. API

在现有 knowledge API 旁扩展；不破坏 search 契约。

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/knowledge/library-map` | 返回节点布局 + 可选 stats |
| GET | `/api/knowledge/footprint` | query: `mode`, `querySessionId`, `workItemId`, `since` |
| POST | `/api/knowledge/search` | **行为扩展**：成功后写入 retrieved 事件（兼容旧响应 shape，可多返回 `querySessionId`） |
| POST | `/api/knowledge/footprint/events` | 手动/打开卡等（P1） |
| GET | `/api/knowledge/footprint/sessions/:id` | 回放一次检索（P1） |

### 9.1 GET library-map 响应（建议）

```json
{
  "nodes": [
    {
      "cardId": "…",
      "title": "…",
      "source": "meeting",
      "x": 0.12,
      "y": 0.4,
      "clusterKey": "meeting"
    }
  ],
  "layout": "source-grid-v1"
}
```

### 9.2 GET footprint 响应（建议）

```json
{
  "mode": "current_query",
  "querySessionId": "…",
  "lit": [
    { "cardId": "…", "depth": 1, "score": 0.8, "touchCount": 1 }
  ],
  "dimCount": 12,
  "litCount": 4
}
```

客户端也可 P0 **纯前端**：search 响应 + listCards 本地算 lit/dim，事件落盘稍后做。
规格仍要求 **最终** 事件可持久化，以便 window 模式；实现可分两阶段（见 §12）。

### 9.3 持久化

| 文件 | 内容 |
|------|------|
| `data/knowledge/footprint-events.json` | id → FootprintEvent |
| `data/knowledge/query-sessions.json` | 可选 |

与 cards/actions/events（工作项时间线）分离，避免概念混淆。

---

## 10. Acceptance criteria

### A1 本次检索点亮（P0）

- [ ] 检索后足迹图可见
- [ ] 亮的 cardId 集合 = 本次 hits 的 id 集合
- [ ] 未命中卡呈暗/弱轮廓，且仍可辨来源分区
- [ ] 图例说明亮/暗含义（平常中文）

### A2 不破坏检索（P0）

- [ ] 搜「检索 来源」仍返回带来源的卡
- [ ] 列表操作（若有）与点亮一致

### A3 布局可解释（P0）

- [ ] 按来源分区（或文档写明的等价规则）
- [ ] 同一数据集两次打开节点相对分区稳定

### A4 联动（P0）

- [ ] 点击图上命中节点，能对应到具体卡（列表高亮或详情）

### A5 事件落盘（P0）

- [ ] 至少 `retrieved` 写入持久化
- [ ] 进程重启后，window 模式仍能看到此前检索足迹（用 since=足够早验证）

### A6 工作项关联加深（P0）

- [ ] link evidence 后，该卡在 footprint 中 depth ≥ linked（或 window 下可区分）
- [ ] 工作项详情可展示「相关依据」点亮集合（迷你图或列表+状态均可，但须满足「集合可见」）

### A7 文案（P0）

- [ ] 无禁用黑话；用「知识足迹 / 点亮 / 未用到」
- [ ] 不声称「AI 理解了仓库」；只声称「显示检索与使用触达了哪些依据」

### A8 性能（P0）

- [ ] 卡数量 ≤ 200 时交互可接受（切换模式 < 300ms 量级，本地）
- [ ] 卡数量很大时 P0 允许：布局只含最近 N 张 + 全部 lit 必含（策略写进实现注释）

---

## 11. Metrics

| 指标 | 交件/自用门槛 |
|------|----------------|
| 集合正确率 | lit 与 hits 不一致次数 = 0（自动化测） |
| 演示可指认 | 30 秒内能指着图说出「亮的是命中、暗的是没用到」 |
| 与 Notion 差异句 | 「我们能看见知识被用到的形状，不是只有笔记列表」 |
| 持久化 | 重启后 window 仍有事件 |

Kill：

1. 只有装饰动画、lit≠hits → 不做上线叙事
2. 图不可读（密到无法点）且无降级列表 → 先修布局
3. 与工作项、检索三者故事打架 → 收束为检索附属，不单开产品名

---

## 12. Phased delivery

### Phase 0a — 前端足迹（可先合并）

- search 后用 hits + listCards 算 lit/dim
- source-grid 布局
- 图例 + 点击联动
- **可不落盘**（若 0a 单独合，须在 UI 标明「仅本次」）

### Phase 0b — 落盘与窗口（P0 完整）

- FootprintEvent / querySession 持久化
- search 写 retrieved
- link 写 linked
- mode: current_query | window | work_item

### Phase 1

- opened / cited
- 迷你回放条（同 session 内）
- 触达次数角标
- 标签聚类布局

### Phase 2

- agent 检索写回 actor
- 与 mindwalk 类工具导出/对照（非必须）

**实现顺序约定：**
规格接受后先 0a+0b 一次做完更佳；若拆分，0a 不得对外声称「历史足迹」。

---

## 13. Testing

| 层 | 内容 |
|----|------|
| Unit | lit 集合算法；depth 取 max；layout 稳定性（同输入同坐标） |
| API | search 后事件数= hit 数；footprint?mode=window 含历史 |
| E2E | 检索 → 图上 litCount 与结果数一致 → 点节点联动 →（0b）重启或再请求 window 仍见事件 |

---

## 14. 与工作项 Spec 的边界

| | 工作项 Spec | 本 Spec |
|--|-------------|---------|
| 主对象 | WorkItem + 行动事件 | Card + 足迹事件 |
| 可见性 | 谁、下一步、沟通写回 | 知识用了哪一片 |
| 时间线 | 工作项详情 | 库图 + 可选 session |
| 共享 | 状态语言 | 点亮语义（retrieved/linked…） |

二者互补：
**工作项回答「事」；知识足迹回答「事所依据的知识被摸过哪里」。**

---

## 15. Open questions（默认取值）

| # | 问题 | 默认 |
|---|------|------|
| Q1 | 软命中（低分 fallback）算不算 lit？ | **算**，但 depth=seen 且 UI 可标「弱相关」若 score 低于阈值 |
| Q2 | 观察窗口默认多久？ | **7 天** |
| Q3 | 全暗时是否显示全部轮廓？ | **是**，否则不知道库有多大 |
| Q4 | 布局算法版本 | `source-grid-v1`，变更须升版本号 |
| Q5 | 0a 是否允许先合？ | 仅内测；交件叙事需 0b |

---

## 16. Done when

- A1–A8 勾完（P0 完整 = 0a+0b）
- 单测 + e2e 绿
- `CONTEXT.md` 增加「知识足迹」词条
- 本文件 status 改为 `accepted` 或 `P0 implemented`

---

## 17. Traceability（效率感觉）

| 感觉 | 本 Spec |
|------|---------|
| 沟通一致 | 亮/暗有统一定义；与 hits 集合一致 |
| 沟通可见 | 库图展示触达；事件可落盘 |
| 知道用了啥知识 | current_query / work_item 模式 |
| 知道什么知识沉睡 | window 下长期 dim 的卡 |

---

## 18. 实现前检查清单（给人 / Agent）

- [ ] 本 spec 已读，Q1–Q5 无异议或已改默认
- [ ] 与工作项 P0 不冲突（evidence link 可双写 linked 事件）
- [ ] 设计视觉：暗底上可读，符合 DESIGN.md
- [ ] 再开实现任务；未勾选前不写业务代码

---

**修订**

| 日期 | 变更 |
|------|------|
| 2026-07-14 | 初版：目标、模型、点亮规则、API、验收、分期 |
