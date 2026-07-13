# Dev Context

## Test Command

```bash
npm run test:unit
npm run test:e2e
npm run build
```

## Test Seams

- Unit: `shared/delivery/state-machine.ts`, `metrics.ts`, `extract-mock.ts`
- API: `POST /api/efficiency/commitments` with `{ fixture: "dialog-01" }`
- E2E: gold script → accept → confirm → closed-loop rate visible

## Code Conduct

- Next.js App Router, client pages with `"use client"`
- Tailwind + shadcn components
- Chinese product copy
- localStorage persistence for demo state
- LLM via `shared/llm/adapter.ts` with mock fallback

## Pattern References

### Delivery domain
- Reference: `app/api/efficiency/minutes/route.ts` (adapter + mock fallback, not domain reuse)
- Mirror: complete/extractJson, never 500 on LLM fail
- Deviations: commitments schema, not minutes

### Efficiency UI
- Reference: prior `app/track/efficiency/page.tsx` kanban columns
- Mirror: select status change, dual track sidebar
- Deviations: delivery statuses, commitment review panel, metrics strip

## Waves completed

- Wave A: domain + vitest + fixture
- Wave B: extract-mock + commitments API
- Wave C: workbench UI + sidebar/home + AgentRuntime guard
- Wave D: E2E rewrite (in progress)
