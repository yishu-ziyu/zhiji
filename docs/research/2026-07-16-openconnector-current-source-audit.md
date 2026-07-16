# OpenConnector current source audit (T-15 / G3)

- Seat: G3 · read-only
- Wave: `.ship/handoffs/TEAM-WAVE-openconnector-browser-tools.md` (G3 section)
- Product context: Owner **D-18** — public read-only web + **one selected GitHub repo first**; selected Drive next; Gmail/full sync and external writes later
- Date: 2026-07-16
- Non-goals: no account access, no connector install, no production edits, no adapter/spike

## Pin

| Item | Value |
|------|--------|
| Repo | https://github.com/oomol-lab/open-connector |
| Local audit clone | `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/tmp/g3-openconnector-audit/open-connector` |
| **HEAD inspected** | `1fc404feeb7643e6cdfbece046f3c09be9495826` |
| HEAD message | `feat(auth): add JWT runtime authentication (#130)` |
| `git describe` | `v1.1.0-28-g1fc404f` |
| package.json version | `1.1.0` (private monorepo package `@oomol-lab/open-connector`) |
| Latest release tag (API) | `v1.1.0` → commit `11e36e8706ab…` (HEAD is **28 commits after tag** on this shallow history describe) |
| **Contract pin (old)** | `c50596dfed67b94f8d87867fc963403b621b6a4f` — `feat(runtime): add idempotent action execution (#120)` (2026-07-15) |
| Commits HEAD − pin | **10** (this clone: `git rev-list --count c50596df..HEAD`) |

**Recommendation for any future engineering pin:** freeze either `v1.1.0` **or** a specific HEAD SHA after license + action allowlist review; do not rely on floating `main`. Document whether JWT env vars are required.

---

## License

| Layer | Finding |
|-------|---------|
| Project | **Apache-2.0** — `LICENSE.txt` present; `NOTICE.md` trademarks disclaimer |
| GitHub API metadata | `license.spdx_id`: Apache-2.0 |
| Runtime deps (lockfile licenses sampled) | `hono` MIT · `jose` MIT · `@modelcontextprotocol/sdk` MIT · `minisearch` MIT · `zod` MIT · `imapflow` MIT · `mailparser` MIT · `nodemailer` MIT-0 · `ali-oss` MIT |
| Constraints | Operators store third-party OAuth/API secrets (`SECURITY.md`); encryption via `OOMOL_CONNECT_ENCRYPTION_KEY`; Cloudflare path uses D1/Workers. **No GPL-family in sampled direct deps.** Full third-party notice inventory not regenerated this pass (lockfile is large). |

Product still owns: which actions are allowed (`OOMOL_CONNECT_ALLOWED_ACTIONS`), which credentials are connected, confirmation for side effects (D-15), and what becomes project knowledge (D-16). Gateway license alone does not grant product implementation.

---

## Execution model (source)

- HTTP: `POST /v1/actions/:actionId` (see `docs/runtime-api.md`)
- Auth: runtime bearer token and/or **JWT** (HEAD) when `OOMOL_CONNECT_JWKS_URI` + issuer + audience set — `src/server/api/runtime-jwt.ts`
- Idempotency: optional `Idempotency-Key` on action POST; 24h response replay — introduced at pin `c50596df`, still documented at HEAD (`docs/runtime-api.md`, `docs/credentials.md`)
- Policy: `OOMOL_CONNECT_ALLOWED_ACTIONS` / `BLOCKED_ACTIONS` / proxy allow-deny — `src/core/action-policy.ts`
- Surfaces: HTTP Runtime API, MCP (`src/mcp.ts`), web console, optional Cloudflare (`docs/cloudflare.md`)

**All provider calls observed are on-demand action execution.** There is no first-class GitHub **webhook inbound feed** in `src/providers/github`. “Activity” is **polled** via GitHub Events REST wrappers (`list_*_events`).

---

## GitHub provider — read map for D-18 “one selected repo”

Source of truth for action list: `src/providers/github/actions.ts`  
Scopes: `src/providers/github/scopes.ts`  
Runtimes: `runtime-repository.ts`, `runtime-issue.ts`, `runtime-pull-request.ts`, `runtime-activity.ts`, `runtime-search.ts`, `runtime-release.ts`, `runtime-shared.ts`

### OAuth / PAT scope packages

| Export | GitHub scopes |
|--------|----------------|
| `githubUserReadScopes` | `read:user`, `user:email` |
| `githubRepoScopes` | **`repo`** (broad: private repo + **write** capabilities at GitHub’s token model) |
| `githubWorkflowScopes` | `workflow` |
| `githubDeleteRepoScopes` | `delete_repo` |
| Default OAuth bundle | all of the above |

