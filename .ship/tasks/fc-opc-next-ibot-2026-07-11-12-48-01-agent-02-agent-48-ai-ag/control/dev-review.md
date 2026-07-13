# Customer-change development review

**Verdict: FAIL**

Reviewed `a659bfae...e91b51d7` only on the requested implementation surfaces, against `plan/customer-change-spec.md`.

## Findings

### P1 — The client confirms a price change without seeing either total price

- Evidence: `app/c/[token]/ChangeClientActions.tsx:77-102` compares scope, delivery date, and final payment only. `ClientChangeView` contains both totals (`shared/delivery/change.ts:98-99` via `AgreementVersion.totalPriceMinor` at `:55`), but the page never renders them. The E2E likewise asserts only date and final payment (`tests/e2e/app.spec.ts:41-46`).
- Trigger: send the specified ¥8,000 → ¥10,000 proposal and open its client link.
- Impact: the bearer can apply a monetary agreement without seeing the changed total price, contrary to spec lines 13 and 23.
- Fix: render original/new total price alongside scope, date, and final payment, and assert it in E2E.

### P2 — The real analyzer rejects valid changes that affect only some agreement fields

- Evidence: the prompt tells the model to quote a category only when the message actually mentions it (`shared/llm/prompts/change.ts:13-16`), but the route requires all four strings to be non-empty (`app/api/efficiency/changes/route.ts:64-72`). The domain then always constructs scope/date/price impacts with fixture-specific explanations (`shared/delivery/change.ts:266-290`).
- Trigger: analyze “请再增加一个英文版本”; a compliant response has empty `deliveryQuote` and `priceQuote`, so the route returns 422 rather than reporting only the affected scope.
- Impact: the advertised paste-a-client-message path works only for messages shaped like the demo fixture, violating spec lines 10-11 and 30.
- Fix: model optional category evidence and construct only impacts supported by non-empty, position-validated quotes.

### P1 — Sending a replacement proposal does not invalidate the old client link

- Evidence: grant revocation is proposal-scoped (`shared/delivery/change.ts:195-202`, `:362`), so sending replacement proposal B does not revoke proposal A's grant. Both grants still match project v1 and `confirmClientChange` accepts either (`:430-483`). `getClientChange`/`requestClientChange` also omit a current-project-version check (`:389-427`).
- Trigger: send A from v1, analyze and send replacement B from v1, then confirm A's old token. A applies as v2 and B subsequently fails as stale. A read-only reproduction returned `{"oldLinkApplied":"OLD A","replacementLink":"项目已有更新，请服务方重新发送","version":2}`. If B is confirmed first, A also remains readable and can still submit `request_changes`.
- Impact: the superseded plan can win the race and update scope, delivery date, and balance, directly violating the old-link invalidation and single-update requirements in spec lines 24 and 29.
- Fix: enforce one active proposal/grant per project version, revoke all project-level grants when issuing a replacement, and reject version-stale grants for GET and both client mutations.

### P2 — The provider UI offers revision/resend while the state machine rejects it

- Evidence: every non-`applied` proposal renders editable fields and a send button (`app/track/efficiency/page.tsx:276-337`), and the adjacent copy promises a later provider edit invalidates the old link (`:340-345`). The domain accepts send only from `draft` or `changes_requested` (`shared/delivery/change.ts:325-327`).
- Trigger: send revision 1, edit any field while status is `pending_client`, and click “发送给客户确认”; the server returns “只有草稿或客户要求修改的方案可以发送”, leaving the old link valid.
- Impact: the visible workflow is false and provider-initiated revisions required by spec line 24 cannot be created.
- Fix: either permit `pending_client` resend as a new revision while atomically revoking the prior grant, or make the form read-only until the client requests changes and correct the copy.

### P3 — The LLM failure message reports three retries after a single attempt

- Evidence: the customer-change route explicitly calls `complete(..., { maxRetries: 1 })` (`app/api/efficiency/changes/route.ts:58-62`), while exhaustion always throws “已重试 3 次” (`shared/llm/adapter.ts:109-110`).
- Trigger: make the configured model timeout or return 5xx.
- Impact: the explicit failure required by spec line 30 is materially untruthful.
- Fix: interpolate the actual retry count in the final error.

### P3 — “Latest proposal” can resolve to the oldest proposal created in the same millisecond

- Evidence: `getProviderChange` sorts solely by ISO `createdAt` (`shared/delivery/change.ts:380-382`); equal timestamps retain Map insertion order. A 100-iteration read-only reproduction returned the first proposal in 98 same-millisecond cases.
- Trigger: create two drafts for one project within one millisecond, then poll provider state.
- Impact: the provider can be shown a stale pending proposal instead of the later/applied one, hiding the actual status transition.
- Fix: use a monotonic sequence/revision or a deterministic timestamp-plus-id ordering.

## Standards axis

The concrete standards failures are the stale-version authorization boundary, the UI/server state-machine contradiction, and the nondeterministic latest-proposal lookup. Process-local storage was not counted as a finding because spec line 45 explicitly excludes database persistence for this iteration.

## Spec axis

The implementation misses client visibility of the changed total price, cannot analyze ordinary subset changes, does not invalidate every project-version-stale link, and cannot perform the provider-initiated link revision promised by the UI/spec.

## Test coverage

`shared/delivery/change.test.ts` passes all 4 tests, and scoped ESLint passes. The checks do not cover: total-price visibility on the client; non-fixture/partial model output; stale-link GET or `request_changes` after a sibling proposal advances the project; provider resend from `pending_client`; request-changes/resend in E2E; the real LLM failure path; or desktop-provider horizontal overflow. Existing E2E at `tests/e2e/app.spec.ts:12-66` therefore proves only the fixture confirmation path and replayed confirmation rejection.

## [Review] Report Card

| Field | Value |
|-------|-------|
| Status | FINDINGS |
| Summary | 6 findings; monetary visibility and replacement-link failures block acceptance |
| Matt upstream read | `vendor/mattpocock-skills/skills/engineering/code-review/SKILL.md` |

### Metrics

| Metric | Value |
|--------|-------|
| P1 | 2 |
| P2 | 2 |
| P3 | 2 |

### Artifacts

| File | Purpose |
|------|---------|
| `control/dev-review.md` | Findings with file:line evidence and verification results |

### Next Steps

1. **Fix findings** — `/yishuship:dev`
2. **QA after fixes** — `/yishuship:qa`
3. **Full workflow** — `/yishuship:auto`

## Recheck

- Finding 1 — FIXED: the client renders original/new total price and E2E asserts `¥8,000 → ¥10,000`.
- Finding 2 — FIXED: analyzer quotes are optional by category, empty categories are omitted, and route/domain tests cover a scope-only change.
- Finding 3 — FIXED: sending any replacement revokes all project grants, and GET/request/confirm enforce current grant and project version.
- Finding 4 — FIXED: `pending_client` resend is accepted, increments the revision, revokes the old link, and is exercised through the provider E2E flow.
- Finding 5 — FIXED: retry exhaustion now interpolates the configured attempt count, so `maxRetries: 1` reports one attempt.
- Finding 6 — FIXED: latest-proposal lookup uses an explicit per-project proposal id and has a same-millisecond regression test.

**Verdict: PASS**

## Malformed JSON fix recheck

CLEAN
