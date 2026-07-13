# Dev Context

## Test Command

`npm run test:unit && npm run lint && npm run build && npm run test:e2e`

## Test Seams

- Public domain seam: actor-aware `transition(from, to, actor)`.
- Repository seam: create/send/client-confirm/provider-deliver/client-accept.
- HTTP boundary: provider route rejects client-owned actions.
- Browser seam: provider page → token client page → provider page → client page.

## Code Conduct

TypeScript strict, existing App Router route handlers, Tailwind tokens from `app/globals.css`, deterministic fixture for demo reliability, no new dependency, no edits to the unrelated minutes-route worktree change.

## Pattern References

- `app/api/efficiency/commitments/route.ts`: mirror request validation, typed JSON responses, and Chinese errors.
- `shared/delivery/state-machine.test.ts`: keep behavior-focused Vitest tests beside pure modules.
- `app/track/efficiency/page.tsx`: preserve the existing single workbench and deterministic fixture entry, replacing only the obsolete single-role path.
- `components/ui/button.tsx` and `app/globals.css`: reuse installed UI primitives and theme tokens.

## Waves

1. Domain status ownership, cohort metrics, and in-memory repository.
2. Provider/client APIs and `/c/[token]` page; depends on Wave 1.
3. Provider workbench, copy, and demo docs; depends on Wave 2.
4. Playwright golden path and full regression; depends on all prior waves.

The latest acceptance source is `plan/locked-override.md`; it supersedes the older four-state design text.
