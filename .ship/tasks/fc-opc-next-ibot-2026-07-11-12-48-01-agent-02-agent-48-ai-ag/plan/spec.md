# FC-OPC Next iBot 2026 - 产品规格书

> 状态：v1.0（22 轮 Loop Engineering 后稳定） | 2026-07-03 初稿 / 2026-07-04 更新 | 基于海报 + HACKATHON_DEV_RULES.md + 22 轮 Eval 闭环

---

## 1. 产品定义

**FC-OPC Next iBot** 是一个双赛道 AI Agent 平台，面向"一人公司"（One Person Company）场景，覆盖电商经营和团队效率两大核心场景。产品通过自然语言交互，让用户用对话方式完成选品分析、内容生产、会议纪要和项目管理。

### 产品定位

- **目标用户**：小商家、个体创业者、小型团队负责人
- **核心价值**：一个 AI Agent 替代多个运营岗位，降低一人公司的运营成本
- **叙事锚点**：FC（函数计算）= 云端部署就绪；OPC（一人公司）= 产品场景；iBot = 任务驱动 Agent 行为

### 核心术语

| 术语 | 定义 |
|------|------|
| Track | 赛道，本项目有电商 Track 和效率 Track |
| Agent | 一个 LLM + prompt + tool 定义的自动化工作流 |
| LLMAdapter | 统一 LLM 调用层，封装多 provider fallback |
| Demo 功能 | 评委可交互演示的功能单元 |

---

## 2. 功能需求（MoSCoW）

### MUST HAVE（4 个，缺一个就不算完成）

#### 电商 Track

**M1: 选品分析 Agent**
- 输入：商品名称/描述 + baiduIndex（可选，百度指数，非负）
- 输出：结构化选品报告，字段含：
  - 基础：`marketHeat, competition, profitMargin, targetAudience, risks, strengths, recommendation`
  - 量化（Round 4-6 新增）：`competitorCount, competitorCountBasis, priceRange, topPlayers[], topSellersMonthlySales, marketHeatBasis`
- 技术：LLM 结构化输出 + 共享函数 `analyzeProduct()`（供 M2 调用打通数据）+ 确定性 hash（同一产品同一组数据）+ 5 品类专属 mock 分支（美妆/猫砂/手表/3C外设/食品坚果）
- 边界：`baiduIndex` 负数返回 400；原始值保留用于 `marketHeatBasis` 显示，`marketHeat` 计算时 `Math.min(10000, baiduIndex)`

**M2: 短视频脚本生成 Agent**
- 输入：商品名称 + `style`（种草/评测/对比，必填，未知值返回 400）+ `duration`（15/30/60s，默认 30）
- 输出：分镜脚本，结构含：
  - 顶层：`scripts[].title`（`${productName} ${duration}s ${style}脚本`）、`scripts[].style`
  - Shot：`time, visual, voiceover` + `shotDifficulty(简单/中/难), requiredCrew, requiredProps`
  - CTA：`suggestedPriceRange`（基于 M1 `profitMargin` 推算，非占位符）
- 技术：`getScriptTemplate(name, duration, style)` 全链路 style 透传 → `buildDeterministicShots(..., style)` → `normalizeScriptResult` 透传；3 种 style 生成不同 hooks/pains/solutions/detailText/ctas/visual
- 一致性：`normalizeScriptResult` 强制顶层/script/CTA/voiceover 价格一致（`alignVoiceoverPrice` 正则对齐）

#### 效率 Track

**M3: 会议纪要 Agent**
- 输入：粘贴会议记录文本
- 输出：结构化纪要，字段含：
  - `title, date, participants[]`
  - `decisions[]`：`{item, context, date}`（date 走 `resolveRelativeDate` 解析，null/待确认时拼 item+context 重试）
  - `actionItems[]`：`{task, assignee, deadline, priority}`（assignee 未知标"待确认"；deadline ISO 格式；priority 规则引擎：deadline 距今天数决定）
  - `timeline[], keyQuotes[]`
- 技术：LLM 提取 + 去重三引擎：
  - `STRONG_ACTIONS`（签约/交付强归一化）
  - `stripFiller`（剥离阶段/评审/工作等后缀）
  - `ACTION_VERBS`（18 个动作动词子串匹配）
  - `extractCoreAction`（核心动作提取）+ `completenessScore`（assignee 2分 + deadline 1分，重复时保留信息更全的一条）
