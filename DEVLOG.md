# 开发日志 - 知几 2026

> 项目启动：2026-07-03 | 黑客松时间：2026-07-11 ~ 2026-07-12

---

## 2026-07-03 凌晨：项目立项

**来源**：zhiji 海报 + 初芯 OPC 社区微信公众号

### 项目定义
- **赛事**：FC-OPC Next iBot 2026 杭州 AIAGENT 黑客松
- **主办**：初芯 OPC 社区 + Next 新智元
- **赛道**：01 电商经营 Agent + 02 效率 Agent
- **形式**：48 小时极客竞赛

### 我的选择
- 双赛道并行（不选一送一）
- 主办方鼓励"一人公司"叙事 → 这是我的核心 story
- 项目地址：`~/Desktop/黑客松/zhiji/`
- 仓库地址：https://github.com/yishu-ziyu/zhiji

---

## Day 0：技术选型

### 关键决策
| 项 | 选择 | 理由 |
|----|------|------|
| 框架 | Next.js 16 App Router | 内置 API Routes，1 仓库双 track |
| LLM | Anthropic 兼容代理（127.0.0.1:15721）| 已验证可用 + 走国内 |
| UI | shadcn/ui + Tailwind | 48h 最大杠杆 |
| 部署 | 本地 dev server | 现场不需要 FC，答辩时讲"架构已 FC-ready" |

### 砍掉的东西
- ❌ LangChain / CrewAI（48h 框架是负债）
- ❌ RAG 向量检索（demo 阶段不需要）
- ❌ 真实淘宝/抖店 API（mock 够用）
- ❌ 数据库（in-memory）
- ❌ 多轮 agent 链（单轮展示概念）

### MoSCoW
- **Must (4)**：选品分析、短视频脚本、会议纪要、项目看板
- **Should (3)**：私域话术、SSE 流式输出、移动端
- **Could (3)**：数据图表、多轮上下文、语音
- **Won't (5)**：真实 API、用户系统、数据库、RAG、第三方集成

---

## Day 0：踩坑记录

### 坑 1：Google Fonts 被网络层封
- `next/font/google` 的 Geist 字体加载失败
- 解决：去掉 `next/font`，改用 system-ui

### 坑 2：useState in Server Component
- Track 页面用 useState 但忘加 "use client"
- 解决：所有 client page 都加 `"use client"` directive

### 坑 3：LLM Thinking Block
- LLM 返回内容前有 thinking 块干扰 JSON 解析
- 解决：写 `extractJson()` 工具函数，从前向后找平衡的 `{`
- 同时过滤掉 `thinking` type 的 block

### 坑 4：shadcn 组件过时
- `shadcn/tailwind.css` 在新版本里不存
- 解决：移除 import，使用原生 Tailwind v4 语法

### 坑 5：TabsContent 没导出
- 自定义 Select 组件漏了 TabsContent
- 解决：把 TabsContent 写成 forwardRef 并 export

### 坑 6：Git push 包含 .next/ + node_modules/
- 第一次 commit 把所有 build artifact 提交了
- 后果：pack size 164MB，push 永远超时
- 解决：fresh clone + 用 `--no-g` 强制 rsync 排除 .gitignore 限制

---

## Day 0：调研 + 答辩准备

### 关键发现
从主办方微信公众号 + 海报：
- **核心奖项**：最佳产品奖、最具商业潜力奖、最佳创客共鸣奖
- **奖金**：5 项金奖 + 资源对接（算力+Token+投资+企业）
- **生态**：阿里云 FC + AgentRun + 华为 + 百度智能云

### 答辩材料（docs/demo/）
- `DEMO_SCRIPT.md`：3 分钟走查脚本 + OPC 叙事
- `BUSINESS_MODEL.md`：99 元/月 vs 2.4 万年薪
- `FC_ARCHITECTURE.md`：FC 部署 + 成本估算
- `README.md`：材料索引 + 现场兜底

### 核心金句
> "一个 AI 团队，替代一家小公司的运营岗位。"
> "我们订阅 99 元/月，替代 24 万/年的人力成本。"
> "这就是一人公司。"

---

## Day 0：技术成就

| 项 | 数据 |
|----|------|
| 代码文件 | 17 个 TS/TSX |
| API routes | 5 个 |
| LLM prompts | 3 个（analyze/script/minutes）|
| E2E 测试 | 11/11 通过（包含真实 LLM 调用）|
| 演示材料 | 4 份 Markdown |

