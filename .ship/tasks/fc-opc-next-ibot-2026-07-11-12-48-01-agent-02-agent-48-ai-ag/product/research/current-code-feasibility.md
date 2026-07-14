# Current code feasibility map

Date: 2026-07-13

Status: implementation pre-judgment. This is not authorization to change business code.

## Current runnable flow

The repository already implements this vertical slice:

```text
pasted customer text
-> POST /api/efficiency/commitments
-> LLM or deterministic fixture extracts commitment candidates
-> provider reviews selected candidates
-> POST /api/efficiency/slips creates and sends slips
-> client opens /c/[token]
-> client confirms or requests changes
-> provider marks delivery
-> client accepts or rejects
-> event history and cohort-safe candidate metrics update
```

The strongest existing product mechanism is not extraction. It is role-owned
state transition: provider code cannot impersonate the client's confirm or accept
actions.

## Reusable code

| Existing capability | Current files | Reuse judgment |
|---|---|---|
| Commitment extraction and evidence excerpt | `app/api/efficiency/commitments/route.ts`, `shared/llm/prompts/commitments.ts` | Reuse the request seam and structured normalization; change the schema only after the selected product action is fixed. |
| Bilateral state authority | `shared/delivery/state-machine.ts`, `shared/delivery/types.ts` | Keep. This is already a defensible rule for consequential client-owned states. |
| Event history | `shared/delivery/repository.ts` | Keep the append-only action idea; the in-memory storage is demo-only. |
| Provider review UI | `app/track/efficiency/page.tsx` | Reuse the review-before-action interaction, but split it only when a second stable screen earns a component boundary. |
| Client guest action | `app/c/[token]/*`, `app/api/efficiency/client/[token]/*` | Reuse for confirmation/acceptance evidence. Do not require it for every internal waiting or project state. |
| Deterministic golden path | `shared/delivery/extract-mock.ts`, `tests/fixtures/delivery/dialog-01.json`, `tests/e2e/app.spec.ts` | Keep and extend with one selected real causal path. |
| Cohort-safe metrics | `shared/delivery/metrics.ts` | Keep the cohort discipline; replace the displayed metrics if the chosen product mechanism changes. |

## Hard gaps

1. **No client or project context.** Every slip is independent. The system cannot
   answer which project, quote, task, dependency or waiting item is affected.
2. **No external event object.** The pasted text is used once and discarded except
   for a short excerpt. There is no durable source event, channel, sender, timestamp
   or relation to prior events.
3. **No candidate change object.** Model output becomes draft slips. It cannot show
   typed before/after changes, confidence, contradictions, abstention or affected
   records.
4. **No durable state.** `shared/delivery/repository.ts` stores data in a process-local
   global `Map`. Restarting or moving to another server instance loses the company
   state.
5. **No active Agent loop.** All work starts from a button. There is no event trigger,
   scheduled check, anomaly policy, approval queue, action execution or verification.
6. **No tenant/auth boundary.** The client page uses a bearer token and the provider
   page has no account boundary. This is acceptable only for a controlled demo.
7. **No outbound integration.** “Send” creates a URL; it does not send through WeChat,
   WeCom, email or another channel.

## Minimum common spine before selecting a feature

The four candidate problems share only a small common spine. Building more than
this before the product decision would be speculative.

```text
SourceEvent
  -> candidate interpretation with evidence
  -> human or counterparty decision
  -> approved state transition
  -> append-only result event
  -> later Agent checks consume verified state
```

Minimal new records if implementation proceeds:

- `Project`: the client engagement that owns commitments and work state.
- `SourceEvent`: what happened, where, when, who produced it and the retained evidence.
- `ChangeProposal`: the Agent's proposed changes, uncertainty and affected records.
- Existing `CommitmentSlip` and its history remain the first authoritative business
  object; do not introduce a generic “business object platform” for the demo.

For a production path, these records require durable relational storage. For the
180-second competition demo, deterministic fixtures and the existing process-local
repository can prove the interaction, but they cannot support a claim of persistent
company memory.

## Candidate problem to code impact

### A. Capacity and priority conflict

Required product inputs:

- project value and commercial risk;
- hard deadlines and dependencies;
- remaining effort and available capacity;
- relationship or strategic constraints that the user chooses to expose.

Likely code impact:

- add `Project`, `CapacityWindow` and explicit prioritization policy data;
- add a portfolio analysis module that returns conflicts and alternatives, not an
  unexplained rank;
- add a conflict-review screen and an approval action;
- add evaluation fixtures where the correct answer changes when one input changes.

Feasibility verdict: technically possible, but the input burden and trust problem are
larger than the algorithm. Do not implement automatic ranking from current slip data.

### B. Forgotten external waiting

Required product inputs:

- who is waiting for whom;
- expected response or evidence;
- review window;
- the downstream commitment or project state that is blocked.

Likely code impact:

- add `WaitingItem` linked to a project and optionally a slip;
- derive candidate open/close transitions from `SourceEvent` and existing client
  actions;
- add deterministic anomaly rules before using the model: overdue window, conflicting
  evidence and partial completion;
- add an Agent review card with evidence, impact and a follow-up draft;
- add a scheduler or durable event trigger only for the real product. The demo can
  inject clock and reply events deterministically.

Feasibility verdict: highest reuse of the existing history and client actions. It is
still only an Agent if events can propose state changes; a timer alone is a reminder.

### C. Client change creates inconsistent state

Required product inputs:

- prior authoritative project/commitment state;
- a new customer event;
- typed relations to scope, date, dependency, quote or task;
- an approval rule for consequential changes.

Likely code impact:

- add `SourceEvent` and `ChangeProposal` with typed before/after candidates;
- extend the extraction prompt to retrieve current project context and return affected
  records, confidence, contradictions and abstentions;
- add a diff-review API that applies approved changes atomically and appends result
  events;
- change the main UI from “extract several cards” to one evidence-linked impact review;
- add tests for no-op, ambiguity, partial approval, stale proposal and atomic apply.

Feasibility verdict: strongest Agent-specific mechanism, but it requires the largest
new state model and currently has the weakest direct scene evidence.

### D. Commercial boundary, acceptance and payment failure

Required product inputs:

- agreed scope and acceptance criteria;
- quote or change-order version;
- price/date impact;
- client authority and proof of approval.

Likely code impact:

- extend the current slip into versioned scope/change requests instead of creating a
  parallel contract system;
- add proposed price/date/scope changes and client approve/reject actions;
- add version comparison and immutable approval history;
- optionally integrate an external e-signature/invoice system later; do not claim the
  existing guest confirmation is a legal signature.

Feasibility verdict: direct connection to money and current bilateral-state reuse, but
it may become a quote/change-order product rather than a general operating Agent.

## Decision rule before implementation

Select the problem only when the evidence shows all four:

1. a recurring Chinese target-user event;
2. an observable loss larger than the added capture/approval friction;
3. a result that a note, alarm or existing PM/CRM workflow does not provide equally
   well;
4. one 180-second path that can be implemented through the existing extraction,
   review, state transition and E2E seams.

