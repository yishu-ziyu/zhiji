# 真读项目夹 · 严格门禁证据

时间: 2026-07-17
范围: A1–A6 + L1–L5（Matt 风格：公开 seam 验收 + 最小实现）

## 命令

```bash
AGENT_RUN_MODE=deterministic npx vitest run shared/project-memory/agent-presence.acceptance.test.ts
npx vitest run shared/project-memory/
```

## 结果

- `shared/project-memory/` **78 passed**（含 live L1/L2/L3）
- presence: A1–A6, L3, L4, L5 绿
- live: L1 gateway, L2 no fallback, L3 usable evidence 绿

## 关键实现

- `shared/project-memory/agent-evidence.ts`
- `shared/project-memory/agent-runtime.ts`（失败不落候选；强制出处）
- `app/api/knowledge/projects/[id]/analysis-runs/route.ts`（failed → 502/422）
- `app/track/knowledge/lib/agent-process.ts`（read_path 计入已读）

## Owner 未做

浏览器亲手验收仍由 Owner 完成（产品清单 §1 / §1b / §3）。
