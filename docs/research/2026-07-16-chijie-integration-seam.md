# Chijie (持节) integration seam — runtime audit

- Date: 2026-07-16
- Seat: G5 (read-only)
- Wave: `.ship/handoffs/TEAM-WAVE-openconnector-browser-tools.md` · G5
- Inspected tree (no edits): `/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser`
- Scion git HEAD observed: `cea3e38` · branch `main` (dirty unrelated docs only; **G5 made no Scion writes**)
- Package: `chijie-browser@0.1.13`
- Built manifest sample: `projects/chijie-browser/dist/manifest.json`
- Product context: fc-opc-ibot on localhost; production code **paused**; this note is evidence only

## 1. What Chijie is (product fact)

Personal **browser action agent** Chrome extension (MV3): multi-step web tasks in daily Chrome; **approval** gates irreversible external commits; **verified completion** requires page-observed evidence, not approval alone.

Source brand/product: `PRODUCT.md` in the chijie tree.

## 2. Present abilities (code-backed)

### 2.1 Observation

| Ability | Where | Notes |
|---|---|---|
| DOM / clickable tree | content script + `buildDomTree.js`; `browser/dom/*` | Injected on `http(s)` tab complete |
| Page state / interactive elements | `browserContext.getState`, side-panel port cmd `state` | Debug-oriented dump to logs |
| Screenshot | port message `screenshot` + tabId | Via attached page |
| Completion probes | `page.observeCompletionCriteria` · criteria kinds in `task/contracts.ts` | `url`, `page_text`, `element_state`, `media_state`, `user_confirmed` |
| Attempt observation state | `ActionAttempt.state` includes `observed` | UI: only page-observed outcomes count as completed work (`task-loop-ui.ts`) |
| Debugger attach | `chrome.debugger` permission + `onDetach` | User cancel detaches → interrupt active task |

### 2.2 Action (agent tool surface)

Declared action schemas (`chrome-extension/src/background/agent/actions/schemas.ts`) and control-policy allow-list (`control-policy.ts` `ALLOWED_ACTIONS`):

`done`, `search_google`, `go_to_url`, `go_back`, `click_element`, `input_text`, `switch_tab`, `open_tab`, `close_tab`, `cache_content`, `scroll_to_percent`, `scroll_to_top`, `scroll_to_bottom`, `previous_page`, `next_page`, `scroll_to_text`, `send_keys`, `control_media`, `get_dropdown_options`, `select_dropdown_option`, `wait`.

`extract_content` exists only as **commented-out** schema (not currently wired).

Browser capabilities depend on MV3 permissions: `storage`, `scripting`, `tabs`, `activeTab`, `debugger`, `unlimitedStorage`, `webNavigation`, `sidePanel`, `host_permissions: <all_urls>`.

### 2.3 Approval

| Piece | Evidence |
|---|---|
| External-commit gate | `action-dispatcher.ts`: states `proposed → approved → executing → observed`; `requestApproval`; reject path “Action was not approved” |
| Heuristic “commit-like” intents | Regex on submit/buy/delete/支付/… before auto-exec |
| Task status | `waiting_approval` while human decides |
| Task commands | `approve` / `reject` with `roundId` + `approvalId` (`packages/storage/lib/task/types.ts`) |
| UI contract in e2e | `[data-testid="approval-approve"]` (scripts) |
| Product rule | Approval is **permission**, not evidence of success (`task-loop-ui.ts`) |

### 2.4 Result / completion

| Piece | Evidence |
|---|---|
| Candidate vs verified | Executor outcomes: `candidate_complete`, `waiting_user`, `paused`, `cancelled`, `failed` |
| User confirm criterion | `confirm_completion` command + `user_confirmed` criterion |
| Verified event | `task_completed_verified` event type in storage task types |
| Act outcome | `worked` / `didnt` / `unknown` — delivery ≠ success (`contracts.ts`) |
| Skills | `save_skill` / `run_skill` for reusable instruction templates |

### 2.5 Task control plane (internal)

`TaskCommand` types: `start`, `follow_up`, `pause`, `resume`, `cancel`, `approve`, `reject`, `confirm_completion`, `save_skill`, `run_skill` — with `commandId`, `taskId`, `expectedRevision` for idempotency / stale rejection.

## 3. Current external-call seams (what actually leaves the extension)

### 3.1 **No product/host call-in API today**

Built + source manifests (`dist/manifest.json`, `chrome-extension/manifest.js`):

| Manifest field | Present? |
|---|---|
| `externally_connectable` | **No** |
| `native_messaging` / host | **No** |
| `optional_host_permissions` beyond all_urls | N/A (already `<all_urls>`) |

Code search under chijie-browser: **no** `onMessageExternal`, `onConnectExternal`, `connectNative`.

**Implication:** A localhost product page (fc-opc-ibot) **cannot** legally `chrome.runtime.sendMessage(extensionId, …)` into Chijie with the current build. There is no supported third-party call interface yet.

### 3.2 Internal UI control plane (same extension only)

`chrome.runtime.onConnect` port name **`side-panel-connection`** (`background/index.ts`):

- Accepts only if `sender.id === chrome.runtime.id` **and** `sender.url === chrome.runtime.getURL('side-panel/index.html')`.
- Unauthorized ports are **disconnected**.
- Message types: `heartbeat`, `task_command`, `get_active_task`, `screenshot`, `state`, `nohighlight`, `speech_to_text`.
- Events broadcast to side panel: task events / snapshots.

`chrome.runtime.onMessage` listener is effectively a **stub** (no handlers).

This is a **tight in-extension** seam, not an external product seam.

### 3.3 Outbound network (extension → internet / local LLM)

