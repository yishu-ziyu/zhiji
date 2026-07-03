# FC-OPC Next iBot 2026 - 技术架构分析

## 独立同行审查报告
> 审查时间: 2026-07-03
> 审查立场: 独立技术架构师，不参与项目开发

---

## 一、项目现状诊断

项目当前处于"骨架阶段"（scaffold-only），本质上一张白纸：
- 零行业务代码
- 零配置文件
- HACKATHON_DEV_RULES.md 未创建
- Ship auto-pilot 停在 design phase，plan 目录为空

48 小时竞速赛中，这意味着架构选择窗口还开着，但也意味着没有任何历史包袱。好消息是没有需要兼容的决策；坏消息是每一行代码都要在本周末前跑通。

---

## 二、赛道语境分析

FC-OPC 这个名字暴露了三件事：
- **FC** = 阿里云函数计算（Function Compute）+ AgentRun，这是阿里云 2025 年 12 月推出的 agentic 基础设施
- **OPC** = 一人公司（One Person Company），钉钉 2025-2026 年核心战略叙事
- **iBot** = 容智信息（Infodator）的 RPA + AI Agent 平台

主办方的真实意图是让参赛者用阿里云 FC 做 backend，面向"一人公司"场景构建 AI Agent。评审维度（来自 2026 年中国同类黑客松数据）：
- 完成度 25%、应用价值 25%、商业潜力 20%、创新性 20%、安全性 10%

**关键推论：** 评委想看的是一个有人味的、能解决具体小商家痛点的产品 demo，不是一个工程杰作。48 小时的展示窗口里，一个跑通流程的产品 beats 三个半成品。

---

## 三、推荐技术栈

### 3.1 统一前端：一个 Next.js 应用

不要做两个独立前端。一个 Next.js (App Router) 应用 + 路由级 track 分流，demo 时按按钮切换。

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Next.js 14+ App Router | 内置 API Routes 可当 backend，SSR 首屏快，单仓库双 track 路由隔离 |
| 语言 | TypeScript | 非 2026 的选项 |
| 样式 | Tailwind CSS + shadcn/ui | 原子 CSS + 现成组件库 = 48 小时最大杠杆 |
| 状态 | Zustand + TanStack Query | 客户端轻状态 + 服务端缓存，零样板 |
| 图标 | Lucide React | shadcn/ui 自带，不用额外装 |
| 部署 | Vercel (demo) + Alibaba Cloud FC (production) | Vercel 本地开发零配置；FC 是主办方技术栈，决赛答辩时提一句"已设计可部署架构" |

### 3.2 后端：Next.js API Routes + 函数级服务层

48 小时不需要微服务。在 Next.js 的 `app/api/` 下按 track 分目录：

```
app/
  api/
    ecommerce/
      analyze/route.ts      # 商品分析
      script/route.ts        # 短视频脚本
      message/route.ts       # 私域话术
      analytics/route.ts     # 店铺数据
    efficiency/
      minutes/route.ts       # 会议纪要
      project/route.ts       # 项目管理
      knowledge/route.ts     # 知识库问答
    llm/
      completions/route.ts   # 统一 LLM 入口
```

决赛答辩时再讲"API Routes 对应 FC 函数，迁移成本为零"。

### 3.3 AI Agent 层：轻量直接调用

**不用 LangChain，不用 CrewAI，不用 AutoGen。**

理由：
- LangChain 的 chain/orchestration 抽象在 48 小时里是负债不是资产
- 2026 年 85% 的生产团队直接用 API 调用，不用框架
- 48 小时 = 容错窗口极窄，多一层抽象 = 多一个调试点

替代方案：写一个 `LLMAdapter` 类，封装请求逻辑和 fallback chain，agent 逻辑直接写在 route handler 里。

**Model Fallback Chain（对接用户已有的 4 个 provider）：**

```
主链：MiMo v2.5-pro → DeepSeek v4-pro → MiniMax-M2.7 → Agnes 2.0 Flash
```

用户已有 4 个 provider 的 API key，按优先级排。用环境变量配置，`LLMAdapter` 内部做自动切换。

| Provider | 用途建议 |
|----------|----------|
| MiMo v2.5-pro | 主力（中英文都好，reasoning 能力强） |
| DeepSeek v4-pro | fallback 1（生成长文本稳） |
| MiniMax-M2.7 | fallback 2（Anthropic 兼容协议，适合 function calling） |
| Agnes 2.0 Flash | 最后兜底（免费，够用） |

### 3.4 基础设施共享层

```
shared/
  llm/
    adapter.ts          # 统一 LLM 调用 + fallback
    prompts/
      ecommerce/        # 电商 prompt 模板
      efficiency/       # 效率 prompt 模板
  types/
    common.ts           # Message, Session 等共用类型
  utils/
    streaming.ts        # SSE 流式输出（聊天体验的关键）
    mock-data.ts        # Mock 数据（比赛不需要真实接入淘宝 API）
  components/
    ui/                 # shadcn/ui 组件
    chat/
      ChatInterface.tsx # 通用聊天组件，两个 track 共用
    layout/
      Sidebar.tsx       # 侧边栏 track 导航
      Header.tsx        # 顶部栏
```

