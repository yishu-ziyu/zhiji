# D-51 / D-52 Project Agent Implementation Plan

> **For Engineering Lead 2 (`surface:65`):** dispatch this packet task-by-task in isolated worktrees. Keep WIP at at most two implementation builders plus one integration seat. The independent verifier must not implement the code it verifies.

**Goal:** After the Owner authorizes this repository folder once, the Agent autonomously maps the project, selectively uses safe in-root tools, reasons from exact revisions, and produces a source-backed candidate with visible model/tool/stop receipts and Owner interrupt/confirmation boundaries.

**Architecture:** A deep `ProjectAgentRuntime` module owns the bounded asynchronous loop. It asks the replaceable `ProjectAgentModelLoop` for the next decision, executes only allowlisted calls through a grant-scoped `ProjectAgentToolHost`, validates evidence itself, persists append-only receipts, and saves only a candidate. StepFun is one model adapter; it does not own tools, authorization, project truth, or Owner decisions. The pre-D-51 `AgentModelLoop.propose` surface is legacy and remains only until Wave C migrates its D-50 caller.

**Tech Stack:** Next.js App Router · TypeScript · Node 22 · SQLite (`node:sqlite`) · existing CAS/project-memory store · direct Anthropic-compatible Messages transport · Git CLI read-only allowlist · Vitest.

## Global constraints

- Authority: `docs/product/SOLUTION-D-51-product-agent-architecture-mvp-model.md`, `docs/product/SOLUTION-D-51-mvp-llm-endpoint-config.md`, `docs/product/SOLUTION-D-52-agent-autonomous-tools-in-authorized-root.md`.
- Product behavior baseline: D-50 closed tip `c2641d3b12fca6801e232abf4ac6de78c7d92819`.
- Canonical engineering line: `g2/d50-onboarding-integration@8acc36af`, which is the product baseline plus only `TEAM_OPERATING_MODEL.md` and `TEAM_CMUX.md`.
- MVP model pin: base `https://api.stepfun.com/step_plan`; adapter appends `/v1/messages`; model `step-3.7-flash`; request body `output_config: { effort: "high" }`; secret env name `LLM_API_KEY` only.
- Never print, copy, hash, commit, or send the secret value. Product/runtime must not depend on CC Switch or `127.0.0.1:15721`.
- No framework adoption. Q-33 remains open; no LangGraph, Temporal, Mastra, or AI SDK dependency.
- First implementation/acceptance slice is local authorized-root only. Public/pre-authorized external reads retain D-10/D-18 rules but are not a first-slice tool adapter.
- No per-read confirmation inside the active grant. Outside-root, sensitive/paid/unapproved source, or any write/send/delete/commit stops before the effect.
- The Agent never receives `OwnerDecisionWriter`; it can only read and create candidates.
- Reuse existing `OriginalRevision`, CAS, `UnderstandingRevision`, and `AnalysisRun`; do not create parallel Evidence/Candidate/Confirmation lifecycles.
- Process truth and FS traffic stay with EL2. EL1 does not directly dispatch FS seats.

---

## 0. Canonical execution control plane

This section is binding for every implementation, runtime proof, and independent acceptance in this packet.

| Item | Canonical value |
|---|---|
| Product behavior baseline | `c2641d3b12fca6801e232abf4ac6de78c7d92819` |
| Canonical engineering line | `g2/d50-onboarding-integration@8acc36af` |
| Contains | accepted MVP tip `3b6c33a1` plus the four D-50 commits plus only the current `TEAM_OPERATING_MODEL.md` and `TEAM_CMUX.md` |
| Canonical worktree | `/Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/16/fc-opc-ibot` |
| Owner runtime HEAD | `c2641d3b12fca6801e232abf4ac6de78c7d92819`; the docs-only engineering tip is not required to execute product behavior |
| Owner runtime URL | `http://127.0.0.1:3331/track/knowledge/mvp` |
| Owner runtime port | `3331` only for this control line |
| D-50 Owner authorize entry | `/tmp/mvp-v0-g6-d50-fixture` only |
| D-50 fixture source | repo `.ship/fixtures/mvp-v0-g6-owner-project`; the authorize entry above must resolve to this directory |
| Isolated runtime state | `/tmp/fc-opc-ibot-c264-owner-runtime-3331` via `PROJECT_MEMORY_DATA_DIR` |
| P0 capacity | 9 available leases: slots `3–8`, `11`, `14`, `15`; sufficient for isolated writers and an independent verifier |
| Non-authoritative runtime | port `3000` from dirty main-tree HEAD `80bcb0b7`; never cite it as c264 evidence |

