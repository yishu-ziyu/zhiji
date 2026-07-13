# Ecommerce Agent Code Map

## Runnable code stays in `app/`

Next.js App Router depends on the `app/` directory.

Do not move the route files unless the imports, tests, and route structure are updated together.

## Pages

- `app/track/ecommerce/page.tsx` renders the ecommerce track UI.
- `app/page.tsx` links to the ecommerce track card.

## APIs

- `app/api/ecommerce/analyze/route.ts` handles product analysis.
- `app/api/ecommerce/script/route.ts` handles script generation.

## Shared modules

- `shared/llm/analyze.ts` contains deterministic product profiles and ecommerce fallback logic.
- `shared/llm/prompts/analyze.ts` contains analysis prompt material.
- `shared/llm/prompts/script.ts` contains script prompt material.
- `shared/components/chat/ChatInterface.tsx` renders analysis and script result cards.

## Development boundary

The ecommerce track should remain runnable.

Efficiency work should not change ecommerce response fields or card rendering unless required by shared infrastructure.
