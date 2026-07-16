# T-11 / D-13 addendum · OpenConnector source + license (D-20 GitHub read candidate)

- Seat: G3 · D-20/T-11 assignment  
- Assignment: `.ship/handoffs/ASSIGN-G3-T11-openconnector-source-license.md`  
- Cross-reference (initial record, still **not adopted**):  
  `.ship/tasks/first-user-real-entry-015/control/T11-openconnector-fc-opc-github-read-adoption-record.md`  
- Prior wave audit (background only): `docs/research/2026-07-16-openconnector-current-source-audit.md`  
- Date: 2026-07-16  
- **Label:** source/license evidence only — **not adopted** — no credentials, connector runtime, adapter/spike, code install, or adoption claim

## 1. Fixed pin

| Field | Value |
|-------|--------|
| Repo | `https://github.com/oomol-lab/open-connector` |
| **Pinned commit** | `1fc404feeb7643e6cdfbece046f3c09be9495826` |
| Describe at pin | `v1.1.0-28-g1fc404f` (package.json `version`: `1.1.0`) |
| Inspection method | Local clone checked out to pin; read `LICENSE.txt`, `package.json`, `package-lock.json`, GitHub/Gmail provider sources |
| Floating `main` | **Prohibited** for any future engineering pin (same rule as T-11 record) |

---

## 2. Project license

| Artifact | Finding |
|----------|---------|
| `LICENSE.txt` | **Apache License 2.0** (header + full text) |
| `NOTICE.md` | Third-party trademarks / no endorsement disclaimer |
| GitHub `license.spdx_id` (repo metadata) | Apache-2.0 |

Apache-2.0 is compatible with typical product use of a **separate** gateway process. It does **not** by itself authorize product dependency install or production wiring.

---

## 3. D-20 object → exact action symbols (pin)

**Action catalog / IDs:** `src/providers/github/actions.ts`  
- Helper: `action()` → `defineProviderAction(service, …)` so runtime id is `github.<name>`  
- Provider export: `src/providers/github/definition.ts` → `export const provider` with `actions: githubActions`, auth `oauth2` + `api_key` (PAT)

**Executors:** `src/providers/github/executors.ts`  
- `export const executors` via `defineProviderExecutors` merging handlers from:
  - `runtime-repository.ts`
  - `runtime-issue.ts`
  - `runtime-pull-request.ts`
  - `runtime-activity.ts`
  - `runtime-search.ts`
  - `runtime-release.ts`
- Context: `requireBearerCredential` → `GitHubActionContext.accessToken`

**Scopes module:** `src/providers/github/scopes.ts`  
- `githubRepoScope = "repo"` · `githubRepoScopes = ["repo"]`  
- OAuth default bundle also includes `read:user`, `user:email`, `workflow`, `delete_repo`

**HTTP transport (docs, pin):** `docs/runtime-api.md`  
- List/search: `GET /v1/actions`, `GET /v1/actions/:actionId`  
- Execute: **`POST /v1/actions/:actionId`**  
- Optional `Idempotency-Key` (duplicate suppression / 24h replay; does **not** implement product confirmation)

**Policy (local allow/block):** `src/core/action-policy.ts`  
- `export class ActionPolicyService`  
- `evaluate(action: ActionDefinition)` — blocked first, then allowlist if non-empty  
- `evaluateProxy(service)` — independent of action allowlist  
- `export function parseActionPolicyList`  
- Env wiring (server): `OOMOL_CONNECT_ALLOWED_ACTIONS` / `OOMOL_CONNECT_BLOCKED_ACTIONS` (documented in `docs/credentials.md`, `docs/configuration.md`)

### 3.1 D-20 allowed **read** mapping (candidate allowlist symbols)

