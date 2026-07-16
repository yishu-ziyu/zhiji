---
title: Post-overnight integration plan
date: 2026-07-16
base: codex/knowledge-project-canvas-clean
map: docs/checkpoints/2026-07-16-overnight-version-map.md
---

# Integration plan (select by capability, not by branch existence)

## Base line (public)

| Item | Value |
|------|--------|
| Branch | `codex/knowledge-project-canvas-clean` |
| Tip at plan time | see `git log -1` after push |
| Product surface | `/track/knowledge` project canvas (WIP, not full product PASS) |
| Rule | Never merge a checkpoint wholesale |

## Capability queue (from overnight map)

| Priority | Capability | Source checkpoint | Acceptance | Action |
|----------|------------|-------------------|------------|--------|
| **P0 base** | Knowledge project canvas (materials, recency, one-hop, narrative) | `codex/knowledge-project-canvas-clean` | Mixed WIP; unit 89/89 | **Stay here**; polish only under new stories |
| **P1 next** | Situation / attention brief (accepted decision only) | `lease3-attention-golden-specs` `ab0514d3` | Only situation decision Captain-accepted | Cherry-pick **docs/decision slices**, not whole golden-loop code |
| **P1 parallel** | Agent-bridge recovery (narrow) | `lease7-b01-recovery-pass-narrow` `4b54c1ae` | PASS NARROW recovery only | New branch `integrate/b01-recovery-narrow`; scope lock; re-test recovery only |
| **P2 review** | Retrieval R5 | `lease4-retrieval-r5-candidate` `e8b3cef6` | Pending independent review; no PASS | Review + golden queries first; integrate only after G4-style PASS |
| **P2 review** | Ledger record-decision R2 | `lease10-ledger-record-decision-r2-candidate` `81d9a1c9` | Local green; review incomplete | Independent review; do not merge on green alone |
| **HOLD** | Golden-loop prototype | `lease6` `b13fc524` | HOLD; deps not accepted | No merge until retrieval + ledger accepted |
| **DO NOT** | B01 two-HIGH R5 | `lease9` `57c6aa45` | BLOCKER | Do not promote |
| **Archive only** | lease5 ledger, lease8 F02 R4, internal raw | various | Superseded / internal | Reference evidence only |

Research lane `lease1` = unreviewed implementation authority → read for product language, not merge as code.

## Recommended sequence

```text
1) Push + freeze canvas-clean as public base (this cycle)
2) integrate/b01-recovery-narrow  ← only recovery acceptance surface
3) integrate/situation-brief-docs ← Captain-accepted situation only from lease3
4) review/retrieval-r5            ← evidence + tests, no merge yet
5) review/ledger-r2               ← evidence + tests, no merge yet
6) After 4+5 PASS → re-open golden-loop from lease6 as new design, not wholesale merge
```

## New branch naming

- `integrate/<capability>-<date>`
- Base always: latest `codex/knowledge-project-canvas-clean` (or main if later promoted)

## Out of scope this cycle

- Internal raw checkpoint branches → never public merge
- Claiming B01 / retrieval / ledger / golden-loop product PASS from overnight alone
- Replacing Agent product paradigm docs with overnight board state

## Human gate before each integrate/*

1. One sentence: user-visible behavior when I do X I see Y  
2. Acceptance label from version-map still valid?  
3. Red-line / non-goals for this slice only  