P0 control-plane gate is **PASS**. Durable runtime/capacity evidence: `.ship/handoffs/EL2-P0-CONTROL-PLANE-READY.md`.

### Runtime start contract (Engineering Lead 2)

Run in a tracked cmux terminal, not a detached shell. Do not copy or print secrets.

```bash
cd /Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/16/fc-opc-ibot
test "$(git rev-parse HEAD)" = "c2641d3b12fca6801e232abf4ac6de78c7d92819"
test "$(readlink /tmp/mvp-v0-g6-d50-fixture)" = \
  "/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/fixtures/mvp-v0-g6-owner-project"
test -d /tmp/mvp-v0-g6-d50-fixture
test -z "$(lsof -tiTCP:3331 -sTCP:LISTEN 2>/dev/null)"
PROJECT_MEMORY_DATA_DIR=/tmp/fc-opc-ibot-c264-owner-runtime-3331 \
  npm run dev -- --port 3331
```

After the listener is up, attribution evidence must include all three checks:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' \
  http://127.0.0.1:3331/track/knowledge/mvp
lsof -nP -iTCP:3331 -sTCP:LISTEN
lsof -a -p "$(lsof -tiTCP:3331 -sTCP:LISTEN | head -n 1)" -d cwd -Fn
```

Expected: HTTP `200`; listener on `3331`; process cwd is the canonical worktree above. The SHA comes from the pre-start `git rev-parse`, not a UI label or environment variable.

### Dirty-tree and lease rules

- Slot 16 currently contains generated/runtime-only paths (`next-env.d.ts`, `data/knowledge/project-memory/`, `pnpm-lock.yaml`). Preserve them, do not claim the lease clean, and do not recycle it while the canonical runtime is active.
- Never use `git add -A` or `git add .`. Each implementation commit stages only the exact files owned by its current task.
- A lease may be returned only after the recorded holder has ended, its process is stopped, and `git status --short` is empty. Do not force-return a dirty lease.
- Engineering Lead 2 maintains at least one isolated writer slot and one distinct independent-verifier slot before opening the implementation wave.

### Necessary baseline acceptance before D-51/D-52 implementation

On `3331`, enter `/tmp/mvp-v0-g6-d50-fixture` in the native folder authorization dialog. It resolves to the repo-owned fixture source `.ship/fixtures/mvp-v0-g6-owner-project`; do not authorize the repo path directly. Independently prove and record:

1. entry offers Continue or native folder choice without project ID/root/watch syntax;
2. cancel creates no grant; selected folder is the visible permission boundary;
3. connect/reconcile reads only inside that root and shows real progress;
4. first output is candidate understanding with source evidence plus explicit unknowns;
5. Owner confirm remains separate; reload/Continue restores the accepted state;
6. runtime evidence names URL `3331`, runtime/product SHA `c2641d3b`, future implementation/integration parent `8acc36af`, fixture path, and canonical cwd.

Any evidence from port `3000`, HEAD `80bcb0b7`, fixture other than `/tmp/mvp-v0-g6-d50-fixture`, or superseded tip `996b30e8` is non-canonical and cannot open/close an engineering gate.

---

## 1. Engineering decisions (frozen for this packet)

### 1.1 Deep modules and seams

| Module | Interface | Implementation responsibility |
|---|---|---|
| `ProjectAgentRuntime` | `start`, `get`, `interrupt` | asynchronous bounded loop, progress, stop validation, candidate save |
| `ProjectAgentToolHost` | one typed `execute` method | authorization, path/revision validation, allowlisted project/Git tools, receipts |
| `ProjectAgentModelLoop` | `nextStep` | StepFun JSON decision or deterministic fallback; no tool execution |
| `AgentRunRepository` | create/update/read run + append receipt | SQLite durability, restart honesty, no Owner resolution |
| `SourceRevisionCatalog` | list current revisions + capture used Git blob | existing originals/CAS; captured history does not create a false change event |

The deletion test applies: authorization and tool safety must not be repeated in routes, model prompts, or UI callers. Routes call the runtime; the runtime calls the tool host.

### 1.2 Model-step protocol

Use structured JSON decisions over the existing Messages transport rather than provider-native tool execution. This preserves the replaceable model seam and keeps authorization in product code.

```ts
export type AgentLoopDecision =
  | { kind: "tools"; calls: ProjectAgentToolCall[] }
  | {
      kind: "finish";
      proposedStop: "evidence_sufficient" | "unknown";
      body: UnderstandingBody;
    }
  | {
      kind: "confirmation_required";
      reason: "expand_scope" | "sensitive_source" | "write_action";
      summary: string;
    };

