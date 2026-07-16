# 项目状态记忆 Agent MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task in an isolated treehouse worktree. Do not use `no-mistakes`, push, deploy, or broad refactors in this MVP wave.

**Goal:** 让 Owner 授权一个本地项目后，产品能持续看到文件变化、保留新旧版本，并由主 Agent 重建「现在怎样、当时怎样、改了什么、为什么、影响什么、依据在哪」，供 Owner 确认新的当前理解。

**Architecture:** 以 `5bd667cf` 作为经验收基线。本地 source observer 只读授权目录并发送变化信号；产品后端是唯一 writer，用 Node 22 `node:sqlite` 保存元数据/事件，用 SHA-256 CAS 保存不可变原始字节。项目自有 reducer 决定状态与恢复；模型只通过可替换 `AgentModelLoop` 提议理解更新。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Node 22 `node:sqlite` / filesystem SHA-256 CAS / `@parcel/watcher@2.5.6` / Vitest / Playwright. MVP 不引入向量库、独立记忆框架、LangGraph 或 Temporal。

## Global Constraints

- 只读 Owner 显式授权的单个本地项目根目录；不扫全机，不扩大到邮箱/Drive/日历/外部 Agent。
- observer、主 Agent 与所有 API 必须共享同一个 project-memory store、同一个 data dir；禁止各自创建互不相通的 SQLite 实例。
- 根目录 grant 只决定「允许读哪里」；每个 matter 必须有 Owner 可见/可关闭的 watch set，只有匹配 watch set 或已被该 matter 引用的变化才进主界面，其他变化只留紧凑 trace。
- 新结果永远新建 understanding revision；不覆盖旧理解，不删除旧依据。
- Owner 已在当前产品对话确认上一条（D-43 / OA-18 answered）；`PRODUCT_DEV_TASKS.md` 仍显示 open 是秘书 1 积压导致的记录滞后，不是产品未决。
- 模型产出永远是 `candidate`；只有 Owner 可以 `accept | edit | reject`。
- 「为什么」没有来源时必须显示「原因尚无可核对依据」，禁止补写动机。
- 搜索/图索引是可重建投影，不是真相。MVP 只做项目内关键词/元数据与一层关系。
- 默认界面是「一件事项居中 + 一层直接关系」；候选发散和结果回流是同一工作台的状态。
- 这一波只跑必要验证：切片 focused tests、集成后一次 full unit、一条真实浏览器路径。暂停 `no-mistakes`、push、PR 和部署。
- `/track/knowledge/mvp` 默认必须走真实 HTTP API；fixture 只允许显式测试开关使用，不得作为 Owner 默认入口。
- 每个实现席在独立 treehouse worktree 工作；每个切片最多一个本地 commit，用于 G2 集成，不 push。
- 普通 ACK/WIP/DONE 发给秘书 2 `surface:83` + G2 `surface:80`；只有 `[BLOCKER]` 或集成 `[READY]` 才进 Lead `surface:78`。

---

## 1. 用户痛点与产品承诺

### 痛点

项目每变一次，文件变了，人的理解、任务和沟通没有一起变。用户隔几天或几周回来，只能靠记忆重新拼出「现在怎样、为什么、下一步是什么」。

### 产品承诺

主 Agent 观察授权项目来源的变化，保留版本与变化历史，重建当前状态，指出过期理解和受影响的行动，并用精确原文支撑下一个决定。

### 首要效果

`return-to-decision time`：Owner 从重新打开项目，到能基于可核对上下文作出下一个决定的时间。

## 2. 唯一 MVP 场景

1. Owner 在 Web 选择「连接本地项目」并明确授权一个根目录。
2. 系统做初始 reconcile，对可读文件建立 SHA-256 revision，不展开全库文件列表。
3. Owner 在本地修改、重命名或删除文件。
4. 产品在 5 秒内显示一条可点变化，能打开 before/after 精确版本；删除显示 tombstone 和删除前版本。
5. 主 Agent 以这些变化与既有事项为输入，产生一个「当前理解更新候选」。
6. 界面用六个问题组织结果：现在 / 当时 / 变了什么 / 为什么 / 影响什么 / 精确依据。
7. Owner 可以确认、编辑后确认或拒绝候选。确认创建新 understanding revision，不覆盖旧版。
8. 重启 Web 和 observer 后，版本、事件、当前理解和待复查状态仍存在。

