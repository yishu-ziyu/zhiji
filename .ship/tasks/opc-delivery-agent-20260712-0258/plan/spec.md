# Spec — OPC Delivery Ops Agent

> **2026-07-13 override:** use `plan/locked-override.md` as the current acceptance contract. Its dual-role statuses, client token page, and cohort-safe metrics supersede conflicting sections below.

**Task:** `opc-delivery-agent-20260712-0258`  
**Branch:** `feature/ai-agent-platform`  
**HEAD at design:** `f97c597cf723ff19ffc04dafa1bf2edfa56e3c15`  
**Scope mode:** full  
**Deadline:** submit 2026-07-18, pitch 2026-07-19

---

## 1. Goal

Transform the efficiency track into a **delivery closed-loop workbench** for one-person companies.

User pastes a **customer conversation** (not internal meeting minutes as the product story). System extracts **commitments**, turns them into **tasks**, tracks them through **Captured → In Progress → Delivered → Confirmed**, and shows **closed-loop rate** on a metrics panel.

Primary surface: Web. Quality bar: full-field best product UI + repeatable 180s demo.

---

## 2. Investigation (host, file:line)

### Current efficiency track

| File | Finding |
|---|---|
| `app/track/efficiency/page.tsx:12-22` | Local `Task` type: `todo \| in-progress \| blocked \| done \| cancelled` — **not** delivery states |
| `page.tsx:24-31` | MOCK_TASKS are generic hackathon backlog, not customer commitments |
| `page.tsx:206-228` | Minutes API injects `actionItems` into kanban as `todo` |
| `page.tsx:252-276` | Copy is still "会议纪要 + 任务追踪" |
| `page.tsx:279-315` | Two modes: minutes / kanban |
| `app/api/efficiency/minutes/route.ts` | ~980 lines of minutes extraction + date engines — valuable patterns, **wrong domain framing** for pitch |
| `shared/types/common.ts:18` | `EfficiencyMode = "minutes" \| "kanban"` |
| `shared/components/layout/Sidebar.tsx:24-27` | Sidebar labels: 会议纪要 / 项目看板 |
| `shared/components/agent-runtime/AgentRuntime.tsx` | Shopkeeper morning brief is **ecommerce** mock (SKU-12) |
| `shared/llm/adapter.ts` | `complete` + `extractJson` with retries; reusable |
| `package.json` | Scripts: dev/build/lint/`test:e2e` only — **no unit test runner** |
| `tests/e2e/app.spec.ts:50-64` | Efficiency E2E asserts 会议纪要 demo button |
| `tests/e2e/app.spec.ts:108-145` | Kanban move uses `window.__setEfficiencyMode` and select options todo/in-progress |

### Implications

1. **Must change product framing** on efficiency page (header, sidebar, demo script, home card if needed).
2. **Must introduce delivery domain model** separate from minutes schema (or map carefully).
3. **Kanban columns must show delivery states** for demo clarity (Confirmed ≠ generic "done").
4. **Reuse** `complete`/`extractJson`, localStorage persistence pattern, dual-div SSR kanban trick, `__setEfficiencyMode` test hook pattern.
5. **Do not** expand ecommerce killer-feature 4-action chain this cycle.
6. **Unit tests:** add lightweight runner (vitest or node:test) for pure metrics/state-machine; E2E for golden path.

---

## 3. Domain model

### Types (`shared/delivery/types.ts`)

```ts
export type DeliveryStatus =
  | "captured"
  | "in_progress"
  | "delivered"
  | "confirmed";

export type CommitmentKind = "hard" | "soft" | "clarification";

export interface Commitment {
  id: string;
  text: string;
  kind: CommitmentKind;
  sourceExcerpt?: string;
  accepted: boolean; // user can reject before task creation
}

export interface DeliveryTask {
  id: string;
  commitmentId: string;
  title: string;
  status: DeliveryStatus;
  deadline?: string; // YYYY-MM-DD or undefined
  priority: "高" | "中" | "低";
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryMetrics {
  periodNewCommitments: number;
  confirmedCount: number;
  closedLoopRate: number; // confirmed / periodNewCommitments, 0 if denom 0
  overdueCount: number;
  openCount: number;
}

export interface ExtractCommitmentsResponse {
  summary?: string; // optional short context; never success alone
  commitments: Array<{
    text: string;
    kind: CommitmentKind;
    sourceExcerpt?: string;
    suggestedDeadline?: string;
    suggestedPriority?: "高" | "中" | "低";
  }>;
  risks: string[]; // ambiguous asks
  _mock?: boolean;
}
```

### State machine (`shared/delivery/state-machine.ts`)

Allowed transitions only:

```text
captured → in_progress → delivered → confirmed
captured → in_progress (skip not allowed to confirmed)
delivered → in_progress (rework)
any non-confirmed → cancelled?  // OPTIONAL: defer cancel; use reject at commitment stage instead
```

**MVP transitions:**

- `captured → in_progress`
- `in_progress → delivered`
- `delivered → confirmed`
- `delivered → in_progress` (rework)
- `in_progress → captured` (optional demote - defer)

Illegal transitions throw or no-op with UI toast; pure function returns `{ ok, next }` for tests.

### Metrics (`shared/delivery/metrics.ts`)

```text
closedLoopRate = confirmedCount / periodNewCommitments
```

- `periodNewCommitments` = count of commitments accepted in session period (demo: all accepted in local store)
- Overdue: `deadline < today` AND status not `confirmed`
- Miss rate is offline gold-script metric (expected hard commitments not extracted), not runtime dashboard mandatory