**Product implication:** Prefer **fine-grained PAT** limited to one repository, **read-only** contents/metadata/issues/PRs, not classic `repo` if avoidable. OpenConnector’s action `requiredScopes` still declare `githubRepoScopes` for most private-repo reads — operators must constrain token + `OOMOL_CONNECT_ALLOWED_ACTIONS` / `BLOCKED_ACTIONS`.

### On-demand reads needed by D-18 questions

| Need | Action id(s) | Primary inputs | `requiredScopes` in source |
|------|--------------|----------------|----------------------------|
| Commits list | `github.list_commits` | owner, repo; optional sha/path/author/since/until | `repo` |
| Commit detail | `github.get_commit` | owner, repo, ref | `repo` |
| Diff range | `github.compare_commits` | owner, repo, basehead | `repo` |
| Search commits | `github.search_commits` | query | (see actions.ts; search often empty-or-repo) |
| File tree | `github.list_directory_contents` | owner, repo; optional path/ref | `repo` |
| File contents | `github.get_file_contents` | owner, repo, path; optional ref | `repo` — returns base64 + decoded text |
| Issues list | `github.list_repository_issues` | owner, repo; state/labels/… | `repo` (PRs filtered out of list) |
| Issue get | `github.get_issue` | owner, repo, issueNumber | `repo` |
| Issue comments / timeline / events | `github.list_issue_comments`, `list_issue_timeline_events`, `list_issue_events`, `list_repository_issue_events` | owner, repo, … | `repo` |
| Issue/PR search | `github.search_issues_and_pull_requests` | query + filters | (search action) |
| PRs list | `github.list_pull_requests` | owner, repo | `repo` |
| PR get / files / commits / reviews / comments | `github.get_pull_request`, `list_pull_request_files`, `list_pull_request_commits`, `list_pull_request_reviews`, `list_pull_request_review_comments`, `list_pull_request_requested_reviewers`, `list_pull_requests_associated_with_commit`, `check_pull_request_merged` | owner, repo, pullNumber / sha | `repo` |
| Repo metadata | `github.get_repository`, `list_branches`, `get_branch` | owner, repo | `repo` |
| Repo activity (poll) | `github.list_repository_events` | owner, repo | `repo` |
| Broader activity (poll) | `list_public_events`, `list_user_public_events`, `list_user_received_public_events`, `list_authenticated_user_events`, `list_authenticated_user_received_events` | username or none | varies / `repo` or user |
| Code search | `github.search_code` | query | **`requiredScopes: []`** in source (public search; private still needs token rights) |
| Releases (optional activity) | `list_releases`, `get_release`, `get_latest_release`, `get_release_by_tag`, `list_release_assets` | owner, repo | `repo` |

### Writes present but **out of D-18 first batch** (must allowlist-deny)

Examples (not exhaustive): `create_issue`, `update_issue`, `create_issue_comment`, `create_pull_request`, `merge_pull_request`, `create_or_update_file`, `delete_file`, `delete_repository`, `create_release`, review submit/merge, workflow `rerun_workflow`, etc.  
Policy tests use `github.create_issue` as blocked example (`src/core/action-policy.test.ts`).

### On-demand vs inbound feed

| Mode | Supported in source? | Mechanism |
|------|----------------------|-----------|
| On-demand read/write actions | **Yes** | `POST /v1/actions/github.*` |
| Inbound GitHub webhooks → product events | **Not found** as provider feature | No webhook handler under `src/providers/github` |
| “Feed-like” | **Poll only** | `list_*_events` / issue events / Gmail `list_history` |

For “why did this project change?”, product should **schedule or agent-trigger** on-demand reads against the selected repo, not wait for OpenConnector push.

### Suggested minimal allowlist (research only, not implemented)

```text
github.get_repository
github.list_branches
github.get_branch
github.list_commits
github.get_commit
github.compare_commits
github.list_directory_contents
github.get_file_contents
github.list_repository_issues
github.get_issue
github.list_issue_comments
github.list_issue_timeline_events
github.list_pull_requests
github.get_pull_request
github.list_pull_request_files
github.list_pull_request_commits
github.list_repository_events
github.search_issues_and_pull_requests
github.search_code
github.search_commits
```

Block `github.*` write verbs and `delete_*` / `merge_*` / `create_*` until Owner opens that class.

---

## Gmail — exists, scopes, why later

