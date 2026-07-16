#!/bin/sh
set -u

REPO="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
fail=0

pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
bad()  { printf 'FAIL  %s\n' "$1"; fail=1; }

printf 'Team environment check\nrepo: %s\n\n' "$REPO"

for command_name in cmux rg git gh node npm jq curl python3 treehouse agent-browser; do
  if command -v "$command_name" >/dev/null 2>&1; then
    pass "$command_name: $(command -v "$command_name")"
  else
    bad "$command_name is missing"
  fi
done

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
if [ "$node_major" -ge 22 ] 2>/dev/null; then
  pass "Node.js $(node --version)"
else
  bad "Node.js 22+ required; found $(node --version 2>/dev/null || printf 'none')"
fi

if git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  pass "git worktree: $(git -C "$REPO" branch --show-current)"
  dirty_count="$(git -C "$REPO" status --porcelain | wc -l | tr -d ' ')"
  if [ "$dirty_count" -eq 0 ]; then
    pass "worktree clean"
  else
    warn "worktree has $dirty_count existing changed/untracked paths; preserve them and use treehouse for new parallel writes"
  fi
else
  bad "repository is not a git worktree"
fi

if gh auth status >/dev/null 2>&1; then
  pass "GitHub CLI authenticated"
else
  warn "GitHub CLI not authenticated; public reads still work, private access needs an Engineering Lead unblock"
fi

if [ -d "$REPO/node_modules" ]; then
  pass "dependencies installed"
else
  warn "node_modules missing; run npm install in the assigned worktree"
fi

env_file="$REPO/.env.local"
if [ -f "$env_file" ]; then
  if grep -q '^LLM_API_KEY=.' "$env_file"; then pass "LLM_API_KEY present (value hidden)"; else warn "LLM_API_KEY missing"; fi
  if grep -q '^LLM_MODEL=step-3.7-flash$' "$env_file"; then pass "LLM model configured: step-3.7-flash"; else warn "LLM_MODEL is not step-3.7-flash"; fi
  if grep -q '^LLM_BASE_URL=' "$env_file"; then pass "LLM base URL present (value hidden)"; else warn "LLM_BASE_URL missing"; fi
else
  warn ".env.local missing; request secret configuration from Engineering Lead 2 and never paste a key into a handoff"
fi

if command -v no-mistakes >/dev/null 2>&1; then
  pass "no-mistakes installed (deferred until final shipping)"
else
  warn "no-mistakes missing (not an MVP feedback-loop blocker)"
fi

printf '\nResult: '
if [ "$fail" -eq 0 ]; then
  printf 'READY with any WARN items reported to Engineering Lead 2.\n'
else
  printf 'BLOCKED; report FAIL items, attempted repair, and requested unblock to Engineering Lead 2.\n'
fi

exit "$fail"
