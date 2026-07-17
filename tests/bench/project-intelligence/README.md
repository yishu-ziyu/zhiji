# Project Intelligence Bench

知几垂直产品评测集（**不是** SWE-bench / 通用 GAIA）。

对齐：`docs/product/优化方案-工程开发范式.md` · P1-1

## 跑

```bash
# 单独
npm run test:bench

# 或
npx vitest run tests/bench/project-intelligence/
```

## 范围（当前 v0.1.0）

| 族 | 含义 |
|---|---|
| structure | 对话结构 round-trip（当前判断/依据/决定） |
| search | Owner 问句 → 检索意图 |
| decision | 决策问题与单 nextDecision |
| reentry | 重进 / 变化 |
| conflict | 材料冲突 |
| refuse | 证据不足诚实 |
| noise | 噪声不升格 |
| quick | 右栏 pill |
| safety | 假路径 / 候选注脚 |

当前离线门禁：纯函数评估（format / parse / extractOwnerSearchQueries），**无 live LLM**，可进 CI。

## 扩场景

1. 在 `catalog.ts` 增加 `BenchScenario`  
2. 或在 `bodies.ts` 增加 UnderstandingBody 夹具  
3. 本地 `npm run test:bench` 全绿再提交  

目标规模：50–100 题（catalog 统计 `benchCatalogStats()`）。

## 与真读门禁关系

- 本 Bench：格式 / 意图 / 结构契约的**宽覆盖**  
- `agent-presence.acceptance`：工具环 + HITL 的**严格闭环**  
- live LLM：另轨 `test:live`，不阻塞默认 CI  
