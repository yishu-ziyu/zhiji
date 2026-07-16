# Cleanup DONE · S-136 · 2026-07-16

Owner: delete process noise; keep development-direction artifacts.

## Removed / packed

- ~33 git worktrees (Desktop siblings + treehouse slots + wave-a trees)
- ~53 local branches (checkpoints, old g*/wave-a, etc.)
- `.ship/handoffs` bulk → `handoffs-and-evidence.tar.gz` (kept 4 files live)
- `.ship/evidence` bulk → same tar
- Obsolete collab docs → `docs-product-noise/`

## Live keep

- Repo: `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot` @ `feature/first-user-real-entry`
- Tree: `~/.treehouse/fc-opc-ibot-678696/16` @ `c2641d3b` · port **3331**
- Product docs: ROADSHOW, SOLUTION-F-06/D-51/52/53/UI, TEAM_*, TEAM_ORG_TUI
- Fixtures: `.ship/fixtures/mvp-v0-g6-*`
- Force pause still on until Owner lifts

## Verify

```sh
git worktree list   # expect 2
git branch          # expect 2
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3331/track/knowledge/mvp
```
