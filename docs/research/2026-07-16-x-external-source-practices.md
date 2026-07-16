# X external-source practices for product Agents

- Seat: G3 (Grok) · surface:65
- Assignment: `.ship/handoffs/ASSIGN-G3-x-external-sources.md`
- Date: 2026-07-16
- Scope: First-person X practices + official/docs cross-check for **what “external source” means** and how strong solo builders, efficiency teams, and quality startups authorize public web, browser, private accounts, feeds, databases, and action tools.
- Non-goals: No production code, no connector setup, no architecture selection.

## Product frame (already Owner-accepted)

| ID | Constraint |
|----|------------|
| D-10 | Internal retrieval auto; pre-authorized external auto + notify; sensitive/paid/unapproved confirm first |
| D-15 | Bounded automation: internal read/organize/draft auto; external send/delete/pay/sensitive/unapproved need confirm; auto output stays candidate |
| D-16 | Every retrieval keeps compact trace; only used results become project evidence; Owner confirms claims |
| D-17 | Authorize by source + scope + expiry + revoke; distinguish public search, connected private, inbound feeds, external actions |
| Q-25 | Still open: concrete external-source inventory and first-batch connectors |

This report is **input to Q-25**, not a product decision.

---

## Evidence grade legend

| Grade | Meaning |
|-------|---------|
| **V** Verified product behavior | Official docs / repo / product help |
| **O** Operator opinion | First-person X claim of shipped practice; not independently verified |
| **M** Marketing / vendor | Product announcement; verify against docs before design |

---

## Five source classes (Q-25 skeleton)

| Class | What it is | Typical auto? | Typical confirm? | Project knowledge |
|-------|------------|---------------|------------------|-------------------|
| **A. Public retrieval** | Web search, browser fetch, open docs/papers | Often auto after product-level allow | Paid APIs, high-cost, dark web, untrusted domains | Hits = candidates; promote only if used (D-16) |
| **B. Connected private read** | OAuth Gmail/Drive/Calendar/Slack/notes | After connect + scope grant; may auto-read with notify (D-10) | Expanding scopes; PII-heavy folders; new accounts | Snapshots/ids with source account + time |
| **C. Inbound feeds** | Webhooks, email rules, RSS, calendar push | Auto ingest as raw events if channel authorized | First-time channel; high-volume spam | Raw event log first; evidence only if cited |
| **D. Enterprise / DB** | SaaS admin, SQL, CRM | Rarely auto without admin policy | Always for write/delete; often for bulk read | Strong audit; least privilege |
| **E. State-changing external actions** | Send email, create event, post, pay, delete | **Never** under D-15 without confirm | Always for send/delete/pay | Action + result event, not silent |

---

## Pattern catalog (X + verification)

### P1 · Permission modes / tiered auto-run (coding agents)

| Field | Content |
|-------|---------|
| X signals | Builders discuss Claude Code approval fatigue; auto vs manual; deny lists for curl/network ([post:14] SeijinJung *O* claims require_approval list; industry chatter). Cursor users report Auto-run / Auto-review / allowlist / sandbox ([forum posts] **O**/community). |
| Verified | **Claude Code permission modes** (official): default = reads only without ask; `acceptEdits` auto file edits + limited FS cmds; `plan` research without edit; `auto` long runs with classifier; `dontAsk` pre-approved only; `bypassPermissions` isolated containers only. Protected paths never auto-approved in most modes. Docs: https://code.claude.com/docs/en/permission-modes · https://code.claude.com/docs/en/permissions · grade **V** |
| Auto | Read / (mode-dependent) local edits |
| Confirm | Shell, network, out-of-scope paths, deny/ask rules, sensitive ops |
| Scope / expiry / revoke | Session mode switch; settings allow/deny rules; org managed settings |
| Audit | Permission prompts + user approval trail; auto mode still logs classifier path |
| Into knowledge | Code diffs are local workspace truth, not “project knowledge cards” |
| User burden | High in Manual; lower in acceptEdits/auto; dangerous modes explicit |
| Implication | Aligns **D-15**: read free, write/network gated. Product should expose mode language, not only binary “Agent on”. |

### P2 · App connectors + “ask before important actions” (ChatGPT-class products)