## 3. 完成定义

- [ ] 一个真实本地 Git 项目可授权、初始化和停止观察。
- [ ] Owner 可输入真实根目录；连接后自动建立一个可编辑的默认 matter 与显式 watch set，不依赖硬编码 fixture。
- [ ] Owner 可看见/修改/停用当前 matter watch set；未匹配变化不抢占主界面。
- [ ] add/modify/rename/delete 都留下 append-only event；重复事件不重复建 revision。
- [ ] CAS 原文以 SHA-256 定址，event 不得指向不存在 blob。
- [ ] 六问结果都能点回 exact revision；没有原因依据时诚实缺省。
- [ ] Agent 不能将候选自行设为 accepted。
- [ ] accepted understanding 的依据出现新 revision 后，旧理解标记 `review_needed`，仍可打开旧依据。
- [ ] 主界面默认居中显示「当前事项」，只展开一层变化/依据/受影响行动。
- [ ] Web 重启后会从 SQLite 恢复 active grant/watch set 并重启 observer；Agent 与 observer 读取同一份事件。
- [ ] G6 用真实浏览器走完一次；最后由 Owner 用自己项目验收。

## 4. 领域合同（并行实现的唯一对齐点）

```ts
export type SourceGrant = {
  id: string;
  projectId: string;
  kind: "local_folder" | "local_git";
  rootPath: string;
  status: "active" | "disabled" | "revoked";
  createdAt: string;
  updatedAt: string;
};

export type OriginalRevision = {
  id: string; // sha256:<hex>
  projectId: string;
  grantId: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  observedAt: string;
  previousRevisionId?: string;
  tombstone: boolean;
};

export type ChangeKind = "added" | "modified" | "renamed" | "deleted" | "reconciled";

export type ChangeEvent = {
  id: string;
  projectId: string;
  grantId: string;
  kind: ChangeKind;
  relativePath: string;
  previousPath?: string;
  beforeRevisionId?: string;
  afterRevisionId?: string;
  observedAt: string;
  dedupeKey: string;
};

export type Matter = {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  status: "active" | "resolved" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type MatterWatchSet = {
  id: string;
  projectId: string;
  matterId: string;
  grantId: string;
  includePathPrefixes: string[]; // Owner-visible; at least one explicit prefix
  excludePathPrefixes: string[];
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type EvidenceAnchor = {
  revisionId: string;
  relativePath: string;
  quote: string; // exact source span; empty is forbidden for a supported claim
  lastVerifiedAt: string;
};

export type StateClaim = {
  text: string;
  evidence: EvidenceAnchor[];
  gaps: string[];
  conflicts: string[];
};

export type ChangeClaim = {
  before: string;
  after: string;
  eventIds: string[];
  evidence: EvidenceAnchor[];
};

export type WhyClaim = {
  text: string;
  status: "supported" | "unknown" | "conflicted";
  evidence: EvidenceAnchor[];
};

export type UnderstandingBody = {
  now: StateClaim;
  then: StateClaim & { at: string };
  changed: ChangeClaim[];
  why: WhyClaim[];
  depends: Array<{ kind: "matter" | "action" | "evidence"; id: string; reason: string }>;
  evidenceRevisionIds: string[];
  nextDecision: string;
};

export type UnderstandingRevision = {
  id: string;
  projectId: string;
  matterId: string;
  kind: "candidate" | "accepted";
  previousAcceptedRevisionId?: string;
  body: UnderstandingBody;
  basedOnEventIds: string[];
  proposedBy: "agent" | "owner";
  createdAt: string;
};

export type OwnerResolution = {
  id: string;
  candidateRevisionId: string;
  decision: "accept" | "edit_accept" | "reject";
  editedBody?: UnderstandingBody;
  actor: "owner";
  createdAt: string;
  acceptedRevisionId?: string; // set only for accept/edit_accept
};

export type MatterUnderstandingHead = {
  matterId: string;
  acceptedRevisionId?: string;
  reviewState: "current" | "review_needed";
  reviewReasonEventIds: string[];
  updatedAt: string;
};

export type ObservationSignal = {
  projectId: string;
  grantId: string;
  kind: ChangeKind;
  relativePath: string;
  previousPath?: string;
  content?: Uint8Array;
  observedAt: string;
  dedupeKey?: string;
};

export type MatterEventView = {
  event: ChangeEvent;
  relevant: boolean;
  matchReason?: "watch_path" | "accepted_evidence" | "linked_action";
};

export type MatterState = {
  matter: Matter;
  watchSet: MatterWatchSet;
  head: MatterUnderstandingHead;
  accepted?: UnderstandingRevision;
  candidates: UnderstandingRevision[];
  recentRelevantEvents: MatterEventView[];
  compactUnmatchedTraceCount: number;
};

export type MatterStateReconstructionInput = {
  projectId: string;
  matterId: string;
  stateAt: string;
  events: MatterEventView[];
  accepted?: UnderstandingRevision;
  evidence: EvidenceAnchor[];
};

export type AnalysisRun = {
  id: string;
  projectId: string;
  matterId: string;
  trigger: "source_change" | "owner_question" | "retry";
  eventIds: string[];
  status: "queued" | "running" | "awaiting_owner" | "completed" | "failed";
  attempt: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
};
```

