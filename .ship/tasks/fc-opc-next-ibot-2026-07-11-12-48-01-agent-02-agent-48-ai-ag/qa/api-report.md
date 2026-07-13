# API Exploratory Report

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 15:08 UTC |
| **Base URL** | http://localhost:3101 |
| **Scope** | Customer-change provider and guest-link API flow |
| **Verdict** | **FAIL — 12/13 requested checks passed** |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 0 |
| **Total** | **1** |

## Requested checks

| Check | Result | Evidence |
|-------|--------|----------|
| Seed demo project v1 | PASS — 201; scope, date, ¥8,000 total, ¥4,000 paid and ¥4,000 final payment are correct | [api-seed.txt](api-seed.txt) |
| Provider authorization | PASS — missing secret returns 400; wrong secret returns 403 | [api-provider-auth-missing.txt](api-provider-auth-missing.txt), [api-provider-auth-wrong.txt](api-provider-auth-wrong.txt) |
| Fixture analyze | PASS — scope is identified; delivery and price remain undecided; all three evidence slices exactly match the source text | [api-fixture-analyze.txt](api-fixture-analyze.txt), [api-fixture-quote-validation.txt](api-fixture-quote-validation.txt) |
| Send proposal | PASS — revision 1, v2 proposal, 2026-07-20, ¥10,000 total and ¥6,000 final payment | [api-send.txt](api-send.txt) |
| Get client view | PASS — returns old/new versions and `identityAssurance: guest_link` | [api-get-client.txt](api-get-client.txt) |
| Blank request-change note | PASS — 400 `请填写修改说明`; proposal remains pending | [api-request-changes-blank.txt](api-request-changes-blank.txt), [api-get-client-after-blank.txt](api-get-client-after-blank.txt) |
| Request changes | PASS — status becomes `changes_requested` and note is retained | [api-request-changes.txt](api-request-changes.txt) |
| Resend invalidates old link | PASS — revision becomes 2, new token is issued, old token returns 409, new token returns 200 | [api-resend.txt](api-resend.txt), [api-old-link-after-resend.txt](api-old-link-after-resend.txt), [api-new-link-after-resend.txt](api-new-link-after-resend.txt) |
| Confirm once | PASS — project changes atomically to v2, 2026-07-20 and ¥6,000 final payment | [api-confirm-once.txt](api-confirm-once.txt), [api-provider-get-after-confirm.txt](api-provider-get-after-confirm.txt) |
| Replay rejection | PASS — second confirmation returns 409 and does not increment again | [api-confirm-replay.txt](api-confirm-replay.txt), [api-provider-get-after-confirm.txt](api-provider-get-after-confirm.txt) |
| Malformed JSON | **FAIL** — returns 500 generic service-unavailable response instead of a client-input 400 | [api-malformed-json.txt](api-malformed-json.txt) |
| Wrong types | PASS — string `totalPriceMinor` returns 400 `总价格式错误` | [api-wrong-type.txt](api-wrong-type.txt) |
| Invalid actions | PASS — provider and client invalid actions return 400; provider-side confirm is explicitly rejected | [api-invalid-provider-action.txt](api-invalid-provider-action.txt), [api-invalid-client-action.txt](api-invalid-client-action.txt), [api-provider-confirm-forbidden.txt](api-provider-confirm-forbidden.txt) |

## Issues

### ISSUE-001: Malformed JSON is reported as an internal service failure

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | Error response / input validation |
| **Endpoint** | POST /api/efficiency/changes |
| **Evidence** | [api-malformed-json.txt](api-malformed-json.txt) |

**Expected**

Malformed JSON is invalid client input, so the API should return HTTP 400 with a clear, stable JSON error.

**Observed**

The endpoint returns HTTP 500 with `{"error":"服务暂时不可用，请稍后重试"}`. This misclassifies a deterministic request error as a transient server outage.

**Reproduction**

```bash
curl -sv -X POST \
  -H 'Content-Type: application/json' \
  --data-binary '{"action":' \
  http://localhost:3101/api/efficiency/changes
```

---

## Additional spec check

The provider endpoint cannot perform client confirmation: it returns 400 `服务方接口不能执行客户确认`. Evidence: [api-provider-confirm-forbidden.txt](api-provider-confirm-forbidden.txt).

## [QA] Report Card

| Field | Value |
|-------|-------|
| Status | FINDINGS |
| Summary | 12/13 requested API checks passed; malformed JSON is misclassified as HTTP 500 |
| Matt upstream read | `vendor/mattpocock-skills/skills/engineering/domain-modeling/SKILL.md` |

### Metrics

| Metric | Value |
|--------|-------|
| Criteria passed | 12/13 |
| Issues beyond spec | 1 |

### Artifacts

| File | Purpose |
|------|---------|
| `qa/api-report.md` | API verdict and reproducible finding |
| `qa/api-*.txt` | Full curl request/response traces and checks |
| `qa/api-app.log` | Port 3101 application log |

