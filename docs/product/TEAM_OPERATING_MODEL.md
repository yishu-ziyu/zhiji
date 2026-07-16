# Team Operating Model

Updated: 2026-07-16. This is the single active authority, communication, and delivery model for the 11 live cmux conversations.

## Authority

```text
Owner — final product authority and hands-on acceptance
├── Product Lead 1 · surface:78 — continuous Owner conversation and synthesis
├── Product Lead 2 · surface:63 — peer product judgment, challenge, and product record
└── Engineering leadership
    ├── Engineering Lead 1 · surface:80 — architecture, engineering packet, technical decisions
    ├── Engineering Lead 2 · surface:65 — dispatch, dependencies, delivery progress, integration
    └── Full-stack Engineers 1–7 · surfaces:82,83,79,77,64,75,74
        └── research, product code, runtime proof, and testing rotate per assignment
```

The Owner is the final authority. Product Leads 1 and 2 are peers for product judgment. Engineering Leads 1 and 2 are jointly accountable for turning an accepted product decision into a usable integrated result. Full-stack engineers are not permanently restricted to frontend, backend, research, or testing.

## Tight communication contract

### Product Leads ↔ Engineering Leads

Both Product Leads and both Engineering Leads communicate at three mandatory points:

1. **Decision enters engineering:** the problem, real user example, accepted behavior, and visible acceptance are written once.
2. **Technical reality changes the product choice:** an implementation constraint, source finding, risk, or simpler opportunity is raised immediately; engineering never silently changes the product.
3. **Integrated result is ready:** both Engineering Leads agree on what works, what was checked, and what remains before reporting once to both Product Leads.

Product Lead 1 owns the continuous Owner conversation and final synthesis. Product Lead 2 independently challenges important conclusions and owns the durable product record. A material disagreement stays visible for the Owner to resolve.

### Full-stack Engineers ↔ Engineering Leads

Every full-stack engineer stays in active contact with both Engineering Leads. Employee intake is deliberately shared so neither lead becomes a bottleneck:

- Engineering Lead 1 receives and synthesizes research findings, architecture questions, technical decisions, code-risk conclusions, and acceptance meaning.
- Engineering Lead 2 receives and synthesizes assignment state, dependencies, worktree ownership, integration state, and READY evidence.
- `BLOCKED` goes to both immediately. Engineering Lead 1 resolves the technical or contract cause; Engineering Lead 2 resolves ownership, dependency, environment, and integration consequences.
- `START` and `DONE` are visible to both through the assignment and delivery record. Engineers do not wait until the end to reveal a conflict.
- The two Engineering Leads actively redistribute intake when either is overloaded. An engineer is never asked to carry contradictory instructions between them.

Routine command output and raw logs stay below the Product Leads. Product-impacting conclusions, genuine decision requests, and integrated acceptance results move upward once, with evidence.

## Responsibilities

| Role | Owns | Does not offload |
|---|---|---|
| Owner | Direction, final judgment, direct product use | Experience acceptance to an agent |
| Product Lead 1 | Owner discussion, problem definition, final product synthesis | Routine delivery traffic |
| Product Lead 2 | Independent challenge, unresolved-question tracking, `PRODUCT_DEV_TASKS.md`, roadshow logic | Raw worker traffic |
| Engineering Lead 1 | Architecture, engineering packet, research/technical intake, contracts, technical decisions, acceptance meaning | Technical blockers or employee synthesis to Engineering Lead 2 alone |
| Engineering Lead 2 | Assignment, operational intake, dependencies, `MVP_FAST_INBOX.md`, worktree capacity, integration, focused checks, READY | Delivery blockers or employee synthesis to Engineering Lead 1 alone |
| Full-stack Engineers 1–7 | Any assigned research, implementation, runtime, browser, or test work | Unchanged problems or unexplained blockers |

