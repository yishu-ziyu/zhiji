# FC-OPC Next iBot 2026 - 实现计划

> Scope: full | Stories: 8 | Based on spec v1.0 + peer diff resolution

---

## 执行原则

1. 每个 Story 是一个可独立演示的垂直切片
2. 按 Story 顺序实现，不跳过
3. 每个 Story 完成后验证：能打开页面 + 能看到效果
4. 最终合并到同一条主线，不做 feature branch

---

## Story 0: 项目脚手架

**目标**：跑通 `npm run dev` 看到空白页面

**步骤**：
- [ ] `npx create-next-app@latest` — TypeScript, Tailwind, App Router, no src dir
- [ ] `git init`（scaffold 默认不 init git）
- [ ] 安装 shadcn/ui CLI + 初始化
- [ ] 安装 shadcn/ui 核心组件：Button, Card, Textarea, Tabs, Badge, ScrollArea, Select
- [ ] 安装依赖：zustand, @tanstack/react-query, lucide-react
- [ ] 配置 tailwind.config.ts 暗色主题基础
- [ ] 创建目录结构：app/track/、app/api/、shared/llm/、shared/components/
- [ ] 创建 `.env.local`（LLM API key 占位符 + 说明）
- [ ] 验证：`npm run dev` → localhost:3000 正常启动

**验证标准**：页面可打开，无 console 报错

---

## Story 1: LLMAdapter 统一调用层

**目标**：一个 API 调用能跑通，fallback chain 可用

