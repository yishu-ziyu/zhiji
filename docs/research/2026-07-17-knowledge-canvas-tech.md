# 知识关系画布：交互与技术选型调研

**日期：** 2026-07-17  
**问题：** 中心关系画布要「可拖、可平移、可缩放、接近 Canvasight 参考图」——业界怎么做、用什么库、本仓怎么接。  
**范围：** 只论中心「节点 + 边」探索画布，不论文档编辑器、不讨论模型环。

## 1. 产品交互拆开说

「可拖画布」在成熟产品里至少是三件独立能力：

| 能力 | 用户动作 | 业界默认手势 |
|------|----------|--------------|
| **平移 viewport** | 空白处拖 / 双指 / 中键 / 空格+拖 | Figma、Miro、Notion 白板 |
| **缩放** | 滚轮 / pinch / 控件 +− | 同上；常配合 `fitView` |
| **拖节点** | 按住卡片改位置 | 节点图编辑器默认；白板里是「选中对象」 |

另外还有：多选、框选、吸附、小地图、键盘移动——第二期再开。

本产品是 **关系图探索**（中心项目/焦点 + 一跳邻居 + 边标签），不是自由涂鸦白板。  
所以核心抽象是 **nodes + edges + viewport**，不是无限画笔层。

## 2. 业界技术套路（共性）

无论自研还是用库，底层几乎同一套：

1. **Viewport 变换**  
   一层 `transform: translate(x,y) scale(z)`（或等价矩阵）包住全部图元。  
   开源实现常见 **d3-zoom** 处理 pan/zoom（含惯性与边界可关）。

2. **节点拖拽**  
   拖节点改的是 **节点坐标**，不是 viewport。  
   边路径随端点重算（贝塞尔 / 平滑步进 / 直线）。

3. **渲染策略**  
   - DOM 节点（自定义 React 卡片）+ SVG/Canvas 画边  
   - 或全 Canvas/WebGL（节点上千时）  
   节点 <100 时 DOM+SVG 足够，且易做 Apple 级卡片样式。

4. **布局**  
   力导向 / 层次（dagre、ELK）/ 径向（中心+环）/ 人手摆位。  
   探索型「焦点 + 一跳」常用 **径向或左右列**，再允许用户拖开后记忆位置。

5. **别手搓的原因**  
   命中测试、指针捕获、触控、缩放中心、拖节点 vs 平移冲突、选中环、无障碍、虚拟化——成熟库已踩完坑。自研 `pointerdown` 平移只能到「能用」，到不了「顺」。

## 3. 开源方案对比（2025–2026 现状）

