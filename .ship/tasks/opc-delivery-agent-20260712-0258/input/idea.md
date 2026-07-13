# Idea: OPC Delivery Ops Agent

## Source

Session consensus 2026-07-12 (user + agent), after reading iBot handbook and product debate.

## One-liner

给一人公司一个 **钉交付的运营助手**：客户对话后把承诺变成任务、盯到交付确认；不以会议纪要为产品核心。

## Why now

- 赛事：FC-OPC Next iBot 杭州站（台风改期：7/18 交作品，7/19 路演）
- 赛道：效率 OPC（赛道二），不做电商本场（无真实账号）
- 野心：全场最佳产品；UI 与呈现是创客共鸣与人工评分的主武器
- 质量流程：yishuship full + superpowers discipline（TDD / design drill / QA）

## Locked decisions

| Decision | Choice |
|---|---|
| Track | 效率 OPC only |
| Core problem | Limited attention; commitments die after customer chat |
| Product | Delivery ops assistant (not minutes tool) |
| North star | Closed-loop rate = customer-confirmed deliveries / new commitments |
| Aux metrics | Miss rate, overdue rate, median delivery cycle, human/AI action ratio |
| Primary surface | Web at full UI quality; mobile-usable; mini-program is shell later |
| Failure defs | Summary-only without tasks = fail; missed hard commitment = fail; no next action = fail |

## Natural user loop (founder self)

```text
Customer contact → problem stated → analyze → build → deliver
```

Minutes are optional input format, not the product.

## Process constraint

Use yishuship or superpowers for delivery quality:
pm-intake → design (spec/plan/drill) → dev (TDD slices) → e2e → review → qa → submit 7/18.