| Outbound | Mechanism | Risk note |
|---|---|---|
| LLM chat | LangChain `ChatOpenAI` / Anthropic / Azure / custom `baseURL` + user `apiKey` (`agent/helper.ts`) | User-configured providers; keys in extension storage |
| Speech-to-text | Gemini provider path (`speechToText.ts`) | Optional |
| Analytics | PostHog if `VITE_POSTHOG_API_KEY` (`analytics.ts`) | Optional env |
| Target websites | Content script + debugger actions | Full-browse under user session cookies |

E2E harnesses spin **local** `http://127.0.0.1:<ephemeral>` fixtures — test-only, not a product bridge.

### 3.4 What is *not* an external product interface

- Side-panel React UI talking to background over the guarded port.
- LLM tool JSON (`action_name` / navigator shapes) — model I/O, not a host API.
- OpenConnector / fc-opc-ibot HTTP APIs — **not referenced** inside chijie-browser for this audit.

## 4. Seam comparison for localhost product use

Goal: fc-opc-ibot (or a local agent host) needs a **narrow, safe** way to request browser observation/action with human approval still inside Chijie.

| Seam | Install / wiring | Who can call | Auth surface | Fits current code? | Safety for localhost product |
|---|---|---|---|---|---|
| **A. No programmatic bridge** (Owner runs Chijie side panel; product only stores Owner-pasted results) | None | Human only | N/A | **Yes (today)** | Safest; no remote browser control from product |
| **B. Local authenticated bridge (extension initiates)** Extension opens WS/HTTP to `http://127.0.0.1:<product-port>` with short-lived token minted by product server | Small extension add + product endpoint | Only processes holding the token on loopback | Token + loopback + optional mTLS later | **Not built**; would be new outbound client in SW | **Narrowest *programmatic* safe default**: no `externally_connectable`; web XSS cannot `sendMessage` the extension; product server mediates |
| **C. `externally_connectable`** limited to `http://127.0.0.1:3000/*` (+ maybe `https://localhost…`) | Manifest change + `onMessageExternal` | Any script on that origin | Must add app-level auth; browser origin is weak under XSS | **Not present** | Convenient but **XSS on product origin = browser agent RCE** with `<all_urls>` + debugger |
| **D. Native messaging** | OS host + manifest `native_messaging` | Native host only | OS user + host binary | **Not present** | Strong isolation; higher install cost; good for desktop packaging later |
| **E. Open / broad externally_connectable or content-script postMessage to product** | Dangerous | Many pages | Weak | Must not | **Reject** for D-10 style product |

### Recommendation (narrowest safe seam)

1. **Near-term (matches “production paused”, D-18 browser as fallback):** keep **A** — no Scion/product bridge code; product uses API connectors first; browser is Owner-driven fallback. Aligns with wave: evidence only.
2. **If Owner later authorizes a programmable bridge:** implement **B** (extension → loopback product bridge with session token), **not C first**.
   - Product exposes e.g. `GET/POST http://127.0.0.1:3000/api/internal/chijie-bridge/*` only on loopback (or separate high port bound to 127.0.0.1).
   - Session token: one-time, short TTL, bound to projectId + purpose (`observe` vs `act`), shown/confirmed in product UI.
   - Extension background polls or long-polls **outbound**; validates token; maps jobs into existing `TaskCommand` / observe paths; **keeps approval UI inside Chijie** for external commits.
   - Never accept unauthenticated commands; never expose full `TaskCommand` to arbitrary web pages.
3. **C** only if product origin is treated as fully trusted and XSS budget is zero — still inferior to B for a knowledge product with uploaded files.
4. **D** when packaging a desktop host is worth the friction.

**Do not** treat OpenConnector as the Chijie call interface. OpenConnector is SaaS/API connector territory; Chijie is browser session automation. Different trust and evidence shapes.

## 5. Mapping to fc-opc-ibot (current product)

| fc-opc-ibot need | Chijie today | Gap |
|---|---|---|
| Read public web when API missing | Manual Chijie task + human paste | No auto writeback |
| Project-scoped evidence with citation | Chijie has page evidence internally; no export API to knowledge cards | Need explicit result export contract (future) |
| Approval before external commit | **Strong inside Chijie** | Must not be bypassed by a product bridge |
| Agent run/bridge in ibot | ibot agent-bridge is **disk protocol under knowledge dir**, unrelated to Chijie | Do not conflate |

## 6. Residual risks / non-claims

- Audit is **static + manifest/code path**; extension was not loaded in Chrome by G5 this turn.
- Personal bootstrap (`ensurePersonalDefaults`) seeds provider defaults on SW boot — integration designs must not assume empty provider storage.
- Full `<all_urls>` + `debugger` means any future external command channel is high impact by default.
- No claim that a bridge is Owner-approved to build; D-18 wave remains read-only evidence.

## 7. Source index (absolute under Scion chijie tree)

```
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/PRODUCT.md
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/package.json
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/dist/manifest.json
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/manifest.js
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/src/background/index.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/src/background/task/manager.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/src/background/task/contracts.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/src/background/task/action-dispatcher.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/src/background/agent/actions/schemas.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/src/background/agent/backends/control-policy.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/chrome-extension/src/background/agent/helper.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/packages/storage/lib/task/types.ts
/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser/pages/side-panel/src/presentation/task-loop-ui.ts
```

## 8. Bottom line

- **Abilities:** observe (DOM/criteria/screenshot), act (full browser tool set), approve (external commits), verify (page-observed completion) — all **inside** the extension control loop.
- **External call interface to a host product:** **absent**. Only same-extension side-panel port + outbound LLM/analytics.
- **Narrowest safe seam for a future localhost product bridge:** extension-initiated **loopback authenticated channel (B)**; keep Chijie approval; avoid broad `externally_connectable` until/unless XSS is accepted as browser-control risk. Until Owner authorizes build, stay at **A**.
