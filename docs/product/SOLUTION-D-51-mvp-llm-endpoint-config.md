# SOLUTION pin · D-51 · MVP LLM endpoint config (non-secret)

**Status:** Owner-accepted product config for Q-34 / D-51 core  
**Parent:** `docs/product/SOLUTION-D-51-product-agent-architecture-mvp-model.md`  
**IDs:** D-51 · Q-34 core closed · OA-22 core closed  
**Audience:** G2 (delivery). **Do not** paste secret values into chat, handoffs, commits, or receipts.  
**Gate note:** G2 activates **G5** for this Agent/model path **only after D-50 final acceptance** (folder-responsibility onboarding READY + accept). This pin alone does **not** unlock G5.

---

## Exact non-secret values (copy as-is)

| Item | Exact value |
|------|-------------|
| **Endpoint base URL** | `https://api.stepfun.com/step_plan` |
| **Adapter path append** | `/v1/messages` |
| **Effective Messages URL** | `https://api.stepfun.com/step_plan/v1/messages` |
| **Model id** | `step-3.7-flash` |
| **Provider (receipt)** | `stepfun` (StepFun · Anthropic-compatible Messages) |
| **Reasoning effort — product/receipt field** | `effort` |
| **Reasoning effort — value (MVP project reconstruction)** | `high` |
| **Secret env key name only** | `LLM_API_KEY` |
| **Non-secret env key names (recommended)** | `LLM_BASE_URL` · `LLM_MODEL` |

### Env mapping (names and public values only)

```text
LLM_BASE_URL=https://api.stepfun.com/step_plan
LLM_MODEL=step-3.7-flash
LLM_API_KEY=<set in local/secret store only; never commit or quote>
```

- Adapter must call: `{LLM_BASE_URL}/v1/messages` (strip trailing slash on base first).
- **Never** put the API key value in PRODUCT_DEV_TASKS, ROADSHOW, this file, ASSIGN bodies, logs, or cmux text.
- Current code may also accept `ANTHROPIC_AUTH_TOKEN` as a legacy alias; **product secret name to configure is `LLM_API_KEY`**.

---

## Receipt (must appear on reconstruction runs)

| Field | MVP value / rule |
|-------|------------------|
| `provider` | `stepfun` |
| `model` | `step-3.7-flash` |
| `effort` | `high` |
| `fallback` | whether deterministic (or other) fallback ran + why |

No secret material in receipt body.

---

## Related product rules (pointer only)

- Agent loop: observe → map → selective tools → exact revisions → sufficient/unknown → candidate → Owner → persist/monitor.  
- Model replaceable; project truth never belongs to the model.  
- Full architecture: parent SOLUTION-D-51.

---

## Delivery sequencing (for G2)

1. **D-50** dual-write → integrate → G4/G6 → Owner-visible acceptance of folder responsibility.  
2. **Only after D-50 final acceptance:** activate **G5** (or other seats G2 chooses) for D-51 Agent loop / model / receipt wiring.  
3. This document is the **durable accepted-solution path** for model/endpoint/effort/env-key-name when that work starts.