| Item | Evidence |
|------|----------|
| Provider present | `src/providers/gmail/` (`actions.ts`, `scopes.ts`, `message.ts`, `executors.ts`) |
| Read/search | `gmail.search_threads`, `list_threads`, `fetch_emails`, `get_message`, `fetch_message_by_message_id`, `fetch_message_by_thread_id`, `get_profile`, drafts list/get, labels list/get, `list_history`, filters list/get, various settings **get** |
| Write/send | `send_email`, `reply_email`, `reply_to_thread`, draft create/update/send/delete, label mutate, trash, filters create/delete, settings **update**, `stop_watch` |
| Read scope | `https://www.googleapis.com/auth/gmail.readonly` (`gmailReadScopes`) |
| Other scopes | modify, compose, send, labels, settings.basic, settings.sharing (`scopes.ts`) |
| Docs | `docs/gmail-oauth-sdk.md` (+ zh-CN) |
| OAuth burden | Google Cloud OAuth client + consent; mailbox privacy; easy over-grant if full `gmailOAuthScopes` used |

**Why Gmail stays later (aligned with D-18 / D-10 / D-15 / D-17):**

1. **Private personal data** — not public web; needs explicit connect + expiry/revoke story.  
2. **Search/read is only part of surface** — same provider exposes **send** and mailbox mutation; accidental allowlist of `gmail.*` is dangerous.  
3. **Full sync temptation** — `list_history` / fetch loops can pull high volume; D-16 wants cited evidence only, not mailbox dump.  
4. **Authorization UX cost** higher than single-repo GitHub PAT for hackathon/product first path.  
5. Owner order already: GitHub selected repo first → Drive selected files → Gmail later.

If ever opened: allow only `gmail.search_threads|fetch_emails|get_message|get_profile` + `gmail.readonly` token; **block** `send_*` / `reply_*` / trash / settings update.

---

## Diff vs fixed commit `c50596df…`

| Area | Change since pin |
|------|------------------|
| Idempotency (HTTP actions) | **Present at pin**; still core at HEAD (not removed) |
| GitHub action definitions | **No diff** in `src/providers/github/actions.ts` on this range (stat empty for github provider) |
| Auth | **HEAD adds JWT** runtime validation (`runtime-jwt.ts`, config docs) |
| Action policy | Fixes for bare `*` matcher, proxy vs action policy interaction (`#126`, `#128`) |
| Other | New/expanded providers (Tailscale, Feishu OAuth, Dune, …) — out of D-18 first path |
| package.json | +`jose` for JWT |

**Contract risk:** Product docs that pin `c50596df` remain valid for **idempotent create_issue smoke**. Current `main`/HEAD adds JWT option and policy fixes; re-pin if engineering restarts.

---

## Runtime / transitive notes for product

- Node local server + optional Cloudflare Workers path.  
- Credentials encrypted at rest when `OOMOL_CONNECT_ENCRYPTION_KEY` set; otherwise startup warns.  
- MCP can invoke actions (`src/mcp.ts`) — product should still enforce allowlist (do not expose full `github.*` to model).  
- Proxy path (`OOMOL_CONNECT_ALLOWED_PROXIES`) separate from action allowlist — review if used.  
- `ali-oss` dependency indicates China OSS provider support; irrelevant to GitHub-first path but increases supply chain surface.

---

## Implications for D-10 / D-15 / D-16 / D-17 / D-18

| Decision | Source-backed note |
|----------|-------------------|
| D-10 | Gateway does not implement product confirmation UI; it executes allowed actions with stored credentials. Pre-auth = connected alias + allowlist. |
| D-15 | Many write actions exist; product must confirm external sends/writes. Prefer action allowlist that is **read-only** for GitHub first batch. |
| D-16 | OpenConnector returns API JSON; product must store retrieval **trace** and promote only used evidence — not auto-ingest full issue lists. |
| D-17 | Connection aliases + scopes + allowlist + token revoke in OpenConnector console; product still needs expiry policy and Owner-visible source boundary. |
| D-18 | **Feasible on current source** for selected GitHub repo **reads** via actions listed above; **no webhook feed**; Gmail ready in source but correctly deferred. |

---

## Residual risks / not verified this pass

- Did not run OpenConnector server, OAuth, or live GitHub/Gmail API.  
- Did not inventory every provider’s transitive native binaries.  
- Fine-grained GitHub PAT mapping to each REST endpoint not re-tested live.  
- Shallow clone: full history beyond pin window not required for action map.

## Method

```text
gh repo clone oomol-lab/open-connector (local tmp only)
git rev-parse HEAD; git log c50596df..HEAD
Read LICENSE.txt, NOTICE.md, package.json, package-lock licenses (sample)
Read src/providers/github/*, src/providers/gmail/scopes+actions, docs/runtime-api.md, docs/credentials.md
rg for webhook/idempotency/policy
```

## Next owner

G1: synthesis with G4/G5/G6 outputs.  
G2: ledger only — **no implementation authority** from this audit.
