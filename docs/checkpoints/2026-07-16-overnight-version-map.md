# Overnight checkpoint map — 2026-07-16

This document records the version boundary created after the Captain stopped all
execution lanes for product realignment. It is a preservation map, not a product
acceptance report.

## Stop boundary

- Team state: all W lanes stopped and released write ownership.
- Last coordination-board content hash: `d5a5ea4d86a0f22fded34921750d63e756fa2318e5c754bde90b0d33b37dbab1`.
- Product preview used for the handoff: `http://localhost:3000/track/knowledge`.
- Main public snapshot before this map: `5859a535719ff47fb1e03425f25c9dd1755040ca`.
- No checkpoint below implies `B01`, retrieval, knowledge ledger, golden loop, or
  live-thread acceptance.

## Public GitHub checkpoints

| Branch | Commit | Meaning | Acceptance |
|---|---|---|---|
| `codex/knowledge-project-canvas-clean` | `5859a535` + this map | Current public-safe canvas, materials, recency, collaboration, and narrative snapshot | Mixed WIP; verification recorded separately |
| `checkpoint/20260716/lease1-matt-research` | `6a58f3da` | Vision gap, attention, interface, and knowledge-quality research | Research evidence; unreviewed as implementation authority |
| `checkpoint/20260716/lease3-attention-golden-specs` | `ab0514d3` | Attention/golden-loop drafts plus accepted situation brief | Mixed docs; only the situation decision was Captain-accepted |
| `checkpoint/20260716/lease4-retrieval-r5-candidate` | `e8b3cef6` | Retrieval implementation and tests | Pending independent review; no retrieval PASS |
| `checkpoint/20260716/lease5-ledger-superseded-evidence` | `d3cc57c1` | Earlier ledger prototype and tests | Superseded evidence only |
| `checkpoint/20260716/lease6-golden-loop-prototype-hold` | `b13fc524` | Golden-loop ports, service, routes, adapters, and tests | HOLD; real retrieval/ledger dependencies not accepted |
| `checkpoint/20260716/lease7-b01-recovery-pass-narrow` | `4b54c1ae` | Agent-bridge recovery candidate | PASS NARROW for recovery scope only |
| `checkpoint/20260716/lease8-b01-f02-r4-superseded` | `f9f45a49` | F02 R4 bridge tree | Superseded frozen evidence |
| `checkpoint/20260716/lease9-b01-two-high-r5-blocker` | `57c6aa45` | Latest two-HIGH bridge candidate | BLOCKER; do not promote |
| `checkpoint/20260716/lease10-ledger-record-decision-r2-candidate` | `81d9a1c9` | Latest record-decision ledger candidate | Local green; independent review incomplete |

## Internal raw checkpoints

Raw local coordination material was committed and pushed to the configured
internal Git remote. These refs intentionally do not go to the public GitHub
repository because they contain local paths, window identifiers, terminal
screenshots, names, and raw meeting captures.

| Branch | Commit | Contents |
|---|---|---|
| `checkpoint/internal-overnight-raw-20260716` | `a335c08b` | Exact primary-tree snapshot, raw board, screenshots, meeting captures, and generated Next drift |
| `checkpoint/internal-20260716/lease1-matt-research-raw` | `4521c4a3` | Exact research lane |
| `checkpoint/internal-20260716/lease2-w2a-ui-e2e-raw` | `699ff8af` | Exact W2-A mixed UI/E2E bridge lane |
| `checkpoint/internal-20260716/lease3-attention-golden-specs-raw` | `9d37ce3b` | Exact attention/golden-loop specification lane |
| `checkpoint/internal-20260716/lease4-retrieval-r5-raw` | `e8b3cef6` | Exact retrieval candidate |
| `checkpoint/internal-20260716/lease5-ledger-superseded-raw` | `d3cc57c1` | Exact superseded ledger candidate |
| `checkpoint/internal-20260716/lease6-golden-loop-hold-raw` | `8a8df702` | Exact golden-loop prototype |
| `checkpoint/internal-20260716/lease7-b01-recovery-raw` | `4b54c1ae` | Exact B01 recovery candidate |
| `checkpoint/internal-20260716/lease8-b01-f02-r4-raw` | `f9f45a49` | Exact F02 R4 candidate |
| `checkpoint/internal-20260716/lease9-b01-two-high-r5-raw` | `57c6aa45` | Exact two-HIGH R5 candidate |
| `checkpoint/internal-20260716/lease10-ledger-r2-raw` | `81d9a1c9` | Exact latest ledger candidate |
| `checkpoint/internal-20260716/grok-docs-rejected-raw` | `50f30315` | Rejected Grok docs lane, preserved only |
| `checkpoint/internal-20260716/b01-web-bridge-preintegration-raw` | `a401c032` | Superseded pre-integration bridge tree |
| `checkpoint/internal-20260716/grok-codex-execution-paused` | `225b08e7` | Clean paused Grok execution lane |

## Publication boundary

The public repository excludes raw review screenshots, raw meeting images,
runtime state, generated `next-env.d.ts` drift, private worktree maps, and
internal coordination logs. Exact bytes remain in the internal raw checkpoint.
`node_modules`, `.next`, test reports, environment files, and runtime knowledge
JSON were never force-added.

## Resume rule

Start the next planning cycle from this map. Select one checkpoint by capability,
read its acceptance label, and create a new integration branch. Never merge a
checkpoint wholesale merely because it exists.