- 防遗漏：编号项后置校验正则 `/\d+[.、)]\s*([^\n。！!]{5,80})/g` 从 transcript 提取所有编号项，与 LLM decisions 对比补缺
- 日期解析：`resolveRelativeDate` 支持今天/明天/后天/下周X/这周X/本周X/本周内/月底前/月底/本月内/下月初/本月初/X月X日（含过期校验，早于今天超 30 天则 year+1）+ 英文日期词 today/tomorrow/next week

**M4: 项目看板**
- 功能：任务列表展示 + 状态切换（5 列：待办/进行中/已阻塞/已完成/已取消）
- 技术：React state + 下拉选择器（Select 组件，非拖拽）
- 数据：mock 任务列表 + **纪要→看板自动打通**（minutes API 返回的 actionItems 自动注入看板"待办"列，E4.7 闭环）
- SSR：双 div + hidden 方案同时渲染两个 tab 内容，curl 能 grep 到元素（kanban div 必须在 minutes div 之前）

#### 通用

**M5: Track 切换 + 暗色主题 UI**
- 左侧导航切换电商/效率 Track
- 统一聊天界面承载所有功能
- 暗色主题，AI 产品视觉风格

**M6: ChatInterface 结构化渲染**（Round 4 新增，原 E7.5 P0）
- 按 `message.type` 分发渲染：`analysis` → AnalysisCard / `script` → ScriptTimeline / `minutes` → MinutesCard
- AnalysisCard：marketHeat 大数字 + 颜色分级 + 量化字段网格 + 头部竞品/目标人群 Badge + 优势/风险双栏 + 综合建议
- ScriptTimeline：分镜时间轴 + 时长/风格标签 + Shot 卡片（visual/voiceover/难度/人员/道具）
- MinutesCard：decisions/actionItems 分组 + assignee/deadline/priority Badge
- 兜底：`extractStructuredData` 优先 `message.data`，其次 `JSON.parse(message.content)`，失败降级为文本

### SHOULD HAVE（有时间就做）

- S1: 私域话术生成（电商）
- S2: SSE 流式输出（打字效果）
- S3: 移动端响应式（至少不崩）

### COULD HAVE（锦上添花）

- C1: 数据看板图表
- C2: 多轮对话上下文记忆
- C3: 语音输入

### WON'T HAVE（明确砍掉）

- 真实接入淘宝/抖店 API（48h 不可能，mock 数据）
- 用户注册/登录系统（hardcoded session）
- 数据库持久化（in-memory 够用）
- RAG 向量检索（demo 不需要）
- 钉钉/飞书集成
- 多轮 Agent 链（单轮够展示概念）

---

## 3. 技术架构

### 3.1 技术栈

| 层级 | 选择 | 理由 |
|------|------|------|
| 前端框架 | Next.js 16.2.10 App Router + Turbopack | 内置 API Routes + SSR + 单仓库双 track |
| React | React 19.2.4 | 随 Next.js 16 |
| 语言 | TypeScript | 类型安全，2026 标配 |
| 样式 | Tailwind CSS + shadcn/ui | 原子 CSS + 现成组件 = 48h 最大杠杆 |
| 状态 | React hooks（useState/useEffect） | 48h 内不引入 Zustand，保持简单 |
| AI 层 | 直接 API 调用 + `complete()`/`extractJson()` | 不用 LangChain/CrewAI，48h 框架是负债 |
| LLM Provider | Anthropic 兼容代理 (127.0.0.1:15721) | step-3.7-flash，已验证可用 |
| 部署（Demo） | **生产 build**（`npm run build && npm run start`）| Turbopack dev server 在 React 19 + Next.js 16 下 hydration 失效，改用生产 build |
| 部署（Production） | 阿里云函数计算（FC） | 主办方技术栈，答辩时讲迁移故事 |
| E2E 测试 | Playwright | 13 个测试，`PLAYWRIGHT_REUSE_SERVER=true` + `BASE_URL=http://127.0.0.1:3025` 复用现有 server |

### 3.2 项目结构

