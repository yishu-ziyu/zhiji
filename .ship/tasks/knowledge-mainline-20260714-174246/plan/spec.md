# plan/spec.md · 工作项与共享情境

**Canonical full spec:** `docs/SPEC-work-item-shared-situation.md`  
**Date:** 2026-07-14

## Goal

效率 = 沟通一致 + 沟通可见。  
产品主对象从「仅卡+薄待办」推进为 **工作项**（状态、负责人、下一步、时间线），依据卡挂在工作项上。  
检索与来源能力不回退。

## Acceptance (P0 must)

1. 可创建工作项；详情顶栏：状态、负责人、下一步  
2. 进入 doing 时无负责人或无下一步 → 被拒绝  
3. 评论与状态变更进入时间线；重启不丢  
4. 可标阻塞并见原因  
5. 工作项可关联带来源的依据卡  
6. 现有检索「检索 来源」仍可用  
7. 可筛选「我的」未完成项并见下一步  
8. API 可 POST agent result 事件并持久化  

## Out of scope

微信同步、客户改约定、Multica 全套 runtime、向量库卖点、多租户、P0 的 Goal 看板复杂态。

## Tests

- Unit: work item validation + event write on patch + repository  
- API: create / bad doing / block / link evidence / result event  
- E2E: 建项 → 负责人+下一步 → doing → 评论 → 挂卡 → 刷新  

## Done when

Full spec §10 A1–A8 checked; units + e2e green; CONTEXT wording updated without banned jargon.
