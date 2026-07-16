# D-37 Browser-extension call-in seam research (Chijie deepen)

- Date (UTC): 2026-07-16
- Seat: G5 · read-only source audit
- Authority: Owner-approved D-37 + D-38 / Q-30; D-19 browser-fallback boundary still in force
- Assignment: `.ship/handoffs/ASSIGN-G5-D37-browser-extension-callin-research.md`
- **Addendum:** D-38 binding, match/compact-trace, inspect-disable-revoke, single fake-extension/loopback spike **proposal only**
- Prior audit: `docs/research/2026-07-16-chijie-integration-seam.md` (G5; still valid base)
- Mode: **no** extension edit/build/install, **no** browser action, **no** localhost product bridge service, **no** production integration, **no** credentials
- Hard stop: **do not execute/build/connect** any adapter/spike before executor/result contract confirmation
- T-19 evidence remains first (post-integration GREEN separate handoff)

---

## 0. D-13 adoption evidence (mandatory)

| D-13 item | Evidence |
|---|---|
| **Exact tree path** | `/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion/projects/chijie-browser` |
| **Git root / commit** | Scion monorepo `/Users/mahaoxuan/Desktop/AI产品经理/自研产品/scion` · HEAD **`cea3e38d0b2e37a7bd0e2258dc420af4a79786df`** · `main` · observed dirty: unrelated `docs/product/G-TEAM-ROSTER.md` only (**G5 wrote nothing**) |
| **Tag** | No product release tag pinned for chijie-browser alone; package **version `0.1.13`** in `package.json` / built `dist/manifest.json` |
| **Upstream origin** | `package.json#repository` → `https://github.com/nanobrowser/nanobrowser.git`; `PRODUCT.md`: “Chrome extension fork (formerly Nanobrowser…)”; README still Nanobrowser-facing |
| **License** | **Apache-2.0** · root `LICENSE` + `package.json#license` |
| **Transitives (sample, lockfile)** | `@langchain/*`, `openai@5.12.2`, `@anthropic-ai/sdk@0.65.0`, `posthog-js@1.297.2` via `pnpm-lock.yaml` — outbound LLM/analytics; not a call-in surface |
| **Verification this turn** | Static read of source + `dist/manifest.json` + prior unit-test paths; **extension not loaded, not built, not installed** by G5 |
| **Mapping to product** | fc-opc-ibot needs optional **browser observation/action fallback** (D-19), not default connector path; evidence must enter knowledge as **candidate** (T-16/T-20), not truth |
| **Divergence from upstream** | Local product work under scion: task control plane (`TaskCommand`, revision, approval, pageRevision stale reject), 持节 branding; README/upstream marketing still Nanobrowser |
| **Exit boundary** | Can keep **A: no bridge** forever; if bridge added later, adapter must be **deletable** (product loopback + optional thin extension client) without rewriting knowledge store; do not fork Nanobrowser runtime into ibot process |

**Standing rule:** citing “Chijie/Nanobrowser adopted” without pin+symbols+map+license+verify+divergence+exit → fails D-13.

---

## 1. Deepen: present control plane (symbols)

### 1.1 Side-panel-only port (sole control UI seam)

| Item | Location |
|---|---|
| Connect name | `side-panel-connection` |
| Guard | `chrome-extension/src/background/index.ts` ~L99–107: `sender.id === chrome.runtime.id` **and** `sender.url === SIDE_PANEL_URL` (`chrome.runtime.getURL('side-panel/index.html')`); else disconnect |
| Client | `pages/side-panel/src/SidePanel.tsx` `chrome.runtime.connect({ name: 'side-panel-connection' })` |
| Message types | `heartbeat`, `task_command`, `get_active_task`, `screenshot`, `state`, `nohighlight`, `speech_to_text` |
| Command path | `task_command` → `taskManager.dispatch(message.command)` → `command_ack` |
| `onMessage` | Stub only (no external handlers) |

### 1.2 Command revision / idempotency

| Item | Location |
|---|---|
| Types | `packages/storage/lib/task/types.ts` · `TaskCommand`, `CommandAck`, `expectedRevision` |
| Stale reject | `chrome-extension/src/background/task/manager.ts` ~L179–180: `expectedRevision !== existing.revision` → `stale_revision` |
| Ack errors | `not_found` \| `stale_revision` \| `invalid_transition` \| `invalid_input` |
| `commandId` | Client UUID; acks keyed per round |