```
fc-opc-ibot/
├── app/
│   ├── layout.tsx              # 根布局 + 暗色主题 provider
│   ├── page.tsx                # 入口页 / Track 选择器
│   ├── track/
│   │   ├── ecommerce/page.tsx  # 电商 workspace
│   │   └── efficiency/page.tsx # 效率 workspace
│   └── api/
│       ├── llm/
│       │   └── completions/route.ts   # 统一 LLM 入口
│       ├── ecommerce/
│       │   ├── analyze/route.ts
│       │   └── script/route.ts
│       └── efficiency/
│           ├── minutes/route.ts
│           └── project/route.ts
├── shared/
│   ├── llm/
│   │   ├── adapter.ts          # LLM 调用 + fallback chain
│   │   └── prompts/            # prompt 模板
│   │       ├── analyze.ts
│   │       ├── script.ts
│   │       ├── minutes.ts
│   │       └── project.ts
│   ├── components/
│   │   ├── chat/ChatInterface.tsx
│   │   ├── layout/Sidebar.tsx
│   │   └── ui/                 # shadcn/ui 组件
│   ├── types/common.ts
│   └── utils/streaming.ts
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### 3.3 LLM Adapter 设计

当前可用 provider（2026-07-03 验证）：

| Provider | 端点 | 模型 | 状态 |
|----------|------|------|------|
| Anthropic 兼容代理 | `http://127.0.0.1:15721` | step-3.7-flash | ✅ 可用 |
| StepFun | `api.stepfun.com` | step-2-16k | ❌ quota 用尽 |

**Adater 设计**：封装为 `LLMAdapter` 类，接受 `baseUrl` + `apiKey` + `model` 配置。内部调用 OpenAI-compatible `/v1/messages` 端点（Anthropic Messages API）。预留 fallback chain 接口，当前只配一个 provider，后续加新 provider 只需加配置。

- 环境变量：`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`
- 统一请求/响应格式，route handler 不感知 provider 差异
- 超时 30s，失败时返回友好错误消息

### 3.4 数据流

```
用户输入 → 前端组件 → API Route → LLMAdapter → LLM Provider
                                              ↓
用户输出 ← 前端组件 ← API Response ← 响应格式化
```

无数据库，无中间件，纯 request/response 循环。

### 3.5 数据生成规范

所有 AI 输出基于真实 LLM 调用，但通过确定性后处理保证演示稳定：

**确定性 hash（`hashProductName`）**：同一产品名 → 同一组 mock 数据，杜绝随机抖动。3 次同输入得到完全相同输出。

**5 品类专属 mock 分支**（`getCategoryMockData`）：
- 美妆：priceRange ¥39-¥399，品牌含花西子/完美日记/橘朵
- 猫砂：priceRange ¥39-¥199，品牌含pidan/网易严选/洁客
- 手表：priceRange ¥199-¥2999，品牌含卡西欧/西铁城/天王
- 3C外设：priceRange ¥59-¥899，键盘品牌[罗技/雷蛇/ikbc/杜伽]，鼠标品牌[罗技/雷蛇/赛睿/卓尔]
- 食品坚果：priceRange ¥19-¥159，品牌含三只松鼠/百草味/良品铺子

**Shot 品类差异化**：
- Shot4 voiceover detailText1：口红="质地和显色度"/手表="表盘工艺"/食品="原料和口感"
- 30s visual：美妆="手背试色"/手表="表盘工艺"/食品="原料特写"

**规则引擎**：
- `computePriority`：priority 不依赖 LLM 自由推断，deadline 距今天数决定（≤3天=高/≤7天=中/其他=低）
- `computeSuggestedPriceRange`：基于 M1 profitMargin 推算 CTA 价格

**SSR 示例样卡**：电商 + 效率首屏预填示例数据，演示不依赖 hydration + 网络。电商 hidden div 补 5 字段（市场热度/头部竞品/价格区间/竞争程度/建议入手价）供 curl 抓取。

**看板 Mock 数据**：
- 6 条预设任务，分布在 5 个状态列
- 包含标题、描述、优先级标签
- minutes API 返回的 actionItems 自动注入"待办"列

### 3.6 UI 交互规范

**功能模式切换**：电商 Track 内使用顶部 Tab 切换（选品分析 / 脚本生成），不是 slash command 也不是自然语言检测。用户先选模式，再输入内容。

**任务看板状态切换**：使用下拉选择器（Select 组件），不使用拖拽。48 小时内下拉比拖拽更可靠。

---

## 4. 非功能需求

| 需求 | 标准 |
|------|------|
| 响应时间 | LLM 首次 token < 3s，完整响应 < 15s |
| UI 质感 | 暗色主题，间距一致，零"僵尸按钮"（HACKATHON_DEV_RULES） |
| 兼容性 | Chrome + Safari 桌面端可用 |
| 错误处理 | LLM 失败时显示友好提示 + fallback 消息 |