export interface ProjectAgentModelLoop {
  nextStep(
    input: AgentLoopContext,
    signal: AbortSignal,
  ): Promise<{ decision: AgentLoopDecision; receipt: AgentModelCallReceipt }>;
}
```

The runtime, not the model, owns the final stop code. `evidence_sufficient` is valid only after exact-anchor verification. Unsupported claims are downgraded to unknown/conflicted before candidate persistence.

### 1.3 Bounded autonomy defaults

These are engineering safety defaults, configurable in code and not advertised as a permanent product limit:

```ts
export const DEFAULT_AGENT_RUN_BUDGET = {
  maxModelTurns: 12,
  maxToolCalls: 24,
  maxFilesRead: 32,
  maxWallMs: 180_000,
  maxToolResultBytes: 64 * 1024,
  maxContextBytes: 256 * 1024,
} as const;
```

- One model turn may request at most four tool calls.
- A truncated result says so in its receipt and invites a narrower follow-up.
- Hitting a cap yields stop reason `budget`, a partial candidate with explicit gaps, or honest `unknown`; never silent success.

### 1.4 First-run scope policy

- No accepted understanding yet: `project_map` may cover the full authorized root, subject to D-50 excludes and the budget.
- Later matter reconstruction: map/search defaults to the active `MatterWatchSet`; a broader in-root call must include a reason recorded in the tool receipt.
- The model never receives a root path it may rewrite. The runtime derives `grantId` and canonical root from the active matter/watch state.

### 1.5 Exact tool names and inputs

```ts
export type ProjectAgentToolCall =
  | { id: string; name: "project_map"; input: { scope: "initial_root" | "matter"; maxDepth?: number } }
  | { id: string; name: "read_revision"; input: { revisionId: string; startLine?: number; endLine?: number } }
  | { id: string; name: "search_text"; input: { query: string; pathPrefix?: string; limit?: number } }
  | { id: string; name: "search_symbols"; input: { query: string; kind?: string; pathPrefix?: string; limit?: number } }
  | { id: string; name: "search_relations"; input: { query?: string; limit?: number } }
  | { id: string; name: "git_status"; input: Record<string, never> }
  | { id: string; name: "git_log"; input: { limit?: number; relativePath?: string } }
  | { id: string; name: "git_diff"; input: { base: string; head?: string; relativePath?: string } }
  | { id: string; name: "git_show"; input: { commit: string; relativePath?: string } }
  | { id: string; name: "git_blame"; input: { commit?: string; relativePath: string; startLine?: number; endLine?: number } }
  | { id: string; name: "compare_history"; input: { leftRevisionId: string; rightRevisionId: string } }
  | { id: string; name: "query_project_memory"; input: { include: "accepted" | "events" | "both"; limit?: number } };
```

Rules:

- Inputs are normalized POSIX-relative paths; reject absolute paths, `..`, NUL, symlink escape, and paths outside the active grant.
- Git receives argv only—never a shell string. Allow only `status`, `log`, `diff`, `show`, and `blame`; disable pager, external diff, and textconv. Resolve refs to full object IDs before recording receipts.
- `project_map`, text/symbol search, and exact revision read operate over current project-memory revisions/CAS, not raw whole-disk access.
- `search_relations` is project-scoped and adapts existing knowledge relations plus accepted-understanding `depends`; it never performs a workspace-global scan.
- `query_project_memory` returns the current matter's accepted understanding and project-scoped events.
- A Git blob actually used as evidence is copied into existing CAS/originals with `sourceVersion=git:<commit>:<blob>`; this capture is idempotent, does not emit a change event, and does not move the observer's current-path tip.

### 1.6 Durable receipts and stop states

```ts
export type AgentStopReason =
  | "evidence_sufficient"
  | "unknown"
  | "owner_interrupt"
  | "budget"
  | "confirm_expand"
  | "confirm_sensitive"
  | "confirm_write"
  | "error";

