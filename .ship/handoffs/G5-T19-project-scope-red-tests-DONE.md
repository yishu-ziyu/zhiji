# G5 · D-27 / T-19 · project-scope RED tests · DONE

- Assignment: `.ship/handoffs/ASSIGN-G5-T19-project-scope-red-tests.md`
- Mode: test-only · **no production edits**
- Base: `2130ea0f` (local T-16 integration)
- Worktree: `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-g5-t19-scope-red`
- Branch: `g5/t19-project-scope-red-tests`
- Exclusive product test file: `tests/unit/project-scope-api.test.ts`

## Result

Executable **RED** suite for all 7 Owner gates. Expected: **7 failed / 0 passed** on base `2130ea0f`.

## Verification

```text
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-g5-t19-scope-red
npm run test:unit -- --run tests/unit/project-scope-api.test.ts
# exit 1 · Tests 7 failed (7)
```

Full log: `.ship/evidence/g5-t19-red-vitest.txt`

## Exact failures (RED)

| # | Gate | Assertion failure (observed) |
|---|---|---|
| 1 | Missing `projectId` not all-projects | `search` GET without projectId → **200** (expected **400**) |
| 2 | A never returns B | relations/`library-map`/`state` scoped to A still surface B endpoints (B relation ids / B work titles leak) |
| 3 | Foreign id under A | `GET work-items/:id?projectId=A` for B item → **200** (expected 403/404) |
| 4 | No silent default write | `POST add` without projectId with demo seed → **201** into `DEFAULT_PROJECT_ID` (expected **400**, no write) |
| 5 | Explicit approved revision-pinned ref | missing route `app/api/knowledge/projects/[id]/cross-project-references/route` |
| 6 | Source-change recheck | same missing cross-project-references surface |
| 7 | Sensitive zero disclosure | project create does not persist `sensitive` / `sensitivity` / `visibility` marker |

## Contract surfaces expected for GREEN (G3)

1. Product read/list/search/state/library/footprint require `projectId` → 400 when missing.
2. Scoped list/search/relations/state/library never include foreign project objects.
3. get/patch work-item (and evidence link) honor caller `projectId`; foreign id → 403/404.
4. `addCard` / `addAction` reject missing projectId; never `?? DEFAULT_PROJECT_ID`.
5. `POST/GET .../projects/[id]/cross-project-references` with Owner `approvedBy`, pin `sourceProjectId` / `sourceObjectId` / `sourceRevision` / `verifiedAt`.
6. Source revision change → `reviewStatus` matches `/review|recheck|stale|needs/i`; pinned revision retained.
7. Project sensitive marker + search/map zero title/hit disclosure across projects.

## Non-goals

- No production / route / repository edits by G5
- No push
- GREEN rerun only after G3 integration (same file unchanged)

## Next

G3 implements T-19 to turn these RED → GREEN. G5 will **rerun unchanged** tests after integration and report remaining failures to G2 + Lead.
