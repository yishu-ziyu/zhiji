# P0 Control plane ready (EL2)

**Time:** 2026-07-16  
**Owners:** Engineering Lead 1 + 2 jointly  

## Canonical lineage

| Item | Value |
|---|---|
| Branch tip | `g2/d50-onboarding-integration@c2641d3b` |
| Full SHA | `c2641d3b12fca6801e232abf4ac6de78c7d92819` |
| Contains | accepted MVP `3b6c33a1` + 4 D-50 commits |
| Worktree | `/Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/16/fc-opc-ibot` |

## Owner runtime (attributable)

| Item | Value |
|---|---|
| URL | **http://127.0.0.1:3331/track/knowledge/mvp** |
| Port | **3331 only** for this control line |
| cwd | slot16 tree above (verified via lsof) |
| PROJECT_MEMORY_DATA_DIR | `/tmp/fc-opc-ibot-c264-owner-runtime-3331` |
| **Not** canonical | port **3000** on dirty main HEAD `80bcb0b7` |

## Fixture

| Item | Value |
|---|---|
| Authorize entry | **`/tmp/mvp-v0-g6-d50-fixture`** |
| Resolves to | `.ship/fixtures/mvp-v0-g6-owner-project` |

## Capacity

| Action | Result |
|---|---|
| Returned clean leases | **14**, **15** (git clean; holder ended) |
| Free slots now | **2** (14 + 15) |
| Kept dirty | 12, 13, 16 (runtime-generated dirt preserved) |
| Slot 17 | not treehouse-managed; not force-returned |

## EL1 packet

Already embeds §0 control plane: `.ship/handoffs/EL1-D51-D52-engineering-packet.md`  
No dual ASSIGN-G5-D51.

## Risks remaining

1. Only **2 free** treehouse slots for Wave A writer + independent verifier (tight).  
2. Slot16 has runtime-only dirty paths (`next-env.d.ts`, `data/knowledge/project-memory/`, `pnpm-lock.yaml`) — do not force-return.  
3. Port 3000 still runs dirty main — must not be cited as c264 evidence.  
4. :74 residual PREP still open (non-blocking).  
