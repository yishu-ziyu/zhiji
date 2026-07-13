# Browser Exploratory Report

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 19:24 CST |
| **App URL** | http://localhost:3000 |
| **Session** | `opc-delivery-qa`, `opc-reject-qa`, `opc-mobile-qa`, Playwright Chromium |
| **Scope** | Provider/client bilateral commitment flow, empty states, edit/resend persistence, actor ownership, required notes, mobile layout |

## Verdict

**PASS (recheck 2026-07-13)** — ISSUE-001 is fixed. Both required-note failures are visible beside their fields and exposed through accessible error semantics.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

## Checks

| Check | Result | Evidence |
|-------|--------|----------|
| Empty provider input shows an error | PASS | [empty-input-error.png](screenshots/empty-input-error.png) |
| Provider edits are retained when first sent | PASS | [edited-before-send.png](screenshots/edited-before-send.png), [after-send.png](screenshots/after-send.png) |
| Provider cannot perform client-owned confirm/accept actions | PASS | [after-send.png](screenshots/after-send.png), [pw-provider-delivered.png](screenshots/pw-provider-delivered.png) |
| Client request-changes requires a note | PASS (recheck) | [recheck-request-change-error.png](screenshots/recheck-request-change-error.png) |
| Requested changes and note reach provider | PASS | [provider-change-requested.png](screenshots/provider-change-requested.png) |
| Provider edits survive update-and-resend and reach same client link | PASS | [pw-provider-after-resend.png](screenshots/pw-provider-after-resend.png), [pw-client-after-resend.png](screenshots/pw-client-after-resend.png) |
| Client confirm → provider deliver ownership | PASS | [pw-client-confirmed.png](screenshots/pw-client-confirmed.png), [pw-provider-delivered.png](screenshots/pw-provider-delivered.png) |
| Client reject requires a note | PASS (recheck) | [recheck-reject-error.png](screenshots/recheck-reject-error.png) |
| 390×844 provider/client layouts remain usable | PASS | [mobile-provider.png](screenshots/mobile-provider.png), [mobile-client.png](screenshots/mobile-client.png) |
| Browser console/runtime errors in exercised pages | PASS | No application exceptions observed; only React DevTools/HMR development messages |

## Issues

### ISSUE-001: Required-note failures are silent on the client page

**Status: RESOLVED in recheck on 2026-07-13.** Original failure evidence is retained below.

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | UX / form validation |
| **URL** | `/c/[token]` |
| **Repro Video** | N/A |

**Expected**

Submitting “要求修改” or “拒收” with a blank required note should show a visible, actionable validation message next to the field.

**Observed**

The API correctly returns `400` (`请填写修改说明` / `请填写拒收说明`), but the rendered page remains unchanged and displays no error, leaving the client unsure whether the click worked.

**Evidence**

1. Blank request-changes submission leaves the pending page unchanged: [pw-change-empty-note.png](screenshots/pw-change-empty-note.png).
2. Blank reject submission leaves the delivered page unchanged: [client-reject-empty-note.png](screenshots/client-reject-empty-note.png).
3. Corresponding `400` bodies: [api-client-invalid-actions.txt](api-client-invalid-actions.txt).

## Notes

- Provider list UI intentionally shows the customer link after send; token redaction was assessed against the provider list API, not this UI.
- Playwright confirmed a resend retained `QA 改版原型 v4` and the edited acceptance criteria at the same client URL.

## Recheck — 2026-07-13

Rechecked only ISSUE-001 against a freshly started real Next.js application.

| Check | Result | Runtime evidence |
|-------|--------|------------------|
| Blank “要求修改” note | PASS | `请填写修改说明` is visible 14 px below the field; the textbox has `aria-describedby="client-note-error"`, and that element has `role="alert"`. [Screenshot](screenshots/recheck-request-change-error.png) |
| Blank “拒收” note | PASS | `请填写拒收说明` is visible 14 px below the field; the textbox has `aria-describedby="client-note-error"`, and that element has `role="alert"`. [Screenshot](screenshots/recheck-reject-error.png) |
| Valid request-changes regression | PASS | HTTP `200`; persisted state `client_requested_changes` |
| Valid confirm regression | PASS | HTTP `200`; persisted state `client_confirmed` |
| Valid provider deliver regression | PASS | HTTP `200`; persisted state `provider_delivered` |
| Valid reject regression | PASS | HTTP `200`; persisted state `client_rejected` |

**Recheck verdict: PASS.**
