# cmux Live Team

Updated: 2026-07-16. The authoritative collaboration rules are in `TEAM_OPERATING_MODEL.md`.

## Live roster

| Surface | Display name | Provider | Accountability |
|---|---|---|---|
| `surface:78` | 产品话事人1 | GPT | Continuous Owner discussion and product synthesis |
| `surface:63` | 产品话事人2 | Grok | Peer judgment, challenge, and durable product record |
| `surface:80` | 工程话事人1 | GPT | Architecture, engineering packets, technical decisions |
| `surface:65` | 工程话事人2 | Grok | Dispatch, dependencies, delivery progress, integration |
| `surface:82` | 全栈1 | GPT | Task-scoped research, implementation, runtime, or testing |
| `surface:83` | 全栈2 | GPT | Task-scoped research, implementation, runtime, or testing |
| `surface:79` | 全栈3 | Grok | Task-scoped research, implementation, runtime, or testing |
| `surface:77` | 全栈4 | Grok | Task-scoped research, implementation, runtime, or testing |
| `surface:64` | 全栈5 | Grok | Task-scoped research, implementation, runtime, or testing |
| `surface:75` | 全栈6 | Grok | Task-scoped research, implementation, runtime, or testing |
| `surface:74` | 全栈7 | Grok | Task-scoped research, implementation, runtime, or testing |

Owner is above the team. Product Leads are peers. Engineering Leads are jointly accountable and jointly receive employee information. Engineering Lead 1 synthesizes research, architecture, technical decisions, and acceptance meaning. Engineering Lead 2 synthesizes assignment, dependencies, integration, and READY evidence. Blockers go to both. Their product-facing summary is jointly owned.

## Verify the live team

```sh
cmux tree --workspace workspace:9
cmux read-screen --surface surface:<id> --lines 120
```

Send text safely and then press Enter:

```sh
cmux send --surface surface:<id> '<message>'
cmux send-key --surface surface:<id> enter
```

Messages containing Markdown backticks must be passed as safely single-quoted text. Unquoted backticks execute in the caller shell.

## Active records

- Product truth and unanswered questions: `.ship/tasks/first-user-real-entry-015/control/PRODUCT_DEV_TASKS.md` — Product Lead 2 owns updates.
- Technical decisions and acceptance meaning — Engineering Lead 1 owns the engineering view.
- Delivery progress: `.ship/tasks/first-user-real-entry-015/control/MVP_FAST_INBOX.md` — Engineering Lead 2 owns live updates; both Engineering Leads review and synthesize it.
- Exact work: current `.ship/handoffs/ASSIGN-*.md` — assigned engineer owns evidence, Engineering Lead 2 owns status.

Old G-number and secretary documents may explain history but do not define current authority.