---

## 四、最小可行 Demo 范围

### 4.1 MoSCoW 拆解

**MUST HAVE（必须有，不做就判死刑）**

电商 Track：
- [x] 1 个商品分析 demo：输入商品名/链接，输出选品分析报告（含优缺点、目标人群、竞品）
- [x] 1 个短视频脚本生成 demo：输入商品，输出 30s/60s 脚本 + 镜头描述
- [x] 一个统一的聊天界面承载以上两个功能

效率 Track：
- [x] 1 个会议纪要 demo：粘贴一段模拟会议记录，输出结构化纪要（决策/待办/负责人）
- [x] 1 个项目看板 demo：展示任务列表（可拖拽状态切换）

两个 Track 共有的：
- [x] 一个登录/切换入口（Track 选择器）
- [x] 暗色主题 UI，看起来像一个 AI 产品

**SHOULD HAVE（应该有，有时间就做）**

- [ ] 私域话术生成（电商）：输入商品 + 客户画像，输出微信话术
- [ ] 知识库问答（效率）：上传几篇文档，基于内容回答
- [ ] 流式打字效果（AI 输出逐字显示）
- [ ] 移动端适配（至少不崩）

**COULD HAVE（锦上添花）**

- [ ] 数据看板图表（店铺经营数据可视化）
- [ ] 多轮对话上下文记忆
- [ ] 语音输入

**WON'T HAVE（明确砍掉）**

- [ ] 真实接入淘宝/抖店 API（48 小时不可能，用 mock 数据）
- [ ] 用户注册/登录系统（demo 用硬编码 session）
- [ ] 数据库持久化（in-memory 够用）
- [ ] RAG 向量检索（demo 阶段不需要，hardcoded context 够用）
- [ ] 钉钉/飞书集成（不需要，评委看的是前端 demo）
- [ ] 多轮 Agent 对话链（单轮够展示概念）

### 4.2 Demo 流程设计（评委视角）

**入场 30 秒：** 打开页面，看到暗色系 AI 产品界面，左侧选 Track，右侧是聊天区。

**电商 Demo（3 分钟）：**
1. 在电商 Track 输入："帮我分析一下这款无线蓝牙耳机的选品价值"
2. AI 流式输出选品分析报告（成本/竞争/利润率/风险）
3. 切换到"生成脚本"模式，输入同款商品
4. AI 输出 3 段短视频脚本，每段有镜头描述和口播文案
5. 评委看到的是：一个产品经理/小商家从选品到内容生产的完整链路

**效率 Demo（3 分钟，如果时间允许）：**
1. 切到效率 Track
2. 粘贴一段模拟会议记录
3. AI 输出结构化纪要（决议/待办/时间线）
4. 展示项目看板上的任务状态切换

**核心竞争力呈现：** "一个平台，两个 AI 角色，覆盖电商经营和团队效率两大场景"

---

## 五、项目目录结构