### 存储约束

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;

CREATE TABLE source_grants (..., UNIQUE(project_id, root_path));
CREATE TABLE matter_watch_sets (..., UNIQUE(project_id, matter_id, grant_id));
CREATE TABLE original_revisions (..., UNIQUE(project_id, grant_id, relative_path, sha256, tombstone));
CREATE TABLE change_events (..., UNIQUE(dedupe_key));
CREATE TABLE matters (...);
CREATE TABLE understanding_revisions (...); -- INSERT only; kind=candidate|accepted
CREATE TABLE owner_resolutions (...);
CREATE TABLE matter_understanding_heads (..., UNIQUE(matter_id)); -- current pointer/review projection
CREATE TABLE analysis_runs (...);
CREATE TABLE outbox (..., UNIQUE(kind, aggregate_id, payload_hash));
```

写入顺序必须是：写 CAS 临时文件 → `fsync` → atomic rename → SQLite transaction 写 revision/event/outbox。允许 orphan blob，不允许 event 指向缺失 blob。

`understanding_revisions` 和 `owner_resolutions` 只允许 INSERT。任何 `accept/edit_accept/reject` 都不得 UPDATE 旧 revision。只有 `matter_understanding_heads` 是可更新投影，并且必须与新 accepted revision + resolution 同一 transaction。

### 端口合同

```ts
export interface ObservationAdapter {
  start(grant: SourceGrant, emit: (signal: ObservationSignal) => Promise<void>): Promise<StopHandle>;
  reconcile(grant: SourceGrant): Promise<ObservationSignal[]>;
}

export interface ProjectMemoryReader {
  readRevision(id: string): Promise<Uint8Array | null>;
  listEvents(projectId: string, after?: string): Promise<ChangeEvent[]>;
  getMatterState(projectId: string, matterId: string): Promise<MatterState>;
}

export interface ObservationWriter {
  ingest(signal: ObservationSignal): Promise<{ event?: ChangeEvent; revision?: OriginalRevision }>;
}

export interface CandidateWriter {
  saveCandidate(run: AnalysisRun, body: UnderstandingBody): Promise<UnderstandingRevision>;
}

