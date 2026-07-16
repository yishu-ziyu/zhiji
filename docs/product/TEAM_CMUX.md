# cmux Live Team

Updated: 2026-07-16 · **live panel re-check after Owner deleted seats (S-136)**.  
Authoritative collaboration rules: `TEAM_OPERATING_MODEL.md`.  
**Verify with:** `cmux tree --workspace workspace:9` (disk roster must match panel).

## Live roster (workspace:9 · 2026-07-16 面板实况)

**Agent seats on panel: 8**（不含 Owner）

| Surface | Display name | Accountability |
|---|---|---|
| `surface:78` | 产品话事人1 | Continuous Owner discussion and product synthesis |
| `surface:63` | 产品话事人2 | Peer judgment, challenge, and durable product record |
| `surface:80` | 工程话事人1 | Architecture, engineering packets, technical decisions |
| `surface:65` | 工程话事人2 | Dispatch, dependencies, delivery progress, integration |
| `surface:77` | 全栈4 | Task-scoped research, implementation, runtime, or testing |
| `surface:64` | 全栈5 | Task-scoped research, implementation, runtime, or testing |
| `surface:75` | 全栈6 | Task-scoped research, implementation, runtime, or testing |
| `surface:74` | 全栈7 | Task-scoped research, implementation, runtime, or testing |

**Owner** is above the team (not a cmux agent seat).

## Reporting chain (Owner 定版 · 见 `TEAM_ORG_TUI.md`)

```
Owner
 └── 产品话事人1 + 产品话事人2     （Leader：产品讨论；收工程综合汇报）
      └── 工程话事人1 + 工程话事人2  （派发层：直接向两位产品 Leader 汇报）
           └── 全栈4 · 5 · 6 · 7   （实现层：向工程派发汇报；无能力边界；实现+清晰测试）
```

### Removed from panel (Owner deleted · no longer live)

| Was | Name |
|---|---|
| `surface:82` | 全栈1 |
| `surface:83` | 全栈2 |
| `surface:79` | 全栈3 |

Old handoffs may still mention 全栈1–3; they are **not** live seats.

## Headcount

| Layer | Count |
|---|---|
| Owner | 1（你） |
| 产品话事人 | 2 |
| 工程话事人 | 2 |
| 全栈 | 4 |
| **Agent 席合计** | **8** |
| **含 Owner** | **9** |

HARD STOP S-135 still applies until Owner releases.

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

## Active records

- Product truth: `.ship/tasks/first-user-real-entry-015/control/PRODUCT_DEV_TASKS.md` — Product Lead 2
- Delivery board: `.ship/tasks/first-user-real-entry-015/control/MVP_FAST_INBOX.md` — Engineering Lead 2 (when not STOP)
- Stop order: `.ship/handoffs/OWNER-HARD-STOP-S-135.md`