export type AgentRunReceipt = {
  provider: "stepfun";
  model: string;
  effort: "high";
  calls: number;
  fallback:
    | { used: false }
    | {
        used: true;
        kind: "deterministic";
        errorClass:
          | "timeout"
          | "auth"
          | "rate_limit"
          | "provider_4xx"
          | "provider_5xx"
          | "network"
          | "invalid_response"
          | "unknown";
      };
};

export type ToolReceipt = {
  id: string;
  runId: string;
  sequence: number;
  tool: ProjectAgentToolCall["name"];
  projectId: string;
  grantId: string;
  scope: { mode: "initial_root" | "matter"; relativePaths: string[]; reason?: string };
  outcome: "ok" | "error" | "confirm_required" | "interrupted";
  summary: string;
  pins: EvidenceAnchor[];
  startedAt: string;
  finishedAt: string;
  errorClass?: string;
};
```

Receipts contain no secret, authorization header, raw prompt, full source body, or raw provider error body. Tool context passed to the model is capped and ephemeral; the durable receipt keeps the summary and exact pins.

`AnalysisRun` gains structured receipt/stop/progress fields and statuses `interrupted` and `confirmation_required`. Tool receipts live in one append-only `agent_tool_receipts` table. `analysis_runs` gets additive nullable JSON/stop/interrupt fields; legacy rows remain readable.

### 1.7 Asynchronous runtime and interrupt

```ts
export interface ProjectAgentRuntime {
  start(input: {
    projectId: string;
    matterId: string;
    trigger: AnalysisRun["trigger"];
    eventIds?: string[];
    budget?: Partial<AgentRunBudget>;
  }): Promise<AnalysisRun>;
  get(projectId: string, runId: string): Promise<AgentRunView | null>;
  interrupt(projectId: string, runId: string): Promise<AnalysisRun>;
}
```

- `POST .../analysis-runs` persists and returns a queued run with HTTP 202.
- `GET .../analysis-runs/[runId]` returns progress, candidate when ready, model receipt, tool receipts, and stop reason.
- `POST .../analysis-runs/[runId]/interrupt` sets the durable interrupt flag and aborts current fetch/Git/read work.
- On process restart, a stale `running` row becomes failed/error or explicit retry; it never masquerades as success. This MVP does not add a workflow framework.

---

## 2. Implementation waves and file mutex

### Wave A — Task 1 only: domain contracts + durable trace

**Builder class:** domain/data. **Dependency:** canonical engineering line `8acc36af` (product code baseline `c2641d3b`). **WIP:** one builder.

**Files:**

- Modify: `shared/project-memory/types.ts`
- Modify: `shared/project-memory/sqlite-store.ts`
- Modify: `shared/project-memory/sqlite-store.test.ts`
- Modify: `shared/project-memory/runtime.ts`
- Modify: `shared/project-memory/runtime.test.ts`

**Produces:** exact types in §1.5–§1.7; `AgentRunRepository`; `SourceRevisionCatalog`; additive SQLite persistence; current-revision listing; idempotent Git-blob capture into originals/CAS without a change event.

- [ ] Write RED tests for legacy-row read, run/receipt reopen, append-only tool receipts, interrupt flag, current revision listing, and Git-blob capture not moving event/current tips.
- [ ] Implement the minimum store/ports.
- [ ] Run:

```bash
npm run test:unit -- shared/project-memory/sqlite-store.test.ts shared/project-memory/runtime.test.ts
```

Expected: focused PASS; no `shared/llm`, tools, route, or UI diff.

### Wave B — Tasks 2 and 3 in parallel after Task 1 integration

#### Task 2: authorized-root tool host

**Files:**

- Create: `shared/project-memory/tools/host.ts`
- Create: `shared/project-memory/tools/project-map.ts`
- Create: `shared/project-memory/tools/revision.ts`
- Create: `shared/project-memory/tools/search.ts`
- Create: `shared/project-memory/tools/git.ts`
- Create: `shared/project-memory/tools/memory.ts`
- Create: `shared/project-memory/tools/host.test.ts`
- Create: `shared/project-memory/tools/git.test.ts`

**Consumes:** `ProjectAgentToolCall`, `ToolReceipt`, `SourceRevisionCatalog`, `ProjectMemoryReader`, active `SourceGrant`/`MatterWatchSet`.

**Produces:**

```ts
export interface ProjectAgentToolHost {
  execute(
    context: AuthorizedProjectContext,
    call: ProjectAgentToolCall,
    signal: AbortSignal,
  ): Promise<{ receipt: ToolReceipt; context: string }>;
}
```

- [ ] RED: map/list stays inside grant and D-50 excludes.
- [ ] RED: exact revision/text/symbol results carry revision/path pins.
- [ ] RED: project relations and accepted/events never leak another project.
- [ ] RED: Git allowlist returns full commit/blob pins and captures used blobs; `../`, symlink escape, arbitrary commands, writes, external diff, and out-of-root Git metadata fail/confirm before read.
- [ ] RED: abort stops file/Git work and writes an interrupted receipt.
- [ ] Implement tools without a new dependency/framework.
- [ ] Run:

```bash
npm run test:unit -- shared/project-memory/tools/host.test.ts shared/project-memory/tools/git.test.ts
```

#### Task 3: StepFun adapter + model decision seam

**Files:**

- Modify: `shared/llm/adapter.ts`
- Create: `shared/llm/adapter.test.ts`
- Modify: `shared/project-memory/agent-model-loop.ts`
- Create: `shared/project-memory/agent-model-loop.test.ts`

**Consumes:** `AgentLoopContext`, `AgentLoopDecision`, `AgentRunReceipt` from Task 1.

**Produces:** `ProjectAgentModelLoop.nextStep`; direct StepFun Messages call; structured error classification; deterministic fallback decision. Do not silently reinterpret the legacy `AgentModelLoop.propose` contract.

- [ ] RED mocked fetch asserts effective URL `https://api.stepfun.com/step_plan/v1/messages`, model `step-3.7-flash`, and `output_config.effort="high"`.
- [ ] RED direct success receipt has `provider=stepfun`, `model=step-3.7-flash`, `effort=high`, `fallback.used=false`.
- [ ] RED timeout/auth/rate-limit/4xx/5xx/network/invalid JSON produce bounded classes and deterministic fallback receipt; no raw response body or secret persists.
- [ ] RED `AbortSignal` cancels the provider fetch.
- [ ] Implement `completeWithReceipt`; keep legacy `complete()` as a text-only wrapper for unrelated callers.
- [ ] Run one fixture-only real StepFun call using the ignored `.env.local` secret. Evidence records only timestamp, provider/model/effort, HTTP success, response byte count/digest, and exit status—never key, prompt, response, or source content.
- [ ] Run:

