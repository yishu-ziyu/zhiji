# 严格验收清单 · E7–E9 + 闭环

**产品：** `/track/knowledge` · 唯一入口  
**北极星：** Canvasight（左项目 · 中关系画布 · 右摘要/Agent 动态 · 底多轨时间线）  
**规则：** 每一条必须 **可观察 / 可失败**；工程自测 ≠ Owner 点头。  
**本清单 Owner 未说「过」前，§0 产品清单不算完成。**

---

## 0. 环境与门禁

| # | 步骤 | 期望 | 失败即 |
|---|------|------|--------|
| 0.1 | `GET http://127.0.0.1:3331/track/knowledge` | HTTP **200**，非 500 | 停 |
| 0.2 | `GET /api/knowledge/projects` | JSON 含 `projects` 数组 | 停 |
| 0.3 | 单测命令见文末 | **全部 PASS** | 停 |
| 0.4 | 浏览器硬刷新（避免旧 CSS/JS） | 四区壳可见 | 停 |

---

## 1. E1–E6 回归（不得回退）

| # | 当… | 应看到… | 验法 |
|---|------|---------|------|
| 1.1 | 打开有材料的项目（如 scion） | 中心=项目；周围 **≥3** 可点节点 | 数 `canvas-node-*` 或中心邻居 |
| 1.2 | 邻居标签 | **不以** package-lock / pnpm-lock / `.mp3` / `run-*.mjs` / `serve-*.mjs` 为主 | 读标签 |
| 1.3 | 「现在怎样」 | 建议材料为可读文档（如 CONTEXT/README），非 css/音频 | `project-now-judgment` |
| 1.4 | 点项目中心 | 右栏「依据」有 **≥1** 可点材料 | inspector 依据 tab |
| 1.5 | 点某材料节点 | 右栏 **大标题=该材料名** | `inspector-focus-title` |
| 1.6 | 有 ≥2 个 actor 的事件 | 底栏 **≥2 轨**（`timeline-lane`） | 底栏 |
| 1.7 | 左栏 | **无** SignalGraph/Canvasight/Multica 参考块 | 目视 |
| 1.8 | 新授权含 ≥3 个 md 的夹 | 进入后是画布而非永远「放进资料」 | 授权夹 + 夹具 |

---

## 2. E7 · 右栏真 Agent 过程 / 动态

| # | 当… | 应看到… | 验法 |
|---|------|---------|------|
| 2.1 | 项目内至少有一条 `actor` 以 `agent:` 开头的结果事件 | 右栏「动态」出现 **八步过程** 列表 | `data-testid=inspector-agent-process` |
| 2.2 | 同上 | 八步每步有 `pending` / `active` / `done` 之一，且与项目状态一致（有材料→前几步 done；有 Agent 结果→工具/推理推进；待确认→owner active） | `data-step` + `data-status` |
| 2.3 | 同上 | **过程下方**有 Agent 动态 feed（时间倒序），含 Agent 名 + 摘要 | `data-testid=inspector-agent-feed` |
| 2.4 | feed 条目可点 | 点击跳到对应事件或工作项焦点 | 中心/右栏变化 |
| 2.5 | 无 Agent 事件的纯材料项目 | 动态区诚实说明「还没有 Agent 执行记录」，**仍显示**八步（多为 pending/前几步 done） | 不空白装死、不编造 |
| 2.6 | 项目焦点默认 | 有 Agent 活动时默认打开「动态」tab | `data-active` on 动态 |

**不做（本轮）：** 改 `agent-model-loop`；假进度动画无数据。

---

## 3. E8 · 画布多 Agent 可见节点

| # | 当… | 应看到… | 验法 |
|---|------|---------|------|
| 3.1 | 项目存在 `agent:*` 结果事件 | 项目焦点邻居中出现 **kind=agent** 节点 | `canvas-node-agent-*` |
| 3.2 | Agent 节点标签 | 可读名（非裸 id），副标含「Agent」或角色 | 目视 |
| 3.3 | 点 Agent 节点 | 中心/焦点切到该 Agent；右栏标题为 Agent 名；摘要含最近结果/条数 | `inspector-focus-title` |
| 3.4 | Agent 焦点邻居 | 含其写过的工作项或结果事件（一层） | 节点可点 |
| 3.5 | 多 Agent | 不同 actor 各成节点，不合并错乱 | 两 actor 两条节点 |
| 3.6 | 无 Agent 事件 | **不**伪造 Agent 节点 | 邻居无 agent |

---

## 4. E9 · 视觉（系统蓝一致性）

| # | 当… | 应看到… | 验法 |
|---|------|---------|------|
| 4.1 | 主操作按钮（如交给 Agent） | 使用系统蓝 **#007AFF**（或等价 token） | 计算样式 / CSS 变量 |
| 4.2 | 右栏 active tab 下划线 | 系统蓝，非纯黑装饰 | 目视 |
| 4.3 | Agent 节点选中/强调 | 蓝色边或浅蓝底，与材料灰区分 | 目视 |
| 4.4 | 字体 | 全站 Plus Jakarta / 系统栈，**无**满屏艺术字 | 目视 |
| 4.5 | 不回归 | 四区布局仍完整；不因抛光挡点击 | 点节点仍 work |

---

## 5. 闭环测试（工程必须全绿）

| # | 命令 / 动作 | 期望 |
|---|-------------|------|
| 5.1 | `./node_modules/.bin/vitest run shared/knowledge/canvas-material-rank.test.ts shared/knowledge/project-canvas.test.ts shared/knowledge/materialize-grant-signals.test.ts shared/knowledge/agent-activity.test.ts` | 全 PASS |
| 5.2 | 活页：`GET .../canvas?focus=project:<有agent事件的项目>` | JSON：`nodes` 含 agent；`agentActivity.steps.length===8`；`agentActivity.feed.length≥1` |
| 5.3 | 活页：`GET /track/knowledge` | 200 |
| 5.4 | （可选）E2E 若环境具备 | `project-canvas-shell` 可见 |

---

## 6. Owner 手感（唯一「过」）

| # | 你做 | 你应感到 |
|---|------|----------|
| 6.1 | 打开有 Agent 跑过的项目 | 像「有助手在工作」：右栏有步骤+动态，中心能点到 Agent |
| 6.2 | 点 Agent → 看依据/结果 | 知道它做了什么、依据在哪 |
| 6.3 | 点材料/工作 | 右侧标题跟着变；不乱 |

你说 **「过」** → 勾产品清单 §0。  
任一条失败 → 记进 GAP，不宣称完成。

---

## 文末：单测入口

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
./node_modules/.bin/vitest run \
  shared/knowledge/canvas-material-rank.test.ts \
  shared/knowledge/project-canvas.test.ts \
  shared/knowledge/materialize-grant-signals.test.ts \
  shared/knowledge/agent-activity.test.ts
```
