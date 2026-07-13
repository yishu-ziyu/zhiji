# Tech and Project Plan

## Technical Plan

- **Keep**：现有 Next.js 16 App Router 单体、efficiency track 页、LLM adapter、shadcn UI
- **Pivot**：效率页主路径从「纪要 + 看板」升级为「交付闭环」；纪要降为可选输入
- **Core modules**：
  - `shared/delivery/types.ts` — Commitment, Task, DeliveryState, metrics
  - `shared/delivery/state-machine.ts` — transitions
  - `shared/delivery/metrics.ts` — closedLoopRate, miss, overdue
  - `shared/delivery/parse.ts` — extract commitments from model/mock
  - `app/api/efficiency/commitments/route.ts` — structured extraction API
  - `app/track/efficiency/page.tsx` — main workbench UI
- **Agent shell**：小掌柜/运营助手可复用 AgentRuntime 形态，语义改为交付盯梢
- **Storage**：localStorage 持久化任务与承诺（与现有 kanban 模式一致）

## Architecture Decision

| Choice | Decision |
|---|---|
| App shape | Single Next.js web workbench (PWA-ready CSS) |
| Multi-end | Agent core via API; only Web shell this cycle |
| LLM | Existing adapter + mock provider fallback |
| State | Client state + localStorage; no DB |
| Test | Vitest/unit if light; Playwright E2E for golden path |

## Project Plan (calendar)

| Day | Date | Focus | Exit criteria |
|---|---|---|---|
| D0 | 7/12 | pm-intake 制品 + design spec/plan | plan.md drill CLEAR |
| D1 | 7/13 | Slice A+B 状态机/提取/看板 | 无 LLM 可点通闭环 |
| D2 | 7/14 | Slice C 仪表盘 + 金标准剧本 | 数字可见；E2E 绿 |
| D3 | 7/15 | UI 全场级 polish | 手机宽度 + 视觉过审自检 |
| D4 | 7/16 | 路演脚本 + fallback + 追问 Q&A | 180s 练 2 次 |
| D5 | 7/17 | 硬化：回归、录像、修边 | build + e2e 绿 |
| D6 | 7/18 | **交作品** | 提交包 + README 演示路径 |
| D7 | 7/19 | **路演** | 不改大功能，只热修 |

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| LLM 不稳 | Mock/replay 一等公民 |
| 范围膨胀 | 00b 砍表；只 ship 交付闭环 |
| UI 普通 | 单独 D3 天只做视觉；参考用户冠军经验 |
| 旧双轨代码干扰 | 电商降为次要入口或隐藏主叙事 |
