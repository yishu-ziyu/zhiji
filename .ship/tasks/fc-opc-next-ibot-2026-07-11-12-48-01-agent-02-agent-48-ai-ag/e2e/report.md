# Browser test report

Date: 2026-07-13

Verdict: PASS

## Test setup

- Framework: Playwright 1.61.1, already present in the repository.
- Browser: Chromium.
- Test file: `tests/e2e/app.spec.ts`.
- The Playwright configuration started and stopped the Next.js application for each run.
- Cleanup result: port 3000 was free after both runs.

## What the tests prove

1. The home page opens the customer-change product and does not show the old ecommerce product.
2. A current project and a customer message produce evidence-backed affected items.
3. The service provider can set a new scope, delivery date, and total price.
4. A provider resend creates a new link and invalidates the previous link.
5. Refreshing the provider page restores the pending project and link.
6. The client sees old and new scope, date, total price, and final payment on a 390×844 viewport without horizontal overflow.
7. Client confirmation updates the project version, delivery date, and final payment once; replay returns 409.
8. A client must explain a requested change; the service provider receives the note and can issue a new link.
9. An invalid provider secret is rejected, and the provider API cannot perform the client's confirmation.

## Results

- Targeted run: 2/2 passed in 11.1 seconds.
- Full run: 5/5 passed in 12.6 seconds.
- Regressions: 0.
- Real failures: 0.
- Retries needed to pass: 0.

## Evidence

- `targeted.log` — the two main customer-change flows.
- `full-suite.log` — all Playwright tests.
- Failure artifacts: none; both final runs were green.

## Required upstream method read

- `/Users/mahaoxuan/Developer/yishuship/vendor/mattpocock-skills/skills/engineering/tdd/SKILL.md`
