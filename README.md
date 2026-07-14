# FC-OPC iBot · Knowledge Loop

效率赛道 · **知识闭环**（资料检索 · 知识管理 · 协作工作流）

> 搜得到 → 收成卡 → 能推进。不是编辑器，不是交付 CRM，不是电商。

## Run

```bash
npm install
npm run dev
# open http://localhost:3000/track/knowledge
```

## Main path

| Path | Role |
|------|------|
| `/` | 入口，只进知识库 |
| `/track/knowledge` | 主产品：检索 / 卡片 / 行动 |
| `/api/knowledge/*` | search, add, minutes, dissect, state, mcp |
| `data/knowledge/*.json` | 本地持久化（gitignore 内容） |

## Explicitly removed

- 客户变更 / 交付约定整条线（`/track/efficiency`, `/api/efficiency`, `/c/*`, `shared/delivery`）
- 电商赛道目录与入口

历史说明仍可在 `docs/research/` 查阅，**不进运行时**。

## Test

```bash
npm run test:unit
# e2e needs build; optional:
# PLAYWRIGHT_REUSE_SERVER=1 npm run test:e2e
```

## Product freeze

`.ship/tasks/knowledge-mainline-20260714-174246/` + `CONTEXT.md`
