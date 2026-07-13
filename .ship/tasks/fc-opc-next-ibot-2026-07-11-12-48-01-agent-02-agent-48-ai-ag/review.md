# Final code review

Date: 2026-07-13

Fixed point: `a659bfae`

Spec: `plan/customer-change-spec.md`

Verdict: CLEAN

## Findings

No remaining P1, P2, or P3 correctness, security, data-integrity, or spec findings were found in the customer-change code path.

## Standards check

- Server boundaries validate provider credentials, request strings, integer money values, and exact evidence positions (`app/api/efficiency/changes/route.ts:23-29`, `shared/delivery/change.ts:267-315`, `shared/delivery/change.ts:350-378`).
- Unexpected server errors are logged and returned as a generic 500 instead of exposing internal messages (`app/api/efficiency/changes/route.ts:15-20`, `app/api/efficiency/changes/[token]/route.ts:8-13`).
- Project state changes are owned by the domain module; the provider route cannot execute the client's confirmation (`app/api/efficiency/changes/route.ts:38-40`).
- Client grants are bound to proposal revision and project version. Sending a replacement revokes every earlier project link (`shared/delivery/change.ts:380-410`, `shared/delivery/change.ts:435-496`).
- The latest proposal is explicit rather than inferred from equal timestamps (`shared/delivery/change.ts:329-330`, `shared/delivery/change.ts:423-432`).
- The in-memory repository is deliberate for this local competition version; database persistence and multi-instance deployment are explicitly excluded by the spec.

## Spec check

- Optional evidence categories allow ordinary messages to produce only supported effects; every emitted quote is checked against the original text (`shared/delivery/change.ts:267-315`).
- Service-provider decisions produce a new scope, date, total price, and final payment without allowing the model to make those decisions (`shared/delivery/change.ts:350-410`).
- The client sees old and new scope, date, total price, and final payment, plus the unverified-identity warning (`app/c/[token]/ChangeClientActions.tsx:60-107`).
- Confirmation updates project version, scope, delivery date, total price, and final payment in one guarded synchronous operation; repeated use fails (`shared/delivery/change.ts:479-538`).
- The provider page restores a pending demo project after refresh and permits provider-initiated resend with a new link (`app/track/efficiency/page.tsx:59-140`, `app/track/efficiency/page.tsx:376-387`).

## Independent review evidence

- The first reviewer reported six concrete findings in `control/dev-review.md`.
- A fresh reviewer rechecked all six after the fixes and recorded `Verdict: PASS`.
- Unit tests: 25/25 passed.
- Browser tests: 5/5 passed.
- ESLint: passed.
- Production build and TypeScript: passed.

## Residual boundaries, not findings

- Data is process-local and is lost when the server restarts.
- The client link proves possession of the link, not the person's legal identity.
- No automatic personal-WeChat reading or external-system writeback is implemented.

These three boundaries are visible in the product or explicitly excluded by the accepted specification.