**步骤**：
- [ ] 写 `shared/llm/adapter.ts` — LLMAdapter 类
  - 从 env 读 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`
  - `complete(prompt, systemPrompt?)` 方法返回 Promise<string>
  - 调用 OpenAI-compatible `/v1/messages` 端点（Anthropic Messages API 格式）
  - 超时 30s，失败时抛错（由 route handler 捕获）
- [ ] 写 `shared/types/common.ts` — Message, LLMConfig 类型
- [ ] 写 `app/api/llm/completions/route.ts` — 统一入口
  - POST 接收 { prompt, systemPrompt? }
  - 调用 LLMAdapter，返回 { text, provider, latency }
- [ ] 写健康检查 route：`app/api/llm/health/route.ts` — 验证 provider 连通性
  - 调用 LLMAdapter 发一条测试请求，返回 { ok, latency, error? }
- [ ] 在 `.env.local` 填入实际配置（baseUrl、apiKey、model）
- [ ] 验证：curl POST /api/llm/completions → 正常返回文本

**验证标准**：4 个 provider 至少 1 个能返回结果，fallback 生效

---

## Story 2: 电商 Track UI 骨架

**目标**：看到暗色主题的电商 workspace

**步骤**：
- [ ] 写 `app/layout.tsx` — 根布局 + Tailwind 暗色主题类
- [ ] 写 `shared/components/layout/Sidebar.tsx` — 左侧导航
  - Track 切换（电商 / 效率）
  - 功能子菜单（选品分析 / 脚本生成）
  - 暗色样式
- [ ] 写 `app/track/ecommerce/page.tsx` — 电商 workspace 页面
  - Sidebar + 主内容区布局
  - 顶部标题 + 描述
- [ ] 写 `shared/components/chat/ChatInterface.tsx` — 通用聊天组件
  - 消息列表（用户消息 + AI 消息）
  - 输入框 + 发送按钮
  - 加载状态（骨架屏）
  - 暗色主题
- [ ] 在电商页面集成 ChatInterface
- [ ] 验证：页面可打开，Track 切换正常，聊天 UI 看起来像 AI 产品

**验证标准**：视觉上是一个暗色 AI 产品界面，不是白页面

---

## Story 3: 电商选品分析功能

**目标**：输入商品名 → 输出选品分析报告

**步骤**：
- [ ] 写 `shared/llm/prompts/analyze.ts` — 选品分析 prompt 模板
  - system prompt 定义角色（电商选品分析师）
  - 输出格式定义（JSON 结构化）
- [ ] 写 `app/api/ecommerce/analyze/route.ts`
  - POST 接收 { productName }
  - 调用 LLMAdapter，传入 analyze prompt
  - 返回结构化 JSON
- [ ] 在 ChatInterface 顶部加 Tab 切换：选品分析 | 脚本生成
- [ ] 模式切换逻辑：当前 Tab 决定发送时调哪个 API route
- [ ] 写结果渲染组件：展示结构化报告（市场热度、竞争、利润率、风险、人群）
  - Mock 数据格式：`{ marketHeat: number, competition: '低'|'中'|'高', profitMargin: string, risks: string[], targetAudience: string[] }`
- [ ] 添加错误处理：LLM 失败时显示友好提示（"AI 正在思考，请稍后再试"）
- [ ] 验证：输入"无线蓝牙耳机"→ 看到结构化的选品分析报告

**验证标准**：完整功能流跑通，这是 Day 1 的心理安全底线

---

## Story 4: 电商短视频脚本功能

**目标**：输入商品名 → 输出分镜脚本

**步骤**：
- [ ] 写 `shared/llm/prompts/script.ts` — 短视频脚本 prompt 模板
  - system prompt 定义角色（短视频编导）
  - 输出格式：30s/60s 两个版本，每段有镜头 + 口播 + 画面
- [ ] 写 `app/api/ecommerce/script/route.ts`
  - POST 接收 { productName, style? }
  - 调用 LLMAdapter
  - 返回结构化 JSON
- [ ] 在电商页面添加"生成脚本"模式切换
- [ ] 写脚本结果渲染组件：展示分镜列表
- [ ] 验证：切换模式 → 输入商品 → 看到分镜脚本

**验证标准**：两种模式（分析/脚本）都能正常工作

---

## Story 5: 效率 Track UI + 项目看板

**目标**：切换到效率 Track 能看到任务看板

**步骤**：
- [ ] 写 `app/track/efficiency/page.tsx` — 效率 workspace
  - 复用 Sidebar + ChatInterface 布局
  - 顶部导航切换功能（会议纪要 / 项目看板）
- [ ] 在效率页面顶部加 Tab 切换：会议纪要 | 项目看板
- [ ] 写看板组件：Kanban 三列（待办 / 进行中 / 完成）
  - 任务卡片：标题 + 优先级标签（高/中/低）
  - 状态切换：每张卡片右上角放下拉 Select（待办/进行中/完成）
  - Mock 任务数据：6 条预设任务，含标题、描述、优先级
- [ ] 实现任务状态切换逻辑（更新本地 state，触发重渲染）
- [ ] 验证：切换到效率 Track → 看到任务看板 → 可切换状态

**验证标准**：看板功能正常，不依赖 AI 调用

---

## Story 6: 效率 Track 会议纪要功能

**目标**：粘贴会议记录 → 输出结构化纪要

**步骤**：
- [ ] 写 `shared/llm/prompts/minutes.ts` — 会议纪要 prompt 模板
  - system prompt 定义角色（会议纪要整理员）
  - 输出格式：决议事项、待办任务、负责人、时间线
- [ ] 写 `app/api/efficiency/minutes/route.ts`
  - POST 接收 { transcript }
  - 调用 LLMAdapter
  - 返回结构化 JSON
- [ ] 在效率页面顶部加 Tab 切换：会议纪要 | 项目看板（复用 Story 5 的 Tab 机制）
- [ ] 在 ChatInterface 中集成：当前 Tab 为"会议纪要"时，发送消息 → 调 /api/efficiency/minutes
- [ ] 写纪要结果渲染组件：展示三栏布局（决议事项 | 待办任务 | 时间线）
  - 决议事项： bullet 列表
  - 待办任务：带负责人标签的列表
  - 时间线：日期 + 事件描述
- [ ] 验证：粘贴模拟会议记录 → 看到结构化纪要

**验证标准**：完整功能流跑通

---

## Story 7: 集成测试 + Demo 准备

**目标**：所有功能可演示，无僵尸 UI

**步骤**：
- [ ] Feature Inventory 审计（HACKATHON_DEV_RULES.md 第1条铁律）
  - 扫 `app/api/` 下所有 route → 列出每个端点的路径 + 方法 + 请求/响应字段
  - 扫前端组件 → 列出每个 fetch/API 调用
  - 对比找缺口：前端调了但后端没有 / 字段不匹配
- [ ] 僵尸 UI 检测（HACKATHON_DEV_RULES.md 第2条）
  - 手动点一遍所有按钮，每个都有实际行为
  - 每个页面都能加载数据，无空页面
  - 确认零 console 报错
- [ ] Demo 流程走查：
  1. 打开页面 → 入口页
  2. 电商 Track → 选品分析 demo
  3. 电商 Track → 脚本生成 demo
  4. 效率 Track → 会议纪要 demo
  5. 效率 Track → 项目看板 demo
- [ ] 修复走查中发现的 bug
- [ ] 写 README.md — 项目说明 + 启动方式 + Demo 话术要点
- [ ] 提交：`git commit -m "feat: complete dual-track AI Agent platform for FC-OPC iBot hackathon"`

**验证标准**：3 分钟 Demo 流程从头到尾跑通，零 console 报错

---

## 实施顺序

```
Story 0 → Story 1 → Story 2 → Story 3 → Story 4 → Story 5 → Story 6 → Story 7
                                                                    ↑
                                                     MUST stop here if time is short
```

**Day 1 目标**：完成 Story 0-4（电商 Track 完整功能）
**Day 2 目标**：完成 Story 5-6（效率 Track）+ Story 7（集成 + 提交）
