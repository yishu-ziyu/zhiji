# Peer Spec - FC-OPC Next iBot 2026

> 由独立 peer agent（agentId: a7b6936edc254e12e）于 2026-07-03 产出
> 基于项目需求 + 黑松经验 + 48h 时间约束

---

## 1. 产品定位（与 host 一致）

- 双赛道 AI Agent 平台，面向一人公司（OPC）场景
- 一个 repo，一个前端，一个 LLMAdapter，路由级 track 隔离
- Demo 在本地 dev server 跑，FC 是答辩时讲的故事

## 2. 技术选型（与 host 一致）

- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand + TanStack Query
- 直接 API 调用，不用 LangChain/CrewAI/AutoGen
- Model fallback chain：MiMo v2.5-pro → DeepSeek v4-pro → MiniMax-M2.7 → Agnes 2.0 Flash

## 3. 项目结构（与 host 一致）

目录结构与 host spec 完全匹配。

## 4. MoSCoW（与 host 一致）

MUST：选品分析、短视频脚本、会议纪要、项目看板、Track 切换 + 暗色主题
SHOULD：私域话术、SSE 流式输出、移动端适配
COULD：数据看板、多轮上下文、语音输入
WON'T：真实第三方 API、用户系统、数据库、RAG、钉钉/飞书集成

## 5. 48h 时间线（peer 特有 - 更细粒度）

**Day 1（7/11）**
- 09:00-10:00 脚手架
- 10:00-12:00 LLMAdapter + 4 provider 连通性验证
- 13:00-15:00 电商 UI 骨架
- 15:00-17:00 选品分析 prompt + route
- 17:00-19:00 短视频脚本 prompt + route
- 20:00-22:00 电商 UI polish

**Day 2（7/12）**
- 09:00-11:00 效率 UI + 项目看板
- 11:00-13:00 会议纪要 + 看板逻辑
- 14:00-16:00 双 Track 打通
- 16:00-18:00 UI polish
- 18:00-20:00 Demo 话术
- 20:00-22:00 最终测试 + 提交

## 6. 风险（peer 特有）

- 模型 API 可用性 40%
- 流式输出不稳定 30%
- 时间低估 60%
- shadcn/ui 安装耗时
- 暗色主题一致性

## 7. 实现要点（peer 特有）

- Mock 数据优先，不需要真实第三方 API
- Day 1 结束必须有一个完整功能流跑通
- API Routes 设计为 FC 函数就绪（迁移成本为零）
- Prompt 质量 > 工程复杂度

---

*WARNING: 本 spec 由 peer agent 独立产出，未经 host 审查。*