| D-20 object | Action id | Definition locus (`actions.ts`) | Handler module (symbol area) | `requiredScopes` at pin |
|-------------|-----------|----------------------------------|------------------------------|-------------------------|
| Commits list | `github.list_commits` | `name: "list_commits"` ~L554 | `runtime-repository.ts` `list_commits` | `githubRepoScopes` → **`repo`** |
| Commit detail | `github.get_commit` | ~L586 | `runtime-repository.ts` | **`repo`** |
| Diff / range | `github.compare_commits` | ~L597 | `runtime-repository.ts` | **`repo`** |
| Exact-revision file | `github.get_file_contents` | ~L1513 | `runtime-repository.ts` `get_file_contents` | **`repo`** |
| Path listing (support) | `github.list_directory_contents` | ~L1499 | `runtime-repository.ts` | **`repo`** |
| Repo meta (support) | `github.get_repository` | ~L534 | `runtime-repository.ts` | **`repo`** |
| Issues list | `github.list_repository_issues` | ~L614 | `runtime-issue.ts` `list_repository_issues` | **`repo`** |
| Issue get | `github.get_issue` | ~L647 | `runtime-issue.ts` | **`repo`** |
| Issue comments | `github.list_issue_comments` | ~L819 | `runtime-issue.ts` | **`repo`** |
| Issue timeline (support) | `github.list_issue_timeline_events` | ~L1384 | `runtime-issue.ts` | **`repo`** |
| PR list | `github.list_pull_requests` | ~L887 | `runtime-pull-request.ts` `list_pull_requests` | **`repo`** |
| PR get | `github.get_pull_request` | ~L1047 | `runtime-pull-request.ts` | **`repo`** |
| PR files | `github.list_pull_request_files` | ~L919 | `runtime-pull-request.ts` | **`repo`** |
| PR commits | `github.list_pull_request_commits` | ~L933 | `runtime-pull-request.ts` | **`repo`** |
| PR reviews | `github.list_pull_request_reviews` | ~L958 | `runtime-pull-request.ts` | **`repo`** |
| PR review comments | `github.list_pull_request_review_comments` | ~L973 | `runtime-pull-request.ts` | **`repo`** |
| Repo activity (poll) | `github.list_repository_events` | ~L1486 | `runtime-activity.ts` `list_repository_events` | **`repo`** |
| Search issues/PRs (optional) | `github.search_issues_and_pull_requests` | ~L845 | `runtime-search.ts` | **`[]`** (empty in catalog) |
| Search code/commits (optional) | `github.search_code` / `github.search_commits` | ~L1610 / ~L1594 | `runtime-search.ts` | **`[]`** |

Action id form used by HTTP/MCP: **`github.<name>`** (service prefix + name).

### 3.2 Explicit **block** set for D-20 (must not be allowlisted)

Non-exhaustive but mandatory classes present in the same provider:

| Class | Examples (action names → `github.*`) | Locus |
|-------|--------------------------------------|--------|
| Create | `create_issue` (~L632), `create_issue_comment`, `create_pull_request`, `create_or_update_file` (~L1658), `create_release`, … | `actions.ts` |
| Update | `update_issue`, `update_pull_request`, … | `actions.ts` |
| Merge / destructive | `merge_pull_request` (~L1131), `delete_file` (~L1675), `delete_repository`, … | `actions.ts` |
| Workflow write | `rerun_workflow`, … | `actions.ts` |
| **All Gmail** | e.g. `gmail.send_email` (`src/providers/gmail/actions.ts` ~L293), plus search/fetch under `gmail.*` | Gmail provider |

**Suggested policy expression (documentation only, not configured):**

```text
OOMOL_CONNECT_ALLOWED_ACTIONS=
  github.list_commits,github.get_commit,github.compare_commits,
  github.get_file_contents,github.list_directory_contents,github.get_repository,
  github.list_repository_issues,github.get_issue,github.list_issue_comments,
  github.list_issue_timeline_events,
  github.list_pull_requests,github.get_pull_request,
  github.list_pull_request_files,github.list_pull_request_commits,
  github.list_pull_request_reviews,github.list_pull_request_review_comments,
  github.list_repository_events
# Prefer explicit list over github.* 
# Plus OOMOL_CONNECT_BLOCKED_ACTIONS for create_*, update_*, merge_*, delete_*, gmail.*
```