### 1.3 Approval gates (external commits stay inside Chijie)

| Item | Location |
|---|---|
| State machine | `action-dispatcher.ts` + tests: `proposed → approved → executing → observed` (or blocked/uncertain) |
| Human commands | `approve` / `reject` with `roundId` + `approvalId` |
| Product rule | Approval ≠ verified success; observation criteria in `contracts.ts` / `completion.ts` |
| Action allow-list | `agent/backends/control-policy.ts` `ALLOWED_ACTIONS` |

### 1.4 Observation / result evidence

| Item | Location |
|---|---|
| Page revision binding | `page-state.ts` · `stale_page_revision` / `stale_target_ref` |
| Completion criteria | `task/contracts.ts` · url / page_text / element_state / media_state / user_confirmed |
| Outcomes | `worked` / `didnt` / `unknown`; candidate vs verified completion events in storage types |
| Attempt state | includes `observed` |

### 1.5 Manifest permissions (built sample)

`dist/manifest.json` v0.1.13:

- `host_permissions`: `<all_urls>`
- `permissions`: `storage`, `scripting`, `tabs`, `activeTab`, `debugger`, `unlimitedStorage`, `webNavigation`, `sidePanel`
- **Absent:** `externally_connectable`, native messaging host, `onMessageExternal` / `onConnectExternal` / `connectNative` (code search empty under tree excluding node_modules)

### 1.6 Missing external interface (reconfirmed)

No product/host call-in API. Localhost fc-opc-ibot **cannot** `chrome.runtime.sendMessage(extensionId, …)` into this build. E2E may use local fixture servers; that is **test-only**, not a product bridge.

---

## 2. Call-in comparison (implementable, **unapproved**)

| Seam | Auth / origin | Replay | Scope bind | User start/stop | Revoke | Result export | Crash/reconnect | External commits |
|---|---|---|---|---|---|---|---|---|
| **A. Human-only** (today) | N/A | N/A | Owner mind | Side panel | Cancel task | Paste/manual | N/A | Inside Chijie only |
| **B. Extension→loopback product** (recommended *if* bridge ever authorized) | Short-lived token mint on `127.0.0.1` product; extension **outbound** poll/WS | `commandId` + product nonce + TTL; Chijie `expectedRevision` for task cmds | Token bound `projectId` + purpose + D-38 watch set | Product UI + Chijie panel; both can stop | Invalidate token; task `cancel` | Explicit export envelope → ibot **candidate** only | Resume poll; no auto-act on reconnect without re-auth | **Must** remain Chijie approval UI; bridge never auto-approve |
| **C. `externally_connectable` localhost** | Browser origin only (weak under XSS) | Need app layer | Harder | Web page can spam | Manifest hard | Same risk | Same | Dangerous with `<all_urls>`+debugger |
| **D. Native messaging** | OS host binary | Host policy | Host | Desktop install | Kill host | Via host | Host managed | Still route acts through Chijie |
| **E. Broad web postMessage / open external** | Weak | Weak | Weak | Hidden | Weak | Leak risk | — | **Reject** |

**Safest programmatic default if Owner later wants automation:** **B**, not C.  
**Safest overall today:** **A** (aligns D-19 fallback + production non-integration).

---

## 3. D-38 mapping (grant + visible watch set)

Every future observation request (product-initiated) must carry:

| Field (conceptual) | Role |
|---|---|
| `projectId` | T-19 hard scope |
| `grantId` / authorization receipt | T-20 style project grant for browser class |
| `watchSet` | Explicit origins/URL patterns/tab intents Owner enabled |
| `matchReason` | Why a change candidate is relevant |

| Observation class | Surface to Owner | Storage |
|---|---|---|
| **Matched relevant change** | Candidate event with reason + locator + time | Retrieval/trace disposition **hit/candidate** only |
| **Unrelated / noise** | Compact trace only (count/summary), no title leak of out-of-grant tabs | Trace, not knowledge |
| **Outside grant origin/tab** | Must not be requested; if observed, drop + audit deny | No product card |

Browser observation is **never** Owner-confirmed knowledge (T-16 L4). Acts that commit externally stay behind Chijie approval.

### 3A. D-38 ADDENDUM — binding, surface, control (required on any future seam)

This subsection **tightens** §3 for D-38. It is contract input for G2 freeze; not an implementation.

#### 3A.1 Project grant + per-matter watch binding (mandatory)