---

## 4. Behavior contract

### B1 — Capture

- Primary CTA: **「使用客户对话剧本」** (gold script)
- User can paste free text into input
- `POST /api/efficiency/commitments` with `{ transcript: string }`
- Response must include `commitments[]`; if empty hard set and transcript has actionable asks → treat as soft failure with retry/mock
- Prose-only success is forbidden: if parse yields zero commitments, UI shows error state + mock replay button

### B2 — Accept

- Review list: toggle accept per commitment
- Soft/clarification items default unaccepted or separate "待澄清" list
- Button **「采纳并生成任务」** creates `DeliveryTask` per accepted hard commitment at `captured`

### B3 — Track

- Board columns: 已捕获 / 进行中 / 已交付 / 已确认
- Status change via select (same interaction pattern as current kanban)
- Metrics strip always visible on efficiency page header

### B4 — Confirm

- Moving to `confirmed` increases closed-loop rate display
- Optional: short delivery note field when entering `delivered` (P1)

### B5 — Demo path (< 3 min)

1. Open `/track/efficiency`
2. Click gold script
3. See ≥2 hard commitments + ≥1 risk/clarification
4. Accept → board populated
5. Advance one task to Confirmed
6. Closed-loop rate number changes (e.g. 0% → 33%+)

---

## 5. API

### `POST /api/efficiency/commitments`

- Input: `{ transcript: string }` non-empty
- Output: `ExtractCommitmentsResponse`
- Implementation:
  - System prompt: extract customer-side and founder-side **executable commitments** from dialog
  - Use `complete` + `extractJson`
  - On LLM fail / bad JSON: **deterministic mock from gold script keywords OR empty commitments with `_mock: true` and known fixture** — prefer fixture that always yields 3 items for demo stability
- Keep `POST /api/efficiency/minutes` for now (unused by primary UI) or leave as secondary "legacy" - **do not delete in first slice** to avoid breaking existing E2E until rewritten

### Prompt rules (new)

- Hard commitment: concrete deliverable / date / "我给你…" / "请你…" / "需要上线…"
- Soft: preference without acceptance criteria
- Clarification: vague ("尽快弄好", "体验好一点")
- Do not invent customers or dates not in text
- Return JSON only

---

## 6. UI IA

### Efficiency page layout

```text
┌ Sidebar (效率为主；电商仍可达但不主叙事) ─┬ Header: 交付运营助手 + 闭环率大数字
│  · 交付闭环 (primary)                      │  今日待交付 / 逾期 芯片
│  · 看板 (same page scroll or tab)          ├──────────────────────────────────
│                                            │  [使用客户对话剧本]
│                                            │  承诺审阅区 | 任务看板
└────────────────────────────────────────────┴──────────────────────────────────
```

### Modes

Replace `EfficiencyMode`:

```ts
export type EfficiencyMode = "capture" | "board";
// capture = input + commitment review
// board = kanban
// metrics always visible
```

Or single-page split: top metrics + capture, bottom board (preferred for demo - less tab hunting).

**Recommendation:** **Single scroll workbench** with sections (metrics → capture → board). Keep minimal toggle only if needed for E2E. Update test hooks to `__setEfficiencyMode("board")` if toggle remains.

### Copy changes

| Old | New |
|---|---|
| 效率 Agent / 会议纪要 | 交付运营助手 / 客户承诺 |
| 使用演示会议记录 | 使用客户对话剧本 |
| 待办 / 已完成 | 已捕获 / 已确认 |

### AgentRuntime

- For this cycle: either hide ecommerce morning brief on efficiency routes **or** retarget copy to "今日交付提醒" mock.
- Minimum: do not show SKU-12 on efficiency path (condition on pathname).

---

## 7. Persistence

- Key: `fc-opc-ibot-delivery-v1` for tasks + accepted commitments + period counters
- Migration: ignore old `fc-opc-ibot-tasks` or one-time clear when detecting old shape
- SSR: default empty or sample delivery tasks with fixed timestamps (hydration-safe)

---

## 8. Testing seams

| Seam | What |
|---|---|
| Unit | `transition(status, event)`, `computeMetrics(tasks, commitments)`, gold fixture parse (mock path) |
| API | POST commitments 400 on empty; 200 with commitments array shape |
| E2E | Gold script → accept → confirm → metrics text matches |

Add `vitest` + `npm run test:unit` OR use `node --test` with tsx - prefer **vitest** for DX.

Gold fixtures: `tests/fixtures/delivery/dialog-01.json` with `transcript` + `expectedHardTexts[]`.

---

## 9. Non-goals (hard)

- Ecommerce 4-action chain, live Taobao data
- Native mini-program
- Auth / multi-tenant
- Mandatory real tool_use
- Minutes as hero feature
- Rewriting all 980 lines of minutes route into commitments (extract patterns only)

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Breaking existing minutes E2E | Update E2E in same PR as UI copy change |
| LLM flake in pitch | Gold script uses mock-first flag `?demo=1` or client-side fixture path |
| Scope creep | Only Slice A–D in plan |
| Status confusion with old todo/done | New labels + new storage key |

---

## 11. Success criteria (engineering)

- [ ] Closed-loop rate visible and updates on Confirm
- [ ] Gold path works offline (mock)
- [ ] Unit tests for metrics + state machine green
- [ ] E2E delivery path green
- [ ] `npm run build` green
- [ ] UI copy does not lead with 会议纪要
