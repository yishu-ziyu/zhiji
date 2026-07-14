# Scope challenge - knowledge mainline freeze

**Task:** `knowledge-mainline-20260714-174246`  
**Date:** 2026-07-14  
**Owner:** User (product) + Grok (artifacts)

## Candidate requirements

| Requirement | Owner | Keep / Cut / Defer | Reason |
|---|---|---|---|
| Source-backed knowledge search | User | Keep | Core scene; Perplexity-like |
| Durable knowledge cards (tags, source, time) | User | Keep | Notion-like attributes, not full wiki |
| Action items with status machine | User | Keep | Linear-like; closes loop |
| Paste meeting → cards + actions | User | Keep | Cold-start feed for library |
| Goal dissect → actions | User | Keep | Secondary capture |
| MCP HTTP tool surface | Engineering | Keep (thin) | Show agent tools; do not overclaim protocol |
| DESIGN.md visual system on knowledge UI | User | Keep | Taste; not the product itself |
| Customer-change delivery demo as main pitch | Prior task | **Cut from mainline** | User froze knowledge as main |
| Personal WeChat full chat sync | Prior debate | **Cut** | No clean API; body-memory + entry gap |
| Full Notion clone / block editor | Temptation | **Cut** | Explicit non-goal |
| Vector DB / Pinecone | Engineering | **Defer** | Keyword + soft fallback enough for demo |
| Multi-user auth / permissions | Future | **Defer** | Single-user hackathon |
| True stdio MCP server process | Engineering | **Defer** | HTTP tools list+invoke is enough to claim "tool surface" |
| E2E Playwright for knowledge golden path | Engineering | Keep (next) | Required testing seam |
| Ecommerce track | Prior | **Cut** | Already out |

## Must-ship this cycle (to submit)

1. One demo path: **search → source-backed cards → advance one action status** (with optional capture).
2. Written PRD with Acceptance / Success Metrics / Kill / Gold script.
3. CONTEXT + product-type aligned to knowledge (this freeze).
4. Honest Agent story: what needs LLM vs deterministic store.

## Explicit non-goals

- Not a CRM, not a contract system, not WeChat bot.
- Not "second Notion".
- Not proving OPC delivery ops in the pitch main path.
- Not production multi-tenant knowledge base.

## Deleted or deferred (do not reintroduce without updating this file)

- Customer-change as 主 demo / 主叙事
- WeChat deep integration
- Full vector DB marketing
