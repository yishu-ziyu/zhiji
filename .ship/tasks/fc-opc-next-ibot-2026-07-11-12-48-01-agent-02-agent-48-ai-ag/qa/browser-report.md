# Browser Exploratory Report

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Verdict** | **FAIL — required client-side coverage was not completed** |
| **App URL** | http://localhost:3000 |
| **Session** | customer-change-qa |
| **Scope** | Desktop provider flow; initial, empty, analysis, invalid-price, and resend states |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0 confirmed product issues** |

The exercised desktop provider states worked without JavaScript errors. The verdict is FAIL because the mandatory 390×844 client flow, refresh persistence, old-link rejection, request-changes validation, confirmation/idempotency, and final v2 state were not completed before the run was stopped.

## Acceptance Evidence

| Check | Result | Evidence |
|-------|--------|----------|
| Demo project v1 values | PASS | [desktop-provider-loaded-v1.png](screenshots/desktop-provider-loaded-v1.png) |
| Empty/whitespace customer message cannot be analyzed | PASS | [desktop-provider-empty-message.png](screenshots/desktop-provider-empty-message.png) |
| Explicit demo message load | PASS | [desktop-provider-demo-message.png](screenshots/desktop-provider-demo-message.png) |
| New scope detected; date and price left for provider decision; source phrases shown verbatim | PASS | [desktop-provider-analysis.png](screenshots/desktop-provider-analysis.png) |
| Price below paid amount rejected with clear alert | PASS | [desktop-provider-invalid-price.png](screenshots/desktop-provider-invalid-price.png) |
| Resend produces a new customer URL | PASS | [desktop-provider-resend.png](screenshots/desktop-provider-resend.png) |
| Provider console during exercised flow | PASS | React dev/HMR informational messages only; no page errors |
| 390×844 client layout and horizontal overflow | NOT RUN | Run stopped before client exploration |
| Refresh persistence | NOT RUN | Run stopped before refresh checks |
| Old customer link invalidation | NOT RUN | New URL observed, old URL not opened |
| Request changes requires explanation | NOT RUN | Client flow not reached |
| Confirm once/idempotency and atomic v2 update | NOT RUN | Client flow not reached |
| Provider credential/API boundaries | NOT RUN | Not exercised through the browser |

## Issues

No reproducible product issue was confirmed in the exercised provider states. Required coverage gaps above prevent a PASS verdict.

## Additional Evidence

- [desktop-provider-initial.png](screenshots/desktop-provider-initial.png)
- [desktop-provider-project-v1.png](screenshots/desktop-provider-project-v1.png)
- [desktop-provider-corrected-proposal.png](screenshots/desktop-provider-corrected-proposal.png)
- [app.log](app.log)

## Cleanup

Browser session closed and port 3000 verified free after the run.

## Recheck

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Verdict** | **PASS** |
| **App URL** | http://127.0.0.1:3103 |
| **Runtime** | Fresh production build (`npm run build` + `next start`) |
| **Scope** | Previously missing customer-change browser checks only |
| **Defects** | **0** |

| Check | Result | Evidence |
|-------|--------|----------|
| Provider refresh restores the current project, analysis, edited proposal, and active customer link | PASS | [recheck-provider-refresh-with-link.png](screenshots/recheck-provider-refresh-with-link.png) |
| Resending after a customer change request creates a second link and invalidates the old link | PASS | New second-send link: [recheck-provider-resent-success.png](screenshots/recheck-provider-resent-success.png); old link returns 404: [recheck-old-link-invalid-after-resend.png](screenshots/recheck-old-link-invalid-after-resend.png) |
| Customer page at 390×844 has no horizontal overflow | PASS | `innerWidth=390`, `clientWidth=375`, `scrollWidth=375`, `horizontalOverflow=false`; [recheck-client-first-mobile-390x844.png](screenshots/recheck-client-first-mobile-390x844.png) |
| Blank change reason is rejected | PASS | Inline alert says `请填写需要修改的内容`, and no action request is sent: [recheck-client-empty-reason-after-visible-click.png](screenshots/recheck-client-empty-reason-after-visible-click.png) |
| Customer can request changes with a reason | PASS | Reason submitted and page reports that the provider must revise and resend: [recheck-client-requested-changes.png](screenshots/recheck-client-requested-changes.png) |
| Provider sees the customer's reason, changes the proposal, and resends | PASS | Reason visible: [recheck-provider-saw-change-reason.png](screenshots/recheck-provider-saw-change-reason.png); revised delivery date `2026-07-21` and second link: [recheck-provider-resent-success.png](screenshots/recheck-provider-resent-success.png) |
| Customer can review and confirm the resent proposal | PASS | Second send shows `2026-07-17 → 2026-07-21`, `¥8,000 → ¥10,000`, and `¥4,000 → ¥6,000`: [recheck-new-link-before-confirm.png](screenshots/recheck-new-link-before-confirm.png); confirmation shows `新方案已生效`: [recheck-client-confirmed-success.png](screenshots/recheck-client-confirmed-success.png) |
| Project updates atomically to the new scope, date, total, and balance | PASS | Provider shows v2, `单版本落地页，增加一组 A/B 测试`, `2026-07-21`, `¥10,000`, and balance `¥6,000`: [recheck-provider-final-v2.png](screenshots/recheck-provider-final-v2.png) |
| Repeating confirmation does not update the project twice | PASS | A second browser with the stale pre-confirm page receives HTTP 409 and `客户链接已使用或已失效`; provider remains v2: [recheck-client-duplicate-confirm.png](screenshots/recheck-client-duplicate-confirm.png), [recheck-provider-final-v2.png](screenshots/recheck-provider-final-v2.png) |

No JavaScript page errors were observed in the completed flow. All `agent-browser` sessions were closed, the service was stopped, and ports 3000, 3102, and 3103 were verified free.