| Bind | Rule |
|---|---|
| **Project grant** | One browser-class grant per `projectId` (or narrower child grant). No observation job without valid grant: not expired, not revoked, capabilities ⊆ `read`/`list`/`observe` only (no silent act). |
| **Per-matter watch set** | Each watch matter is an explicit Owner-visible set: origin pattern(s) and/or tab intent and/or URL prefix; stored with `matterId`, `projectId`, `grantId`, `createdBy`, `createdAt`, `enabled`. |
| **Request envelope** | Every poll/job must include `projectId` + `grantId` + `matterId` (or explicit watch-set revision). Missing any → deny before observe. |
| **No global browser grant** | `resourceBoundary="*"` / all tabs / all origins without matter → reject (align T-20 boundary ban). |
| **T-19** | Foreign `projectId` or grant from B used under A → deny / zero disclosure. |

#### 3A.2 Match reason vs compact trace

| Class | When | Owner surface | Persist |
|---|---|---|---|
| **Matched candidate** | Observation matches enabled watch rules for that matter | Show locator + **matchReason** (which rule hit) + time + grant/matter ids | Trace object `disposition=hit|candidate` only |
| **Compact trace** | In-grant session noise that did not match matter rules | Aggregate only: counts, lastAt, matterId — **no** foreign titles/snippets | Compact summary row; not knowledge card |
| **Out of grant** | Tab/origin not in grant∪watch | Must not appear as candidate; audit deny optional | No product body |

**Match reason** is explanatory, not truth: it never promotes to Owner-confirmed knowledge (T-16) and does not skip Chijie approval for acts.

#### 3A.3 Inspect / disable / revoke

| Control | Owner-visible behavior | Effect |
|---|---|---|
| **Inspect** | List active grants, matters, watch rules, last match/compact stats, last token expiry | Read-only; no secrets in UI |
| **Disable matter** | Toggle `enabled=false` on one matter | New jobs for that matter denied; other matters unchanged; history kept |
| **Disable grant** | Suspend project browser grant | All matters under grant stop; compact/candidate ingest stops |
| **Revoke grant** | `revokedAt` + actor + reason | Tokens invalidated immediately; in-flight fake/real jobs fail closed; old traces readable, not renewable |
| **Revoke token** | Session token list / kill | Same as short TTL expiry; no act after kill |

Disable ≠ delete history. Revoke must not require extension rebuild.

#### 3A.4 Fail closed (D-38)

| Fail if |
|---|
| Observation without project grant |
| Observation without per-matter watch (or with disabled matter) |
| Candidate surfaced without `matchReason` |
| Out-of-grant tab title/snippet leaked into product search/list |
| Disable/revoke ignored by bridge client |
| Result export sets knowledge confirmed or auto-approves Chijie external commit |

---

## 4. Map page changes → D-37 candidate source events (not truth)

| Chijie signal | Candidate product event (future) | Must not become |
|---|---|---|
| `observed` attempt with page evidence | `sourceClass=browser_session` hit + locator (url + pageRevision) | Auto `KnowledgeCard` claim |
| Completion criterion satisfied | Candidate result with revision pin | Work `confirmed` / knowledge L4 |
| Debugger detach / cancel | Trace `failed`/`cancelled` | Silent success |
| Screenshot / DOM dump | Optional attachment under grant | Unscoped dump store |

Compose with T-20 disposition: unused hits stay trace-only; cite pins revision; source change → review-needed.

---

## 5. Safest seam recommendation input (for G2 / Owner later)

1. **Now:** no bridge; Owner uses Chijie side panel; product stores only what Owner explicitly imports as candidate.  
2. **If programmable path approved:** extension-initiated **authenticated loopback (B)** only; keep approval inside Chijie; bind D-38 watch set; export results as T-20/T-16 candidates.  
3. **Reject** C/E as first seam.  
4. **Do not** conflate ibot disk `agent-bridge` with Chijie.  
5. **Do not** treat OpenConnector as browser call-in.

---

## 6. One fake-extension / loopback adapter · spike **proposal only**

### 6.0 Authorization state

| Item | State |
|---|---|
| Proposal | **Yes** (this section) |
| G2 freeze / exclusive assign | Required before code |
| Executor/result contract confirmation | **Required before any execute/build/connect** |
| Execute / build / Chrome load / real loopback server | **Forbidden now** |

### 6.1 Goal (single spike)