---

## TODO 倒计时（7/11 之前）

### P0（必须做）
- [ ] 录 4 段 demo 视频作为现场 fallback
- [ ] 演练 DEMO_SCRIPT.md 三次（确保 3 分钟不超时）
- [ ] 准备备用设备：第二台装好同版本代码

### P1（应该做）
- [ ] 准备 10 个评委追问的答案
- [ ] 录一段 LLM 流式输出（即使代码没有，体验更好）
- [ ] 录一段"完整 demo"（电商+效率 3 分钟，无剪辑）

### P2（锦上添花）
- [ ] 增加 SSE 流式输出（user 体验提升）
- [ ] 移动端适配
- [ ] 公开场景的 UI 微调

---

## 风险清单

| 风险 | 概率 | 影响 | 兜底 |
|------|------|------|------|
| 现场 LLM 慢 | 40% | 中 | mock 数据 + 录像 |
| 网络断 | 10% | 高 | 备用设备 |
| 评委追问 | 60% | 中 | 架构图 + GitHub 仓库 |
| 电脑崩 | 5% | 高 | 第二台机器 |

---

## 备份状态

- 本地：仓库根目录
- GitHub：https://github.com/yishu-ziyu/zhiji
- PR：https://github.com/yishu-ziyu/zhiji/pull/1
- 分支：`feature/ai-agent-platform`

---

## 2026-07-06：赛事评分细则修正

**来源**：用户提供赛事评分截图。

### 新评分结构

| 权重 | 来源 | 看什么 |
|----|----|----|
| 90% | 评委人工评分 | 场景价值、商业化潜力、创新、体验、路演与协作 |
| 10% | AI 技术评分 | 连通性、稳定性和代码相关表现 |

另有创客共鸣奖，基于选手互评总得分形成。

### 对工程策略的影响

- 主战场从旧假设的「完成度/应用价值/商业潜力/创新性/安全性」改为 **90% 人工评分体验**。
- step-3.7-flash tool_use spike 仍做，但只是 10% 技术评分的一部分，不再占满全部精力。
- 小掌柜 UI、早报、4 动作链、180 秒路演、mock/录像兜底优先级上调为 P0。
- 文档已落地到 `docs/score-rubric.md`，并同步更新 `docs/implementation/7-day-plan.md` 和 spec v2。

---

## 待办

- 录 4 段 demo 视频
- 演练
- 准备追问应对

---

## 2026-07-13：效率 OPC 交付流程落地

### 产品锁定
- 赛道：效率 OPC（不做电商主叙事）
- 北极星：完成率
- 主产品：交付运营助手（客户对话 → 承诺 → 看板 → 确认）

### 工程
- `shared/delivery/*` 状态机 + metrics + mock + storage
- `POST /api/efficiency/commitments`（fixture-first）
- `/track/efficiency` 工作台重写
- vitest unit + Playwright E2E 全绿
- 路演脚本重写：`docs/demo/DEMO_SCRIPT.md`
- 商业模式一页对齐交付叙事

### 时间
- 交件 7/18 · 路演 7/19（台风改期）

---

## 2026-07-12：OPC 概念定义入档

**来源**：用户提问 "OPC 到底指什么"，多源一手调研。

### 关键结论

- **OPC = One Person Company（一-人公司）**，不是 "One-Person Commerce"
- 2026-07-03 浙江省发布《人工智能 OPC 术语》**团体标准**（2026-08-01 实施），由浙江省数字经济发展中心 + 阿里云等 14 家编制
- 电商/跨境电商是 OPC 生态下的子方向
- "FC-OPC Next iBot 2026" 是初芯 OPC 社区主办的标准 OPC 黑客松

### 落地资料

- 新增 `docs/research/opc-definition.md`：OPC 定义 + 一手 URL + 路演话术模板
- 后续 `docs/research/opc-competitor-landscape.md` 和 `baili-platform.md` 待补（后台调研 agent 还在跑）

### 对路演的影响

- 开场可引用浙江省团体标准锚定 OPC 定义，**避免评委质疑概念**
- "数字员工"是官方标准术语，可在描述 AI Agent 时使用
- 话术模板见 `docs/research/opc-definition.md` 末段