/** Never injected into AgentModelLoop or background AnalysisRun services. */
export interface OwnerDecisionWriter {
  resolveCandidate(input: OwnerResolution): Promise<{
    resolution: OwnerResolution;
    accepted?: UnderstandingRevision;
    head: MatterUnderstandingHead;
  }>;
}

export interface AgentModelLoop {
  propose(input: MatterStateReconstructionInput): Promise<UnderstandingBody>;
}
```

## 5. HTTP 行为

| Method | Path | 行为 |
|---|---|---|
| `POST` | `/api/knowledge/projects/:id/source-grants` | 授权单个本地根目录；校验真实路径；返回 receipt |
| `POST` | `/api/knowledge/projects/:id/source-grants/:grantId/reconcile` | 全量对账；只读；幂等 |
| `DELETE` | `/api/knowledge/projects/:id/source-grants/:grantId` | 停止观察并标记 revoked；不删历史 |
| `GET/PUT` | `/api/knowledge/projects/:id/matters/:matterId/watch-set` | Owner 查看/修改/停用显式 path prefixes；不得默认全 root 静默可见 |
| `GET` | `/api/knowledge/projects/:id/memory?matterId=...` | 当前 accepted/candidate、变化、依据、待复查 |
| `POST` | `/api/knowledge/projects/:id/analysis-runs` | 对指定变化运行状态重建，产生 candidate |
| `POST` | `/api/knowledge/understanding/:id/resolve` | Owner `accept/edit_accept/reject`；服务端禁 Agent actor |
| `GET` | `/api/knowledge/revisions/:id` | 打开 exact revision；只有所属项目授权可读 |

## 6. 实现任务与独占文件

### Task 1: G2 — 集成基线与合同冻结

**Files:**
- Create: `.ship/handoffs/G2-MVP-V0-ledger.md`
- Create: `.ship/handoffs/G2-MVP-V0-contract-freeze.md`
- Integration only after individual DONE; do not edit builder-owned source files.

**Steps:**
- [ ] 从 `5bd667cf` 建 `g2/mvp-v0-integration` 独立 worktree，记录绝对路径。
- [ ] 将本文第 4–5 节复制为 freeze handoff；不自行改名。
- [ ] 顺序集成 G3 → G3B → G5 → G3A，仅解决合同级冲突。
- [ ] 运行 `npm run test:unit`；只有全量绿才解锁 G4/G6。
- [ ] 不运行 `no-mistakes`，不 push，不部署。

### Task 2: G3 — 项目记忆真相层

**Files:**
- Create: `shared/project-memory/types.ts`
- Create: `shared/project-memory/cas.ts`
- Create: `shared/project-memory/sqlite-store.ts`
- Create: `shared/project-memory/reducer.ts`
- Create: `shared/project-memory/sqlite-store.test.ts`
- Create: `shared/project-memory/reducer.test.ts`

**Produces:** 第 4 节的 types + `ProjectMemoryReader` / `ObservationWriter` / `CandidateWriter` / `OwnerDecisionWriter`。

**Necessary tests:**
- [ ] modify 生成新 revision/event，同字节重复信号幂等。
- [ ] delete 保留最后 blob + tombstone；restart 可读。
- [ ] CAS 写入失败时 SQLite 不得出现孤立 revision/event。
- [ ] accepted understanding 的 evidence 变化后标记 `review_needed`，不覆盖原文。
- [ ] accept/edit_accept 不 UPDATE candidate/accepted revision；新建 accepted revision + OwnerResolution，只在同一 transaction 移动 `MatterUnderstandingHead`。
- [ ] Agent 运行只获得 `ProjectMemoryReader & CandidateWriter`；不能获得/调用 `OwnerDecisionWriter`。

Run:
```bash
npm run test:unit -- shared/project-memory/sqlite-store.test.ts shared/project-memory/reducer.test.ts
```

### Task 3: G3B — 本地项目观察与授权路由

**Files:**
- Create: `shared/project-memory/observer.ts`
- Create: `shared/project-memory/observer.test.ts`
- Create: `shared/project-memory/grants.ts`
- Create: `app/api/knowledge/projects/[id]/source-grants/route.ts`
- Create: `app/api/knowledge/projects/[id]/source-grants/[grantId]/route.ts`
- Create: `app/api/knowledge/projects/[id]/source-grants/[grantId]/reconcile/route.ts`
- Create: `app/api/knowledge/projects/[id]/matters/[matterId]/watch-set/route.ts`
- Modify: `package.json` only to add exact `@parcel/watcher@2.5.6` and the minimal observer script if needed.

**Consumes:** `SourceGrant`, `MatterWatchSet`, `ObservationAdapter`, `ObservationWriter.ingest`.

**Necessary tests:**
- [ ] 路径越出 grant root 立即拒绝。
- [ ] add/modify/delete 变为 observation signal；启动、watcher error 后都会 full reconcile。
- [ ] revoke 后不再接收新变化，历史保留。
- [ ] 未授权目录不会被扫描。
- [ ] 未匹配 matter watch set 的变化只留 trace；主界面只收到带 `matchReason` 的相关变化。
- [ ] observer 与 Agent API 使用同一 runtime store；重启 manager 后 active grant/watch set 可恢复并继续观察。
- [ ] 首次连接可创建默认 matter/watch set；同内容移动 old→new 形成一个 `renamed` event（带 `previousPath`），而非无关联的 delete+add。

Run:
```bash
npm run test:unit -- shared/project-memory/observer.test.ts
```

### Task 4: G5 — 主 Agent 状态重建与 Owner 决议

**Files:**
- Create: `shared/project-memory/reconstruct.ts`
- Create: `shared/project-memory/agent-model-loop.ts`
- Create: `shared/project-memory/reconstruct.test.ts`
- Create: `app/api/knowledge/projects/[id]/memory/route.ts`
- Create: `app/api/knowledge/projects/[id]/analysis-runs/route.ts`
- Create: `app/api/knowledge/understanding/[id]/resolve/route.ts`
- Create: `app/api/knowledge/revisions/[id]/route.ts`

**Consumes:** `ProjectMemoryReader & CandidateWriter`, `AgentModelLoop`, 第 4 节领域合同。Owner resolve route 单独依赖 `OwnerDecisionWriter`，不与 Agent service 共用容器实例。

**Rules:**
- 默认主 Agent 必须实际调用现有 `shared/llm/adapter.ts` 生成结构化候选；模型不可用时才降级为确定性 changed/evidence，禁止把“model”配置静默当模板运行。
- Agent 只读取当前 matter watch set、已确认依据或关联行动命中的事件；不得把项目最近 20 条全局事件直接混入当前事项。
- 每个 `why` 是结构化 `WhyClaim`；`supported` 必须同时有 exact revision + relative path + exact quote + lastVerifiedAt；否则只能是 `unknown` 或 `conflicted`。
- `supported` 的 path 必须与 revision 元数据的 canonical path 一致，quote 必须真实存在于该 revision 字节。
- 模型输出经 schema 校验；所有 `evidenceRevisionIds` 必须存在且属于当前项目。
- actor 不是 `owner` 时，resolve 路由返回 403；Agent/AnalysisRun 的 dependency graph 中不存在 `OwnerDecisionWriter`。
- accept/edit_accept 必须新建 accepted revision；拒绝只写 resolution；不允许 UPDATE 候选或旧 accepted body/status。
- 已决议 candidate 不再作为当前候选返回；重复 resolve 幂等。resolve 必须同时校验 `projectId + matterId + candidateId`，不得用全局 candidate ID 跨项目写入；`edit_accept` 缺少 `editedBody` 必须拒绝。
- 模型不可用时仍返回确定性 changed/evidence，并标记「需 Owner 判断」。

Run:
```bash
npm run test:unit -- shared/project-memory/reconstruct.test.ts
```

### Task 5: G3A — 可真实使用的非线性工作台

**Files:**
- Create: `app/track/knowledge/mvp/page.tsx`
- Create: `app/track/knowledge/mvp/mvp-workbench.module.css`
- Create: `app/track/knowledge/mvp/components/SourceGrantPanel.tsx`
- Create: `app/track/knowledge/mvp/components/MatterFocusCanvas.tsx`
- Create: `app/track/knowledge/mvp/components/StateReconstructionPanel.tsx`
- Create: `app/track/knowledge/mvp/components/UnderstandingReviewCard.tsx`
- Create: `app/track/knowledge/mvp/components/RevisionViewer.tsx`
- Create: `app/track/knowledge/mvp/lib/api.ts`

**Reference only:** `g3a/t18-nonlinear-prototype@08fac68a`; port interaction patterns, do not merge its browser-memory fake state.

**Visible behavior:**
- [ ] 首次进入只显示「选择本地项目」和授权说明。
- [ ] 连接后中央是一个 matter；一层显示变化、依据、受影响对象。
- [ ] 工作台持续显示该 matter 正在看哪些 path prefixes，Owner 可修改/停用；非匹配变化不进中心。
- [ ] 点击变化/依据换中心，可打开 exact revision 与 before/after。
- [ ] 右侧用六问显示状态重建，候选和 accepted 有明确文字区分；每个 why 单独显示 supported/unknown/conflicted 与 exact quote。
- [ ] 确认/编辑/拒绝可点，刷新后仍在。
- [ ] 不以全库文件列表作为中心。
- [ ] 默认 adapter 调用真实 source-grant / watch-set / memory / analysis / resolve / revision API；Owner 输入真实 root path。fixture 只能通过显式测试参数启用。

### Task 6: G4 — 必要证伪

**No production edits.** 集成 SHA 出现前只准备 fixture，不重复调研。

Fail immediately if any is true:
- 未授权目录被读取；
- delete 后旧版不可打开；
- event 指向缺失 blob；
- Agent/route 能自己 accept candidate；
- 「为什么」无依据仍给出确定原因；
- 来源更新后旧理解未 `review_needed`；
- 跨项目泄漏标题、路径、内容或 revision。

Required commands only:
```bash
npm run test:unit
```

### Task 7: G6 — Owner 真实场景验收准备

Run one browser scenario on G2 integrated SHA:

1. 连接一个 fixture Git 项目。
2. 修改一个文件、重命名一个文件、删除一个文件。
3. 确认界面 5 秒内出现三个可点变化。
4. 打开删除前版本和修改 before/after。
5. 运行 Agent，检查六问与 exact evidence。
6. 确认一次 understanding，再修改其依据文件，看到 `review_needed`。
7. 重启后确认状态存在。

Evidence: screenshots + exact URL + one short log. No exhaustive visual matrix.

## 7. 实现顺序

```text
G2 冻结合同
  ├─ G3   记忆真相层
  ├─ G3B  本地观察/授权
  ├─ G5   Agent 状态重建
  └─ G3A  正式工作台
          ↓
      G2 集成 + full unit
          ↓
      G4 必要证伪 + G6 真实浏览器
          ↓
      Owner 用自己项目验收
```

## 8. 明确后置

- 监控 Claude/Codex/Grok，或向它们派工。
- Gmail/Drive/日历/消息/整账号同步。
- 任何外部写入、发送、删除、付费。
- 向量库、全局知识图、复杂工作流、多 Agent 编排。
- 个人/团队知识库和隐式跨项目搜索。
- PR/push/deploy/`no-mistakes`；等 Owner 用过 MVP 并完成首轮反馈后再开。

## 9. 参考真相

- Product list: `.ship/tasks/first-user-real-entry-015/control/PRODUCT_DEV_TASKS.md`
- Runtime recommendation: `docs/research/2026-07-16-main-agent-runtime-architecture.md`
- Memory recommendation: `docs/research/2026-07-16-project-memory-architecture-foundations.md`
- Current runtime audit: `docs/product/2026-07-16-current-runtime-product-reality.md`
- Nonlinear prototype evidence: `.ship/handoffs/G2-T18-prototype-ledger.md`
