# FC-OPC Next iBot 2026 - 产品规格书

> 状态：草稿 | 2026-07-03 | 基于海报 + HACKATHON_DEV_RULES.md + peer 分析

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
- 输入：商品名称/描述
- 输出：结构化选品报告（市场热度、竞争程度、利润率预估、风险点、目标人群）
- 技术：LLM 结构化输出，mock 数据增强分析深度

**M2: 短视频脚本生成 Agent**
- 输入：商品名称 + 可选风格（种草/评测/对比）
- 输出：30s/60s 分镜脚本（镜头描述 + 口播文案 + 画面建议）
- 技术：LLM prompt 模板，结构化 JSON 输出

#### 效率 Track

**M3: 会议纪要 Agent**
- 输入：粘贴会议记录文本
- 输出：结构化纪要（决议事项、待办任务、负责人、截止时间）
- 技术：LLM 提取 + 结构化输出

**M4: 项目看板**
- 功能：任务列表展示 + 状态切换（待办/进行中/完成）
- 技术：React state + 拖拽组件（dnd-kit 或简单下拉）
- 数据：in-memory mock 任务列表

#### 通用

**M5: Track 切换 + 暗色主题 UI**
- 左侧导航切换电商/效率 Track
- 统一聊天界面承载所有功能
- 暗色主题，AI 产品视觉风格

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
| 前端框架 | Next.js 14 App Router | 内置 API Routes + SSR + 单仓库双 track |
| 语言 | TypeScript | 类型安全，2026 标配 |
| 样式 | Tailwind CSS + shadcn/ui | 原子 CSS + 现成组件 = 48h 最大杠杆 |
| 状态 | Zustand + TanStack Query | 轻客户端状态 + 服务端缓存 |
| AI 层 | 直接 API 调用 + LLMAdapter 类 | 不用 LangChain/CrewAI，48h 框架是负债 |
| LLM Provider | Anthropic 兼容代理 (127.0.0.1:15721) | step-3.7-flash，已验证可用 |
| 部署（Demo） | 本地 dev server | 零配置 |
| 部署（Production） | 阿里云函数计算（FC） | 主办方技术栈，答辩时讲迁移故事 |

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

### 3.5 Mock 数据规范

所有 AI 输出基于真实 LLM 调用，但以下场景提供 mock 数据增强体验：

**选品分析 Mock 数据**（增强分析深度）：
- 市场热度指数（1-100）
- 竞争程度等级（低/中/高）
- 利润率预估范围
- 目标人群画像标签

**看板 Mock 数据**：
- 6 条预设任务，分布在三个状态列
- 包含标题、描述、优先级标签

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

1. 打开 `localhost:3000` 看到暗色主题入口页
2. 点击电商 Track → 输入商品名 → 输出选品分析报告
3. 切换功能 → 输入商品名 → 输出短视频脚本
4. 切换到效率 Track → 粘贴会议记录 → 输出结构化纪要
5. 看板可切换任务状态
6. 两个 Track 之间无 FOUC，切换流畅
7. 零 console 报错（除 LLM provider 偶尔超时的 warning）

---

## 7. 待确认事项

- [ ] 用户当前 Node.js 版本（Next.js 14 需要 >= 18.17）
- [ ] 用户有哪些 LLM API key 可用（4 provider 是否都配好）
- [ ] 是否需要真机测试（用户还是搭档做演示）
