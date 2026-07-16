# G3 · T-19 · Project-hard isolation + revision-pinned cross-project ref · DONE

- Assignment: D-27 / T-19 · `.ship/handoffs/ASSIGN-G3-T19-project-isolation.md`
- G5 RED contract (not edited): `g5/t19-project-scope-red-tests@52da97d6` · exclusive `tests/unit/project-scope-api.test.ts`
- Worktree slot12: `/Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/12/fc-opc-ibot`
- Branch: `g3/t19-project-isolation`
- Base: `2130ea0f` · Production tip: `be633805` · **no push**
- D-28 route: ordinary DONE → secretary:82 + G2:80 only; never surface:78

## Result

| Gate | Status |
|------|--------|
| Missing projectId → error | GREEN |
| A never returns B | GREEN |
| Foreign id deny under A | GREEN |
| No silent DEFAULT write | GREEN |
| Owner-approved revision pin | GREEN |
| Source change → needs_review | GREEN |
| Sensitive zero title/hit | GREEN |

## Commit list (from base; tip is this handoff commit)

```text
712e677a docs(ship): refresh G3 T-19 DONE with G5 RED alignment evidence
be633805 test(api): pass projectId on work-item evidence mutations
fae51a8a feat(api): align T-19 surfaces with G5 RED acceptance contract
acdabc14 feat(knowledge): scope relations and pin client cross-project revision
572d9cf6 docs(ship): hand off G3 T-19 project isolation DONE
1e6c0a4a test(knowledge): cover T-19 isolation and cross-project refs
3cf9d2f6 feat(api): require projectId on knowledge product routes
24519b3c feat(knowledge): require projectId on MCP knowledge tools
be6c2caa feat(knowledge): require projectId for searchKnowledge
82a7361b feat(knowledge): hard project isolation and revision-pinned cross-refs
247007b1 feat(knowledge): add Project.sensitive and CrossProjectReference types
07b34de8 feat(knowledge): add project-scope helpers for T-19 isolation
```

## Changed paths (production)

- `shared/knowledge/project-scope.ts` (+tests)
- `shared/types/knowledge.ts` — Project.sensitive, CrossProjectReference
- `shared/knowledge/repository.ts` — hard scope, relations project filter, cross-ref pin/mark/view
- `shared/knowledge/search.ts`, `mcp-tools.ts`
- `app/api/knowledge/*` product routes requiring projectId
- `app/api/knowledge/projects/[id]/cross-project-references/route.ts` **(G5 surface)**
- `app/api/knowledge/cross-project-refs/route.ts` (flat helper)

## Tests (G3-owned; G5 exclusive file absent from this branch)

- `shared/knowledge/project-isolation.test.ts`, `project-scope.test.ts`
- `shared/knowledge/search.test.ts`, `repository.test.ts`, `mcp-tools.test.ts`
- `tests/unit/project-api.test.ts`

## Verification (exact)

```text
# G5 RED (ephemeral copy of 52da97d6; not committed on G3 branch)
git show 52da97d6:tests/unit/project-scope-api.test.ts > tests/unit/project-scope-api.test.ts
./node_modules/.bin/vitest run tests/unit/project-scope-api.test.ts
→ 7 passed
rm tests/unit/project-scope-api.test.ts

./node_modules/.bin/vitest run shared/knowledge/project-isolation.test.ts shared/knowledge/project-scope.test.ts
→ pass

./node_modules/.bin/vitest run
→ Test Files 22 passed · Tests 188 passed

./node_modules/.bin/eslint shared/knowledge app/api/knowledge --max-warnings 0
→ exit 0
```

## Residuals

- Neighbors/path still id-global (outside G5 gates 1–7)
- UI must pass projectId or 400
- Integrate: land G5 RED file + this branch for permanent GREEN

## Rollback

Reset branch to `2130ea0f`. No push.

```text
G3 DONE · T-19 · g3/t19-project-isolation · production be633805 · base 2130ea0f · G5 RED 7/7 ephemeral · unit 188 · lint 0 · no push
```
