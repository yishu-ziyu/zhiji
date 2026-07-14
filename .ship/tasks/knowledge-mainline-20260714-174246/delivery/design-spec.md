# Engineering design-spec - knowledge mainline

## Engineering Goal

Ship a **demoable knowledge loop** at `/track/knowledge` that passes PRD A1–A3, with optional A4–A5. Customer-change code stays but is not the pitch.

## Product Context

- Primary user: knowledge worker (founder first)
- Loop: search (source-backed) → cards → actions with status
- References: Perplexity / Notion attributes / Linear; visual: DESIGN.md

## Requirements

1. Deterministic store for cards/actions (JSON under `data/knowledge/`)
2. Search with source filters
3. Capture tabs: note / minutes / dissect
4. Action board status transitions
5. MCP-style HTTP tools at `/api/knowledge/mcp`
6. UI and home CTA prioritize knowledge

## Acceptance Criteria

Copy of PRD A1–A5. Engineering DONE for submit requires A1–A3 + green unit tests.

## Constraints

- No WeChat private-chat scrape
- No claiming full MCP stdio server
- No box-shadow / indigo SaaS restyle against DESIGN.md without reason
- Secrets never in repo

## Source Artifacts

- `product/00-product-type.json`
- `product/00b-scope-challenge.md`
- `product/08-prd.md`
- `docs/PRD-iBot-Knowledge-Efficiency-Agent.md` (mirror)
- Code: `shared/knowledge/*`, `app/api/knowledge/*`, `app/track/knowledge/*`

## Next eng stories (ordered)

1. Playwright gold path for A1–A3  
2. CI-stable offline path (force offline in test env)  
3. Demo script doc 180s aligned to gold script  
