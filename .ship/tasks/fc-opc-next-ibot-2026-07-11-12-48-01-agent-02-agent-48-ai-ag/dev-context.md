# Dev Context

## Current Spec

`.ship/tasks/fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag/plan/customer-change-spec.md`

## Test Command

```bash
npm run test:unit
npm run test:e2e
npm run lint
npm run build
```

## Test Seams

- Public domain functions in `shared/delivery/change.ts`: version checks, token expiry, replay protection, evidence position validation and all-or-nothing project update.
- HTTP routes under `/api/efficiency/changes`: request validation and role separation.
- User-visible pages: `/track/efficiency` and `/c/[token]` through Playwright.

The user confirmed the full visible path on 2026-07-13.

## Code Conduct

- Direct ordinary Chinese in all user-visible text; no industry shorthand or invented labels.
- Reuse the current Next.js route, in-memory repository, client-page and deterministic-fixture patterns.
- Do not add dependencies.
- Validate all request bodies and evidence positions on the server.
- Explicit fixture only; never silently replace a failed model call with fixture data.
- Keep unrelated dirty-tree changes untouched.

## Pattern References

- `shared/delivery/repository.ts`
  - Why analogous: current in-memory store, immutable copies and guarded state changes.
  - Mirror: global development store, `structuredClone`, synchronous guarded updates.
  - Deviation: new link is bound to project and proposal versions and becomes single-use.
- `app/api/efficiency/slips/route.ts`
  - Why analogous: current provider API validation and error responses.
  - Mirror: validate at the route, keep domain changes in the shared module.
  - Deviation: new API requires a project-scoped provider secret.
- `app/c/[token]/ClientActions.tsx`
  - Why analogous: mobile client action page and request-change validation.
  - Mirror: responsive card, polling and accessible error text.
  - Deviation: compare old and new versions; explicitly state that the guest link does not verify identity.
- `tests/e2e/app.spec.ts`
  - Why analogous: second browser context, mobile viewport and role-specific full flow.
  - Mirror: assert visible business outcomes through pages and public HTTP routes.

No root `DESIGN.md` exists. Reuse `app/globals.css`, existing cards, buttons and spacing.

## Story And Dependency

One sequential story: current project → analyze customer message → service provider edits → customer acts → project and payment state update. All touched UI, API and domain files share this path, so parallel implementation would create file conflicts.

## Matt Upstream Read

- `/Users/mahaoxuan/Developer/yishuship/vendor/mattpocock-skills/skills/engineering/implement/SKILL.md`
- `/Users/mahaoxuan/Developer/yishuship/vendor/mattpocock-skills/skills/engineering/tdd/SKILL.md`
