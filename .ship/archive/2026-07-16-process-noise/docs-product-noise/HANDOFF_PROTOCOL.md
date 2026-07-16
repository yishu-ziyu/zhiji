# Team Handoff Protocol

Updated: 2026-07-16. Authority: `docs/product/G-SEATS.md`.

## One source of truth

Handoffs live in `.ship/handoffs/`. Terminal chat is delivery transport, not durable project state.

## Assignment

Codex or G2 creates `.ship/handoffs/ASSIGN-<seat>-<task>.md` with:

```markdown
# <task>
- Owner-language behavior:
- Non-goals:
- Worktree/branch:
- Owned files:
- Required checks:
- Evidence path:
```

No implementation starts without an assignment and exclusive file ownership.

## Completion or block

The seat writes `.ship/handoffs/<seat>-<task>-DONE.md` or `-BLOCKED.md`:

```markdown
# <seat> · <task> · DONE|BLOCKED
- Assignment:
- Result:
- Changed paths:
- Verification command and exit code:
- Evidence:
- Residual risk:
- Next owner:
```

Then send one line to G2 and Codex:

```text
<seat> DONE|BLOCKED · <absolute handoff path>
```

## Acceptance flow

```text
Codex defines behavior
  → G1 grounds it in real UI, code, data, and owner feedback
  → G2 assigns exclusive work
  → Builder returns implementation evidence
  → G4 attempts to falsify
  → G5 captures runtime evidence
  → G6 tests ten-second comprehension
  → Codex integrates and reports to Owner
```

Failure returns to a newly assigned writer with explicit file ownership. Reviewers never patch silently.
