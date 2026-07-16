# 差距清单：现状 → Canvasight 北极星

可执行工程项。完成打勾。Owner 验收仍以「点一下像不像理想形态」为准。

## 北极星（验收画面）

左多项目 · 中项目关系画布（真节点）· 右当前对象摘要 + 动态 · 底按人/Agent 的时间线。  
喂料（授权夹/拖文件）不是终点。

## 现状一句话

四区壳在、React Flow 径向画布在，但中心常被 lockfile/音频/脚本噪声占满；右侧更像表单；底栏是事件平铺不是多轨；理解/工作节点稀少时像「文件列表图」。

---

## 工程项（按阻塞排序）

### E0 页面能开 [x]

- **问题：** CSS 语法错误导致 3331 整站 500  
- **做：** 修好 `project-canvas.module.css` `.workspace` 块  
- **验：** `GET /track/knowledge` → 200  

### E1 中心节点：去噪 + 优先理解/工作/可读材料 [x]

- **问题：** scion 等项目中心周围是 `_options.css`、mp3、`run-*.mjs`，不像「结构」  
- **做：** `shared/knowledge/canvas-material-rank.ts`；邻居与「现在怎样」证据过滤  
- **验：** 单测 E1 + 活页 scion 邻居以可读材料为主  

### E2 项目焦点右侧有理解依据 [x]

- **问题：** 项目焦点 `inspector.evidence=[]`，右栏「依据」空  
- **做：** project 焦点 inspector.evidence = projectNow 证据卡  
- **验：** 单测 + inspector.evidence 非空  

### E3 右栏标题跟随焦点 [x]

- **问题：** header 永远是项目名/项目摘要，点材料仍像「项目面板」  
- **做：** header 用 `inspector.title` + focus 类型副标  
- **验：** `data-testid=inspector-focus-title`  

### E4 底栏按人/Agent 多轨 [x]

- **问题：** 每条事件一行，不是 Canvasight 式「按 actor 轨道」  
- **做：** `ProjectTimeline` 按 actor 分轨  
- **验：** `data-testid=timeline-lanes`  

### E5 左栏去掉参考产品 cosplay [x]

- **问题：** SignalGraph/Canvasight 等参考标签像工程展板  
- **做：** 删 referenceSources 展示  
- **验：** 侧栏无参考产品块  

### E6 授权夹后画布能亮 [x 工程]

- **问题：** 授权只写 memory、进项目不加载 materials  
- **做：** materialize bridge + enter 时 load materials（已合）  
- **验：** 新授权 ≥3 md 夹 → 进画布见节点（需你重试）  

### E7 右栏真 Agent 过程 feed [x 工程]

- **问题：** 动态 tab 只是事件列表，不是八步过程  
- **做：** `agentActivity` 入 snapshot；右栏动态 = 八步 + Agent feed  
- **验：** `ACCEPTANCE_E7_E9.md` §2 + 单测  

### E8 多 Agent 可见节点 [x 工程]

- **问题：** 画布无 agent 节点  
- **做：** `CanvasNodeKind=agent`；项目邻居含 agent；可点焦点  
- **验：** `ACCEPTANCE_E7_E9.md` §3 + 单测  

### E9 视觉抛光 [x 工程]

- **问题：** 主色偏黑、Agent 不突出  
- **做：** `--pc-accent: #007AFF`；主按钮/ tab / Agent 节点  
- **验：** `ACCEPTANCE_E7_E9.md` §4  

---

## 本轮已做完

E0–E9 工程项。严格验收：`docs/product/ACCEPTANCE_E7_E9.md`。  
Owner 说「过」前产品清单 §0 不勾。
