# iBot 效率 Agent 技术实现方案 & 开发计划

**版本**：0.1
**日期**：2026-07-14
**目标**：把 PRD 中的架构图转化为**可立即执行**的代码方案，方便你直接给 Claude / Cursor 等 coding agent 使用。

## 1. 当前仓库状态（快速评估）
- 已有 Next.js + API Routes 基础
- 已有结构化数据模型（Change, Commitment, Minutes 等）
- 已有 QA / E2E 测试框架
- 需要重点转向：知识库模块 + MCP 接口 + 简化交付流程

## 2. 总体技术架构（基于 PRD 架构图）

- **前端**：Next.js App Router + shadcn/ui（知识库界面）
- **后端**：API Routes（Next.js）
- **知识库**：简单文件系统 + SQLite / JSON 文件 + 向量检索（可选，先用关键词 + 语义）
- **Agent 引擎**：LLM 调用 + Prompt 链 + 状态机
- **MCP**：暴露 Tool 接口（search_knowledge, add_to_knowledge 等）

## 3. 模块实现计划（优先级排序）

### 优先级 1：知识检索模块（最核心）
- 创建 `/lib/knowledge` 目录
- 实现 `search_knowledge(query)` API
- 前端页面 `/knowledge`（检索 + 卡片展示）

### 优先级 2：自动会议纪要 & 行动建议
- API `/api/minutes`（输入原始文本 → 输出结构化纪要 + 行动项）
- 使用已有 `shared/llm/prompts` 扩展

### 优先级 3：MCP 接口（比赛必须）
- 添加 MCP Server 路由或使用 mixer.ai 生成
- 暴露核心 Tools：search_knowledge, create_task, add_knowledge

### 优先级 4：任务拆解 + 状态更新（简化版）
- 复用已有 state-machine
- 简化交付流程，聚焦知识联动

## 4. 最小可演示版本（MVP）
1. 用户输入会议记录或任务描述
2. 系统自动生成纪要 + 行动项 + 知识卡片
3. 支持检索已有知识
4. 提供 MCP 链接
5. 前端界面清晰可演示

## 5. 下一步行动
我可以立即帮你：
- 在仓库中创建对应目录和文件骨架
- 写好每个模块的详细 Prompt / API spec
- 生成完整的 coding agent 指令

你现在想让我先做什么？
A. 直接 push 代码骨架到仓库
B. 先写完整的技术 spec 给 coding agent
C. 其他

直接说。