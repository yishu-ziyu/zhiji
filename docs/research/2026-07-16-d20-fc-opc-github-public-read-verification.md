# D-20 isolated public GitHub read verification

- Date: 2026-07-16 (UTC probe ~08:31–08:32)
- Seat: G5
- Assignment: `.ship/handoffs/ASSIGN-G5-D20-isolated-github-read-verification.md`
- Target: public `yishu-ziyu/fc-opc-ibot` (GitHub id `1287818904`, `private: false`)
- Method: **unauthenticated HTTP GET only** via Node `fetch` (no `Authorization` header, no token, no `gh auth`)
- Write methods issued: **none** (no POST/PATCH/PUT/DELETE)
- Credentials: **none**
- Isolated probe dir: `tmp/g5-d20-github-read/`
- Product/config/connector: **not modified**

## Owner-language result

We have **reproducible proof** that the D-20 object set for this public repository can be **read without account credentials** for: repository metadata, commits (with per-file patches), compare diffs, exact-revision file content, issues API (list/detail/comments), and pull requests (detail, changed files with patches, reviews, review comments).

No probe returned **401/403**. No authentication grant was attempted or required to complete the assignment.  
Note: this repo currently has **zero pure Issues** (`search?q=...+is:issue` → `total_count: 0`); Issues endpoints still return **200** (empty or PR-as-issue shapes). That is a **data emptiness** fact, not an auth boundary.

## Probe inventory (all GET)

Full machine log: `tmp/g5-d20-github-read/request-log.txt` · `request-log.json`  
`auth_header_sent: false` on every row.

| # | Endpoint (path) | Status | Object proof |
|---|---|---|---|
| 1 | `/repos/yishu-ziyu/fc-opc-ibot` | 200 | `full_name`, `private:false`, default branch |
| 2 | `/repos/.../commits?per_page=5` | 200 | default-branch tip commit list |
| 3 | `/repos/.../commits/{sha}` | 200 | sha `b1d47d4a…` · 44 files · patches on text files · stats |
| 4 | `/repos/.../contents/README.md?ref={init sha}` | **404** | path absent at that revision (not auth) |
| 5 | `/repos/.../contents/package.json?ref=b1d47d4a…` | 200 | blob sha `5f2c7757…` · base64 content · decoded preview |
| 6 | `/repos/.../issues?state=all&per_page=10` | 200 | includes PR #3 as issue-shaped objects |
| 7 | `/repos/.../issues/3` | 200 | issue/PR #3 detail |
| 8 | `/repos/.../issues/3/comments` | 200 | `[]` empty comments |
| 9 | `/repos/.../pulls?state=all&per_page=10` | 200 | PR list |
| 10 | `/repos/.../pulls/3` | 200 | PR #3 detail · changed_files count |
| 11 | `/repos/.../pulls/3/files` | 200 | file list + patches (large body) |
| 12 | `/repos/.../pulls/3/reviews` | 200 | review id `4700659873` state `COMMENTED` |
| 13 | `/repos/.../pulls/3/comments` | 200 | review comment id `3584307606` on `shared/knowledge/repository.ts` |
| 14 | `/rate_limit` | 200 | unauth core limit **60**/hr (remaining observed mid-run) |
| 15 | `/repos/.../branches` | 200 | includes `main`, ship branch, checkpoints |
| 16 | `/repos/.../git/trees/{sha}` | 200 | root tree paths at init sha |
| 17 | `/repos/.../commits?sha=main&per_page=3` | 200 | main history |
| 18 | `/repos/.../commits/cf0f597b…` | 200 | main HEAD · 253 files · 190 with patches · 2 parents |
| 19 | `/repos/.../compare/{parent}...cf0f597b…` | 200 | compare `ahead` · 72 commits · 253 files |
| 20 | `/repos/.../contents/package.json?ref=cf0f597b…` | 200 | exact file at main HEAD · blob `63af81c9…` |
| 21 | `/search/issues?q=repo:…+is:issue` | 200 | `total_count: 0` pure issues |

### Commits + diffs

- Init tip on default ship branch: `b1d47d4a597a367b69343ea2781d588bc878babb` (“chore: init main branch”) — root commit, **no parents** → `/compare` N/A; **diffs present** as `files[].patch` on commit detail (e.g. `.gitignore`, `package.json`, app sources). Evidence: `raw/02-commit-detail.json`, `commit-diff-summary.json`.
- `main` HEAD: `cf0f597b4d7bd8f7d291229f8a9e1117adc70fba` with parents; compare  
  `f5a58ec0…...cf0f597b…` → 200, `status: ahead`, patches available. Evidence: `raw/18-compare-main.json`, `main-branch-probe.json`.

