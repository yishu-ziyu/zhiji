# 工作板 · 015 首用户真实接入

- task_id: first-user-real-entry-015
- 优先级: P0 产品诚实性（G1 强制）
- 合同: docs/product/dev-contract-015-first-user-real-entry-v1.md
- 更新约定: 每完成一步改状态 + 一行证据路径；禁止用 seed 冒充进度

## 状态图例
`todo` | `doing` | `blocked` | `done` | `fail`

## 清单

| ID | 事项 | 负责人 | 状态 | 证据/备注 |
|----|------|--------|------|-----------|
| W0 | 合同 015 冻结 | G1 | done | docs/product/dev-contract-015-first-user-real-entry-v1.md |
| W1 | 验收用例 BDD 细化 | G2 | done | .ship/handoffs/G2-015-acceptance.md |
| W2 | 默认关 seed 冒充 | G3 | done | repository `isDemoSeedEnabled` / `SEED_DEMO=1` only |
| W3 | 新建真实项目 | G3 | done | POST `/api/knowledge/projects` + UI create form |
| W4 | 单文件加入项目并归属 | G3 | done | POST materials + `files/{projectId}/` |
| W5 | 重启仍在 + 单测 | G3 | done | tests/unit/first-user-real-entry.test.ts；`npm run test:unit` 144/144 |
| W6 | 空 data 端到端证伪 | G4 | todo | 等 G3 handoff：.ship/handoffs/G3-015-done.md |
| W7 | G1 对人只报过/没过 | G1 | todo | |

## 阻塞
（无）

## 日志
- 2026-07-16 G1: 建板；G2/G3/G4 已派 015
- 2026-07-16 13:10 G1: 建工作管理板；巡检 G2 done / G3 doing / G4 watching
- 2026-07-16 G3: W2–W5 done · 分支 feature/first-user-real-entry · HEAD a64bbeb0 · handoff G3-015-done.md · unit 144 pass
