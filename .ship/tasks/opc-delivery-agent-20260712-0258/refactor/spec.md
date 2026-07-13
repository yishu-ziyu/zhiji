# Refactor: deepen delivery browser and public-data seams

## Scope
Files in blast radius: provider/client pages, slips/client routes, delivery types/state machine, E2E tests.
Test command: `npm run test:unit && npm run lint && npm run build && npm run test:e2e`

## Evidence

### Structure
1. God File / Long Method — `app/track/efficiency/page.tsx:72` — provider polling, token persistence, actions, extraction and rendering share one 282-line function.
2. Mixed Concerns / Long Method — `app/api/efficiency/slips/route.ts:29` — validation, editable patch decoding and transitions are interleaved.
3. Duplicated Code — `app/api/efficiency/slips/route.ts:66,85` — editable patch decoding appears twice.
4. Dead Code — `shared/delivery/types.ts:57,94` and `state-machine.ts:50` — unused compatibility exports enlarge the interface.

### Reuse / Quality / Efficiency
- Reuse: duplicated field primitive — `app/c/[token]/ClientActions.tsx:102` — bypasses the existing `Textarea` module.
- Quality: leaky abstraction — `app/c/[token]/page.tsx:13` — provider-only token is serialized into the client module.
- Quality: copy-paste — `app/track/efficiency/page.tsx:193,234` — provider action payload is assembled twice.
- Efficiency: recurring no-op updates — provider/client polling replaces state every 1.5 seconds even when `updatedAt` is unchanged.

## Invariants
1. Provider never performs client confirmation or acceptance — `shared/delivery/state-machine.ts:6`.
2. Send/resend preserves edits and the same customer link — `tests/e2e/app.spec.ts:109`.
3. Public list/client data never includes `clientToken` — `tests/e2e/app.spec.ts:91`.
4. Empty required client notes show inline errors — `tests/e2e/app.spec.ts:49,58`.
5. The five-step golden path remains executable in one browser session — `tests/e2e/app.spec.ts:12`.

## Target Structure
| Module | Owns | Changes When |
|--------|------|--------------|
| `app/track/efficiency/use-provider-slips.ts` | provider polling, token adapter, provider actions and link copying | provider-side transport behavior changes |
| `shared/delivery/public-slip.ts` | removal of provider-only fields | public commitment shape changes |
| `app/api/efficiency/slips/route.ts` | HTTP validation and response composition | provider HTTP contract changes |
| `app/track/efficiency/page.tsx` | extraction workflow and page composition | provider workflow presentation changes |

## Eliminate
- Editable patch decoding: 2 copies → 1 private function in the slips route.
- Provider action payload construction: 2 copies → 1 function in the provider hook.
- Token redaction: manual copies → 1 `toPublicSlip` function.
- Dead exports: delete `DeliveryTask`, `DELIVERY_COLUMNS`, and `isTerminal` plus its isolated test.

## Execution Order
1. Verify the existing unit and E2E suites.
2. Structure: extract the provider browser adapter; run unit and golden-path E2E.
3. Reuse: replace the client textarea with the shared module; run golden-path E2E.
4. Quality: centralize public-slip redaction and editable patch decoding; run unit and API/E2E tests.
5. Efficiency: retain object identity on unchanged polls; run the full suite.

## Abort If
- Tests fail twice on the same step after attempted fix.
- Blast radius grows beyond the listed delivery files.
