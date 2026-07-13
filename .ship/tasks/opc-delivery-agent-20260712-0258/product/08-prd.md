# PRD — OPC Delivery Ops Agent

## Product Requirements

### P0

1. **输入**：粘贴客户对话 / 需求文本（可提供 1 个示例剧本一键载入）
2. **承诺提取**：列出可执行 commitments；支持用户勾选、编辑、删除
3. **任务化**：每个采纳承诺生成任务，进入看板
4. **状态机**：`Captured → In Progress → Delivered → Confirmed`
5. **北极星面板**：闭环率 = Confirmed / 本期新增承诺；展示漏项提示与逾期
6. **主动感**：进入页面可见「今日待交付 / 逾期」；非纯空白聊天框
7. **失败可见**：若模型只返回散文无结构化承诺，UI 标记失败并允许重试 / 用 mock 剧本

### P1

8. 风险/待澄清项（模糊需求单独列出）
9. 交付说明草稿（Delivered 时自动生成简短交付摘要）
10. L1 金标准：≥5 段固定对话回归（捕获率可人工核对）
11. 手机宽度可用的响应式布局

### P2

12. 真 LLM 流式；live 早报式主动推送
13. 导出 / 分享闭环报告
14. 小程序壳

## Acceptance Criteria

- [ ] 标准 Demo 剧本端到端 < 3 分钟可讲完
- [ ] 剧本含 ≥2 条硬承诺 + 1 条模糊点；硬承诺均进入任务板
- [ ] 至少 1 条任务可走到 Confirmed，闭环率数字变化可见
- [ ] 无「仅总结无任务」的成功态
- [ ] `npm run build` 通过；核心路径有 E2E 或可重复手工脚本
- [ ] UI 暗色/产品级视觉，无明显作业感

## Success Metrics

| Metric | Definition | Demo target |
|---|---|---|
| **Closed-loop rate** | Confirmed / new commitments (period) | 剧本结束 ≥ 1/N 可见上升 |
| Miss rate | Hard commitments not captured | 0 on gold script |
| Time to tasks | Input → board populated | < 30s (or instant mock path) |
| Overdue exposure | Overdue tasks highlighted without user search | Always on board |

## Assumptions

- 单用户本地状态足够演示（localStorage / in-memory）
- LLM 可用；不可用时 mock provider 必须撑满 Demo
- 评委接受 mock 数据若叙事诚实且闭环可见

## Kill Criteria

- 若产品仍被描述为「会议纪要工具」且无法在 30 秒内纠正 → 重做信息架构
- 若闭环率无法在 UI 上计算展示 → 不做功能堆砌上线
- 若 UI 与场上平均 chat wrapper 无差异 → 不申报全场最佳叙事

## Testing Seams

1. **Unit**：承诺解析 / 状态机转移 / 闭环率计算（纯函数）
2. **API**：`POST /api/efficiency/commitments`（或等价）返回结构化 JSON
3. **E2E**：加载剧本 → 见承诺 → 进看板 → Confirmed → 面板数字变
4. **Gold scripts**：`tests/fixtures/customer-dialogs/*.json` + expected commitments

## Vertical Slice Candidates

1. **Slice A**：状态机 + 看板 + 假数据闭环率（无 LLM）
2. **Slice B**：粘贴对话 → LLM/mock 提取承诺 → 进看板
3. **Slice C**：仪表盘 + 逾期 + Demo 剧本一键
4. **Slice D**：UI polish + 路演模式 + fallback

## Edge Cases

- 全是寒暄无承诺
- 全是模糊需求无可执行项
- LLM 超时 / 非 JSON
- 用户删除全部承诺
- 重复粘贴同一对话

## Out of Scope

电商、多租户、原生小程序、真实支付、真 tool_use 必达
