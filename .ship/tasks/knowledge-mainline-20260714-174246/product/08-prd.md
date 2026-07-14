# PRD - Knowledge Loop Agent (mainline)

**Version:** 0.2 freeze  
**Date:** 2026-07-14  
**Task:** `knowledge-mainline-20260714-174246`  
**Canonical product path:** `/track/knowledge`

## Product Requirements

### One-liner

面向知识工作者：把零散材料变成**可溯源的卡片**和**可推进状态的行动**，检索时能找回来。

### User

- Primary: 用户本人（知识工作者）
- Secondary: 同赛道一人公司 / 小团队知识岗（叙事可扩，验收不扩）

### Core objects

| Object | Meaning |
|--------|---------|
| KnowledgeCard | 一条可复用事实/结论；含 content, source, tags, timestamp, links |
| ActionItem | 可执行任务；status: todo → doing → confirmed → done；含验收标准 |
| SearchHit | Card + score；结果必须带来源 |

### Core flows

1. **检索：** 输入问题 → 过滤来源（可选）→ 卡片列表 + 简答条（首条依据）
2. **沉淀：** 手记 / 粘贴会议 / 拆目标 → 写入 cards 和/或 actions
3. **推进：** 行动板上一点改状态；建议区可刷新

### Agent participation (honest)

| Step | Agent / LLM | Deterministic system |
|------|-------------|----------------------|
| Search | optional ranking later | keyword/tag score + filters |
| Minutes / dissect | LLM when key present | offline rule fallback + JSON write |
| Status update | no | state write to store |
| Suggest | LLM optional | offline from open actions |

**Pitch rule:** Agent 负责理解与拆解候选；**系统保存事实**；人推进状态。

## Acceptance Criteria

### A1 - 检索可体验（P0）

- [ ] 打开 `/track/knowledge`，默认或输入「检索 来源」能返回 ≥1 条卡片
- [ ] 每条可见 **source**（会议/文档/手记等）与正文
- [ ] 来源筛选切换后结果符合过滤（或合法空态）

### A2 - 沉淀可体验（P0）

- [ ] 手记保存后再次检索相关词能命中新卡
- [ ] 进程重启后（JSON 持久化）新卡仍在（除非清空 data 目录）

### A3 - 行动可体验（P0）

- [ ] 行动板展示至少 1 条行动
- [ ] 点击推进：todo→doing 或 doing→confirmed 或 confirmed→done，刷新后状态保持

### A4 - 会议入库（P1）

- [ ] 粘贴示例会议文本 → 生成 ≥1 卡 或 ≥1 行动（LLM 或 offline 均可，须标注 offline）

### A5 - 工具面（P1）

- [ ] `GET /api/knowledge/mcp` 返回 5 个工具定义
- [ ] `POST` 可 `search_knowledge` / `update_collaboration_state`

### A6 - 主线叙事（P0 路演）

- [ ] 首页与侧栏主 CTA 指向知识库，不把客户变更当主标题
- [ ] 30 秒口述不出现「我们是第二个 Notion / 微信 CRM」

## Success Metrics

| Metric | Hackathon bar | How to measure |
|--------|---------------|----------------|
| Demo complete rate | 1 次不中断走完 A1–A3 | 手测 / 未来 E2E |
| Source visibility | 100% hits show source | UI checklist |
| Persistence | add card survives restart | file in `data/knowledge/` |
| Time-to-first-hit | < 10s from page load | stopwatch |
| Judge comprehension | 评委能复述闭环三步 | 路演后自检 |

North-star (post-hackathon, not required to ship): **second-session reuse** - 用户隔天用同一库解决新问题的次数。

## Assumptions

| Assumption | How to falsify |
|------------|----------------|
| 用户愿意粘贴/手记喂库 | 金脚本里拒绝粘贴 → 冷启动失败 |
| 关键词检索够 demo | 语义问法零命中且 soft fallback 被评委质疑 |
| offline 可当 Agent 演示 | 评委要求看 tool_use 轨迹且没有 → 降级为工具站 |
| DESIGN 不伤可读 | 路演投影看不清 → 减弱装饰 |

## Kill Criteria

出现任一条，**停止加功能，先改方向或诚实降级叙事**：

1. 金脚本 3 次无法在 2 分钟内完成 A1–A3
2. 评委/用户认为与 Notion 无差异且无法用「溯源+状态闭环」一句打掉
3. 无任何持久化，重启即空（已修；若回退则 kill）
4. 主线重新改回客户变更而未更新本文件与 CONTEXT

## Testing Seams

| Seam | Exists | Note |
|------|--------|------|
| Unit: repository / search / mcp-tools | Yes | `shared/knowledge/*.test.ts` |
| API: search/add/state | Manual / curl | Add E2E next |
| Playwright knowledge gold path | **Missing** | Must add before submit if possible |
| LLM path | Optional | Prefer fixture offline for CI |

## Vertical Slice Candidates

1. **Slice 0 (now):** seed search + status click + JSON persist  
2. **Slice 1:** Playwright A1–A3  
3. **Slice 2:** one live LLM minutes path with key (demo machine only)  
4. **Slice 3 (defer):** real connectors / vector

## Edge Cases

- Empty library after wipe → seed  
- Unknown query → soft recent fallback (must not look like fake high relevance)  
- LLM down → offline minutes/dissect, UI 标注  
- Concurrent writers → out of scope (single user)

## Out of Scope

- Customer-change main demo  
- WeChat sync  
- Multi-tenant ACL  
- Full MCP stdio productization  
- Market size claims

## Gold script (demo)

1. Open `/track/knowledge`  
2. Search「检索 来源」→ see cards with source chips  
3. Optionally add a note「黑客松验收：卡片必须带来源」→ search「验收」  
4. On action board, advance one item status  
5. (Optional) Paste meeting sample → generate cards/actions  
6. One line to judge: 「搜得到、收成卡、能推进；不是编辑器。」

## Engineering Goal (bridge)

Keep `/track/knowledge` as the only main demo path. Do not invest in efficiency-track pitch UI. Next eng: Playwright gold path; optional live LLM flag.
