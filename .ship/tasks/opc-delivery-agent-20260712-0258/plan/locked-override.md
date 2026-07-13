# Locked Product Override — 2026-07-13

This file supersedes the old four-state and `confirmed / periodNew` sections in `product/08-prd.md`, `plan/spec.md`, and `plan/plan.md`.

- Wedge: semi-formal client alignment → bilateral delivery commitment slip.
- Input: Web paste only; never claim WeChat integration.
- States: `draft → pending_client_confirm → client_confirmed | client_requested_changes → provider_delivered → client_accepted | client_rejected`.
- Ownership: provider creates/sends/delivers; client confirms/requests changes/accepts/rejects from `/c/[token]` without login.
- Provider APIs must never set client-owned states.
- Metrics: cohort-safe candidates only; reject period-confirmed / period-new.
- Golden path: fixture → draft → send/link → client confirm → provider deliver → client accept.
- Out: meeting-minutes-first framing, calendar aggregation, ecommerce revival, legal e-signature claims, native apps.

Acceptance seams: actor-aware state-machine unit tests, provider authorization API check, and Playwright golden path across provider and client pages.
