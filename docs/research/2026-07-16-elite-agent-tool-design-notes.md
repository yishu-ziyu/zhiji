# 顶尖 Agent / 工具设计笔记（服务 D-53 · 非采用决定）

**日期:** 2026-07-16  
**作者:** 产品话事人2  
**目的:** Owner 要求：不用「读文件条数硬顶」代替架构；调研顶尖实践如何设计 Agent 与工具。  
**等级:** X 公开讨论 + 行业二手综合 + 本产品已定约束交叉。**非** 法律意见、**非** 框架采纳、**非** D-13 钉死源码审计。

---

## 0. 对本产品的一句话

顶尖 coding agent 几乎从不靠「最多读 N 个文件」当产品智慧；他们靠：

**便宜地图 → 搜索 → 精确读 → 多步 tool loop → 任务外侧验证（什么叫够）→ 可中断 harness → 模型可换。**

这与 Owner「不要读文件硬顶、要靠 Agent 设计」一致；也与 D-51/D-52/D-53 同向。

---

## 1. 反复出现的设计模式

| 模式 | 在做什么 | 对本产品 |
|------|----------|----------|
| **Harness > 裸模型** | 工具循环、权限、工作区、验证在模型外（Simon Willison；Claude Code SDK 被描述为可换 prompt/tools 的同一 harness） | 真相与 grant 在产品；`AgentModelLoop` 只做推理环 |
| **先 map / 索引，再深读** | 结构、符号、调用链、影响面，减少整仓塞上下文（X：code map / hierarchy / blast radius 类实践） | D-51 step「建项目图」是工具，不是真相 |
| **先搜后读** | grep/glob/符号检索 → 再 exact span 读 | D-52 搜/读/Git 工具清单的排序 |
| **精确读，不整文件灌** | 按行/块/revision 摘录 | 对齐「exact revision + quote」 |
| **任务外侧 verifier** | Karpathy 线：不能评就无法自动研究；先写清 done/evidence/checks（X 二次传播） | 「理解文件夹」的完成 = 有来源候选/unknown，不是步数 |
| **状态与 delta，不每轮重放整仓** | 长任务传变化与已编译证据包，而非反复全仓 token（X 架构讨论） | project memory + events 已是产品形状 |
| **可见失败与停因** | tool 失败环、context rot 仪表（OSS 讨论） | D-52 tool receipts + stopping reason |
| **人可中断 / 高风险停点** | 写操作与扩权不静默 | D-52 已定 |
| **中等模型 + 好工具** | Owner 策略：中等跑通 → 更强模型增益 | D-53b；工具质量 > 盲目换模 |

---

## 2. 工具「配得好」通常长什么样

面向代码/项目理解的 agent，稳定工具族（名称因产品而异）：

1. **List / tree / ignore-aware map**（便宜）  
2. **Search**（文本、符号、路径）  
3. **Read exact**（path + revision/commit + 行范围）  
4. **Git read-only**（status/log/diff/show/blame）  
5. **Follow ref**（定义/引用/一跳依赖）  
6. **Compare**（before/after、与已接受理解对照）  
7. **（后置）** 外部检索、浏览器、写操作 — 带授权与确认  

**反模式：** 只有 chat；只有一次 complete；把整仓 JSON 塞进 prompt；用「读满 N 文件」当理解完成。

---

## 3. 与「不要读文件上限」的精确关系

| 做法 | 顶尖习惯 | 本产品 |
|------|----------|--------|
| 产品硬顶「最多读 50 文件」 | 少见作为主智慧 | **Owner 否决**（D-53c） |
| 工具层分页/截断超大文件 | 常见，防单次爆炸 | **允许**（实现细节，须在 receipt 标明 truncated） |
| 进程超时 / 可中断 | 常见 harness | **保留**（不得写成「已理解」） |
| 够用即止（sufficient / unknown） | 核心 | **D-51 已定** |
| 任务验收在环外 | Karpathy 线 | **D-53a** |

---

## 4. 对本产品工程的直接含义（仍须 D-50 后启动）

1. 交付 **toolful** 环，不是 endpoint 替换。  
2. 工具优先：map → search → exact read → git → compare。  
3. 完成定义：授权夹上的 **有来源候选理解 / unknown**，不是 tool 计数。  
4. StepFun 中等模型必须能在该 harness 下跑通。  
5. 首版工具只在授权根内（D-53d）。  
6. 不因本笔记采纳 Claude Code / LangGraph 等框架（D-48/Q-33 仍开）。

---

## 5. 证据索引（公开 · 非钉死源码审计）

- X：Karpathy 评价/循环与 verifier 二次传播（@alphabatcher 等）  
- X：Simon Willison — agent harness + 正确工具集；执行 harness 难于 JSON tool call  
- X：Alex Albert — Claude Code SDK 作为可定制 agent harness  
- X：code map / 调用链 / grep 增强使 agent「更聪明」类实践（多作者）  
- 行业：Claude Code 设计空间论文/解读（harness 环绕模型）；sub-agent 探索大仓  

**缺失（应继续调研，不阻塞 D-53 产品记录）：**  
- StepFun `step-3.7-flash` 官方 tool/structured 能力一手卡  
- 对 Claude Code / Codex / Aider 的 **D-13 级** 源码钉死比较（若要「参考开源」须另开 T）

---

## 6. 变更

| 时间 | 内容 |
|------|------|
| 2026-07-16 | 初版 · 服务 Owner D-53 · 否决读文件硬顶 |
