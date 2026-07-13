# Peer Spec — OPC Delivery Ops Agent

**WARNING: Second spec was self-generated, not independent peer agent**  
(Independent peer runtime not dispatched this session; second-pass review of host investigation.)

## Agreement with host

- Pivot efficiency track to delivery closed-loop; north star closed-loop rate
- New domain types under `shared/delivery/*`
- New API `/api/efficiency/commitments` rather than overloading minutes UI story
- Reuse adapter `complete`/`extractJson`, localStorage pattern, kanban select UX
- Update E2E; add unit test runner
- Defer ecommerce, mini-program, tool_use

## Additional findings / pressure tests

1. **`ChatInterface.tsx` is large (584 lines)** and minutes-oriented message types (`type: "minutes"`). Prefer not to force commitment review through chat bubbles; use a dedicated **CommitmentReview** panel so success criteria (structured list) cannot hide inside chat.
2. **Minutes route complexity is a trap.** Peer warns against "thin wrapper calling minutes and remapping actionItems → commitments" as permanent design — remapping preserves meeting vocabulary in prompts and mock titles. Accept only as temporary 1-hour spike if LLM prompt not ready; target is dedicated commitments prompt.
3. **Home page (`app/page.tsx`)** still markets dual track with 会议纪要 language — for pitch consistency, update efficiency card copy in same epic.
4. **Zustand is already a dependency** (`package.json`) but unused for kanban. Optional: use zustand for delivery store; host may keep useState+localStorage for speed. Peer: either is fine; pick one and do not introduce both.
5. **Confirmed actor:** In solo demo, "客户确认" is a button the founder clicks ("标记客户已确认"). Document honesty in pitch: real customer confirm is post-hackathon webhook.
6. **Empty-state failure mode:** If gold script path accidentally hits live LLM that returns empty, demo dies. Peer requires **fixture-first demo button** that does not depend on network (client-side fixture inject OR API `?fixture=dialog-01`).

## Divergences to resolve in host

| # | Peer claim | Suggested disposition |
|---|---|---|
| D1 | Commitment review UI must not be ChatInterface-only | Accept → dedicated panel |
| D2 | Demo button must be fixture-first | Accept |
| D3 | Home card copy in scope | Accept as small task in Slice C/D |
| D4 | zustand optional | Host choice: useState OK for MVP |

## Peer acceptance add-on

- Demo button works with network disabled (Playwright offline or mock route)
- At least one E2E asserts metrics text contains `%` or rate fraction after confirm
