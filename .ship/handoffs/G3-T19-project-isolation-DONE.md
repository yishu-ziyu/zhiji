# G3 · T-19 · Project-hard isolation + revision-pinned cross-project ref · DONE

- Assignment: D-27 / T-19 · `.ship/handoffs/ASSIGN-G3-T19-project-isolation.md`
- Maps: `.ship/research/grok-followups/G5-Q04-project-isolation-execution-map.md`, `.ship/research/grok-followups/G4-Q04-scope-fail-gates.md`
- Worktree: `/Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/12/fc-opc-ibot`
- Branch: `g3/t19-project-isolation`
- Base: local T-16 integration `2130ea0f` (no push)
- Head: `1e6c0a4a`
- Lease: G3-T19-project-isolation (sole production owner)

## Result

| Owner behavior | Done |
|----------------|------|
| Product reads/writes require current `projectId` | Yes |
| Missing scope → error (never all projects / never silent `DEFAULT_PROJECT_ID`) | Yes |
| Project A cannot list/search/get/mutate/map B objects | Yes |
| Demo seed may keep explicit id only when `SEED_DEMO=1` | Yes (unchanged seed id) |
| Min cross-project ref: Owner approval + pinned source hash + verify drift → review | Yes |
| Sensitive source: no title stored on host ref | Yes |
| Personal/team libraries | Out of scope (not built) |

## Commit list (atomic, base → head)

```text
07b34de8 feat(knowledge): add project-scope helpers for T-19 isolation
247007b1 feat(knowledge): add Project.sensitive and CrossProjectReference types
82a7361b feat(knowledge): hard project isolation and revision-pinned cross-refs
be6c2caa feat(knowledge): require projectId for searchKnowledge
24519b3c feat(knowledge): require projectId on MCP knowledge tools
3cf9d2f6 feat(api): require projectId on knowledge product routes
1e6c0a4a test(knowledge): cover T-19 isolation and cross-project refs
```

## Changed paths

### Production

- `shared/knowledge/project-scope.ts` — `requireProjectId`, `assertEntityInProject`, `assertOwnerApprover`, scope errors
- `shared/types/knowledge.ts` — `Project.sensitive?`, `CrossProjectReference`
- `shared/knowledge/repository.ts` — write require projectId; normalize no DEFAULT; `getCardInProject` / `getActionInProject`; `getLibraryMapData(projectId)`; `getFootprintData({ projectId })`; `setProjectSensitive`; cross-ref create/list/verify
- `shared/knowledge/search.ts` — `searchKnowledge` requires `filters.projectId`
- `shared/knowledge/mcp-tools.ts` — search/add/dissect/suggestions require projectId
- `app/api/knowledge/search/route.ts`
- `app/api/knowledge/add/route.ts`
- `app/api/knowledge/work-items/route.ts`
- `app/api/knowledge/work-items/[id]/route.ts`
- `app/api/knowledge/state/route.ts`
- `app/api/knowledge/library-map/route.ts`
- `app/api/knowledge/footprint/route.ts`
- `app/api/knowledge/minutes/route.ts`
- `app/api/knowledge/dissect/route.ts`
- `app/api/knowledge/cross-project-refs/route.ts` **(new)**

### Tests (not G5 RED file)

- `shared/knowledge/project-scope.test.ts`
- `shared/knowledge/project-isolation.test.ts` **(new)**
- `shared/knowledge/search.test.ts`
- `shared/knowledge/repository.test.ts`
- `shared/knowledge/mcp-tools.test.ts`
- `tests/unit/project-api.test.ts`

**Not edited:** `tests/unit/project-scope-api.test.ts` (G5 exclusive), G3A prototypes.

## Verification

```bash
cd /Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/12/fc-opc-ibot
./node_modules/.bin/vitest run
# Test Files  22 passed (22)
# Tests  188 passed (188)

./node_modules/.bin/eslint shared/knowledge app/api/knowledge --max-warnings 0
# exit 0
```

Isolation evidence (from `project-isolation.test.ts`):

1. `addCard`/`addAction` without projectId → `ProjectScopeError`
2. Search/list/get/library-map: A never returns B
3. Cross-ref rejects agent approver; Owner pins hash; content change → `reviewRequired`
4. Sensitive source → `sourceTitle` undefined on host ref

## Residuals / rollback

| Residual | Notes |
|----------|--------|
| UI callers may 400 until they always pass `projectId` | library-map / footprint / state / search clients must send scope |
| Neighbors/path/relations-by-id still resolve global card id then traverse | start node is id-global; soft residual vs full map hard-scope |
| work-items subroutes (events/evidence/agent-run/island) not all project-gated | main GET/PATCH/list/create are hard |
| No personal/team library model | Owner deferred remainder of Q-04 |
| G5 RED file not present in this worktree | G5 owns that file in parallel |

**Rollback boundary:** reset branch to `2130ea0f` discards all 7 commits above. No push was performed.

## Next

- G2: integrate / lease return when ready
- G4/G5: falsify RED gates against this branch
- UI pass-through of `projectId` on remaining soft clients if any 400 in demo

```text
G3 DONE · T-19 · branch g3/t19-project-isolation · head 1e6c0a4a · base 2130ea0f · 188 unit pass · no push
```
