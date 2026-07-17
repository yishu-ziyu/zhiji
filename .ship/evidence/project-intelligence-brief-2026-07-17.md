# 项目情报简报 · Agent Contract 边界收口 2026-07-17

## 命令

```bash
npx vitest run \
  tests/unit/assemble-brief.test.ts \
  shared/knowledge/agent-run-writeback.test.ts \
  shared/knowledge/seed-work-items-from-materials.test.ts \
  shared/project-memory/claims/resolve-claim.test.ts \
  tests/unit/mvp-agent-process.test.ts \
  tests/unit/agent-task-cards.test.ts
```

## 结果

25 + 4 related tests passed (see session run).

### 边界 1 grounded 硬门
- body 无 receipts → insufficient，无 Candidate 判断正文
- 缺 search_text → 不产生
- map+search_text+read 且 Run 成功 → Candidate brief
- Run failed → run_failed，不展示成功简报

### 边界 2 WorkSuggestion
- writeAgentRunToKnowledge / seed / writeAgentTaskCards → created=0
- nextDecision 仅 suggestionOnly 字符串

### 边界 3 Claim 四态
- accept / accept_edited / reject / defer 持久化
- defer 不推进 Accepted；全部终裁后才 finalize

## 状态

**implemented / unit-tested** · 非 accepted · 未全量打包