| 方案 | 适合 | 不适合 | 许可 / 成熟度 | 本仓匹配度 |
|------|------|--------|---------------|------------|
| **[@xyflow/react](https://reactflow.dev/)（原 React Flow）** | 节点图、工作流、知识关系、架构图；自定义 React 节点/边；pan/zoom/拖节点开箱 | 自由手绘白板 | MIT；生态最大；内部 d3-zoom + d3-drag + zustand | **首选** |
| **[tldraw](https://tldraw.dev/)** | Miro 类无限白板、涂鸦、形状工具 | 强类型业务边 + 一跳探索图会「过重」 | 专有 SDK 许可需读条款 | 过重 |
| **Cytoscape.js / Sigma.js / vis-network** | 大规模图分析、科学可视化 | 高度定制 React 产品卡片、四区壳嵌入 | 多为 MIT | 样式与壳难融 |
| **Konva / Fabric** | 通用 2D 画布 | 自己实现图语义与 React 集成 | MIT | 仍大量自研 |
| **手搓 transform** | 原型验证 | 生产级手势 | — | **应淘汰** |

**结论：**  
- 我们的参考图（Canvasight / SignalGraph 系）是 **节点卡片 + 曲线边 + 中心焦点**，不是白板。  
- 与 **React Flow / xyflow** 的问题空间一致。  
- 直接采用 `@xyflow/react`，自定义 Node/Edge 贴参考图视觉；**不要**继续在 `ProjectCanvas` 里手写 pan。

## 4. 推荐接入方式（高质量最小集）

### 4.1 依赖

```bash
pnpm add @xyflow/react
```

（样式：`@xyflow/react/dist/style.css`，再用 CSS 变量压成我们的暖灰 + 系统蓝。）

### 4.2 职责切分

| 层 | 负责 |
|----|------|
| `shared/knowledge/project-canvas.ts` | **数据**：焦点、一跳邻居、边、attention、projectNow（不变） |
| `ProjectCanvas.tsx` | **viewport + 交互**：把 snapshot → xyflow nodes/edges；radial 初始坐标；自定义节点外观 |
| 页面壳 | 左导航 / 右摘要 / 底时间线仍在 page；画布只占中区 |

### 4.3 交互默认（对齐常见产品）

- `panOnDrag`：空白 / 中键平移  
- `zoomOnScroll` + `minZoom` / `maxZoom`  
- `nodesDraggable`：卡片可拖；**不**默认 `nodesConnectable`（本阶段是探索不是改图连线）  
- `fitView`：焦点切换后适配  
- 可选：`Background` 点阵或淡环（参考图同心圆用自定义 SVG/CSS 层）

### 4.4 布局

1. **首屏：** 中心节点固定 (0,0)，邻居按角度均分半径 R（或左/右两列），边 `type: 'default' | 'smoothstep' | 自定义贝塞尔`。  
2. **用户拖过的节点：** 可选 session 内记住 position；持久化下一期。  
3. 节点很多时：仍用现有 `hiddenNeighborCount` 折叠，而不是一次铺 50 个。

### 4.5 明确不做（本轮）

- 用户手动画新边（连线编辑）  
- 协作 CRDT  
- 上千节点 WebGL  
- 换成 tldraw 白板工具栏  

## 5. 与当前实现差距

| 现状 | 问题 | 用 xyflow 后 |
|------|------|----------------|
| 三列 CSS grid + 手写贝塞尔 | 边与节点易错位；难拖 | 节点坐标驱动边 |
| 自研 pan | 手势弱、无缩放 | 产品级 pan/zoom |
| 边证据塞节点里 | 视觉脏 | 自定义 Edge label / 节点只留短 chip |
| 无开源依赖 | 重复造轮 | `@xyflow/react` |

## 6. 验收（替换后）

1. 空白处拖：画布平移流畅。  
2. 滚轮：缩放，中心大致跟手。  
3. 拖节点：卡片移动，边跟着走。  
4. 点节点：右侧摘要仍更新（`onFocus` 不变）。  
5. 焦点在 project 时：中心是项目，周围 ≥3 真实节点（阶段 2 北极星仍满足）。

## 7. 来源

- React Flow 官方：https://reactflow.dev/ — pan/zoom/drag 内建；底层 d3-zoom / d3-drag  
- xyflow npm：`@xyflow/react`  
- tldraw：https://tldraw.dev/ / https://github.com/tldraw/tldraw — 无限白板 SDK  
- 业界实践综述：节点图用 React Flow；白板用 tldraw（见公开博客与官方定位）

## 8. 决策

**采用 `@xyflow/react` 重写中心画布交互层。**  
数据层 `buildProjectCanvasSnapshot` 保留；UI 从手搓 stage 迁到 xyflow。

## 9. 落地状态（同日）

- 依赖：`@xyflow/react@12.x` 已装入本仓  
- 实现：`app/track/knowledge/components/ProjectCanvas.tsx` 已改为 xyflow  
  - 空白拖 = pan，滚轮 = zoom，拖卡片 = 挪节点，点节点 = `onFocus`  
  - 初始径向布局 + `fitView`；不开放连线编辑（`nodesConnectable=false`）  
- 样式：`project-canvas.module.css` 中 `.rf*` 贴合暖灰卡片 + 系统蓝选中环  

## 10. 焦点迁移 + 理解优先（同日续）

**产品巧思：** 画布是「焦点图」不是「全量文件树」。点某节点 → `focus` 换到该对象 → 以它为中心重铺一跳邻居（xyflow `fitView`）。

**数据策略（`project-canvas.ts`）：** 项目中心邻居优先级  

1. 工作 attention / 在跟工作  
2. 最近打开的材料  
3. 「现在怎样」理解依据  
4. 有关系的材料 / 工作依据  
5. 少量剩余文件样本（有理解结构时最多 4 份）  

非项目焦点时始终挂 **项目中心** 一跳，便于回到全局。UI 有「回到项目中心」。

**仍弱：** 纯授权夹、尚无工作项时，理解主要是确定性 `projectNow` + 材料证据，还不是模型写的任务图。要更像参考图的「01 跑通检索…」节点，需要 Agent 写回 work items / 关系（工程师 2 模型环可后续喂）。

## 11. Canvasight 对齐续（2026-07-17 夜）

学 xyflow + dim0 级体验，**不换栈**：

| 能力 | 实现 |
|------|------|
| 节点随 Agent 点亮 | `agent-canvas-live.ts` → `data-agent-phase`（mapped/searched/reading/done） |
| Live Feed | 右栏 `AgentProcessPanel` 收据流 + 动态 tab 合并 tool receipts |
| Canvas Stats | 画布右上 `canvas-stats-bar`（节点/关系/材料/Agent 步骤 + Live） |
| 桥接 | `page.tsx` 把 `agentSession.toolReceipts` 传入 `ProjectCanvas.agentLive` |

## 12. Dagre 布局 + 01/02 任务卡（2026-07-17 续）

| 能力 | 实现 |
|------|------|
| Dagre 自动布局 | `@dagrejs/dagre` · `canvas-auto-layout.ts` · 默认无手摆位置时用；按钮「自动布局」/「纵向↔横向」 |
| Agent 写回任务卡 | `agent-task-cards.ts` · 理解 → `01 核对…` + 文件跟进卡 · `writeAgentRunToKnowledge` 落库后 `renumberOpenWorkTitles` |
| 节点展示 | work_item 左侧序号芯片 `rfTaskIndex`（从标题 `01 ` 解析） |

ELK 未装（重）；dagre 覆盖本产品一跳星型图。若图变深再引 `elkjs`。
