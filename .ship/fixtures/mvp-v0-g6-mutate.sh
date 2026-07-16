#!/usr/bin/env bash
# MVP-V0 G6 · single filesystem mutation step for Owner scenario execute
# Run AFTER grant+reconcile is active on integrated build. Not for PREP demo.
set -euo pipefail
ROOT="${MVP_V0_FIXTURE_ROOT:-/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/fixtures/mvp-v0-g6-owner-project}"
LOG="${ROOT}/.mvp-v0-mutate.log"
cd "$ROOT"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "=== mutate start $TS ==="
  # 1) modify
  printf '\n## MVP-V0 mutate %s\n- file modified for before/after revision\n' "$TS" >> NOTES.md
  echo "modified NOTES.md"
  # 2) rename
  git mv TODO.md TODO-renamed.md 2>/dev/null || mv TODO.md TODO-renamed.md
  echo "renamed TODO.md -> TODO-renamed.md"
  # 3) delete
  rm -f DECISIONS.md
  echo "deleted DECISIONS.md"
  echo "=== mutate done $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} | tee -a "$LOG"
echo "LOG=$LOG"