```
fc-opc-ibot/
├── app/
│   ├── layout.tsx              # 根布局（暗色主题 provider）
│   ├── page.tsx                # 入口页（Track 选择器）
│   ├── track/
│   │   ├── ecommerce/
│   │   │   ├── page.tsx        # 电商 workspace
│   │   │   └── chat/
│   │   │       ├── analyze/page.tsx
│   │   │       └── script/page.tsx
│   │   └── efficiency/
│   │       ├── page.tsx        # 效率 workspace
│   │       └── chat/
│   │           ├── minutes/page.tsx
│   │           └── project/page.tsx
│   └── api/
│       ├── llm/
│       │   └── completions/route.ts
│       ├── ecommerce/
│       │   ├── analyze/route.ts
│       │   └── script/route.ts
│       └── efficiency/
│           ├── minutes/route.ts
│           └── project/route.ts
├── shared/
│   ├── llm/
│   │   ├── adapter.ts
│   │   └── prompts/
│   │       ├── analyze.ts
│   │       ├── script.ts
│   │       ├── minutes.ts
│   │       └── project.ts
│   ├── components/
│   │   ├── chat/
│   │   │   └── ChatInterface.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── ui/                # shadcn/ui 组件
│   ├── types/
│   │   └── common.ts
│   └── utils/
│       ├── streaming.ts
│       └── mock-data.ts
├── .env.local                  # LLM API keys（用户已有全局配置）
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 六、风险清单

### 高风险

**1. 模型 API 可用性（概率 40%）**
用户有 4 个 provider 的 key，但 hackathon 期间网络环境不确定。MiMo 和 DeepSeek 走国内节点应该稳定；MiniMax  Anthropic 兼容端已知有 QPS 限制；Agnes 免费 tier 随时可能下线。
- 缓解：fallback chain 是必须的；准备 1-2 套离线 prompt 结果做 fallback display

**2. 流式输出不稳定（概率 30%）**
不同 provider 的 streaming 实现差异大。MiMo 支持 SSE；MiniMax Anthropic 端点支持 streaming；DeepSeek 标准兼容。但 48 小时内调试 streaming edge case 非常耗时。
- 缓解：第一版先做非流式（等结果后一次性显示），有时间再升级 streaming

**3. 时间低估（概率 60%，这是所有黑客松的第一风险）**
当前 scope 有 4 个功能点（选品分析、脚本生成、会议纪要、项目看板），每个都需要 prompt 调优。
- 缓解：严格按 MoSCoW 优先级做。Day 1 只做电商 track 的两个核心功能 + UI 骨架；Day 2 上午做效率 track 的两个功能；Day 2 下午 polish + 准备 demo 话术

### 中风险

**4. shadcn/ui 组件安装耗时**
shadcn/ui 需要 CLI 初始化，48 小时里每个组件都是 `npx shadcn-ui@latest add`，累计可能吃掉 1-2 小时。
- 缓解：只用最核心的 5-6 个组件（Button, Card, Textarea, Tabs, Badge, ScrollArea），其他用原生 HTML + Tailwind

**5. 暗色主题 UI 一致性**
AI 产品的 UI 质感主要来自间距、字体层级、微交互。48 小时里很难打磨到 pixel-perfect。
- 缓解：参考 Linear/Notion AI 的暗色配色，用 CSS 变量统一管理，不要逐组件调

### 低风险

**6. 阿里云 FC 部署**
Demo 阶段不需要真的部署到 FC。本地 Next.js dev server 完全够用。答辩时提一句"架构设计为 FC-ready"即可。

**7. 数据持久化**
纯 demo 不需要数据库。所有交互用 in-memory state + mock 数据。

---

## 七、48 小时时间线建议

**Day 1（7月11日）**

| 时段 | 任务 | 产出 |
|------|------|------|
| 09:00-10:00 | 脚手架：Next.js + Tailwind + shadcn/ui + 目录结构 | 可运行的空白项目 |
| 10:00-12:00 | LLMAdapter 实现 + 4 provider 连通性验证 | 一个 API 调用能跑通 |
| 12:00-13:00 | 午餐 | - |
| 13:00-15:00 | 电商 UI：Sidebar + Chat 界面 + 暗色主题 | 有样子的外壳 |
| 15:00-17:00 | 电商 Prompt 1：选品分析 prompt + API route | 能对话 |
| 17:00-19:00 | 电商 Prompt 2：短视频脚本 prompt + API route | 第二个功能 |
| 19:00-20:00 | 晚餐 | - |
| 20:00-22:00 | 电商 UI polish + 流式输出 | 基本可用 |

**Day 2（7月12日）**

| 时段 | 任务 | 产出 |
|------|------|------|
| 09:00-11:00 | 效率 UI：复用 Chat 组件，加项目看板 | 效率 Track 外壳 |
| 11:00-13:00 | 效率 Prompt：会议纪要 + 项目看板逻辑 | 两个功能 |
| 13:00-14:00 | 午餐 | - |
| 14:00-16:00 | 双 Track 路由打通 + Track 切换 | 完整的双轨体验 |
| 16:00-18:00 | UI polish：响应式 + 微交互 + 加载状态 | 像样的产品 |
| 18:00-19:00 | 准备 Demo 话术 + 3 分钟走查脚本 | 答辩材料 |
| 19:00-21:00 | 最终集成测试 + Bug 修复 | 可演示版本 |
| 21:00-22:00 | 提交 + 准备演示 | 收工 |

---

## 八、架构原则总结

1. **一个 repo，一个前端，一个 LLMAdapter**。重复是黑客松的敌人。
2. **Prompt 即功能**。电商 Track 的核心价值是 prompt 质量，不是工程复杂度。
3. **Mock 数据优先**。不需要真实接入任何第三方 API。评委看的是 AI 理解和生成能力，不是数据管道。
4. **Day 1 结束必须有一个完整功能流**（从输入到输出跑通）。这是心理安全底线。
5. **FC 是答辩时讲的故事，不是 Day 1 需要部署的东西**。

---

## 九、与本项目命名约定的关系

项目名 `fc-opc-ibot` 暗示了三个技术承诺：
- **FC** = 阿里云函数计算：架构设计为函数级，API Route 对应 FC 函数，迁移文档写一行 README 即可
- **OPC** = 一人公司：产品叙事围绕"一个 AI 团队替代一个小公司的运营岗位"
- **iBot** = 容智 RPA 风格 Agent：demo 展示"任务驱动"的 agent 行为（输入任务描述 → 自动执行 → 返回结果），而不是简单聊天机器人

这三层在技术架构里都能覆盖：API Route 对应 FC 函数，Prompt 设计围绕 OPC 场景，Agent 行为通过 tool-use pattern（在 prompt 中定义执行步骤）模拟。

---

*本报告为独立技术审查，基于项目当前骨架状态和黑客松约束条件撰写。所有建议均为方向性指引，具体实现细节需在开发过程中根据实际情况调整。*