```bash
npm run test:unit -- shared/llm/adapter.test.ts shared/project-memory/agent-model-loop.test.ts
```

### Wave C — Task 4 only: bounded runtime + routes

**Dependency:** integrate Task 2 then Task 3. **WIP:** one builder.

**Files:**

- Create: `shared/project-memory/agent-runner.ts`
- Create: `shared/project-memory/agent-runner.test.ts`
- Modify: `shared/project-memory/reconstruct.ts`
- Modify: `shared/project-memory/reconstruct.test.ts`
- Modify: `app/api/knowledge/projects/[id]/analysis-runs/route.ts`
- Create: `app/api/knowledge/projects/[id]/analysis-runs/[runId]/route.ts`
- Create: `app/api/knowledge/projects/[id]/analysis-runs/[runId]/interrupt/route.ts`
- Create: `tests/unit/project-agent-run-api.test.ts`

**Consumes:** Task 1 store/contracts, Task 2 tool host, Task 3 model loop.

**Produces:** `ProjectAgentRuntime`; asynchronous start/get/interrupt routes; evidence-validated stop; candidate-only persistence.

- [ ] RED: first run chooses multiple tools without user-supplied paths/snippets and passes only relative in-grant scope.
- [ ] RED: `evidence_sufficient` requires verified exact anchors; otherwise downgrade and stop `unknown`.
- [ ] RED: budget cap, provider fallback, confirmation request, hard error, and Owner interrupt each persist the correct stop/receipt without protected side effects.
- [ ] RED: Agent runtime object has no `resolveCandidate`/`OwnerDecisionWriter`.
- [ ] RED: stale running row after restart becomes explicit error/retry state, never success.
- [ ] Implement the loop and routes. Remove `whySourceQuotes` as a required caller responsibility; the Agent gathers its own excerpts.
- [ ] Run:

```bash
npm run test:unit -- shared/project-memory/agent-runner.test.ts shared/project-memory/reconstruct.test.ts tests/unit/project-agent-run-api.test.ts
```

### Wave D — Task 5 only: Owner-visible run/progress/receipts

**Dependency:** Task 4 route contract integrated. **WIP:** one frontend builder.

