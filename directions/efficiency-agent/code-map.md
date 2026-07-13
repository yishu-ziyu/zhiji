# Efficiency Agent Code Map

## Runnable code stays in `app/`

Next.js App Router depends on the `app/` directory.

This folder is a planning and direction workspace.

## Pages

- `app/track/efficiency/page.tsx` renders the efficiency track UI.
- It owns the current task state, sample data, minutes submission, and Kanban display.

## API

- `app/api/efficiency/minutes/route.ts` handles transcript parsing and structured minutes generation.
- The route also contains deterministic post-processing logic for dates, priorities, assignees, and duplicates.

## Shared modules

- `shared/components/chat/ChatInterface.tsx` renders minutes result cards.
- `shared/types/common.ts` defines `Message` and `EfficiencyMode`.
- `shared/llm/adapter.ts` wraps model calls.

## Refactor candidates

These are candidates only.

Do not move them until tests are in place.

1. Extract task types and mock tasks from `app/track/efficiency/page.tsx`.
2. Extract `KanbanBoard` and `TaskCard` from `app/track/efficiency/page.tsx`.
3. Extract minutes rules from `app/api/efficiency/minutes/route.ts`.