### Exact-revision file

- At `b1d47d4a…`: `GET .../contents/package.json?ref=b1d47d4a…` → 200, content base64, preview starts with `"name": "fc-opc-ibot"`. Saved: `package.json@b1d47d4.txt`, `raw/03b-file-package-json-at-sha.json`.
- `README.md` at that sha and on default ship branch ref → **404 Not Found** (file missing in tree, not private).
- At `main` HEAD: `package.json` → 200, size 1031, blob `63af81c96e0e97ebc95974af659d0e6d317364b6`.

### Issues + comments

- List/detail/comments endpoints: **all 200 unauthenticated**.
- Pure issues in repo: **0** (search API). Sample issue-shaped object is **PR #3**.
- `issues/3/comments` → `[]` (200). Conversation for that PR lives under **pull review comments**, not issue comments.

### PRs + files + reviews

- PR **#3**: detail 200; files 200 (many patches); reviews 200 (1 review by `chatgpt-codex-connector[bot]`); review comments 200 (path `shared/knowledge/repository.ts` line 849).  
  Evidence: `raw/08-pr-detail.json` … `raw/11-pr-review-comments.json`.

## Auth boundary

| Question | Answer |
|---|---|
| Did any required object need auth? | **No** for this public repo’s D-20 read set |
| 401/403 encountered? | **No** |
| Minimum scope if private/sensitive later? | Not triggered. If a future private repo or private object returned 404/403, stop and report before grant. Typical **read-only** GitHub fine-grained scopes would be Contents: Read, Issues: Read, Pull requests: Read, Metadata: Read — **not requested or used here** |
| Rate limit risk | Unauthenticated **60 req/hr/IP**; production connectors should not rely on this alone |

## Mapping to decisions

| Decision | Implication of this proof |
|---|---|
| **D-20** | Public GitHub object set for `yishu-ziyu/fc-opc-ibot` is readable without credentials for commits/diffs, exact file@rev, issues API, PRs/files/reviews |
| **D-10** | Pre-authorized public read is technically feasible; product must still **show source** (repo, rev, URL) when using hits as evidence |
| **D-15** | This wave used **read-only GET**; no write/mutation. Writes remain later and confirmation-gated |
| **D-16** | API returns locators (`html_url`, sha, path, review/comment ids) suitable as **candidate** citations; must not auto-promote full dumps to confirmed knowledge |
| **D-17** | Unauth public read has no connection grant/expiry; product still needs Owner-visible authorization record if a tokenized connector is ever used |
| **T-11** | This is a **verification record**, not an OpenConnector adoption/T-11 dependency pin. Any connector adoption still needs separate fixed version, license, seam, and exit |

## Non-goals confirmed

- No login, token, cookie, or `Authorization` header  
- No issue/PR mutation  
- No OpenConnector install/runtime  
- No product/data/config edit  
- No merge

## Reproduce

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
# Node fetch GET without Authorization — see tmp/g5-d20-github-read/request-log.txt
# Or single example:
node -e "fetch('https://api.github.com/repos/yishu-ziyu/fc-opc-ibot/commits?per_page=1',{headers:{Accept:'application/vnd.github+json','User-Agent':'G5-D20-public-read-verify/1.0'}}).then(async r=>console.log(r.status, (await r.text()).slice(0,120)))"
```

## Residual risks

- Default branch name is a long `ship/...` ref; `main` differs — product must pin **exact ref/sha**, not assume `main`.  
- Unauth rate limit is low.  
- Empty pure Issues means issue-comment UX must not be assumed populated.  
- Large PR file payloads (500KB+) — connectors should page and store only used evidence.

## Evidence paths

```
tmp/g5-d20-github-read/request-log.txt
tmp/g5-d20-github-read/request-log.json
tmp/g5-d20-github-read/summary.json
tmp/g5-d20-github-read/commit-diff-summary.json
tmp/g5-d20-github-read/extra-exact-file.json
tmp/g5-d20-github-read/main-branch-probe.json
tmp/g5-d20-github-read/raw/*.json
docs/research/2026-07-16-d20-fc-opc-github-public-read-verification.md
.ship/handoffs/G5-D20-isolated-github-read-verification-DONE.md
```