### Next Steps

1. **Fix failure** — map JSON parse failures to a 400 response.
2. **Re-QA** — rerun the malformed JSON check and a happy-path regression.

## Recheck

| Field | Value |
|-------|-------|
| **Date** | 2026-07-13 |
| **Verdict** | **PASS — 13/13 requested checks passed** |
| **Base URL** | `http://127.0.0.1:3102` |
| **Start command** | `npm run dev -- --port 3102` |
| **Test method** | Real Next.js application exercised with `curl -sv`; status and JSON bodies asserted with `jq` |
| **Cleanup** | Tracked PID stopped; port 3102 verified free ([api-recheck-cleanup.txt](api-recheck-cleanup.txt)) |

The original malformed-JSON defect is resolved. Both the provider route and client-token route now return HTTP 400 with `{"error":"请求内容不是合法的 JSON"}`. No product defect was reproduced in the requested 13-check API scope.

Execution note: an initial attempt ran after its background dev process had already been reclaimed, so every request returned connection refused. That infrastructure-invalid attempt was discarded, overwritten by the successful persistent-server evidence below, and is not counted in the 13/13 verdict.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Seed demo project v1 | PASS — 201; v1, scope, date, ¥8,000 total, ¥4,000 paid and ¥4,000 final payment are correct | [api-recheck-seed.txt](api-recheck-seed.txt) |
| 2 | Provider authorization | PASS — missing secret is 400; wrong secret is 403 with stable JSON errors | [api-recheck-auth-missing.txt](api-recheck-auth-missing.txt), [api-recheck-auth-wrong.txt](api-recheck-auth-wrong.txt) |
| 3 | Fixture analyze | PASS — scope detected; date and price undecided; all evidence offsets slice to the exact source quotes | [api-recheck-fixture-analyze.txt](api-recheck-fixture-analyze.txt) |
| 4 | Send proposal | PASS — revision 1, pending status, v2, 2026-07-20, ¥10,000 total and ¥6,000 final payment | [api-recheck-send.txt](api-recheck-send.txt) |
| 5 | Get client view | PASS — old/new versions returned with `identityAssurance: guest_link` | [api-recheck-get-client.txt](api-recheck-get-client.txt) |
| 6 | Blank request-change note | PASS — 400 `请填写修改说明`; follow-up GET remains `pending_client` | [api-recheck-request-blank.txt](api-recheck-request-blank.txt), [api-recheck-get-after-blank.txt](api-recheck-get-after-blank.txt) |
| 7 | Request changes | PASS — status becomes `changes_requested`; note is retained | [api-recheck-request-changes.txt](api-recheck-request-changes.txt) |
| 8 | Resend invalidates old link | PASS — revision 2; old link is 409; new link is 200 | [api-recheck-resend.txt](api-recheck-resend.txt), [api-recheck-old-link.txt](api-recheck-old-link.txt), [api-recheck-new-link.txt](api-recheck-new-link.txt) |
| 9 | Confirm once | PASS — one request atomically applies v2, 2026-07-20 and ¥6,000 final payment; provider read agrees | [api-recheck-confirm-once.txt](api-recheck-confirm-once.txt), [api-recheck-provider-after-confirm.txt](api-recheck-provider-after-confirm.txt) |
| 10 | Replay rejection | PASS — replay is 409; version and history remain unchanged | [api-recheck-confirm-replay.txt](api-recheck-confirm-replay.txt), [api-recheck-provider-after-replay.txt](api-recheck-provider-after-replay.txt) |
| 11 | Malformed JSON | PASS — provider and client-token POST routes both return 400 with the expected JSON error | [api-recheck-malformed-provider.txt](api-recheck-malformed-provider.txt), [api-recheck-malformed-client.txt](api-recheck-malformed-client.txt) |
| 12 | Wrong types | PASS — string `totalPriceMinor` returns 400 `总价格式错误` | [api-recheck-wrong-type.txt](api-recheck-wrong-type.txt) |
| 13 | Invalid actions | PASS — provider/client invalid actions are 400; provider-side confirm is explicitly rejected | [api-recheck-invalid-provider.txt](api-recheck-invalid-provider.txt), [api-recheck-invalid-client.txt](api-recheck-invalid-client.txt), [api-recheck-provider-confirm.txt](api-recheck-provider-confirm.txt) |

Summary assertion output: [api-recheck-results.txt](api-recheck-results.txt).

### [QA] Recheck Report Card

| Field | Value |
|-------|-------|
| Status | DONE |
| Summary | 13/13 requested API checks passed; original malformed-JSON failure is fixed |
| Matt upstream read | `vendor/mattpocock-skills/skills/engineering/domain-modeling/SKILL.md` |

| Metric | Value |
|--------|-------|
| Criteria passed | 13/13 |
| Real defects in requested scope | 0 |
