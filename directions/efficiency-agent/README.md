# Efficiency Agent Direction

本场只做一件事：把一次半正式客户对齐变成双方交付承诺单。

```text
Web 粘贴 → AI 草稿 → 服务方发送 → 客户无登录确认
→ 服务方交付 → 客户验收
```

客户确认和验收只能从 `/c/[token]` 完成，服务方不能代点。产品不声称已接入微信；也不做会议纪要、CRM 或全能 OPC OS。

## Main routes

- 服务方：`app/track/efficiency/page.tsx`
- 承诺提取：`POST /api/efficiency/commitments`
- 承诺单动作：`GET|POST /api/efficiency/slips`
- 客户页：`/c/[token]`
- 客户动作：`POST /api/efficiency/client/[token]/action`

## Demo evidence

演示必须让评委看到客户链接、客户确认、服务方交付、客户验收。指标只展示同 cohort 的候选指标，不使用“本期确认 / 本期新增”的混合口径。