The default split is operational, not a boundary for helping. Engineering Leads actively unblock work and may cover each other. Full-stack engineers may use any relevant technical capability. Authority to mutate external systems, expose secrets, or broaden product scope still follows the accepted product decision.

## Product feedback → usable result

1. Owner reports an annoyance, question, or failure while using the product.
2. Product Lead 1 discusses why it is wrong and what the user should be able to perceive or do.
3. Product Lead 2 records the problem, example, accepted solution, open question, and roadshow implication.
4. Both Engineering Leads read the same product record. Engineering Lead 1 writes the engineering packet; Engineering Lead 2 assigns the work.
5. Full-stack engineers research, implement, and verify in bounded parallel lanes. The verifier is different from the implementer.
6. Engineering Lead 2 integrates and runs only the checks proportionate to the MVP risk. Engineering Lead 1 confirms the result still matches the product decision.
7. Both Engineering Leads jointly produce the product-facing summary: Engineering Lead 1 owns technical reality and acceptance meaning; Engineering Lead 2 owns delivery state and runtime evidence. Owner uses the result. New feedback returns to step 1.

## Full-stack capability rule

Full-stack means capability is broad:

- inspect local code and project data;
- research local and current primary sources;
- implement frontend, backend, storage, Agent runtime, adapters, and tests;
- use browser automation and capture reproducible runtime evidence;
- install or configure a missing local dependency when it is safe, reversible, and inside the authorized environment.

For each task, Engineering Lead 2 names the implementer and an independent verifier. No engineer verifies its own implementation. Parallel writers use separate `treehouse` worktrees and do not edit the same owned files.

## Missing tool or environment rule

An engineer never waits silently for a missing capability.

1. Diagnose it and make one safe, evidence-producing attempt to install, configure, fetch, or repair it.
2. If it is still blocked, requires a credential or permission, may affect external systems, or risks existing work, contact Engineering Lead 2 immediately and copy Engineering Lead 1 when technical judgment is involved.
3. Report exactly: required capability, attempted command/action, observed failure, affected task, and smallest requested unblock.
4. Engineering Lead 2 owns the unblock to completion or reroutes it; Engineering Lead 1 resolves architecture or contract questions.

No API key or secret appears in chat, handoffs, screenshots, commands, or committed files.

## Standard engineering environment

| Need | Standard |
|---|---|
| Repository | `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot` |
| Runtime | Node.js 22, npm 10; use the repository lockfile and do not introduce a second package-manager lock |
| Search and source | `rg`, `git`, `gh`, `jq`, `curl`; current primary sources for external research |
| Parallel writes | `treehouse`; one isolated worktree per writer |
| Browser proof | cmux browser or `agent-browser`; Playwright when repeatability matters |
| Unit and product checks | Vitest, focused tests first; one relevant integrated suite; Owner use is final MVP acceptance |
| Long or fleet work | `gnhf` / `firstmate` only when the task needs them |
| Ship gate | `no-mistakes` is deferred during the MVP feedback loop and returns before final shipping |
| Secrets | `.env.local`, gitignored; presence may be checked, values must never be printed |

Run `scripts/team-env-check.sh` before taking a new write lane or when an environment problem is suspected.

## Assignment and reporting contract

Every assignment includes:

- user-visible behavior and durable product decision path;
- owned files and isolated worktree/branch;
- required tools or data;
- focused checks and independent verifier;
- DONE path and remaining risk.

Every engineer reports four events only: `START`, `BLOCKED`, `DECISION`, and `DONE`. Both Engineering Leads share employee intake and jointly synthesize it. Engineering Lead 1 maintains the technical-decision view; Engineering Lead 2 maintains the live delivery-progress view. They issue one jointly owned product-facing summary. Product Lead 2 maintains the single product record.

## Precedence

When instructions conflict:

1. Owner decision;
2. latest accepted entry in `PRODUCT_DEV_TASKS.md`;
3. this operating model;
4. current engineering packet and assignment;
5. older G-seat, secretary, or wave documents are historical only.