**Files:**

- Modify: `app/track/knowledge/mvp/lib/api.ts`
- Modify: `app/track/knowledge/mvp/page.tsx`
- Create: `app/track/knowledge/mvp/components/AgentRunProgress.tsx`
- Create: `app/track/knowledge/mvp/components/AgentRunReceipts.tsx`
- Modify: `app/track/knowledge/mvp/mvp-workbench.module.css`
- Create: `tests/unit/mvp-agent-run-visibility.test.ts`

**Produces:** start/poll/interrupt UI; visible current tool/status; compact model/tool receipts; stop reason; candidate remains Owner-reviewable.

- [ ] RED: fresh D-50 connect automatically starts toolful reconstruction without project ID, paths, snippets, or per-read dialogs.
- [ ] RED: running UI shows phase/current tool and an interrupt control; interrupt stops polling as interrupted.
- [ ] RED: final UI shows candidate, exact evidence or unknown, tool receipts, stopping reason, provider/model/effort/fallback; no secret fields.
- [ ] RED: confirm-required state shows the protected request before effect; it does not reuse Owner candidate-confirm as authorization.
- [ ] Implement focused UI only; fixture mode remains explicit and cannot be default product evidence.
- [ ] Run:

```bash
npm run test:unit -- tests/unit/mvp-agent-run-visibility.test.ts tests/unit/mvp-onboarding-folder-choice.test.ts tests/unit/mvp-event-revision-open.test.ts
```

### Wave E — EL2 integration and READY

Integrate in order: Task 1 → Task 2 → Task 3 → Task 4 → Task 5. Reject any diff outside each mutex unless this packet is amended first.

- [ ] Rebase the integration line only from the canonical baseline in §0; do not use the dirty main tree or port `3000` as a source of code/evidence.
- [ ] Preserve explicit staging: list each owned path in `git add`; never use `git add -A` / `git add .`.
- [ ] Confirm no secret/config file is tracked and no evidence contains a key/prompt/source/response body.
- [ ] Run all new focused suites once.
- [ ] Run exactly one integrated unit suite:

```bash
npm run test:unit
```

- [ ] If green, publish one integrated SHA/path as READY to the independent verifier. No push/PR/deploy/no-mistakes unless EL1+EL2 separately open it.

### Wave F — independent acceptance

Use `.ship/handoffs/FS-D51-D52-accept-criteria-freeze.md` and `.ship/research/d51-d52-ui-accept-fixtures.md`. Verifier must differ from all implementers.

**First real Owner-language scenario:**

1. Choose `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot` through D-50; provide no paths, snippets, project IDs, watch syntax, or per-read approvals.
2. Agent automatically uses at least project map, recent Git history/diff/show, search, exact revision reads, and project-memory accepted/events query as evidence requires.
3. Progress is visible and interrupt works. Every call leaves a compact in-boundary receipt.
4. Candidate covers **now / changed / why / impact / next decision**. Supported claims open exact path+revision+quote; unsupported points are explicit unknown/conflict.
5. Model receipt shows `stepfun` / `step-3.7-flash` / `high` / direct-or-fallback. Candidate is not accepted until Owner acts.
6. Out-of-root read and write/commit attempts stop before effect. No secret appears in UI, API receipt, log, or evidence.

Acceptance includes one direct real StepFun run and one controlled deterministic-fallback run. A mere endpoint swap, a one-shot event-metadata completion, or receipts without real tools is FAIL.

---

## 3. Evidence inputs and deliberate deferrals

Joined durable PREP:

- `.ship/research/d51-agent-loop-repo-map.md`
- `.ship/research/d51-llm-runtime-map.md`
- `.ship/research/d52-tool-autonomy-map.md`
- `.ship/research/d51-d52-ui-accept-fixtures.md`
- `.ship/handoffs/FS-D51-D52-accept-criteria-freeze.md`

Deliberately deferred:

- public/pre-authorized external read adapter (D-10/D-18 rules preserved);
- framework choice Q-33;
- write/send/delete/commit tools;
- whole-disk access;
- numeric budget as permanent product promise;
- automated acceptance of candidate understanding.

## 4. Completion claim

D-51/D-52 is engineering-complete only when the integrated READY tip passes the real repository scenario and all hard A–D gates. StepFun configuration alone is not completion. Tool receipts alone without exact grounded candidate evidence are not completion. The Owner's final product judgment remains outside engineering PASS.