Default with **empty** allowlist is “all non-blocked allowed” (`ActionPolicyService.evaluate`) — **unsafe for product** unless operators set allowlist.

---

## 4. Divergences vs product / D-20 (must stay product-owned)

| Topic | OpenConnector at pin | Product must still own |
|-------|----------------------|-------------------------|
| **Broad `repo` scope** | Nearly all D-20 reads declare `requiredScopes: githubRepoScopes` → OAuth scope string **`repo`**, which is GitHub’s classic broad scope (includes write capabilities at the token model, not “contents read-only”). | Prefer fine-grained **public/read** token for `yishu-ziyu/fc-opc-ibot` only; if public unauthenticated REST is enough, **stop before any grant** (T-11 record). Empty catalog scopes on some search actions ≠ safe private access. |
| **No webhook feed** | No webhook handler under `src/providers/github`. `list_repository_events` is **on-demand poll** of GitHub Events API. | Product schedules/triggers reads; does not assume push-driven sync. |
| **No product controls** | Gateway stores connections/tokens (operator), optional JWT (`src/server/api/runtime-jwt.ts` at pin), action policy env. | D-10/D-15/D-16/D-17: confirmation, source expiry/revoke UI, retrieval trace, evidence promotion, Agent non-self-confirm — **absent** from this candidate. |
| **Evidence truth** | Action JSON responses only. | Stable evidence records, revision pins, Owner confirmation remain product. |
| **Local product seam** | None on `feature/first-user-real-entry` (`shared/openconnector/` not present as production integration). | Current public web path remains AnySearch (`shared/anysearch/client.ts` etc.) — unrelated adoption. |

---

## 5. Direct / transitive license inventory (practical boundary)

### 5.1 Project

- **Apache-2.0** (`LICENSE.txt`).

### 5.2 Direct `dependencies` at pin (`package.json` → lock versions)

All **19** direct runtime dependencies declare permissive licenses in `package-lock.json`:

| Package | Version (lock) | License field |
|---------|----------------|---------------|
| `@cfworker/json-schema` | 4.1.1 | MIT |
| `@hono/node-server` | 2.0.6 | MIT |
| `@modelcontextprotocol/sdk` | 1.29.0 | MIT |
| `@scalar/hono-api-reference` | 0.11.7 | MIT |
| `ali-oss` | 6.23.0 | MIT |
| `fast-xml-parser` | 5.9.3 | MIT |
| `hono` | 4.12.27 | MIT |
| `imapflow` | 1.4.6 | MIT |
| `jose` | 6.2.3 | MIT |
| `mailparser` | 3.9.14 | MIT |
| `mdast-util-from-markdown` | 2.0.3 | MIT |
| `mdast-util-gfm` | 3.1.0 | MIT |
| `mdast-util-to-markdown` | 2.1.2 | MIT |
| `micromark-extension-gfm` | 3.0.0 | MIT |
| `minisearch` | 7.2.0 | MIT |
| `nodemailer` | 9.0.3 | MIT-0 |
| `pino` | 10.3.1 | MIT |
| `rss-parser` | 3.13.0 | MIT |
| `zod` | 4.4.3 | MIT |

**No GPL/AGPL/SSPL in direct dependencies.**

### 5.3 Full lockfile histogram (all `package-lock` entries with `version`)

Practical scan of **671** package entries:

| License (as declared) | Approx. count |
|-----------------------|---------------|
| MIT | 553 |
| Apache-2.0 | 41 |
| ISC | 25 |
| MPL-2.0 | 12 |
| LGPL-3.0-or-later | 10 |
| BSD-2/3 | 14 |
| Dual / other (MIT OR Apache-2.0, BlueOak, 0BSD, MIT-0, CC0, arrays) | remainder |

