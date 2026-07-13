# Efficiency Agent Direction

This folder is the workspace for the selected hackathon direction.

The current competition focus is the one-person company efficiency agent.

The product should help a founder turn messy meeting text into clear tasks, visible progress, and next meeting preparation.

## Selected subtrack

Meeting minutes plus task tracking plus project delivery reminders.

## Why this direction

The current project already has a working minutes page and a Kanban board.

This direction fits the hackathon scoring better because the judge can see the value quickly.

It also fits the user's strength in product thinking, knowledge management, and Agent workflow design.

## Main route

- Page: `app/track/efficiency/page.tsx`
- Minutes API: `app/api/efficiency/minutes/route.ts`
- Shared chat renderer: `shared/components/chat/ChatInterface.tsx`

## Demo promise

Paste a meeting transcript.

The Agent extracts decisions and action items.

Action items become board cards.

The board shows what to do next and what is blocked.
