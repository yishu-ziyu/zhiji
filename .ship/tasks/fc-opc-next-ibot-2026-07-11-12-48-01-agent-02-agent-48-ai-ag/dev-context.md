# Dev Context - FC-OPC iBot 2026

> Generated after Stories 0-7 implementation
> Task: fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag

## TEST_CMD

```bash
npx next build   # TypeScript + build validation
```

## CODE_CONDUCT

- No hardcoded secrets; LLM keys read from env vars
- All API routes return proper HTTP status codes and error messages
- Client components use `"use client"` directive
- Shared components in `shared/` directory, imported via `@/` alias

## Per-Story Patterns

### Story 0: Project Scaffolding
- Next.js 16 + React 19 + TypeScript 5
- shadcn/ui with base-nova style
- Dark theme via CSS variables in globals.css
- No external font dependencies (Google Fonts blocked)

### Story 1: LLMAdapter
- File: `shared/llm/adapter.ts`
- Pattern: single `complete()` function, env-driven config
- Error handling: AbortSignal timeout + friendly error messages
- Provider: Anthropic Messages API (`/v1/messages`)

### Stories 2-6: Frontend + API
- Route handlers: `app/api/<track>/<feature>/route.ts`
- Pattern: validate input → call LLMAdapter → parse JSON → return Response.json
- JSON parsing: `lastIndexOf("{")` to handle LLM thinking blocks
- Frontend: Client components with `"use client"`, shadcn/ui components

### Prompt Template Pattern
- File: `shared/llm/prompts/<feature>.ts`
- Export: `SYSTEM` constant + `build<Feature>Prompt()` function
- System prompt defines output format and constraints
- End with "只返回 JSON，不要额外文字"

## Environment Variables

```
LLM_BASE_URL=http://127.0.0.1:15721
LLM_API_KEY=<from ANTHROPIC_AUTH_TOKEN>
LLM_MODEL=step-3.7-flash
```

## Verified Routes

| Route | Method | Status |
|-------|--------|--------|
| / | GET | Static |
| /track/ecommerce | GET | Static |
| /track/efficiency | GET | Static |
| /api/llm/health | GET | Dynamic |
| /api/llm/completions | POST | Dynamic |
| /api/ecommerce/analyze | POST | Dynamic |
| /api/ecommerce/script | POST | Dynamic |
| /api/efficiency/minutes | POST | Dynamic |

## Known Limitations

1. Script API returns raw JSON (not structured) due to LLM thinking block
2. Only 1 LLM provider active (Anthropic proxy); StepFun quota exhausted
3. No database; all state in-memory
4. No multi-turn context; each request is stateless