| Field | Content |
|-------|---------|
| X signals | Connector/OAuth complexity for agents is a common pain (Composio founder thread **M**/**O**). |
| Verified | OpenAI Help: **Apps / connectors** — ChatGPT can read and act in connected services; **app permissions** control when ChatGPT asks before using apps; default Important actions allows reading with ask before more sensitive actions. https://help.openai.com/en/articles/11487775-connectors-in-chatgpt · Apps SDK OAuth 2.1 / MCP auth · grade **V** |
| Auto | Read-oriented app use under “important actions” default |
| Confirm | Configurable; actions that change external state |
| Scope | Per-app OAuth scopes; workspace templates for org OAuth |
| Audit | Product-side confirmation UI; connector link status |
| Into knowledge | Chat-attached files/snippets; not a durable project evidence model by default |
| User burden | One OAuth per app; then permission policy |
| Implication | Supports **D-10/D-17**: connect once (source+scope), then runtime confirm for sensitive/paid/unapproved. |

### P3 · Per-user OAuth for multi-app agents (Composio AgentAuth)

| Field | Content |
|-------|---------|
| X | @KaranVaidya6 (Composio) introduces AgentAuth: OAuth/API keys across 250+ apps for agents on user behalf (2024-11-25) **M** — https://x.com/KaranVaidya6/status/1861037496295137314 |
| Verified | Composio docs: user-scoped connections; managed OAuth; custom auth config for scopes; tools act as that user. https://docs.composio.dev/docs/authentication · https://composio.dev/content/per-user-oauth-for-ai-agents · grade **V** (docs) / product claims **M** for scale numbers |
| Auto | Tool calls after user linked account |
| Confirm | Initial OAuth consent; product must still add HITL for sends |
| Scope / revoke | Per-user connection; dashboard disconnect; scopes in auth config |
| Audit | Connection monitoring dashboard (vendor claim) |
| User burden | Low for developers (managed OAuth); end-user still does per-app consent |
| Implication | Infrastructure pattern for **class B** private sources; does **not** replace D-15 action confirmation. |

### P4 · Least tool surface / avoid dumping full MCP catalogs

| Field | Content |
|-------|---------|
| X | @arbitdata: mounting MCP dumps entire tool surface each turn; need 1 of 13; `allowed_tools` ≠ context — be own MCP client (2026-07-14) **O** · @ScottShapiroUXD: exposing every tool confuses agent (2026-07-09) **O** · @aakashgupta: Workspace MCP measured ~142 tools / ~37k tokens; CLI skills avoid loading all defs (2026-03-05) **O** with measurements |
| Verified | Google Workspace CLI `gws` repo: Discovery-built CLI + agent skills + optional `gws mcp`; structured JSON. https://github.com/googleworkspace/cli · grade **V** for existence; token-tax numbers remain **O** unless remeasured |
| Auto | N/A (design of tool exposure) |
| Confirm | Fewer tools reduce accidental high-privilege tool selection |
| Implication | **D-17 scope** should include *which tools* of a connector are enabled, not only OAuth. Matches product need to separate read tools from send tools. |

### P5 · Task-scoped / expiring authority (startup & governance voices)

| Field | Content |
|-------|---------|
| X | @heyiamsaharsh: “AI agents should not keep yesterday's permissions for today's task… grant access per task, scope to one side effect, expire automatically” (2026-07-14) **O** · @Tahir_Mahmood: authority map ALLOW/CONSTRAIN/APPROVE/BLOCK + evidence required (2026-07-14) **O** · @LearnWithBrij: read-only search; draft-only email; approve before send/delete; audit trail (2026-07-10) **O** · @WorkOS / @mcpdemolive: AuthKit can scope agent access to a single tool inside a service (2026-07-15) **M**/**O** |
| Verified | Permit.io Access Request MCP + human approval pattern documented in third-party tutorial (HackerNoon / Permit) **C** industry writeup — not Permit primary source in this pass. Claude Code org controls + ask rules **V** as partial analog. |
| Implication | Strong alignment with **D-17 expiry + revoke** and **D-15** confirm for external side effects. Treat pure X posts as **opinion** until productized. |

### P6 · Solo operator: external content = higher model / human verify

| Field | Content |
|-------|---------|
| X | @kaostyl OpenClaw playbook: cron agents read web with stronger model only (prompt injection); human verifies sub-agent “done” claims (2026-02-13) **O** high-engagement first-person |
| Verified | Not a product; operational pattern only. Prompt-injection risk of web content is industry consensus (Anthropic auto-mode classifier mentions hostile content) **V** partial |
| Auto | Isolated cron sessions for research |
| Confirm | Human verification before user-facing announce |
| Into knowledge | File-based memory hierarchy (session/daily/thematic) — **O** pattern |
| Implication | For class **A** public retrieval: prefer on-demand + trace; do not auto-promote web text to confirmed knowledge (**D-16**). |

### P7 · Login / browser-acting agents (startup demos)

| Field | Content |
|-------|---------|
| X | @harveyhucal Altrina (YC W25): agents that log in and act — email, post, payments (2025-12-29) **M** demo |
| Verified | Not independently audited here. Treat as **class E** high risk. |
| Implication | If ever considered: always confirm, session-scoped credentials, hard revoke — never first batch for Q-25. |

### P8 · Human-in-the-loop frameworks

| Field | Content |
|-------|---------|
| X | @hackernoon / Permit Access Request MCP for LangGraph HITL (2025-06-30) **M**/tutorial |
| Verified | LangGraph interrupt / human approval is documented in LangGraph docs (general knowledge; not re-fetched this pass) — use as **pattern V** only after pin. |
| Implication | Product confirmation is a **first-class UI event**, not a prompt soft-ask. |

### P9 · Trace vs user-visible tool noise

| Field | Content |
|-------|---------|
| X | LangChain agent engineer: Slack thread hides non-HITL tool calls; full detail in traces (2026-07-16) **O** |
| Implication | Audit visibility (**D-16** trace) can be complete while Owner UI stays sparse; still show confirmation for external actions. |

---

## Source table (selected)

| ID | Author / product | Date | Type | Grade | URL / ID | Concrete behavior claimed |
|----|------------------|------|------|-------|----------|---------------------------|
| X1 | @heyiamsaharsh | 2026-07-14 | Opinion | O | post 2077121648051052635 | Per-task scoped access + auto expiry |
| X2 | @KaranVaidya6 / Composio | 2024-11-25 | Vendor+X | M | post 1861037496295137314 | AgentAuth multi-app OAuth for agents |
| X3 | @kaostyl | 2026-02-13 | Solo ops | O | post 2022109154446651855 | Isolated agents; human verify; external content = strong model |
| X4 | @LearnWithBrij | 2026-07-10 | Opinion | O | post 2075543008137912444 | Draft-only email; approve send/delete |
| X5 | @aakashgupta | 2026-03-05 | Builder analysis | O | post 2029409062367199414 | MCP tool-token tax; prefer CLI skills |
| X6 | @arbitdata | 2026-07-14 | Builder | O | post 2076940374874980473 | MCP full dump vs allowed_tools |
| X7 | @Tahir_Mahmood | 2026-07-14 | Governance | O | post 2077061308969525665 | ALLOW/CONSTRAIN/APPROVE/BLOCK authority map |
| V1 | Anthropic Claude Code | docs 2026 | Official | V | code.claude.com/docs/en/permission-modes | Tiered permission modes; default read-only auto |
| V2 | OpenAI ChatGPT apps | help 2026 | Official | V | help.openai.com … connectors-in-chatgpt | App permissions; ask before use |
| V3 | Composio docs | 2026 | Official | V | docs.composio.dev/docs/authentication | Per-user OAuth connections |
| V4 | Google Workspace CLI | repo 2026 | Official | V | github.com/googleworkspace/cli | Discovery CLI + skills + MCP for Gmail/Drive/Calendar |
| V5 | Cursor Auto-review | changelog 2026-05-29 | Official | V | cursor.com/changelog/auto-review | Allowlist / sandbox / classifier for Shell,MCP,Fetch |

---

## Cross-check vs Owner decisions

| Decision | Supported by field practice? | Tension |
|----------|------------------------------|---------|
| **D-10** pre-auth external auto + notify | ChatGPT “important actions” read default; Claude default read | Many solo builders still over-grant long-lived OAuth (**O** risk) |
| **D-15** confirm external side effects | Claude/Cursor confirm culture; Brij draft-only email **O**; ChatGPT app permissions **V** | Demo startups market full login automation (**M**) — reject as default |
| **D-16** trace + promote used only | Trace-vs-UI (LangChain **O**); no product auto-promotes search hits to fact | Builders often paste web into memory files without formal candidate status **O** |
| **D-17** source+scope+expiry+revoke | Task-scoped access **O**; WorkOS single-tool scope **M**; Composio disconnect **V** | Expiry is rarely default in consumer OAuth — product must add policy layer |
| **Q-25** first batch | Strong demand: **public web search**, **browser fetch**, **Gmail/Calendar/Drive-class private read**, **MCP/CLI tools**; actions last | Enterprise DB and payment should not be first batch |

---

## Implications for “what external source means” (options for Owner, not chosen)

1. **External** = anything outside project-local truth store (not “outside the internet only”).
2. Subtypes **must** be first-class: public · private-connected · feed · enterprise · action (D-17).
3. **Authorization object** should capture: source id, scopes (tools + data ranges), granted_at, expires_at, revocable, sensitivity/paid flags, last_used.
4. **Runtime policy**: internal free; pre-auth external free + toast; else confirm (D-10). Actions always confirm (D-15).
5. **Copy into project**: never whole mailbox; only cited snippets + URL/id + retrieval trace (D-16).
6. **User burden target**: one connect per source family; few permanent toggles; confirm only on side-effect / sensitive / paid / new scope.
7. **First-batch candidates (research recommendation only)**: (a) public web search already in product via AnySearch; (b) explicit browser fetch with domain allow; (c) optional one private read connector later — **not** send/pay. Implementation still paused under D-06.

---

## Failures / limits

- X sample is non-exhaustive; ranking favors English agent/tool discourse 2024–2026.
- Vendor star counts and “250+ apps” not re-audited.
- No login to third-party accounts; no connector setup.
- Claude/Cursor/OpenAI UIs may change labels; pin docs URLs when designing.

## Confidence

- **High** that tiered permissions + OAuth connect + confirm-on-write is the industry default for serious tools (**V** docs).
- **Medium** that task-scoped expiring grants will become UX default (strong **O**, weak **V**).
- **Low** on any single startup’s demo claims without independent audit.

## Next owner

G1: fold into Q-25 source map and Owner options.  
G2: ledger only; no production assign from this report alone.