**Flagged non-MIT-family entries (not “GPL-only product poison,” but must be known):**

| License | Packages (examples) | Why in tree (lock provenance) | Relevance to D-20 GitHub-read transport |
|---------|---------------------|-------------------------------|----------------------------------------|
| **LGPL-3.0-or-later** | `@img/sharp-libvips-*` (multi-arch), some `@img/sharp-win32-*` dual Apache+LGPL | Transitive via **`miniflare` → `sharp`** (Cloudflare/local Workers tooling path; `sharp` itself Apache-2.0) | **Not on GitHub Action execution critical path** if only Node HTTP + GitHub provider used; still present if full monorepo install/deploy uses miniflare/wrangler |
| **MPL-2.0** | `lightningcss` + platform packages | Front-end/CSS tooling (web workspace / bundling) | **Build/web tooling**, not GitHub REST action core |
| **MIT OR EUPL-1.1+** | `@zone-eu/mailsplit` | Via **mailparser** (Gmail/email path) | **Out of D-20**; only if Gmail/mail stack is later enabled |

### 5.4 Explicit unreviewed remainder (gate honesty)

| Remainder | Status |
|-----------|--------|
| Per-file LICENSE text of every nested package beyond lockfield `license` | **Not** opened file-by-file |
| Runtime native binaries inside sharp-libvips / workerd optional scripts | **Not** binary-audited |
| Whether a minimal production image can omit miniflare/sharp/web workspace | **Not** proven by packaging experiment (no install/run this task) |
| Legal opinion on LGPL dynamic linking of sharp-libvips if Cloudflare path ships | **Out of G3 scope** — flag only |
| SPDX completeness vs npm `license` field accuracy | Assumed npm field = best available evidence |

**D-13 statement:** Direct runtime dependencies for the gateway are **permissive (MIT/MIT-0/Apache samples)**. Full lock tree is **mostly MIT/Apache** with **known LGPL (libvips via sharp/miniflare)** and **MPL (lightningcss)** tooling packages. **This is not a “clear to adopt” license sign-off** — it is an inventory with named remainders. Adoption remains **false**.

---

## 6. Exit boundary (D-13)

| Layer | Owner | On exit |
|-------|--------|---------|
| Selected-repo evidence (SHA, issue/PR ids, excerpts, links) | **Product** | Retain; source revision stays on evidence |
| Auth / expiry / revoke / confirm / audit records | **Product** | Retain |
| Retrieval traces & result events | **Product** | Retain |
| OpenConnector process, connection aliases, runtime tokens, idempotency cache, provider schemas | **Transport only** | Delete/stop; **must not** be sole truth |
| Replacement | Any other transport (e.g. direct GitHub REST client, different gateway) | Swap behind product adapter boundary **if/when** Owner authorizes engineering |

Removing OpenConnector must not erase D-20 facts already stored as product evidence.

---

## 7. What this addendum does **not** claim

- Not adopted; not D-13 complete for shipping without G5 public-read verification + Owner acceptance.  
- No connector install, credentials, server start, adapter, spike, or production code.  
- No statement that `repo` scope is acceptable for production OAuth.  
- No statement that unauthenticated public REST equals OpenConnector behavior (G5 path is separate).

## 8. Residual open items for T-11 record

1. G5 isolated public GitHub REST verification (pending in initial record).  
2. Owner decision after G1 synthesis.  
3. If engineering ever starts: packaging profile that excludes unused LGPL/MPL tooling if required by policy.

## Method

```text
git checkout 1fc404feeb7643e6cdfbece046f3c09be9495826
Read LICENSE.txt, NOTICE.md, package.json, package-lock.json (license fields)
Read src/providers/github/{actions,definition,executors,scopes,runtime-*}.ts
Read src/core/action-policy.ts, docs/runtime-api.md
Cross-ref T11-openconnector-fc-opc-github-read-adoption-record.md
```
