# CONTEXT — OPC Delivery Ops Agent

Shared language for this delivery cycle (2026-07-12 → 7/19).

## Domain terms

| Term | Canonical meaning | Avoid saying |
|---|---|---|
| OPC | One Person Company；编制为零的完整商业主体 | 「小团队随便用」为主人设 |
| Delivery ops assistant | 钉交付的运营助手 | 会议纪要机器人 |
| Commitment | 可验收的承诺 | 任意聊天句子 |
| Bilateral commitment slip | 服务方发送、客户确认、服务方交付、客户验收的事实对象 | 单角色任务卡 |
| Candidate metrics | 同一创建 cohort 的 7 日确认率、确认耗时、按期验收率 | 本期确认 / 本期新增 |
| Gold script | 固定客户对话回归样例 | 每次随机输入 |
| Failure | 散文总结无任务；漏硬承诺；无下一步 | 仅 UI 报错码 |

## Hard decisions

1. Track = **efficiency only**. Ecommerce runtime code removed from the app (2026-07-13).
2. Client-owned confirm / accept actions are the visible product wedge; cohort-safe metrics are candidates, not validated north stars.
3. Quality process = yishuship full + TDD/design drill.
4. Submit 7/18, pitch 7/19 (typhoon reschedule).
5. Multi-end: API core later; Web shell now.

## Task

`.ship/tasks/opc-delivery-agent-20260712-0258/`
