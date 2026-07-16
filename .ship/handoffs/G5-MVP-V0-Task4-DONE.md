# G5 · MVP V0 Task 4 · DONE (replacement)

- Seat: G5
- Branch: `g5/mvp-v0-task4-agent-reconstruct`
- Worktree: `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-g5-mvp-v0-task4`
- Base: `g2/mvp-v0-integration` **`3d4c097a`** (source amend **`ab242b67`**)
- Mode: **one local replacement commit** · **no push** · **no no-mistakes**
- Report: secretary2 **surface:83** + G2 **surface:80** only (not Lead unless blocker)

## Frozen (do not integrate)

| SHA | Note |
|-----|------|
| **`59302d20`** | Old Task4 — frozen forever, not integrated |
| `3beb4baf` / pre-amend stacks | Superseded by this replacement |

## Contract alignment

- `UnderstandingBody.why` → `WhyClaim[]`
- `supported` requires exact **revision + path + quote + lastVerifiedAt** (else coerced to `unknown`)
- Immutable `UnderstandingRevision` (`kind: candidate | accepted`)
- accept/edit → **INSERT new accepted** + move head (via `OwnerDecisionWriter.resolveCandidate`)
- AnalysisRun / memory / revisions: **`AgentMemoryService`** = Reader + CandidateWriter only (`asAgentMemoryService`)
- Resolve route: **`OwnerDecisionWriter` only** (`getOwnerDecisionWriter`)
- **No** duplicate `shared/project-memory/types.ts`

## Task4 paths

- `shared/project-memory/agent-model-loop.ts`
- `shared/project-memory/reconstruct.ts`
- `shared/project-memory/reconstruct.test.ts`
- `app/api/knowledge/projects/[id]/memory/route.ts`
- `app/api/knowledge/projects/[id]/analysis-runs/route.ts`
- `app/api/knowledge/understanding/[id]/resolve/route.ts`
- `app/api/knowledge/revisions/[id]/route.ts`

## Verification

```bash
npm run test:unit -- --run shared/project-memory/reconstruct.test.ts \
  shared/project-memory/sqlite-store.test.ts \
  shared/project-memory/reducer.test.ts
# 24/24 PASS (Task4 10 + store/reducer 14)
```

## Residuals

- Live LLM wiring optional (`AGENT_RUN_MODE=model`); default deterministic
- UI Task 5 not in this commit
