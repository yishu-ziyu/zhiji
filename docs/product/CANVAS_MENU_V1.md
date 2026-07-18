# 画布菜单 v1（Agent 可执行呈现词表）

**版本：** canvas-menu-v1  
**状态：** 冻结执行契约；扩展只加不改语义  
**消费者：** 人工预设芯片 · Agent 工具 `set_canvas_view` · 意图路由

## 1. 原则

1. Agent **只调视图**，不 invent 关系边。  
2. 每次意图最多选 **1 个 view + 1 个 focus**（可加 highlight）。  
3. 合法出口只有 `CanvasCommand`（经 `set_canvas_view` 或等价 API）。  
4. 词表变更必须升次版本号，并补黄金口令与 eval。

## 2. Views（呈现预设）

| id | 人话 | 边策略 | 标签 | 着色 | 适用意图 |
|----|------|--------|------|------|----------|
| `now` | 现在怎样 | 藏 weak；保留 medium/strong | 仅 strong 常显 | 现有 strength/kind | what_now, resume_recent, open_entity |
| `by_kind` | 类型一眼 | 藏 weak | 默认关，悬停开 | kind 主色 | survey_types |
| `decision` | 决策通路 | 仅 attention / blocked / strong work | 全开（边少） | 阻塞强调 | whats_blocked, what_now |
| `evidence` | 证据网 | 仅 evidence / material（+ 可选 attention） | 依据类可显 | 统一依据色 | why_evidence |

默认：`now`。

## 3. Ops（可执行操作）

| op | 参数 | 效果 |
|----|------|------|
| `set_view` | `view` | 切换呈现预设 |
| `set_focus` | `focus: CanvasNodeRef` | 改中心焦点并拉 snapshot |
| `set_highlight` | `nodeKeys[]`（`kind:id`） | 节点 pulse / 搜索高亮 |
| `set_fold` | `1hop` \| `path` | v1 仅记录；path 留给 v1.1 |

`set_canvas_view` 一次可携带 view + focus + highlight（原子应用）。

## 4. CanvasCommand（JSON）

```json
{
  "menuVersion": "canvas-menu-v1",
  "view": "now" | "by_kind" | "decision" | "evidence",
  "focus": { "kind": "project"|"work_item"|"card"|"event"|"agent", "id": "..." },
  "highlightNodeKeys": ["card:uuid", "work_item:seed-…"],
  "fold": "1hop",
  "reason": "短中文：为何选此呈现（给 Owner 看）",
  "intentId": "why_evidence"
}
```

校验规则：

- `menuVersion` 必须为 `canvas-menu-v1`  
- `view` 必须在上表  
- `focus` 若存在则 kind/id 非空  
- `highlightNodeKeys` 可选，每项匹配 `^[a-z_]+:.+$`  
- 未知字段忽略，不报错（前向兼容）

## 5. 意图枚举 v1

| intentId | 典型说法 | 默认 view | focus 策略（Agent/规则） |
|----------|----------|-----------|---------------------------|
| `what_now` | 现在怎样 / 先干啥 | `now` | 保持项目中心或 attention 主项 |
| `resume_recent` | 昨天那个项目 / 接着看 | `now` | 最近 activity / 用户点名实体 |
| `why_evidence` | 凭什么 / 证据从哪来 | `evidence` | 当前结论或指定节点 |
| `whats_blocked` | 卡点 / 阻塞 | `decision` | 项目中心或 blocked 工作项 |
| `survey_types` | 关系都有啥类型 | `by_kind` | 保持当前焦点 |
| `open_entity` | 打开某某文件/任务 | `now` | 解析到的 card/work_item |
| `decision_path` | 决策链路 / 该动哪条 | `decision` | attention 主项 |
| `present_logic` | 展示业务逻辑 / 项目在做什么 / 核心流程 | `now` | 项目中心；`highlightNodeKeys` 为 Agent 已读材料对应 card；`fold=path`；构图侧 pin 这些节点并画「逻辑串联」呈现边（非持久关系库） |
| `unknown` | 无法归类 | （不发 command） | — |

**present_logic 语义（产品）：** 不是只换视图预设。Agent 须先理解授权夹（map/search/read），把真实文件映射为材料节点，再在中央画布上串联呈现。无材料时只切 `now` 并说明原因。

## 6. 工具契约 `set_canvas_view`

**输入：** `CanvasCommand`（可省略 `menuVersion`，服务端补全）  
**输出 receipt：**

- `outcome: ok` + `detail` 为规范化 JSON command  
- `outcome: error` + `errorClass: invalid_input`（校验失败）

**副作用：** 无磁盘写入；UI 读 tool receipt / API 响应后改焦点与预设。

## 7. 禁止

- 为「好看」新增边或改 relation 库  
- 一次切换多个 view  
- 用长文代替 command  
- 在未登记的 view id 上执行

## 8. Eval 门槛（过线定义）

- 黄金口令 **全量命中**（`canvas-golden-intents.ts`，≥100 条）意图 id + view  
- 负例口令 **全部 unknown**（不误触发画布）  
- 每条期望 view 与 command.view 一致  
- `set_canvas_view` 非法输入 100% error  
- 合法输入 100% 产出可 JSON.parse 的 command  

**扩说法：** 只加同意图的中文/英文变体与黄金样例，不改 views/intent 枚举。  
改菜单结构必须升 `canvas-menu-v1` → v1.1。