**One** isolated spike: Node **fake extension** client ↔ product **loopback mock** on `127.0.0.1`, proving D-37 call-in safety **and** D-38 grant/matter/watch/match/compact/inspect-disable-revoke — without Chrome, debugger, or Chijie tree edits.

### 6.2 Components (future isolated treehouse only)

| Piece | Role |
|---|---|
| Fake extension client | Outbound poll/post with token; posts synthetic page-change observations |
| Product loopback mock | `127.0.0.1` only: mint/revoke token; register grant/matter/watch; accept observations; match engine |
| Fixtures | Grants, matters, watch rules, in-match vs noise vs out-of-grant packets, replay nonces |
| Unit fail gates | §6.4 — pure tests preferred; no network beyond localhost mock if ever run |

### 6.3 Suggested exclusive paths (proposal only — not created)

```text
tests/unit/d38-browser-loopback-spike.test.ts
tests/fixtures/d38-browser-loopback/
  grant-valid.json
  matter-watch.json
  obs-match.json
  obs-noise.json
  obs-out-of-grant.json
# optional: .ship/spikes/d38-loopback/  (deletable; never app/ production)
```

Do **not** invent production routes until G2 freezes names. Spike may use in-process functions first.

### 6.4 Fail gates (RED when spike code exists)

| ID | Gate |
|---|---|
| G-auth | No/invalid token → deny; token not bound to `projectId`+`grantId` → deny |
| G-matter | Missing/disabled `matterId` → deny |
| G-watch | Observation without matching enabled watch → **compact trace only**, not candidate |
| G-match-reason | Candidate without `matchReason` → reject surface |
| G-out-grant | Out-of-grant origin → zero title/snippet in product-facing payload |
| G-replay | Reused nonce/`commandId` → reject |
| G-disable | Matter or grant disabled → further candidates denied; history retained |
| G-revoke | Grant/token revoked → deny; no act |
| G-inspect | Inspect API returns grants/matters/stats **without** secrets |
| G-result | Export cannot set Owner-confirmed knowledge or Chijie auto-approve |
| G-loopback | Non-`127.0.0.1` host rejected (if HTTP mock used) |
| G-commit | External-commit job without Chijie approval state → never execute in fake executor |

### 6.5 Commands (only after contract confirmation + assign)

```text
# DO NOT RUN until executor/result contract confirmed and G2 assigns
npm run test:unit -- --run tests/unit/d38-browser-loopback-spike.test.ts
```

### 6.6 Rollback

Delete spike package + fixtures + test file; no knowledge schema; Chijie untouched; no production routes left behind.

### 6.7 Hard stop (repeat)

**Do not execute, build, install, or connect** this adapter/spike (or any real bridge) **before** the executor/result contract is confirmed. Research + proposal only until then.

---

## 7. External patterns (thin, non-adopted)

| Pattern | Note vs D-13 |
|---|---|
| Chrome `externally_connectable` | Documented browser feature; weak if product XSS; **not** present in Chijie |
| Native messaging | Stronger OS boundary; high install cost; **not** present |
| Nanobrowser upstream | Apache-2.0 origin; pin would need release tag + re-verify; local scion tree is the inspected artifact |

Do not claim these are product-adopted.

---

## 8. Residual risks / non-claims

- Static audit; SW behavior under real Chrome not re-probed this turn.  
- `<all_urls>` + `debugger` = any future call-in is high impact.  
- Personal secret inject script exists in build pipeline (`inject:personal`) — bridge designs must not exfil provider keys to product.  
- Upstream README still markets Nanobrowser CWS; local fork divergence is product-task control plane, not a published separate license fork notice beyond Apache-2.0 file.

---

## 9. Relation to concurrent work

| Work | Relation |
|---|---|
| T-19 GREEN @ `d715b64d` | Project hard scope applies to any future grant/watch set |
| T-20 plan | Trace/disposition for browser candidates |
| T-21 prep | Evidence reuse if browser cite pins revision |
| Prior Chijie seam | This file **deepens**; does not supersede operational “no bridge today” |

---

## 10. Exit summary

| Question | Answer |
|---|---|
| Is there a call-in API today? | **No** |
| Safest now? | Human-only **A** |
| Safest later programmable? | Extension→loopback **B** + Chijie-kept approvals + D-38 watch |
| Spike now? | **One** fake-extension/loopback **proposal only**; not executed/built/connected |
| D-38? | Grant + per-matter watch bind; matchReason vs compact trace; inspect/disable/revoke required |
| Production integration? | **None** this research |
