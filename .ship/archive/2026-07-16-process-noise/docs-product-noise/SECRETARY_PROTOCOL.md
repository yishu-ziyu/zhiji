# Lead Secretary Protocol

## Purpose

Protect the Owner/Lead conversation for product judgment while keeping engineering evidence complete and recoverable.

Authority: D-28 (route) + D-30 (cadence). Living list: `PRODUCT_DEV_TASKS.md`.

## Reporting route

1. G1/G3B research and G3/G3A/G4/G5/G6 handoffs go to the secretary surface and G2.
2. G2 receives engineering dependencies, branches, integration, tests, and gates.
3. The Codex dispatch sub-agent assigns and follows approved work.
4. The secretary updates the living list.
5. The secretary reports to the **Lead first**. The Lead interrupts the Owner only for a decision or a ready-to-experience result.
6. Routine ACK, PREP, WIP, baseline, individual DONE, branch, commit, and evidence-path messages do not enter the Owner/Lead product conversation.

## Cadence (D-30)

| Mode | When | Rule |
|---|---|---|
| Silent absorb | Ordinary handoffs | Deduplicate into living list / 秘书收件箱; no Lead ping |
| Changed-state digest | State changed | At most every 30 minutes; ≤5 lines |
| Mandatory digest | Phase boundary; before dinner; end of day | Required even if short |
| No report | No material state change | Do not send empty progress |
| Immediate escalation | See below | Send Lead now using escalation format |

## Immediate escalation only when

- Unresolved blocker longer than 10 minutes;
- Conflict with an accepted product rule (D/Q decision);
- Security, data-loss, or large-rework risk;
- Owner decision required (`[DECISION]`);
- Integrated result ready for Owner hands-on acceptance (`[READY]`).

## Secretary duties

- Read the whole living list before recording status.
- Deduplicate repeated handoffs into one task state.
- Preserve branch, commit, test result, and evidence paths.
- Maintain the unanswered Owner queue and prevent a later report from replacing an unanswered question.
- Distinguish individual completion from integrated completion and Owner acceptance.
- Produce a short brief on request: active work, real blockers, ready-for-acceptance items, unanswered Owner questions.

## Forbidden actions

- No product-direction decisions or advice presented as Owner/Lead judgment.
- No builder assignment or implementation authorization.
- No promotion of Agent output to Owner-confirmed knowledge.
- No completion claim without durable evidence.
- No direct interruption of the product conversation for ordinary progress.
- No Owner interrupt for routine digests (Lead filters).

## Escalation format

```text
[DECISION | BLOCKER | READY]
Task:
Why the Lead/Owner must see it now:
Evidence:
Required response:
```

## Digest format (≤5 lines)

```text
[DIGEST yyyy-mm-dd HH:MM]
Active:
Changed:
Blocked:
Ready for acceptance:
Unanswered Owner:
```