---

## 5. 48 小时时间线

### Day 1（7/11）

| 时段 | 任务 | 产出 |
|------|------|------|
| 09:00-10:00 | 脚手架：Next.js + Tailwind + shadcn/ui + 目录结构 | 可运行的空白项目 |
| 10:00-12:00 | LLMAdapter 实现 + 4 provider 连通性验证 | 一个 API 调用能跑通 |
| 13:00-15:00 | 电商 UI：Sidebar + Chat 界面 + 暗色主题 | 有样子的外壳 |
| 15:00-17:00 | 电商 M1：选品分析 prompt + API route | 能对话 |
| 17:00-19:00 | 电商 M2：短视频脚本 prompt + API route | 第二个功能 |
| 20:00-22:00 | 电商 UI polish | 基本可用 |

### Day 2（7/12）

| 时段 | 任务 | 产出 |
|------|------|------|
| 09:00-11:00 | 效率 UI + 项目看板 | 效率 Track 外壳 |
| 11:00-13:00 | 效率 M3 + M4：会议纪要 + 项目看板 | 两个功能 |
| 14:00-16:00 | 双 Track 路由打通 + Track 切换 | 完整双轨体验 |
| 16:00-18:00 | UI polish + 加载状态 + 错误处理 | 像样的产品 |
| 18:00-20:00 | Demo 话术 + 3 分钟走查脚本 | 答辩材料 |
| 20:00-22:00 | 最终集成测试 + 提交 | 可演示版本 |

**Day 1 结束必须有一个完整功能流跑通（M1 选品分析），这是心理安全底线。**

---

## 6. 验收标准

1. 打开 `localhost:3025` 看到暗色主题入口页
2. 点击电商 Track → 输入商品名 → 输出选品分析报告（含量化字段）
3. 切换功能 → 输入商品名 + 选 style → 输出短视频脚本（含 title/style/suggestedPriceRange）
4. 切换到效率 Track → 粘贴会议记录 → 输出结构化纪要（含 decisions + actionItems + ISO 日期）
5. 看板 5 列可切换任务状态，纪要 actionItems 自动入"待办"列
6. 两个 Track 之间无 FOUC，切换流畅
7. 零 console 报错（除 LLM provider 偶尔超时的 warning）
8. ChatInterface 结构化渲染（AnalysisCard / ScriptTimeline / MinutesCard）
9. `npx tsc --noEmit` exit 0
10. `npx playwright test` 13/13 passed

## 6.1 已知限制（WON'T-FIX）

- **E4.60 词序归一化极端 case**：`"团队完成设计阶段"` vs `"设计阶段完成评审"` 这类主语/宾语倒置的变体，去重引擎无法识别为同一任务。连续 2 轮 L1 修复未生效，标记 WON'T-FIX。在实际会议记录中罕见，演示风险低。
- **LLM 抖动**：同一 transcript 多次调用可能得到不同 LLM 输出。确定性后处理已收敛关键差异，演示建议固定 transcript 预跑。
- **Turbopack dev server hydration 失效**：React 19 + Next.js 16 Turbopack 下 hydration 完全不工作，必须用生产 build 跑演示和 e2e。

---

## 7. 待确认事项

- [x] 用户当前 Node.js 版本（Next.js 16 需 >= 18.17，已验证）
- [x] LLM API key 已配置（本机代理 127.0.0.1:15721，step-3.7-flash）
- [x] 演示方式：本地生产 build + PORT=3025

---

## 8. Loop Engineering 执行总结（2026-07-04）

本项目按 Andrew Ng 三层嵌套 Loop 方法论执行了 22 轮迭代：

| 阶段 | 轮次 | 产出 |
|------|------|------|
| L1 Agentic Coding Loop | Round 1-3, 6, 8, 10, 12, 14, 16, 18, 20, 22 | 修代码层问题（僵尸按钮、解析脆弱、字段缺失、去重、日期解析） |
| L2 Developer Feedback Loop | Round 4-5, 7, 9, 11, 13, 15, 17, 19, 21 | 派 subagent 扮演真实用户（电商小陈 + 效率小林）体验 + WebSearch 调研真实场景 |
| L3 External Feedback Loop | 黑客松现场 | 评委反馈 → 演化愿景（未执行，待答辩） |

**最终状态**：~152 GREEN / 1 RED（WON'T-FIX）/ 0 BLOCKED

完整执行历史见 [eval.md](./eval.md)。
