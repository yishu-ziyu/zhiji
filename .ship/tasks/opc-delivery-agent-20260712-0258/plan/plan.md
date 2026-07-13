# Implementation Plan — OPC Delivery Ops Agent

> **2026-07-13 override:** `plan/locked-override.md` supersedes the old four-state, provider-self-confirm, and period-ratio steps below. Dev must implement the bilateral token-link golden path.

**Spec:** `plan/spec.md` (patched with peer D1–D3)  
**TDD:** unit first for pure modules; E2E last per slice  
**Do not** start Slice B UI until Slice A unit tests pass

---

## Slice A — Domain core (no UI LLM)

### Task A1: Types + state machine + metrics (TDD)

**Files:**
- Create `shared/delivery/types.ts`
- Create `shared/delivery/state-machine.ts`
- Create `shared/delivery/metrics.ts`
- Create `shared/delivery/state-machine.test.ts`
- Create `shared/delivery/metrics.test.ts`
- Add vitest: `npm i -D vitest`, script `"test:unit": "vitest run"`, minimal `vitest.config.ts`

**Steps:**
1. Write failing tests for legal transitions and illegal transitions.
2. Implement `canTransition` / `transition`.
3. Write failing tests for `computeMetrics`:
   - 0 commitments → rate 0
   - 3 period commitments, 1 confirmed → rate ≈ 0.333
   - overdue counts tasks with deadline < today and status ≠ confirmed
4. Implement metrics.
5. Run `npm run test:unit` → green.

**Done when:** unit tests green; no page changes required.

---

### Task A2: Gold fixture files

**Files:**
- Create `tests/fixtures/delivery/dialog-01.json`

**Content shape:**
```json
{
  "id": "dialog-01",
  "title": "客户微信对齐 - 落地页改版",
  "transcript": "...含2条硬承诺+1条模糊...",
  "expectedHard": ["输出改版原型", "本周五前上线预览链接"],
  "expectedClarifications": ["体验好一点"]
}
```

**Done when:** file exists and is valid JSON.

---

## Slice B — Commitments API + mock path

### Task B1: Mock extractor (TDD)

**Files:**
- Create `shared/delivery/extract-mock.ts`
- Create `shared/delivery/extract-mock.test.ts`

**Behavior:** Given `dialog-01` transcript (or id), return fixed commitments matching fixture expectedHard + risks.

**Done when:** unit tests green without network.

---

### Task B2: API route

**Files:**
- Create `app/api/efficiency/commitments/route.ts`
- Create `shared/llm/prompts/commitments.ts`

**Behavior:**
1. Validate transcript non-empty → 400
2. If body `{ fixture: "dialog-01" }` OR env/demo → return mock extractor result with `_mock: true`
3. Else call `complete` + `extractJson` with commitments system prompt
4. On failure → fall back to mock (never 500 for LLM issues)

**Manual check:** `curl -X POST localhost:3000/api/efficiency/commitments -d '{"fixture":"dialog-01"}'`

**Done when:** curl returns ≥2 commitments.

---

## Slice C — Workbench UI

### Task C1: Delivery store helpers on page

**Files:**
- Create `shared/delivery/storage.ts` (load/save `fc-opc-ibot-delivery-v1`)
- Rewrite primary flow in `app/track/efficiency/page.tsx`

**UI sections (single workbench):**
1. Header: title **交付运营助手**, badge 参赛主线, metrics strip (闭环率 / 逾期 / 进行中)
2. Button: **使用客户对话剧本** → fixture path (no network required)
3. Optional paste + **提取承诺** → API
4. **CommitmentReview** list (checkboxes) + **采纳并生成任务**
5. **DeliveryBoard** columns: 已捕获 / 进行中 / 已交付 / 已确认 with status select
6. Test hook: `window.__setDeliveryDemo` optional; keep `__setEfficiencyMode` if tabs remain — prefer board always visible below

**Remove hero framing of 会议纪要** (subtitle, primary demo button).

**Done when:** full click path works with fixture offline.

---

### Task C2: Sidebar + home copy

**Files:**
- `shared/components/layout/Sidebar.tsx` — efficiency items: 交付闭环 / 任务看板 (or single item)
- `shared/types/common.ts` — update `EfficiencyMode` if needed
- `app/page.tsx` — efficiency card: 客户承诺 → 交付确认；去掉纪要主卖点

**Done when:** home + sidebar match product language.

---

### Task C3: AgentRuntime pathname guard

**Files:**
- `shared/components/agent-runtime/AgentRuntime.tsx`

**Behavior:** On `/track/efficiency`, either hide FAB or show delivery-oriented brief mock (今日待交付). Do not show SKU-12.

**Done when:** efficiency page does not show 选品库 SKU copy.

---

## Slice D — E2E + harden

### Task D1: Update Playwright

**Files:**
- `tests/e2e/app.spec.ts`

**Replace/adjust:**
- Efficiency tests for 交付运营助手 / 使用客户对话剧本
- New describe: fixture → accept → move to confirmed → expect metrics
- Keep health/API validation; update minutes-only assumptions if broken
- Shopkeeper test stays on ecommerce only

**Done when:** `npm run test:e2e` green (or document skipped LLM-dependent tests).

---

### Task D2: Build + lint gate

**Commands:**
- `npm run test:unit`
- `npm run lint`
- `npm run build`

**Done when:** all pass.

---

### Task D3: Demo script alignment (docs only)

**Files:**
- Update `docs/demo/DEMO_SCRIPT.md` efficiency section to delivery closed-loop 180s
- Or add `docs/demo/DEMO_SCRIPT_DELIVERY.md` if prefer not clobber ecommerce sections

**Done when:** 180s script matches UI labels.

---

## Execution order

```text
A1 → A2 → B1 → B2 → C1 → C2 → C3 → D1 → D2 → D3
```

Parallel safe: A2 ∥ A1 after types exist; C2 can start after C1 labels known.

---

## Out of plan (do not implement)

- Minutes route rewrite
- Ecommerce 4-action chain
- SSE streaming
- WeChat mini-program shell
- Real customer confirm webhooks

---

## Definition of Ready for `/yishuship:dev`

- [x] spec.md complete with investigation citations
- [x] peer-spec + diff-report resolved
- [x] plan.md vertical slices, no TBD steps
- [ ] drill CLEAR (below)
