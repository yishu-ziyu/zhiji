# SOLUTION · D-51 · Product Agent architecture + MVP model (Q-34 core)

**Status:** Owner-confirmed core (2026-07-16)  
**IDs:** D-51 · closes answered core of Q-34 / OA-22  
**Authority list:** `.ship/tasks/first-user-real-entry-015/control/PRODUCT_DEV_TASKS.md`  
**Roadshow:** `docs/product/ROADSHOW_PRODUCT_LOGIC.md`  
**For:** Lead product path; G2 delivery when engineering scope needs this architecture  
**Security:** **Never** record, quote, log, or commit API keys / tokens.

---

## 1. Problem (why this decision)

Without a product Agent loop, MVP stays “observer + one-shot complete on event metadata,” which cannot fulfill D-39/D-44/D-50 (source-backed current understanding after folder authorization).

## 2. Accepted Agent architecture (core loop)

The product Agent **is** this loop (not a chat wrapper, not a configurator form):

1. **Observe** the **authorized** project (boundary = Owner-selected folder / grants).
2. **Build a project map** (structure / materials / history entry points — map is working structure, not truth).
3. **Selectively read / retrieve with tools** (on demand inside the boundary; not dump whole tree into the model by default).
4. **Reason over exact revisions** (citations pin revision + path; never free-floating claims).
5. **Continue** until evidence is **sufficient**, or **mark unknown** where it is not.
6. **Create a source-backed candidate** understanding (Agent cannot self-confirm as final).
7. **Owner correct / confirm** (or expand permission when needed).
8. **Persist** the result and **monitor** for further authorized changes (re-enter loop).

Aligns: D-39 · D-40 · D-41 · D-42 · D-43 · D-44 · D-45 · D-50.

## 3. MVP model / transport (core)

| Rule | Decision |
|------|----------|
| MVP primary model | **StepFun `step-3.7-flash`** (product primary for MVP project reconstruction). |
| Transport | **Direct Anthropic-compatible Messages** path via existing adapter pattern. |
| Path composition | Adapter **appends** `/v1/messages` to the configured base; therefore **base URL must be the gateway root only** (no trailing Messages path). **Owner-confirmed MVP base URL:** `https://api.stepfun.com/step_plan` (public endpoint config — **not** a secret). Effective call = base + `/v1/messages`. |
| Reasoning effort | Product/receipt field **`effort`** = **`high`** for MVP project reconstruction. |
| Replaceability | **Model remains replaceable.** Swap model/provider without rewriting project truth. |
| Truth ownership | **Project truth never belongs to the model.** Originals / events / accepted understanding live in project memory; model is a replaceable reasoner. |
| Secrets | Secret env **key name only:** `LLM_API_KEY`. **Never** store, quote, log, or commit the key **value**. |

### Exact MVP LLM pin (non-secret) — G2 source of truth

**Dedicated pin path:** `docs/product/SOLUTION-D-51-mvp-llm-endpoint-config.md`

| Item | Exact value |
|------|-------------|
| Base URL | `https://api.stepfun.com/step_plan` |
| Adapter appends | `/v1/messages` |
| Effective URL | `https://api.stepfun.com/step_plan/v1/messages` |
| Model id | `step-3.7-flash` |
| Effort field | `effort` |
| Effort value | `high` |
| Secret env key name | `LLM_API_KEY` (value never recorded) |

**Note:** Local-dev default in some trees (`http://127.0.0.1:15721`) is historical code, not the Owner-confirmed MVP product base. **G5 for D-51 only after D-50 final acceptance.**

## 4. Receipt requirement (provider / model / effort / fallback)

Every reconstruction (or equivalent Agent analysis run) that produces a candidate **must** leave a durable, inspectable receipt of at least:

| Field | Meaning |
|-------|---------|
| **provider** | Which gateway/provider family was used (e.g. StepFun Anthropic-compatible Messages). |
| **model** | Model id actually requested (MVP primary: `step-3.7-flash`). |
| **effort** | Reasoning effort setting used (MVP reconstruction: **high**). |
| **fallback** | Whether deterministic (or other) fallback ran, and why (e.g. model error / timeout). |

Receipt is product/traceability surface (D-41), **not** a place for secrets. **No API key** in receipt body.

## 5. Visible acceptance (core — G4/G6 language)

When Agent runs project reconstruction after an authorized folder:

1. I can see that understanding is **candidate** until I confirm/correct.
2. Claims I accept can be pointed at **exact revisions** (or honestly **unknown**).
3. If model fails, I can see **fallback** was used via receipt — not silent template pretending to be model.
4. Changing model config does **not** rewrite historical project truth by itself.
5. No UI or log in product docs shows raw API keys.

## 6. Closed vs still open

**Closed by D-51 (answered core of Q-34 / OA-22):**

- Product Agent **loop** (observe → map → selective tools → reason on revisions → sufficient/unknown → candidate → Owner → persist/monitor).
- MVP **primary model** = StepFun **`step-3.7-flash`**; base **`https://api.stepfun.com/step_plan`** + adapter `/v1/messages`; high effort; replaceable model; truth not owned by model.
- **Receipt** fields required: provider / model / effort / fallback.

**Follow-up closed by D-52:** in-root autonomous tool capability (no per-read confirm; iterate until evidence/unknown; confirm for expand/sensitive/writes; Owner interrupt; tool receipts + stopping reason). See `docs/product/SOLUTION-D-52-agent-autonomous-tools-in-authorized-root.md`.

**Still open:**

- **Runtime/framework adoption** remains **Q-33 / OA-16** (no framework adopted by D-51/D-52; D-48 still holds for current MVP stack stage).
- Exact wire of high-effort parameter to StepFun gateway API (eng detail under product rule “high”).

## 7. Non-goals

- Not adopting LangGraph/Mastra/Temporal/AI SDK by this record (see D-48 / Q-33).
- Not whole-disk read; not unapproved sources.
- Not Owner-substitute acceptance of MVP ship (OA-21 still Owner).

## 8. Links

- PRODUCT_DEV_TASKS: D-51 · Q-34 · OA-22 · S-116 / S-117  
- Prior code facts (baseline, not the goal): `observer.ts` · `agent-model-loop.ts` · `shared/llm/adapter.ts`
