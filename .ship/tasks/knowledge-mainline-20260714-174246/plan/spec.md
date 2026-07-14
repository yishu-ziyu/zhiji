# plan/spec.md - knowledge mainline

## Goal

Knowledge loop is the only mainline product for FC-OPC efficiency track demo.

## Acceptance (must)

1. Search returns source-backed cards  
2. Add card persists across process restart  
3. Action status advances and persists  
4. Home/sidebar main CTA → knowledge  

## Out of scope

Customer-change pitch, WeChat sync, vector DB, multi-tenant.

## Tests

- Unit: existing `shared/knowledge/*`  
- E2E: add knowledge gold path (next)

## Done when

PRD A1–A3 checked on a clean run + units green.
