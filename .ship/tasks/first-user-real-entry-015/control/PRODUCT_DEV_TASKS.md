# 产品开发任务（产品共识 → 工程交付 → 主人试用）

**产品方向:** 公司 / 一人公司效率 Agent。  
**产品循环:** 资料检索 → 知识管理 → 协作工作流 → 结果回流并更新知识。  
**用户价值:** 对抗项目混乱；用高效率的传递方式帮人形成足够正确的判断，并完成下一步决定。  
**质量底线:** 关键判断能指回来源；真项目、真材料、真行动、真结果。

**更新：** 2026-07-16（S-137 · 主线合一 `main` @ `d4eec430` · 强制暂停仍有效）

### S-137 主线合一（Owner 批准 · 不再走并行分支）

| 项 | 现行 |
|---|---|
| **唯一开发目录** | `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot` |
| **唯一分支** | `main` @ tip **`d4eec430`**（含 D-50/`c2641d3b` 线 + Wave A + correction） |
| **worktree** | 仅主仓 1 棵（slot16 已撤） |
| **试用** | 在主仓起 `next dev --port 3331` + 夹具 `/tmp/mvp-v0-g6-d50-fixture` |
| **约定** | 默认不新开 feature 分支 / 不新开 treehouse 并行树，除非 Owner 再改 |



### S-136 清理结果（Owner 批准：只留开发方向相关）

| 做了 | 结果 |
|---|---|
| git worktree | 只留 **主仓** + **slot16**（产品基线 `c2641d3b` / :3331） |
| 本地分支 | 只留 `feature/first-user-real-entry` + slot16 的 `g6/d50-final-c2641d3b` |
| handoffs / evidence | 打包装箱 → `.ship/archive/2026-07-16-process-noise/`；现场只留暂停钉 + 工程包 + P0 控制面 |
| 旧协作文 | 秘书/G席/LIVE board 等移入 archive |
| 未动 | 主代码、fixtures、产品 SOLUTION/ROADSHOW/TEAM_*、PRODUCT_DEV_TASKS、Dia |

### ⛔ 强制暂停（S-135 · 立即生效 · 高于一切派发）

**Owner 原话：**「我现在希望所有人把任务停下来，听我说。」

| 谁 | 现在必须 |
|---|---|
| 全栈 / 所有实现席 | **立刻停写码、停开新波、停发消息刷屏** |
| 工程话事人1/2 | **停派发**；不收工人流水；不报进度除非 Owner 问 |
| 产品话事人1/2 | **停新产品决策记录与方案推进**；只听 Owner |
| 浏览器 / 独立验 | **停扫、停跑** |
| 所有人 | **听 Owner 说完**；未得 Owner 下一句前不得自行恢复任务 |

**解除条件：** 仅 Owner 本人明确说可以继续 / 指定谁做什么。  
**本条覆盖** D-51/D-52 实现波、Wave 后续、UI 草案推进、收件箱消化等一切进行中工作。

### 现行视图（读清单先看这里 · S-135 STOP 优先）

| 层 | 现行唯一 |
|---|---|
| 组织权威 | **D-54 + D-55** · `TEAM_OPERATING_MODEL.md` · `TEAM_CMUX.md` |
| 产品方向已锁 | **D-04 · D-12 · D-24 · D-35/36 · D-39–D-45 · D-50 · D-51–D-53 · D-48（MVP 栈）** |
| Owner 可试用关闸 | URL **仅** `http://127.0.0.1:3331/track/knowledge/mvp`（HTTP 200 · slot16 · **非** :3000）· 产品基线 **`c2641d3b`** · 夹具 **仅** `/tmp/mvp-v0-g6-d50-fixture`（Owner S-132 确认）· **禁止**对话框直接填 repo 路径 |
| tip 分层（勿混） | **产品基线/D-50 关闸** `c2641d3b` · **权责文档 tip** `8acc36af`（仅 TEAM 两文档）· **工程集成 tip（Wave A）** `33067fe0`（领域契约+run/receipt 轨迹；**≠** 产品全功能完成） |
| 工程进行中 | D-51/D-52：**Wave A 已集成 @`33067fe0`**；下一波工具+模型并行；**独立验收仍待后续 READY**；**产品不宣称 D-51/D-52 全完成** |
| D-50 浏览器 | G6 FINAL §4 PASS **仅** @`c2641d3b`（旧 tip 996 不关闸） |
| 容量 | free treehouse **≥2**（当前约 **9**）；slot16 运行脏文件保留且不提交；**3331 进程须保持** |
| Owner 仍待动作 | **OA-21 亲手验收**（可在 3331+夹具试，不挡工程下一波）· **D-56 UI 草案** 未点头 · **OA-12** 未批 · **Q-33** 本波不讨论（D-48） |
| 废止勿当现行 | 旧 G 编号/双秘书现行协议 · 过期 READY tip · 脏主树 **:3000 @80bcb0b7 不可归因** |

**污染/爆炸防控（S-131→S-133）：** 历史档案勿当现行；产品侧只收**工程双负责人综合摘要**，不吞工人流水。**eng READY ≠ Owner 验收**（D-02）。

---

## How this list grows

This is the single living product list. Every substantive discussion may add one or more of:

- `Q-*` — an unresolved product question or unknown;
- `T-*` — work that can be assigned and verified;
- `D-*` — an accepted decision or rejected approach, with its evidence;
- `F-*` — owner-reported behavior or experience feedback.

Items are appended, linked, and resolved; they are not silently rewritten away. A solution does not erase the question that caused it. Direct interaction and experience acceptance belong to the Owner. Agents prepare evidence and reproducible scenarios.

### Current coordination additions

| ID | Type | Item | Status |
|---|---|---|---|
| Q-01 | Research | Which research method should be used for each kind of unknown before product claims are made? | Inventory complete: `.ship/handoffs/G1-research-methods-DONE.md` |
| D-01 | Engineering | Use the pinned Matt flow through yishuship for non-trivial engineering work. | Accepted by Owner |
| D-02 | Experience | Direct interaction and experience judgment are performed by the Owner; agents prepare the scenario and evidence. | Accepted by Owner |
| D-03 | Product | Developing this product with the product-consensus window and multiple engineering agents is the first real validation scenario for the product loop. | Accepted by Owner |
| D-04 | Product direction | Build a company / one-person-company efficiency Agent whose product logic is research and retrieval → knowledge management → collaborative workflow → execution results feeding knowledge and future retrieval. | Accepted by Owner; locked |
| D-05 | Collaboration | Product cycle remains: clarify → record decisions → eng delivers → Owner uses → feedback re-enters list. **Ops routing via G2/builders superseded by D-54/D-55.** | SUPERSEDED ops by D-54/D-55 · cycle substance kept |
| D-06 | Build strategy | Define the business behavior first, then evaluate mature open-source implementations at source level. Reuse, adapt, or fork suitable code; build only the uncovered product-specific gaps. | Accepted by Owner |
| D-07 | Dispatch cadence | Dispatch accepted research and engineering work immediately so execution feedback arrives while product discussion continues. G2 does not add a permission stop after receiving an approved spec with safe file ownership and verification. | Accepted by Owner |
| D-08 | Retrieval triggers | Retrieval supports three coexisting triggers: explicit user request; Agent-detected insufficient, conflicting, or stale evidence; and an action requiring missing current facts. Every search exposes scope, reason, sources, time, and authorization boundary; duplicate/cost controls apply. | Accepted by Owner |
| D-09 | Grok KAL PRD | Treat the supplied KAL PRD as a candidate design input. Reuse accepted business behavior; revise rigid assumptions; do not treat its Python/LangGraph/Streamlit stack or schemas as implementation authority. | Accepted by Owner |
| D-10 | Retrieval authorization | Product-internal retrieval runs automatically. Pre-authorized external sources run automatically with visible notification. Sensitive data, paid sources, and any unapproved source require confirmation before retrieval. | Accepted by Owner |
| D-11 | Knowledge freshness | Explicit source validity wins. New versions, conflicts, or relevant project changes mark knowledge for review. Type-based review windows are reminders only. Actions depending on current facts always re-retrieve. Preserve history and show last verification plus review reason. | Accepted by Owner |
| D-12 | Product Agent relationship | Present one accountable main Agent to the user. It continuously works from the user's goal and project state, uses specialist Agents/models/tools internally, follows authorization rules, writes results back, and keeps the user as final authority. | Accepted by Owner |
| D-13 | Open-source adoption evidence | “Reference open source” requires concrete reuse evidence: pinned tag/commit, exact source files/symbols and behavior, local mapping, license and transitive-license review, verification, divergence, and replacement/exit boundary. Name-dropping a project or copying its marketing model does not satisfy D-06. | Accepted by Owner |
| D-14 | Main interaction | Use one main Agent across chat and the project workbench. Chat handles goals, questions, direction changes, and permission decisions. The workbench exposes sources, project state, actions, progress, and results. Both surfaces share one Agent identity and project memory, and changes flow both ways. | Option C accepted by Owner |
| D-15 | Agent autonomy | Use bounded automation. The Agent automatically performs project-internal reading, retrieval, organization, candidate creation, and draft generation. External sending, deletion, payment, sensitive operations, and unapproved access require explicit confirmation. Automatic output remains candidate/draft and cannot self-confirm. | Option B accepted by Owner |
| D-16 | Retrieval-to-knowledge lifecycle | Every retrieval keeps a compact trace of query, reason, scope, sources, and time. Only results actually used for a judgment or action become stable project evidence. Agent conclusions remain candidates. Owner confirmation promotes the relevant claim/decision to confirmed knowledge. Execution results return as evidence and may revise the decision after review. | Option C accepted by Owner |
| D-17 | External-source authorization | Authorize external access by source and scope with an expiry and immediate revocation. Sensitive and paid sources always require separate confirmation. Public search, connected private accounts, inbound feeds, and external actions must be distinguished before implementation. | Option C accepted by Owner |
| D-18 | First external sources | First connect public read-only web retrieval and one Owner-selected GitHub repository for read-only code, issue, pull-request, and relevant repository-event retrieval. Next, pilot only Owner-selected Google Drive files through Picker. Gmail/full private-account sync and all external writes remain later work. | Accepted by Owner |
| D-19 | External tool responsibilities | The main Agent owns judgment, authorization, and writing results back to the project. It searches project truth first, uses OpenConnector as the candidate transport for stable structured APIs, and uses Chijie only as an explicit browser fallback when an API is insufficient. | Accepted by Owner |
| D-20 | First GitHub verification | Use `yishu-ziyu/fc-opc-ibot` as the first repository. The minimum read-only objects are commits and diffs, files at an exact revision, Issues with comments, and pull requests with changed files and reviews. Disable every create, update, merge, delete, send, and full-sync action. Optimize for the earliest complete real read path; defer non-critical completeness and polish. | Accepted by Owner; G2 may prepare and run a D-13/T-11 compliant isolated verification, with no production integration |
| D-21 | Collaboration cycle and load | Judgment → research → execution → Owner acceptance cycle substance kept. **G2/G3–G6 idle-fill seat model superseded by D-54/D-55 (+ D-47 was MVP-wave only, also superseded as living ops).** | SUPERSEDED ops by D-54/D-55 |
| D-22 | Nine-window responsibility blocks | Historical nine-window G-seat blocks. **Superseded by dual product leads + dual eng leads (D-54/D-55).** Owner final hands-on judgment still true (D-02). | SUPERSEDED by D-54/D-55 |
| D-23 | Owner answer queue | Any direct question asked to the Owner remains explicitly recorded as unanswered until the Owner answers it. The judgment window must re-ask the same question and must not let later status updates or new topics silently replace it. | Accepted by Owner |
| D-24 | Knowledge truth model | Approve scheme 2 as the target: citable immutable originals + structured knowledge/evidence + actions/events; keyword, semantic, and relation indexes are rebuildable projections, never the sole truth. This approves the target model, not the claim that current code already satisfies it. | Accepted by Owner |
| D-25 | Outsider collaboration | The Owner may use the Outsider conversation as a second product-judgment surface. The Outsider reads this entire living list and owns only the `局外人观察队列` section for observations, advice, open questions, and Owner-requested captures. The Lead promotes accepted items into formal Q/F/D/T entries and dispatches only from those formal entries. The Outsider does not assign agents or mark decisions/implementation complete. | Accepted by Owner |
| D-26 | Nonlinear workbench direction | Use the current workbench as the shell and a movable-focus, one-hop relation canvas as the central interaction. Conversation creates reviewable candidate nodes; clicking any object recenters attention; execution results return as candidates; footprints show where a judgment traveled. Apply the concept-review corrections: focus is not confirmed knowledge, materials are not candidates, search is separate from Agent conversation, and a used path does not imply truth. | Accepted by Owner; clickable prototype authorized |
| D-27 | Knowledge scope | Default to hard current-project isolation. Cross-project reuse is an explicit Owner-approved reference, never an implicit global read or copy. Preserve source project, source object, exact version, and last verification; source changes mark dependents for review. Sensitive projects reveal nothing across projects by default. Personal/team libraries are deferred until project isolation and explicit references work. **S2 option A (with D-38):** active-grant-only redacted hint; zero on sensitive/ungranted; open/use still revision-pinned reference; no global discovery (S-41). | Accepted by Owner; S2 option A; **T-19 S2 FINAL READY EVIDENCE** @`5bd667cf` (S-85); **no T-21 unlock / no Owner substitute** |
| D-28 | Secretary and reporting route | Historical single-secretary route (later dual-sec D-46/D-49). **Living org: D-54/D-55** — product list sole writer = **产品话事人2**；普通员工流量进双工程话事人，不进产品对话。 | SUPERSEDED by D-54/D-55 |
| D-29 | First retrieval source set | First retrieval sources are: current-project truth; Owner-selected local folders/repos; public web; one selected GitHub repository read-only. Google Drive Picker-selected files are later. Gmail, calendar, messages, and full-account sync are deferred. Continues to obey D-10/D-17/D-18/D-20; no external write. | Accepted by Owner (OA-04/Q-05); reaffirmed |
| D-30 | Secretary cadence | Ordinary handoffs absorbed silently. Changed-state digest at most every 30 minutes and ≤5 lines. Mandatory digest at phase boundary / before dinner / end of day. Immediate escalation only for: unresolved blocker >10 minutes; conflict with an accepted product rule; security/data/rework risk; Owner decision required; or integrated acceptance-ready result. No-change → no report. Secretary reports to Lead first; Lead interrupts Owner only for decision or ready-to-experience. Supersedes looser ad-hoc reporting under D-28 for cadence detail. | Accepted by Owner (OA-05/Q-29); Lead/Owner capture |
| D-31 | Retrieval method (subordinate tools) | Staged methods remain available as **tools only**: current-project exact keyword/metadata → one-hop relation → semantic project-chunk when needed → authorized structured external API/GitHub → explicit browser fallback. Rank/explain rules still apply; semantic index rebuildable, never truth. **Superseded as product primary by D-42:** product retrieval is **one-matter project state + transitions** (current/historical/changed/why/depends/evidence). D-31 stages are subordinate helpers under that purpose, not the product surface. **Unauthorized as primary:** document-only, vector-only, or latest-only retrieval products. | Accepted by Owner (OA-06/Q-06); **subordinate under D-42 FINAL** |
| D-32 | Result identity | Raw hits are temporary candidates. Only actually used results become revision-pinned project evidence. Agent conclusions remain candidates. Owner-confirmed claims become confirmed knowledge. Source change marks dependents review-needed while preserving old snapshots. Unused hits remain only in compact retrieval trace. Aligns D-16/D-24. Fold into T-20 eng BDD via existing T-16/T-20 revision/evidence/candidate/confirmation/review identity model; **no** duplicate lifecycle schema; **no** product implementation authorization. | Accepted by Owner (OA-07/Q-07); reaffirmed OWNER DECISION RECORD |
| D-33 | Roadshow decision narrative | Every product Q must also be maintained in a concise roadshow document, separate from engineering noise. Required fields: user pain/question; decision; concrete example; visible product behavior; efficiency value; current implementation/evidence. Path: `docs/product/ROADSHOW_PRODUCT_LOGIC.md`. Never invent Owner decisions; only confirmed Q/D entries. | Accepted by Owner; Lead/Owner capture |
| D-34 | Evidence reuse | Save one evidence object and reuse by stable ID. Expose backlinks to every judgment/action/draft/result. Dedupe by stable locator + exact revision. A new revision remains separate and fans out review-needed to all dependents. Cross-project reuse still requires D-27 explicit Owner approval. | Accepted by Owner (OA-08/Q-08); reaffirmed OWNER DECISION RECORD; implementation track **T-21** |
| D-35 | Knowledge-management essence | Knowledge management means continuously maintaining a **source-backed, revisable project understanding** so the user and Agent do not rebuild context from scattered material. This is product essence, not an implementation authorization. Linked map: retrieval → Q-05–Q-08; knowledge-base → Q-02–Q-04/Q-09; Agentization → Q-15–Q-17; workflow/result → Q-12–Q-14; surfaces → Q-27/Q-28; multi-Agent truth → Q-17. | Accepted by Owner (Q-09 essence); Q-09 productization **not complete** (see D-36 unit + Q-30 sync) |
| D-36 | Maintained unit | The product's maintained unit is **one concrete matter being advanced**: a question / judgment / decision / goal that carries purpose, evidence, unknowns, current understanding, decision, action, executor, result, and revision history. Not “files as unit” and not only a whole-project summary blob. Q-09 productization remains linked and incomplete until continuous-sync (Q-30) is settled. No implementation authorization by this record alone. | Accepted by Owner; Lead/Owner capture |
| D-37 | Sync architecture direction | **Web** = decision / review / authorization workbench. **Local companion + structured SaaS connectors + explicit browser extension + Agent Bridge** continuously **sense** only **authorized** real work and write back **source + versioned change events**. Manual upload/paste remains fallback. Changes become **candidates**, are matched to affected matters, and **never silently rewrite** project understanding. Companion senses sources only (D-39). **Research:** D-13 options + min adapter/spike **proposal** only. Memory **structure** = **D-40 FINAL**; production still not authorized (T-22 prep only). | Accepted by Owner (Q-30); sensing direction firm |
| D-38 | Sync scope | **Project-level** source grants + **per-matter** Agent-maintained **visible watch sets**. Changes are **versioned events**. Only **relevant** changes surface with **match reason**; unrelated remain compact trace. Owner can **inspect/disable** watches. **No access** outside project grants. Structure of memory events = **D-40**; synthesis still held for D-37 D-13 join + non-production T-22. | Accepted by Owner (OA-11/Q-30); structure D-40; production held |
| D-39 | First-version main Agent + core scope | **OWNER DECISION FINAL (OA-14 answered).** First-version **主 Agent** continuously **observes Owner-authorized project-source changes**, **maintains project memory**, compares history, detects impact / gaps / conflicts / staleness, retrieves more **only when needed AND authorized**, and **proposes** current-understanding / next-decision updates. **External Coding-Agent orchestration is deferred / non-core.** Future integration research = evidence only. Not whole-computer or coding-agent surveillance; out-of-scope activity correctly unknown. Terms: `CONTEXT.md` 推进事项 · 项目记忆 · 主 Agent. Engineering prep track: **T-22** (research/interface only). **OA-12 still not approved.** Memory structure addendum: **D-40**. | FINAL · Owner 2026-07-16 |
| D-40 | Project Memory structure (product requirement) | **OWNER DECISION FINAL (OA-15 confirmed).** Product requirement only: Project Memory = **versioned immutable originals** + **append-only change events** + **versioned current understanding**; **rebuildable indexes** (never truth). Aligns D-24. Not a framework/runtime selection. External execution gateway remains non-core (D-39). Architecture/runtime/memory foundations selection is **open under Q-33 / OA-16** — requires stable high-quality Agent architecture research before any technical choice. **No implementation** until Owner reviews recommendation + isolated-spike evidence. | FINAL · Owner 2026-07-16 · product requirement only |
| D-41 | Trust = traceability (never opaque score) | **OWNER DECISION FINAL (OA-17 / Q-10; fields fixed S-82).** Trust = **traceability**, **never** a confidence/opaque score. Required visible basis: **source kind + exact revision**; **derivation or Owner decision**; **last checked**; **conflicts / gaps**; **downstream use**. Rank/relevance/similarity diagnostic only—not trust. Aligns D-16/D-32/D-40. **No** production/schema by this record. T-20 BDD-09 · T-22 proposals must obey. | FINAL · Owner 2026-07-16 |
| D-42 | Retrieval = project state + transitions | **OWNER DECISION FINAL (Q-06–Q-08 linked; deepened S-82).** Primary product retrieves **project state and state transitions**, **not** knowledge/document chunks or card search. For one **matter** reconstruct: **current state**; **historical state**; **what changed**; **why it changed**; **what depends on it**; **exact supporting evidence**. Keyword / semantic / relations (and other D-31 stages) are **tools under this purpose only**. Canonical: **state@t** = source revisions + current facts/judgments/decisions + unknowns + actions + results; **transition** preserves **before / change / after**. Aligns D-24/D-31/D-36/D-40. T-20 BDD-08/10/11 · T-22 narrative must obey. **No** production unlock. | FINAL · Owner 2026-07-16 |
| D-43 | New results never overwrite old understanding (Q-11) | **OWNER DECISION FINAL (OA-18 answered · S-99 reaffirm).** New results **never overwrite** old understanding. **Only append** a **reviewable transition** and/or **new current-understanding revision**. **Current pointer** moves **only after confirmation** (or applicable rule). **History retained** (prior revisions, conflicts, source versions). Dependents marked **review-needed**. Aligns D-32/D-34/D-40/D-41. Current MVP PRD already executes this. **No** open/待讨论 status. | FINAL · answered · Owner 2026-07-16 |
| D-44 | First primary scenario / roadshow entry (Q-18) | **OWNER DECISION FINAL (OA-19 + Lead S-97).** First main user/demo scene: user returns after **days/weeks** to an **authorized local project**; Agent reconstructs **now / then / what changed / why / impact / exact evidence** and helps make the **next decision**. Aligns D-39/D-40/D-41/D-42. Retrieval/knowledge/workflow = **internal ingredients**, not the pitch. Pain/solution/metric frozen under **D-45**. **No** production unlock. | FINAL · Owner 2026-07-16 · scene only |
| D-45 | Pain · solution · primary metric (Q-19) | **OWNER DECISION FINAL (OA-20 answered).** **Pain:** after project change, **files, human understanding, tasks, and communication go out of sync**. **Solution:** Agent **observes authorized sources**, **keeps versions and change history**, **reconstructs current state**, and **flags stale understanding / affected actions**. **Primary metric:** **return-to-decision time** (re-enter → source-backed next decision). **No numeric improvement claim before measurement.** | FINAL · Owner 2026-07-16 · wording+metric only |
| D-46 | Dual-secretary boundary (MVP wave) | Historical dual-secretary file split. **Superseded as living ops by D-54/D-55.** Product-record ownership now **产品话事人2** (not Sec1 seat brand). | SUPERSEDED by D-54/D-55 |
| D-47 | MVP-wave throughput (11-window efficiency) | Historical WIP-cap / G-seat critical path for one MVP wave. **Living ops: dual eng leads D-55**; product does not re-read G3B→G2→G4/G6 as authority. | SUPERSEDED as living ops by D-54/D-55 |
| D-48 | MVP tech stack stage decision (S-101 closed) | **LEAD DECISION FINAL (S-105 · answers S-101 research).** For current **MVP wave only:** **keep** `node:sqlite` + **FS CAS** + **@parcel/watcher** + **pure reducer** + **existing split ports** (ObservationWriter / AgentMemoryService / OwnerDecisionWriter / Reader). **Do not introduce** new orchestration frameworks (LangGraph / Mastra / Temporal / Letta / etc.). **JSON knowledge vs project-memory SQLite dual truth:** **not merged this wave**. **Vercel AI SDK:** **deferred** (not this wave). **Clarification:** `AgentModelLoop` already wired to existing **`shared/llm` adapter** — this is **not** AI SDK unification. Research artifact remains evidence only: `docs/research/2026-07-16-tech-stack-code-grounded-selection.md`. **No further routine reminders** of this decision unless product scope changes. | FINAL · Lead 2026-07-16 · MVP stage |
| D-49 | Owner-feedback delivery organization | Historical Sec1 product-secretary + G2 dispatch org. **Substance kept:** product discussion records 问题/例子/方案/验收/路演/未答；不吞工人流水。**Living org: D-54/D-55** — dual product leads; list writer = 产品话事人2; eng via dual eng leads. | SUPERSEDED ops by D-54/D-55 · record discipline kept |
| D-50 | Onboarding responsibility: user authorizes folder; Agent understands (F-06) | **OWNER DEEPER CONCLUSION (not folder-picker-only).** **Root failure:** onboarding **reverses responsibility** — treats user as **system configurator**. **Accepted responsibility:** user **only identifies an authorized project folder**; Agent **reads within boundary**, detects **structure/history/changes**, produces **initial source-backed current understanding**, and asks Owner **only** to correct/confirm uncertainty or **expand permission**. **Hide** projectId / rootPath syntax / watch syntax / internal terms. Continue vs native picker = means. Cancel safe; no read outside folder. **Accept sequence:** open → no internal fields → Continue or pick folder → boundary visible → Agent builds source-backed understanding → Owner only for uncertainty/expand. Durable: `docs/product/SOLUTION-F-06-mvp-onboarding-folder-picker.md`. **Eng CLOSED PASS · Owner 验收关闸产品 tip 仍 `c2641d3b`**（含已验收 MVP `3b6c33a1` + 后续 D-50 commits）· 不重开。**S-128 工程线 tip `8acc36af`**（= `c2641d3b` + TEAM 权责两文档）· **验收关闸 tip 不跟迁。** **S-129:** free treehouse=9；验收须在 3331+fixture 覆盖隐藏 ID/取消/边界/进度/理解+unknown/Owner 确认/Continue。 **S-127 P0 控制面（Owner/验收可归因）:** URL **仅** `http://127.0.0.1:3331/track/knowledge/mvp` · treehouse **slot16** · **勿用**脏主树 **:3000**（HEAD 不可当 D-50 证据）。授权入口 **仅** `/tmp/mvp-v0-g6-d50-fixture` → `.ship/fixtures/mvp-v0-g6-owner-project`。详情：`.ship/handoffs/EL2-P0-CONTROL-PLANE-READY.md`。理解任务完整兑现仍依赖 D-51/D-52 实现波（D-53a）。 | FINAL · tip split eng vs accept · 2026-07-16 |
| D-51 | Product Agent architecture + MVP model (Q-34 core) | **OWNER CONFIRMED · D-53 补齐。** Loop + StepFun pin + receipt。Durable: `SOLUTION-D-51-*`. **Eng S-133（双工程唯一摘要）:** Wave A（领域契约 + run/receipt 轨迹）**已集成 @`33067fe0`**；**产品不宣称 D-51 全完成**。下一波工具+模型并行；独立验收仍待 READY → 再只向双产品报一次。验收关闸 tip 仍 **`c2641d3b`**（不跟迁 33067fe0）。 | FINAL · Wave A eng only · 2026-07-16 |
| D-52 | Agent autonomous tools inside authorized root (D-51 follow-up) | **OWNER CONFIRMED · D-53e。** 根内充分自主 + 确认边界 + receipts。Durable: `SOLUTION-D-52-*`. **Eng S-133:** 工具实现属 **下一波**（与模型并行）；**未**产品全完成；首版仅授权夹。 | FINAL · tools wave pending · 2026-07-16 |
| PL2-D51-D52-REVIEW | Product Lead 2 independent review of D-51/D-52 | **S-120 提出；S-121 Owner 已答 → D-53（含 D-53e = 原 O4/PL2-Q4）。** O1–O5 全闭。Durable: `PL2-SECOND-JUDGMENT-D51-D52.md` · `SOLUTION-D-53-*.md`. | CLOSED by D-53 · archive |
| D-53 | Owner answers on agent task completion, model, tools, scope | **OWNER 亲答 (S-121/S-122).** (a) Agent **持续生长**；**具体任务**「授权夹→理解」必须以 **有来源理解/诚实 unknown** 完成，禁止只连模型空聊。 (b) MVP **固定** StepFun `step-3.7-flash` **先跑通**（中等模型；更强模型后置增益）。 (c) **否决**读文件条数硬顶；靠 **map→搜→精确读→多步 tool→环外验收→可中断**（调研：`docs/research/2026-07-16-elite-agent-tool-design-notes.md`）。 (d) **第一版仅授权文件夹**。 (e) **D-53e FINAL：** 首次在授权夹内摸清全貌；之后盯事默认围着事；夹内扩大须有理由+receipt。 Durable: `docs/product/SOLUTION-D-53-owner-answers-agent-understanding-and-tools.md`. Closes PL2-Q1–Q5. | FINAL · Owner 2026-07-16 |
| D-54 | Team authority reset (replace G-seats / dual-secretary) | **OWNER/OPERATING MODEL FINAL · 立即生效 (S-123).** **唯一现行规则:** `docs/product/TEAM_OPERATING_MODEL.md` · **实时席位:** `docs/product/TEAM_CMUX.md`. **废止** 旧 G 编号、秘书双轨、固定专业身份。 **权威:** Owner 最终；产品话事人1/2 同级；工程话事人1/2 共同对交付负责。三节点产品↔工程双向同步。全栈不设专业边界；实现者不得自验。密钥永不入档。环境自检 `scripts/team-env-check.sh`。产品话事人2 维护 `PRODUCT_DEV_TASKS` + 路演；不吞原始员工流量。 **员工信息入口分摊 → 见 D-55（废止「只由工程话事人2 汇总」）。** | FINAL · amended by D-55 · 2026-07-16 |
| D-55 | Dual Engineering Lead intake (no EL2 single funnel) | **立即生效 (S-126).** **作废** 上一版「普通员工信息统一由工程话事人2 汇总」——会制造单点过载。 **工程话事人1 (:80)** 接收并综合：调研结论、架构问题、技术决策、代码风险、验收含义。 **工程话事人2 (:65)** 接收并综合：任务状态、依赖、工作区、集成状态、READY 证据。 **BLOCKED 同时发两人：** EL1 解技术/契约；EL2 解人员/依赖/环境/集成后果。 **START/DONE** 经共享任务与交付记录让两人都可见。 两人按负载**主动互相分流**，**共同**产出唯一产品向汇总；**任何一人都不是唯一入口**。全栈须与**两位**工程话事人紧密沟通，不得只向一人扔结果后离开。 权威正文：`TEAM_OPERATING_MODEL.md`（已更）· 席位：`TEAM_CMUX.md`。产品侧仍只收**综合后**的工程现实，不吞工人流水。 **S-134 执行补丁（Owner 指出一人 40+ 堆积）：** ① 全栈**禁止**把 ACK/WIP/进度当聊天连发某一工程话事人；默认只写**共享盘**（START/BLOCKED/DONE 四事件）。 ② **禁止**「所有 FS 消息统一 absorb 进 EL2 一人台账」——EL2 ledger 不得自称 sole absorb。 ③ 技术类 → **只** EL1；排程/槽位/集成/READY → **只** EL2；错投 **一句退回** 不代答。 ④ 任一工程话事人**在办 >5** 或收件积压 >10 → 立刻互分流或让全栈改写盘，**禁止**继续堆。 ⑤ 产品侧见到「40 条待办」视为**过程故障**，不是产品待议清单。 | FINAL · anti-pile patch S-134 · 2026-07-16 |
| D-56 | MVP workbench interaction redesign (draft) | **DRAFT · 产品话事人2** · `docs/product/SOLUTION-UI-MVP-INTERACTION-REDESIGN.md`。问题：当前 `/track/knowledge/mvp` 像工程验收台。目标：打开 3 秒内知道现在怎样 / 有据几条 / 下一步只决定什么。**未 FINAL · 不派工 · 不改码** 直至 Owner+双产品点头。 | DRAFT · WAIT dual product + Owner |
| Q-33 | Agent runtime + memory foundation selection | Which stable Agent runtime and memory foundations to use (if any)? Selection **only after** primary-source/pinned-source evaluation; license/transitive review; TypeScript/Next.js/local companion fit; persistence/checkpoint/interrupt/event/tool/replay/test behavior; operational complexity; domain-memory ownership; replacement boundary. **Research returned** (`docs/research/2026-07-16-main-agent-runtime-architecture.md` · `docs/research/2026-07-16-project-memory-architecture-foundations.md` · related). **No framework adopted.** **WAIT_OWNER** on adoption/recommendation accept. Gate: Owner reviews research + isolated-spike evidence before any impl. Linked: D-06/D-13/D-40/T-22. **Product Agent loop + MVP model = D-51**; **in-root autonomy = D-52** (does not adopt a framework). | Research returned · OA-16 WAIT_OWNER adoption · no impl |
| Q-34 | Product Agent architecture: read / reason / retrieve / model | **CORE → D-51 + D-52 + D-53（PL2-Q 全闭）。** 产品方向关。**交付：** S-124 工程 PREP→实现闸（EL1 packet 已在盘）；集成 READY 前不算产品行为兑现。**仍开产品层：** Q-33 框架选型 only。 | 产品关 · eng 实现中 · Q-33 open |
| OA-21 | First usable MVP candidate | **Eng acceptance-ready (S-108/S-111)** tip **`3b6c33a1`**. **G6 final Owner browser PASS**: matched events · delete prior · real candidate wait · 3ch/六问 · accept/review/reload. **G4** unit **252** + H1–H11 **retained**. Evidence: `.ship/handoffs/G6-MVP-V0-owner-scenario-DONE.md` · `.ship/evidence/g6-mvp-v0/final-*`. Process sole: `MVP_FAST_INBOX.md`. **Owner product acceptance still WAIT** (D-02; eng READY ≠ Owner). | Acceptance-ready · Owner pending |
| T-17 | Frontend research | Research current product patterns, reusable open-source UI implementations, X/startup interaction examples, and the current `/track/knowledge` gaps for evidence, candidate/confirmed state, result writeback, and source revision. | Complete; final synthesis and source maps recorded |
| T-18 | Nonlinear workbench clickable prototype | Build an isolated, read-only prototype close to `/track/knowledge` with three switchable structural variants. It must expose a separate main-Agent conversation surface, candidate expansion, click-to-recenter one-hop relations, return/back, result review, and footprint time/touch depth without changing production data. | **Evidence READY (prototype only)** @`08fac68a`: G3A DONE · **G4 PASS G1–G8** · **G6 walkthrough 6/6 PASS** (:3319 stopped). **Owner taste (which variant to ship) non-substitutable** — not production ship / not Owner product acceptance of production UI. Ledger: `G2-T18-prototype-ledger.md`. Evidence: `G6-T18-owner-walkthrough-DONE.md` · `.ship/evidence/g6-t18/`. |
| T-19 | Q-04 project isolation and explicit reuse | Remove silent default-project reads/writes, require current `projectId` on product-facing APIs, reject cross-project id access, and add the minimum explicit Owner-approved cross-project reference with exact source revision and review-on-change. Do not add personal/team libraries or implicit global discovery. | **S-85 FINAL READY EVIDENCE COMPLETE** @ tip **`5bd667cf`** = G5 frozen + G3 inclusive four through **`bd3efa01`**; kind **`approved_source_may_be_relevant`**. **G2 30/30 · 210/210 · lint 0** · **G4 G1–G8/P1–P7 PASS** · **G5 byte-equal 7/7 GREEN** · **G6 S1+S2a–d+S3–S5 8/8 PASS** (:3320 stopped). Post-tip **`8f2` kind changes forbidden**. **No T-21 unlock · no Owner substitute**. Ledger: `G2-T19-S2-redacted-hint-ledger.md`. ≠ T-22. |
| T-16 | Q-02 three red-gap domain/API behaviors | Immutable material hash/citation; server ban on Agent self-confirm; result events → reviewable candidate knowledge only. | Domain/API integrated @`2130ea0f` (179/179); G4 recheck PASS; G6 scenario PASS (not Owner final); ship/no-mistakes run `01KXN3X7GJ9HXQ1NCR6ZBHN9A7` parked/blocked on clean-base reconstruction; F-04 frontend identities still FAIL |
| T-20 | Retrieval source/method engineering prep | Engineering **spec/BDD + independent acceptance prep** for D-29+D-31+D-32 **plus D-41/D-42**. Primary product = **state reconstruction scenarios** (D-42); trust = **provenance/conflict/freshness/use history** (D-41); **no** opaque score / document-only / vector-only path. Central spec **BDD-08–11**. Existing T-16/T-20 identity model; **no** duplicate lifecycle schema. **No** code/connection/credential/write by this track. Spec: `t20-d29-d31-d32-retrieval-contract-spec.md`. Ledger: `G2-T20-safe-prep-ledger.md`. | **S-92 authoritative contract docs-only amend:** primary = six-way now/then/changed/why/depends/evidence; stages 1–5 subordinate; **BDD-08..11** traceability + anti-gates. Seat addenda G1/G4/G5/G6 joined. **No** code/adoption/execute |
| T-21 | Evidence reuse BDD/implementation slice | Smallest non-duplicative BDD + implementation for D-34: reuse by stable ID; backlinks; locator+revision dedupe; new revision fans out review-needed; cross-project still D-27. Map onto existing **T-16** `evidenceIds` / `sourceFileId`+`sourceContentHash` / relations / events and **T-19** cross-project review identity. **No** duplicate Evidence/Draft schema. | **Preserved exactly** (D-34). BDD frozen; G5 RED PREP DONE. **Held** — **T-19 S2 READY evidence does NOT unlock T-21**. **Not** replaced by T-22. not Owner acceptance |
| T-22 | Project Memory research / interface-prep only | **D-13 + interface-prep only** under D-39/D-40/**D-41**/**D-42**/**D-43**. Structure = D-40; **trust = traceability only** (opaque score FAIL); **retrieval = six-way state reconstruction primary**; anti-gates: tool/doc/vector/latest/opaque-score. Architecture selection = **Q-33 / OA-16** (research returned · **WAIT_OWNER adoption**). **No** schema freeze / Agent runtime / framework adopt. **T-21 held.** Canonical ledger: `G2-T22-project-memory-ledger.md`. | **S-93:** five lanes joined. **S-94:** interface PREP **expanded** (reuse/gap · event/understanding transitions · trigger/coalesce/idempotency/retry · fixture spike · Owner decisions/OSS disagreements). Still **non-frozen/docs-only**. **No** runtime/schema/impl. **T-21 unchanged.** |
| T-01 | Infrastructure | Audit and preconfigure each seat's required tools, worktree, runtime, tests, and evidence path before product work. | Audit complete: `.ship/handoffs/G2-team-environment-DONE.md` |
| T-02 | Engineering | Translate D-04 into a Matt-based spec with test seams and vertical implementation slices, using the existing code and living task list. | Assigned to G2 |
| F-03 | Runtime evidence | The current real-data runtime does not expose one accountable Agent that continuously retrieves, acts, and writes results back. Existing Agent capabilities are fragmented review/run/protocol surfaces. | Confirmed by G3/G4/G5/G6 evidence; product gap |
| F-04 | Frontend evidence | The current `/track/knowledge` UI does not visibly distinguish immutable source revision, Agent candidate, Owner-confirmed knowledge, stale/superseded knowledge, or result pending knowledge writeback. | G4 FRONTEND-A1: all five visual identities FAIL; separate from the now-passing T-16 domain/API behaviors |
| F-05 | Owner challenge: not surveillance / not agent gateway | Owner challenged executor-gateway direction: core need is not watching Claude/Codex/Grok or all computer activity. Correct unknown outside authorized project sources is a feature. External agents = change producers only; observe effects in authorized traces without requiring tool identity. | Owner [CAPTURE] 2026-07-16; resolved into **D-39** |
| F-06 | Owner #1 · onboarding reverses responsibility | **Surface:** forces projectId / rootPath / watch syntax (screenshot + `mvp/page.tsx` L115/L229–241). **Root:** treats user as **system configurator**, not project authorizer. **Accepted (D-50 deepened S-114):** user only identifies authorized folder; Agent reads in-boundary, detects structure/history/changes, produces initial **source-backed current understanding**; Owner only corrects/confirms uncertainty or expands permission; hide internal terms. **Not** picker-only bug. **Solution:** `docs/product/SOLUTION-F-06-mvp-onboarding-folder-picker.md`. Evidence: `.ship/evidence/f06-onboarding-internal-ids/`. Eng dual-write in flight; accept = responsibility sequence. | Accepted · D-50 deepened · → G2 · not Owner final ship |

---

## Owner 待回答队列

**S-131 现行未结（只这几条还要 Owner 动）：** **OA-12**（未批）· **OA-16/Q-33**（框架采纳 WAIT，本波 D-48 不换栈）· **OA-21**（亲手验收 WAIT）· **D-56 草案**（UI 改向未点头）。其余 OA 行 = 已答档案。

| ID | 对应问题 | 等待回答 | 状态 |
|---|---|---|---|
| PL2-Q1 | 任务是否完成 | 授权夹后是否必须真正理解（有来源），不能只连模型？ | **已答 → D-53a**：智能体可持续；**该任务**必须理解文件夹才算业务完成 |
| PL2-Q2 | 阶跃模型 | 固定中等模型先跑通？ | **已答 → D-53b**：固定 `step-3.7-flash` 先跑通；更强模型后置增益 |
| PL2-Q3 | 读文件上限 | 要不要条数硬顶？ | **已答 → D-53c**：**不要硬顶**；靠 Agent 架构与工具设计 + 调研笔记 |
| PL2-Q4 | 全貌 vs 盯事 | 何时扫全夹、何时盯一件事？ | **已答 → D-53e FINAL**（Owner：「第四点按建议」）· 首次全貌；盯事默认围着事；扩大有理由+receipt |
| PL2-Q5 | 第一版范围 | 是否只在授权夹？ | **已答 → D-53d**：**第一版仅授权文件夹** |
| OA-01 | Q-02 | 是否批准方案 2 作为目标模型：可核对原件 + 结构化知识/依据 + 行动与事件；检索索引可重建？批准只确定目标，当前三个红色缺口仍进入执行。 | 已回答：批准（D-24） |
| OA-02 | Q-27 | 主界面优先采用哪种结构：A 工作台 + 按需关系轨迹；B 关系画布；C 时间线？ | 已回答：暂选 A；普通线性工作台仍不够，需要继续解决非线性效率 |
| OA-03 | Q-28 | 是否采用“工作台外壳 + 可移动焦点的一层关系画布 + 对话自动形成候选节点 + 使用足迹叠层”作为 A 的非线性交互？ | 已回答：同意，按概念审查修正后进入可点击原型（D-26/T-18） |
| OA-04 | Q-05 | 是否确认首批检索来源为：当前项目真相 + 用户选定的本地文件/代码仓 + 公开网页 + 一个选定 GitHub 仓；Drive 仅选定文件后置试点；Gmail/日历/消息全量接入暂缓？ | 已回答：确认（D-29）；T-20 已授权最小注册表/授权回执/检索轨迹预备（G1+G3B ASSIGN）；不预决 Q-06 |
| OA-05 | Q-29 秘书节奏 | 是否确认秘书向 Lead 的节奏：普通 handoff 静默吸收；有变化时最多每 30 分钟一条五行列摘要；阶段边界/晚饭前/日终强制摘要；仅对 >10 分钟未解 blocker、与已接受产品规则冲突、安全/数据/返工风险、需 Owner 决策、或集成后可验收结果立即升级；无变化不报；秘书先报 Lead，Lead 仅在决策或可体验时打断 Owner？ | 已回答：确认（D-30） |
| OA-06 | Q-06 | 是否确认分阶段检索顺序：项目内精确关键词/元数据 → 一层关系 → 必要时语义项目块 → 已授权结构化外部 API/GitHub → 显式浏览器回退；排序按任务相关、来源可靠、新鲜度、精确度、既往使用，并解释每条结果为何出现；索引可重建、非唯一真相？ | 已回答：确认（D-31 方法）；**产品主检索见 D-42**（事项状态重建）；D-31 仅为从属工具 |
| OA-07 | Q-07 | 是否确认：原始命中仅为临时候选；仅被采用的结果成为钉版本的项目依据；Agent 结论保持候选；Owner 确认后成为已确认知识；来源变化标记待复查并保留旧快照；未采用命中只留在紧凑检索轨迹？ | 已回答：确认（D-32 再确认）；并入 T-20 eng BDD（复用 T-16 身份模型，无重复 schema、无生产实现） |
| OA-08 | Q-08 | 是否确认复用规则：同一依据对象以 ID 跨判断/行动/草稿/结果引用而非复制；展示反向引用；按稳定 locator+精确 revision 去重；新版本保持独立；来源变化向所有依赖扇出待复查；跨项目复用仍须 D-27 显式批准？ | 已回答：确认（D-34 再确认）；实现切片 **T-21**（等 T-19 集成 SHA） |
| OA-09 | Q-09 产品化 · 可见单位 | 知识管理的可见单位是什么：文件、整项目摘要、还是每件正在推进的具体事项/问题/决定？ | 部分回答：单位=一件具体事项（D-36）；Q-09 产品化仍未完成（见 Q-30/OA-10） |
| OA-10 | Q-30 | 若审阅/决策 UI 在 Web，而工作发生在本地文件、代码仓、SaaS、浏览器、人与外部 Agent 上：每件活跃事项如何持续同步，又不要全账号监控或手工重传？ | 已回答：架构 D-37 + 范围 D-38；核心 Agent 见 **D-39**；记忆结构见 **D-40** |
| OA-11 | Q-30 同步范围 | 是否确认：项目级来源授权 + 事项级 Agent 维护的可见 watch set；版本化变更事件；相关变化带理由呈现；无关仅紧凑轨迹；Owner 可检查/关闭；不越权？ | 已回答：确认（D-38 再确认 OWNER DECISION RECORD） |
| OA-12 | Q-12/Q-14/Q-15 执行者模型 | 是否确认：每个 Action 显式写执行者类型、输入依据/版本、权限停点、完成条件、验证；主 Agent 协调负责；Result 挂回事项且只能提议理解变更？ | **未批准**。D-39 不代替本项 |
| OA-13 | Q-31 | Web 主 Agent 如何派发到本地 coding agents 并收回 ACK/进度/结果？ | **非核心（D-39）**；外部 Coding-Agent 编排延后；只读调研 / 未来证据 only |
| OA-14 | First-version Agent definition | 是否确认首版主 Agent = 持续观察授权项目来源变化、维护项目记忆、对照历史、发现影响/缺口/冲突/过期、仅在需要且已授权时再检索、提议当前理解与下一步决策；外部 Coding-Agent 编排延后/非核心？ | **已回答：确认（D-39 FINAL）** |
| OA-15 | Three-layer memory mechanism | 是否确认项目记忆三层 = (1) **不可变/版本化原件**（含最后版本 + 删除 tombstone）；(2) **只追加变化事件**；(3) **版本化当前理解**；关键词/语义/关系索引可重建；大二进制可策略控制保留，但删除**不得抹去**事实/历史？ | **已回答：确认（D-40 产品要求 FINAL）**；技术选型不在本项 — 见 **Q-33 / OA-16** |
| OA-16 | Q-33 Agent runtime + memory foundations | 在完成高质量、可核对的 Agent 架构调研之前，是否禁止任何运行时/记忆基础库的技术选型与采纳？选型必须基于：一手/钉死源码评估、许可与传递依赖审查、TypeScript/Next.js/本地 companion 适配、持久化/checkpoint/中断/事件/工具/重放/测试行为、运维复杂度、领域记忆归属、替换边界；并在 Owner 审阅推荐方案 + 隔离 spike 证据后才能实现？候选保持开放（LangGraph / Temporal / AI SDK / Agents SDK / Letta / Zep 等），**无一采纳**。 | **调研已返回 · WAIT_OWNER 采纳。** 证据：`docs/research/2026-07-16-main-agent-runtime-architecture.md` 等；**无框架已采纳**；**无实现**直至 Owner 审阅推荐 + 隔离 spike 证据 |
| OA-17 | Q-10 Trust expression for current understanding | 产品如何表达对「当前理解」的信任？可见依据 vs 单一置信分数？ | **已回答：确认（D-41 FINAL · S-82 字段定型）** — 须展示：来源种类+精确 revision、推导/Owner 决定、上次核对、冲突/缺口、下游使用；**禁止**置信分/不透明信任分 |
| OA-18 | Q-11 How new results update old understanding | 新结果是否可覆盖旧理解？如何形成可审变迁、何时移动「当前」指针、历史是否保留？ | **已回答：确认（D-43 FINAL · S-99）** — 永不覆盖；只追加可审 transition/新 revision；**current 指针确认后移动**；**历史保留**；依赖需复查。**非 open** |
| OA-19 | Demo / market-entry scenario (Q-18) | 是否将「回到已变化的已授权本地项目 → 重建现在/当时/变化/原因/影响/精确依据 → 帮助下一步决定」定为**首个主场景**？ | **已回答：确认（D-44 FINAL · S-97）** — 首个主场景/路演入口已定 |
| OA-20 | Exact pain / solution / metric (Q-19) | 是否确认痛点、方案与首要效率指标？ | **已回答：确认（D-45 FINAL）** — 痛点=文件/理解/任务/沟通不同步；方案=观察授权来源+版本历史+重建状态+过期/受影响行动；指标=return-to-decision time；测量前不报数字 |
| OA-21 | 首个可用 MVP 候选 | 首个可用 MVP 的范围是什么（在 D-43/D-44/D-45 约束下先交付什么）？ | **工程 acceptance-ready @`3b6c33a1`**（S-111: G6 final PASS · G4 252+H1–H11）· **Owner 亲手验收仍 WAIT** · 不得代办 |
| OA-22 | Q-34 产品 Agent 架构 | 产品 Agent 的架构究竟是什么：如何读、如何推理、如何检索、用什么模型/运行时？ | **核心 D-51 + 自主 D-52 已答** — 循环 + StepFun pin；授权根内充分自主（无逐次读确认、可迭代工具）；须 tool receipts+stopping reason；扩盘/敏感/写发删 commit 须确认。**仍开：** 框架运行时 Q-33/OA-16 |

---

## 产品讨论收件（S-* · 历史日志）

**S-131：** 本节为 **append-only 历史**，**不是**现行组织协议。现行：Owner + 产品话事人1/2；清单 sole writer = **产品话事人2**；工程综合入口 = **D-55** 双工程话事人。旧 Sec1/Sec2/G 编号路由 **废止**（D-54）。下面 S-00～S-130 保留证据链，**状态列 Active 不代表仍生效**。

| ID | 来源 | 类型 | 内容 | 证据 / 原因 | 状态 |
|---|---|---|---|---|---|
| S-00 | Lead | Protocol | **[HISTORIC]** D-49 product secretary protocol. **Superseded by D-54/D-55.** Do not treat Sec1/G2 routing as living. | D-54/D-55; S-131 | SUPERSEDED · archive |
| S-01 | G1+G4+G5+G6 | ACK | D-28 route acknowledged. Ordinary ACK/PREP/WIP/individual-DONE → secretary + G2 only; Lead only via [DECISION]/[BLOCKER]/[READY]. | `.ship/handoffs/G1-ACK-D28-reporting-route.md`; `.ship/handoffs/G4-ACK-D28-reporting-route.md`; `.ship/handoffs/G5-ACK-d28-reporting-route.md`; `.ship/handoffs/G6-ACK-D28-reporting-route.md` | Logged |
| S-07 | G1 | Individual DONE | FRONTEND-R5 document research complete; no pending product code from G1 on that lane. Does not change F-04 (UI identities still FAIL) or authorize production frontend work. | G1 inline ACK 2026-07-16; `.ship/handoffs/G1-ACK-D28-reporting-route.md`; linked T-17 complete | Research DONE; not Owner acceptance |
| S-08 | G3B | Individual DONE | FRONTEND-R2 OSS source map complete. Candidates: assistant-ui MIT; Monaco v0.52.0 MIT; Cline v3.15.0 Apache-2.0; MUI v6.4.0 MIT. Fixed revisions/symbols/license/failure + integration-exit boundaries recorded. No product-code changes; not Q-02/OA-01 implementation; not D-13 production adopt. | `.ship/research/G3B-frontend-oss-source-map.md`; `.ship/handoffs/G3B-frontend-oss-source-map-DONE.md` | Research DONE; not Owner acceptance; not implement auth |
| S-02 | G2 | Ledger | Consolidated T-18/T-19 wave. Integrate seq for T-19: G5 commit → G3 commits on clean base → unchanged RED file → focused/full-unit/lint → unlock G4/G5/G6 post-integration execute. No Owner decision; no durable blocker; nothing READY for Owner acceptance. | `.ship/handoffs/G2-D26-D27-execution-ledger.md`; ASSIGNs G3/G3A/G4/G5/G6 | Active wave |
| S-03 | G5 | HOLD | T-19 RED @`52da97d6` accepted; `tests/unit/project-scope-api.test.ts` **FROZEN**. HOLD: await G2 `:80` integrated SHA/path → unchanged rerun + exact log → `:82`+`:80`. No prod edits; no `:78` routine. | `.ship/handoffs/G5-T19-project-scope-red-tests-DONE.md`; `.ship/handoffs/G5-ACK-t19-dispatch-hold.md`; `.ship/evidence/g5-t19-red-vitest.txt` | HOLD; GREEN blocked on integrate |
| S-04 | G4 | HOLD | T-19 baseline FAIL accepted @`87152b14`. HOLD: wait G2 integrated T-19 SHA+path on `:80`; then execute G1–G8 only; PASS/FAIL → `:82`+`:80`. No implementer edits; no `:78` routine. | `.ship/handoffs/G4-T19-project-scope-fail-gates-DONE.md`; `.ship/handoffs/G4-HOLD-T19-await-integrated-sha.md`; `.ship/research/grok-followups/G4-T19-project-scope-fail-gates.md` | HOLD; execute blocked on integrate |
| S-05 | G6 | PREP / HOLD | T-19 DISPATCH HOLD: PREP accepted; wait G2 `:80` integrated SHA/path; then execute A=`G6体验空项目` / B=`scion` Owner scenario (evidence only; no Owner substitute). Report `:82`+`:80` only. | `.ship/handoffs/G6-T19-owner-scenario-PREP.md`; `.ship/research/grok-followups/G6-T19-cross-project-owner-scenario.md` | PREP held; execute blocked on integrate |
| S-09 | G2+G3–G6 | S2 evidence READY | Tip **`5bd667cf`**. G4+G5+G6 eng evidence complete → **S-72**. Stale “G6 pending” superseded. | `G2-T19-S2-redacted-hint-ledger.md`; S-72 | Superseded by S-72 |
| S-10 | G3A | Individual DONE | T-18 @`08fac68a`: exclusive prototype route; browser A/B/C + responsive screenshots; interaction log; no API/persistence; lint/tsc/diff. Evidence pack recorded. **not** Owner acceptance. | `G3A-T18-nonlinear-prototype-DONE.md`; `.ship/evidence/g3a-t18/**`; S-42 | Individual DONE; acceptance open |
| S-14 | G2 | Ledger | T-20: frozen spec + **D-32 addenda accepted**; no exec tests/impl auth. T-21 BDD frozen at `t21-d34-evidence-reuse-backlinks-spec.md` + `G2-T21-evidence-reuse-ledger.md`; G3/G5 queued behind integrated T-19. T-19: G3 `b74cc1d5` accepted for integrate (not done). Ledgers: T-20 + D26/D27 + T-21. | G2 routine 2026-07-16 | Spec frozen; T-19 integrate pending |
| S-15 | G1 | Individual DONE | T-20 contract DONE + **D-32/Q-07 addendum**: unused hit=trace only; used result=revision-pinned project evidence; Agent conclusion=candidate; only Owner confirm → existing confirmed knowledge; source change=old snapshot + review-needed. No parallel lifecycle schema; no product code. | `docs/research/2026-07-16-t20-source-registry-contract.md`; `.ship/handoffs/G1-T20-source-registry-contract-DONE.md` | Individual DONE + D-32 addendum; not Owner acceptance |
| S-06 | G2 | T-16 state | T-16 domain slices integrated @`2130ea0f`; G4/G6 PASS for approved behaviors; individual≠Owner acceptance. no-mistakes `01KXN3X7GJ9HXQ1NCR6ZBHN9A7` parked; clean-base reconstruction blocked (missing remote prerequisite baseline). F-04 separate. | `.ship/handoffs/G2-T16-production-ledger.md`; G4-T16-red-gap-recheck-DONE; G6-T16-three-red-gaps-owner-scenario-DONE | Domain integrated; ship gate not READY |
| S-11 | Lead/Owner | Capture | OA-04/Q-05 confirmed → D-29 First retrieval source set; Q-05 decided; T-20 safe prep linked (no Q-06 algorithms). OA-05 opened: secretary cadence proposal awaiting Owner. | Lead/Owner [CAPTURE] 2026-07-16 on secretary surface | Superseded by S-12 for OA-05 |
| S-12 | Lead/Owner | Capture | OA-05/Q-29 confirmed → D-30 secretary cadence. OA-06 later answered as D-31 (see S-16). | Lead/Owner [CAPTURE] 2026-07-16 on secretary surface | Superseded by S-16 for OA-06 |
| S-13 | Lead/Owner | Decision record | D-29/OA-04 reaffirmed. T-20 narrowed: smallest source registry + auth receipt + retrieval trace prep only; no Q-06 algorithms, external access/accounts, credentials, or writes. Dispatched G1+G3B ASSIGNs. | `.ship/handoffs/ASSIGN-G1-T20-source-registry-contract.md`; `.ship/handoffs/ASSIGN-G3B-T20-source-registry-interface-prep.md` | Recorded; no escalation |
| S-16 | Lead/Owner | Capture | OA-06/Q-06 → **D-31** Retrieval method. T-20 may use D-29+D-31. **OA-07** later answered as D-32 (see S-17). | Lead/Owner [CAPTURE] 2026-07-16 | Superseded by S-17 for OA-07 |
| S-17 | Lead/Owner | Decision record | D-31 reaffirmed; T-20 upgraded to engineering spec/BDD + independent acceptance prep (no product implement / no external access-write). D-32 Result identity (OA-07). D-33 Roadshow narrative + `docs/product/ROADSHOW_PRODUCT_LOGIC.md`. OA-08 opened for Q-08. | OWNER DECISION RECORD + [CAPTURE] 2026-07-16 | Recorded |
| S-18 | Lead/Owner | Decision record | D-32/OA-07 reaffirmed. Fold D-32 into T-20 eng BDD via existing T-16 identity model; no duplicate lifecycle schema; no product implement auth. | OWNER DECISION RECORD D-32 2026-07-16 | Recorded |
| S-19 | G6 | PREP / ACK | T-20 PREP complete (no execute). D-32 ladder I1–I5 locked in scenario. No product code / external / duplicate schema / Owner substitute. **T-19 still first** (HOLD for G2 integrated SHA → execute A/B). T-20 execute only after eng build **and** after T-19. Standby. | `.ship/handoffs/G6-T20-owner-scenario-PREP.md`; `.ship/research/grok-followups/G6-T20-retrieval-owner-scenario.md` §3b | PREP held; T-19 first |
| S-20 | G4 | PREP DONE + ADDENDUM | T-20 fail-gates PREP R1–R6 + **D-32 R7**: unused=trace-only; revision-pin only when used; Agent no self-confirm; source change keeps stamp+review-needed via T-16; no duplicate schema. T-19 unlock still first. No code/external. | `.ship/research/grok-followups/G4-T20-retrieval-fail-gates-PREP.md`; `.ship/handoffs/G4-T20-retrieval-fail-gates-PREP-DONE.md`; `.ship/handoffs/G4-T20-retrieval-fail-gates-PREP-D32-ADDENDUM-DONE.md` | PREP+R7; T-19 first |
| S-21 | G5 | Plan DONE + ADDENDUM | T-20 RED/BDD plan + **D-32 Gate H**: unused=trace-only; revision-pinned evidence only when used; Agent candidate/Owner confirm via existing T-16 identity; source change keeps snapshot+review-needed; no duplicate schema. Still **no executable tests** until G2 freeze. T-19 priority @`52da97d6` unchanged. No `:78`. | `.ship/research/grok-followups/G5-T20-retrieval-red-bdd-plan.md`; `.ship/handoffs/G5-T20-retrieval-red-plan-DONE.md` | Plan+H; await freeze |
| S-22 | Lead/Owner | Capture | OA-08/Q-08 → **D-34** Evidence reuse. OA-09 opened for Q-09 knowledge-management attention split. ROADSHOW updated with Q-08. | Lead/Owner [CAPTURE] 2026-07-16 | Superseded by S-23 for T-21 |
| S-23 | Lead/Owner | Decision record | D-34/OA-08 reaffirmed. **T-21** registered: smallest non-duplicative BDD/impl for evidence reuse on T-16+T-19 identities; no duplicate Evidence/Draft schema; **impl waits integrated T-19 SHA**. | OWNER DECISION RECORD D-34 2026-07-16 | Recorded |
| S-24 | G5 | PREP DONE | T-21 evidence-reuse RED PREP (no executable tests). Gates R/N/B/I/F/X/S. Exclusive proposal: `tests/unit/evidence-reuse-api.test.ts` + `tests/fixtures/t21-evidence-reuse/`. No Evidence/Draft schema. Wait G2 freeze T-21 BDD + integrated T-19 base. T-19 @`52da97d6` frozen priority. No prod; no `:78`. | `.ship/research/grok-followups/G5-T21-evidence-reuse-red-prep.md`; `.ship/handoffs/G5-T21-evidence-reuse-red-prep-DONE.md` | PREP; T-21 BDD now frozen; wait T-19 integrate |
| S-25 | G3B | Individual DONE | T-20 interface-prep DONE (+D-32 map). Later **reconciliation** → S-27. | `.ship/handoffs/G3B-T20-source-registry-interface-prep-DONE.md` | Superseded by S-27 |
| S-26 | Lead/Owner | Capture | Q-09 essence → **D-35**. OA-09 unit later → D-36. | Lead/Owner [CAPTURE] 2026-07-16 | Superseded by S-27/S-28 |
| S-27 | G3B | Individual DONE | T-20 reconciliation to G1 contract + G2 frozen spec (D-32/D-29/D-31 fields, stage/why/rank display). Listed code gaps: linkEvidence provenance; Agent candidate/work confirmed misuse; checkpoint ≠ knowledge confirmation; AgentBridge stale ≠ general review-needed; search projectId not forced. No prod code/test/external. | `.ship/research/G3B-T20-source-registry-interface-prep.md`; `.ship/handoffs/G3B-T20-source-registry-reconciliation-DONE.md` | Research DONE; not impl |
| S-28 | Lead/Owner | Capture | **D-36** maintained unit = one concrete matter (fields listed). **Q-30/OA-10** opened: continuous sync without full-account surveillance or manual re-upload; candidates only (manual / connectors / local companion / hybrid). Q-09 productization linked, incomplete. ROADSHOW updated. | Lead/Owner [CAPTURE] 2026-07-16 | Superseded by S-29 for OA-10/11 |
| S-29 | Lead/Owner | Capture | Q-30 web+companion (pre-D-37). OA-11 opened. | Lead/Owner [CAPTURE] 2026-07-16 | Superseded by S-30 / D-37 |
| S-30 | Lead/Owner | Decision record | **D-37** Q-30 architecture: Web workbench + local companion + SaaS connectors + browser extension + Agent Bridge; sense authorized work only; versioned change events; candidates matched to matters; no silent rewrite; manual fallback. **D-13 research only**; production waits OA-11/permissions. ROADSHOW updated. | OWNER DECISION RECORD D-37 2026-07-16 | Superseded by S-31 for D-38 |
| S-31 | Lead/Owner | Decision record | **D-38** OA-11 sync scope confirmed. **OA-12** opened (Q-12/Q-14/Q-15 executor model). ROADSHOW updated. | Lead/Owner [CAPTURE] 2026-07-16 | Superseded by S-32 reaffirm |
| S-32 | Lead/Owner | Decision record | D-38/OA-11 **OWNER DECISION RECORD** reaffirmed. D-37 research expands to concrete options + min isolated adapter/spike **proposal** (D-13); **no spike exec / no prod** until OA-12 executor/result contract. Ledger: `.ship/handoffs/G2-D37-sync-research-ledger.md`. (Historical note: an early READY claim for T-19 was withdrawn — see S-40.) | OWNER DECISION RECORD D-38 + D-37 ledger 2026-07-16 | OA-12 gate for spike |
| S-33 | G5 | Research DONE · G2 ACCEPTED | D-37 browser call-in **accepted as D-13 input**: Chijie `cea3e38`/v0.1.13 Apache-2.0; no call-in API; A-now / B-loopback-later only. D-38 grant+watch+matchReason+revoke mapped. **Addendum remains local-fixture proposal only** (no spike run). | `docs/research/2026-07-16-d37-browser-extension-callin-source.md`; G5 DONE handoff; G2 D-38 join | Joined D-13; local-fixture only |
| S-34 | G2 | Gate | **D-38 synthesis gate**: four D-37 D-13 join + **OA-15** memory mechanism (D-39 Agent scope confirmed). **Joined:** G1 + G5. **Remaining join:** G3B + G3. | `.ship/handoffs/G2-D38-sync-adapter-spike-ledger.md` | Gate held; OA-15 open |
| S-35 | G1 | Research DONE · G2 ACCEPTED | D-37/D-38 local companion: Chokidar `5.0.0` MIT vs watchexec `v2.5.1`/`8.2.0` Apache-2.0 — fixed source, capability/gap, license, exit; **candidate input only, neither adopted**. Fixture-only adapter proposal unexecuted. | `docs/research/2026-07-16-d37-local-companion-watchers-research.md`; `.ship/handoffs/G1-D37-local-companion-watchers-research-DONE.md` | Joined D-13; not adoption; not spike |
| S-36 | G3 | Research DONE | D-37 Agent Bridge audit @`87152b14`: protocol-only (bind/request/answer); reuses grant/hash/idempotency/stale; **missing** watcher/registry/cursor/candidate/match/D-38 watch UX. Fixture spike proposed only; no execute. **Not yet G2-joined** into D-38. | `.ship/research/grok-followups/G3-D37-agent-bridge-source-audit.md`; `.ship/handoffs/G3-D37-agent-bridge-source-audit-DONE.md` | Research DONE; join pending |
| S-37 | G3B | Research DONE | D-37 GitHub/Drive events research handoff present (`G3B-D37-github-drive-events-research-DONE.md`). **Not yet G2-joined** into D-38. | `.ship/handoffs/G3B-D37-github-drive-events-research-DONE.md`; ASSIGN-G3B-D37-… | Research DONE; join pending |
| S-38 | G2 | Scope note | T-19 S2 residual → policy open (pre-S-41). Superseded by **S-41** resolution. | `G2-D26-D27-execution-ledger.md` | Superseded by S-41 |
| S-39 | Lead/Owner | Capture | OA-12 not approved; Q-31/Q-32 opened (pre-D-39). **Superseded for scope by S-52 / D-39.** | Lead/Owner [CAPTURE] 2026-07-16 | Superseded by S-52 |
| S-40 | G2 | Ledger correction | **T-19** was Acceptance HOLD (G4/G5 PASS; G6 S2 FAIL); T-21 locked. **T-18** G3A evidence only. **D-38 join:** G1 accepted; G5 local-fixture only; remaining G3B+G3. S2 policy state superseded by **S-41**. | G2 routine ledger correction 2026-07-16 | D-38/T-18 still valid; T-19 S2 → S-41 |
| S-41 | Lead/Owner | Decision record | **T-19 S2 RESOLUTION · option A (D-27 + D-38):** Cross-project hint only inside **active Owner-preauthorized** project/source grant; hint **generic/redacted** (no project title / id / content / object / hit / revision); sensitive and ungranted / expired / disabled / revoked → **zero hint**; opening/using still requires separate explicit Owner-approved **revision-pinned** T-19 reference; **no global discovery**. Blocker **resolved into active corrective BDD/implementation**. **Not READY**. Spec: `t19-s2-d27-d38-redacted-hint-spec.md`. Ledger: `G2-T19-S2-redacted-hint-ledger.md`. | Lead/Owner T-19 S2 RESOLUTION 2026-07-16 | Corrective authorized; not acceptance |
| S-42 | G2/G3A | Routine state | **T-18:** G3A individual DONE @`08fac68a`. G4 falsify dispatched. G6 PREP → S-45. **Not** Owner acceptance / **not READY**. | `G3A-T18-nonlinear-prototype-DONE.md`; `.ship/evidence/g3a-t18/**`; `G2-T18-prototype-ledger.md` | Superseded by S-45 for G6 |
| S-43 | G6 | PREP · execute open | T-19 S2 RERUN PREP done. **Unlocked** on integrated tip **`5bd667cf`** (S-61). Independent execute → `:82`+`:80`. | `G6-T19-S2-redacted-hint-rerun-PREP.md` | Execute open |
| S-44 | G5 | Individual DONE · RECONFIRM | **T-19 S2 RED active frozen** (reconfirmed). Base `g2/t16-integration@d715b64d` · branch `g5/t19-s2-redacted-hint-red` · HEAD `6d224c4c` · worktree `fc-opc-ibot-g5-t19-s2-hint-red`. Exclusive `tests/unit/project-scope-hint-api.test.ts` only. Reconfirm **7/7 FAIL exit 1**. No prod edits/push. Log: `.ship/evidence/g5-t19-s2-redacted-hint-red-vitest.txt`. Handoff: `G5-T19-S2-redacted-hint-red-tests-DONE.md`. Await G2 integrate → unchanged GREEN rerun. No `:78`. | same evidence (reconfirm) | RED frozen active; wait integrate |
| S-45 | G6 | PREP → DONE | T-18 walkthrough PREP then **EXECUTE 6/6 PASS** (S-64). | `G6-T18-owner-walkthrough-PREP.md` | Superseded by S-64 |
| S-46 | G2 | Routine state | **T-19 S2 correction started.** Frozen contract `t19-s2-d27-d38-redacted-hint-spec.md` + ledger `G2-T19-S2-redacted-hint-ledger.md`. Base `d715b64d`. **G5 RED** dispatched/DONE frozen `6d224c4c`. **G3 production** dispatched. **G6 PREP accepted** (S-43). **G4 PREP** → S-47. **T-21 remains held**. Not READY. | G2 routine 2026-07-16; S-41; S-43; S-44 | Active; wait corrected SHA |
| S-47 | G4 | PREP → DONE | T-19 S2 PREP then **EXECUTE PASS** (S-63). | `G4-T19-S2-redacted-hint-falsification-PREP.md` | Superseded by S-63 |
| S-48 | G3 | Individual DONE | **T-19 S2 production tip `5df8cd95`** reported DONE (range `acf3deab..5df8cd95`). Not integrated — see S-49 durable hold. | `G3-T19-S2-redacted-hint-DONE.md` | Superseded by S-49 for integrate state |
| S-49 | G2 | Durable HOLD | Historical: tip `5df8cd95` path mismatch — **no integrate**. Superseded by **S-50** corrected tip `bd3efa01` with `redacted-hints`. | `G2-T19-S2-redacted-hint-ledger.md` | Superseded by S-50 |
| S-50 | G3 | Individual DONE | Historical tip `bd3efa01`. Later S-55 wrongly claimed tip `8f2ea27c` — **VOID by S-78**. | was G3 DONE | See S-78 |
| S-51 | G4 | Individual DONE · PASS | **T-18 falsification PASS G1–G8.** Target `g3a/t18-nonlinear-prototype@08fac68a` lease14. Runtime private **:3318 STOPPED**; no product/branch edits. G1 structure · G2 Agent≠search + candidate · G3 recenter/back · G4 text+icon kinds · G5 confirm/edit/reject no self-confirm · G6 footprint time≠depth · G7 CONTEXT revisions · G8 `/api`=0 + exclusive scope. Residuals: non-prod nav / memory-only / not Owner taste. Note: T-19 S2 still priority when G2 SHA arrives. Report :82+:80 only. | `G4-T18-prototype-falsification-DONE.md`; `G4-T18-prototype-fail-gates.md`; `.ship/evidence/g4-t18/` | PASS; not Owner acceptance |
| S-52 | Lead/Owner | Scope correction | First D-39 write (gateway out of core). Refined by **S-53** as F/D **candidate** (not final). | 2026-07-16 | Superseded by S-53 for finality |
| S-53 | Lead/Owner | Capture · F/D candidate | Owner challenged executor-gateway direction. **F-05** + **D-39 candidate** (not final until next confirmation): not Claude/Codex/Grok or whole-computer surveillance; only Owner-authorized project sources; out-of-scope activity **correctly unknown**; external Agents = possible file/git/tool change producers; observe **effects** in authorized sources without knowing tool; no authorized trace → unknown; execution gateway = **optional future**, not core. **OA-14** to confirm first-version Agent = persistent **observer/reasoning partner** for authorized project change (perceive versions/add/edit/delete/git/source events; project memory; compare history; gaps/conflicts/stale; retrieve more only when needed/authorized; propose understanding + next-decision updates; external execution orchestration **deferred**). Merge lines: business logic (remember evolution, restore judgment context, reduce confusion) + Agentization (perception+memory+reasoning+tools+bounded autonomy **on that logic only**). **OA-12 still not approved.** No memory/runtime prod until OA-14 confirmed. | Owner [CAPTURE] 2026-07-16 | Candidate; await reconfirm |
| S-54 | G3/G2 | Handoff correction | Historical: tip was `bd3efa01`. **S-55 8f2 tip claim VOID (S-78).** | S-54 2026-07-16 | See S-78 |
| S-55 | G3 | Individual DONE | Historical tip claim **`8f2ea27c` — VOID**. Not authorized production tip. | S-55 | **VOID by S-78** |
| S-56 | G3 | Handoff correction · no new impl | Range defect + four-commit set. Refined by **S-57** scope freeze. | S-56 | Superseded by S-57 for freeze |
| S-57 | G2/G3 | Scope freeze | T-19 S2 freeze: four @ `bd3efa01` only; post-tip kind **out**. Pending re-verify. | `G2-T19-S2-redacted-hint-ledger.md` | Active freeze |
| S-58 | G3 | ACK · idle | **T-19 S2 SCOPE FREEZE ACK.** Accepted integrate only: **`afeedbc5^..bd3efa01`**. G3 idle. | `G3-T19-S2-redacted-hint-DONE.md` | ACK; G3 idle |
| S-59 | Lead/Owner | Decision record | OA-14 → D-39 confirmed (pre-FINAL wording). Superseded by **S-60 FINAL** + **T-22**. | Owner [CAPTURE] 2026-07-16 | Superseded by S-60 |
| S-60 | Lead/Owner | Decision FINAL | **D-39 / OA-14 FINAL** + **T-22** research/interface-prep only; **T-21** preserved. OA-15 open; OA-12 not approved. | OWNER DECISION FINAL 2026-07-16 | D-39 FINAL; T-22 research only |
| S-61 | G2 | Integration DONE | **T-19 S2 integration corrected.** Tip **`5bd667cf`**. G4/G6 unlocked. **T-21 remains held.** | `G2-T19-S2-redacted-hint-ledger.md` | Integrated; accept execute open |
| S-62 | G2 | PREP ledger | Historical prep-ledger path. **Canonical T-22 ledger** = `G2-T22-project-memory-ledger.md` (S-72). | was `G2-T22-project-memory-prep-ledger.md` | Superseded path by S-72 |
| S-63 | G4 | EXECUTE DONE · PASS | **T-19 S2 falsification PASS** @ `5bd667cf` only. G1–G8 + P1–P7. Residual listCards helper. **Not** a T-22 join; T-19 ledger only. | `G4-T19-S2-redacted-hint-falsification-EXECUTE-DONE.md`; `.ship/evidence/g4-t19-s2/` | T-19 PASS (hygiene: ≠ T-22) |
| S-64 | G6 | EXECUTE DONE · PASS | **T-18 owner walkthrough DONE 6/6 PASS** @`08fac68a`. Owner taste non-substitutable. Prototype evidence READY (S-72). | `G6-T18-owner-walkthrough-DONE.md`; `.ship/evidence/g6-t18/` | PASS walkthrough |
| S-65 | G2 | Ledger hygiene (stale) | Earlier row wrongly joined T-19 G4 into T-22. **Void.** T-22 G4 only via `G4-T22-project-memory-falsification-PREP-DONE.md` (S-71/S-72). | S-65 void | Superseded by S-72 hygiene |
| S-66 | G5 | Individual DONE | **T-22 Project Memory RED-prep (D-39/OA-14).** Exclusive **docs only**. Plan + handoff G5-T22-… Gates **M1–M8** + P1–P8. Joined **canonical** T-22 ledger (S-72). | `G5-T22-project-memory-red-prep-DONE.md`; `G2-T22-project-memory-ledger.md` | Research DONE; not impl |
| S-67 | Lead/Owner | Decision FINAL | **D-40 / OA-15** product memory structure (first write). Refined by **S-68**. | OWNER DECISION ADDENDUM D-40 2026-07-16 | Superseded detail by S-68 |
| S-68 | Lead/Owner | Capture · Decision refine | **OA-15 confirmed → D-40** product requirement only: versioned originals + append-only change events + versioned current understanding; rebuildable indexes. **Requires** stable high-quality Agent architecture research before technical selection. **Q-33 / OA-16 open:** runtime + memory foundations selection criteria recorded; **no framework adopted**; LangGraph/Temporal/AI SDK/Agents SDK/Letta/Zep/etc candidates only; two deep research lanes active; **no implementation** until Owner reviews recommendation + isolated-spike evidence. **OA-17 / Q-10 opened** (waiting Owner): trust in current understanding — recommended visible basis = source count/type, exact revisions, last checked time, Owner/adoption status, conflicts, use history; **no** single opaque confidence score. ROADSHOW: D-40 product requirement only (no framework claim). T-18–T-21 unchanged. | Owner [CAPTURE] 2026-07-16; PRODUCT_DEV_TASKS + ROADSHOW | D-40 product-only; Q-33/OA-16 open; OA-17 wait |
| S-69 | G3 | Individual DONE | **T-22 memory-revision-analysis interface PREP.** Docs only. PMA seam + F1–F10. At join time D-41/D-42 were research notes; **superseded as Owner FINAL by S-70**. | `G3-T22-memory-revision-analysis-interface-DONE.md` | Research DONE; not impl |
| S-70 | Lead/Owner | Decision FINAL | **D-41 + D-42 OWNER DECISION FINAL** (not lane-only). **D-41 trust:** visible provenance/revision, conflicts, freshness/effective/stale, use history; **never** opaque trust score (OA-17/Q-10 answered). **D-42 retrieval product:** one-matter project-state reconstruction for now / then / what changed / why / what depends / exact evidence. **D-31 methods subordinate only**; document/vector/latest-only **unauthorized** as primary. Align **T-20** + **T-22** prep (no production/schema/adoption). ROADSHOW updated. | OWNER DECISION RECORD D-41/D-42 2026-07-16; PRODUCT_DEV_TASKS + ROADSHOW | D-41/D-42 FINAL; T-20/T-22 align only |
| S-71 | G4 | PREP DONE · T-22 only | **T-22 architecture falsification PREP** (docs only). Evidence: `G4-T22-project-memory-fail-gates.md` + `G4-T22-project-memory-falsification-PREP-DONE.md`. M1–M8 Partial/Gap; expected RED until freeze+fixture spike. **≠** T-19 G4 PASS (S-63). Joined **only** into `G2-T22-project-memory-ledger.md`. | G4-T22 handoffs; S-72 | T-22 G4 DONE; not impl |
| S-72 | Lead/Secretary | FINAL STATE RECONCILE | T-19/T-18/T-20 snapshot. **T-22 part superseded by S-75** (G1/G3B not joined; only G3/G4/G5). T-19 S2 eng READY @`5bd667cf` still stands. | Owner PRIORITY FINAL STATE RECONCILIATION 2026-07-16 | T-19 holds; T-22 → S-75 |
| S-73 | Secretary | Ledger hygiene | **T-22 G4 join rule locked:** PENDING until exclusive `G4-T22-project-memory-falsification-PREP-DONE.md` exists; **now exists → DONE joined** on that path only. **T-19 G4 S2 PASS** lives only in `G2-T19-S2-redacted-hint-ledger.md` — never cross-joins T-22. Purged prep-ledger dual-artifact G4 row. T-19 status preserved separately (S-72). | `G2-T22-project-memory-ledger.md`; prep-ledger superseded note | Hygiene fixed |
| S-74 | G5 | ADDENDUM · T-22 D-40 | **G5 T-22 RED-prep D-40 structure addendum.** Owner-accepted structure (already D-40 FINAL): versioned immutable originals + append-only events + versioned current understanding + rebuildable index projections. Lane stays research/interface prep. OSS/frameworks **compare-only** (no choose/adopt). **No** Agent runtime · schema freeze · production. Plan §0: `G5-T22-project-memory-red-prep.md`. Handoff: `G5-T22-project-memory-red-prep-DONE.md`. No `:78`. Does not change T-18/T-19/T-20/T-21. Reaffirms G5 join on canonical T-22 ledger. | plan §0 + handoff; `G2-T22-project-memory-ledger.md` | ADDENDUM joined; not impl |
| S-75 | G2/Secretary | T-22 ledger correct | **Lane-separated join set:** G3/G4/G5 joined **only** exclusive T-22 DONE handoffs. **T-19 S2 G4 PASS** exclusively in `G2-T19-S2-redacted-hint-ledger.md`. **D-40** four-layer + **G5 M1–M8** addendum recorded. **Awaiting G1/G3B DONE joins.** **No** schema/BDD/production/T-21 changes. Supersedes S-72 claim that G1/G3B already joined. | `G2-T22-project-memory-ledger.md` | Partial PREP; G1/G3B pending |
| S-76 | G4 | ADDENDUM · T-22 D-40 DONE | **G4 T-22 D-40 structure addendum.** Truth model: M2 originals · M3 append-only events · M5 versioned understanding · M7 indexes=rebuildable projections (never truth). M1/M6/M8 still required around structure; coding-agent gateway non-core. OSS (lakeFS/Graphiti/Wikibase/Jena/Chokidar/watchexec/ES patterns) **compare-only — no choose/adopt**. Research/interface prep only. **No** schema freeze · Agent runtime · production. **Not** impl unlock. T-19 status untouched. No `:78`. | `G4-T22-project-memory-fail-gates.md`; `G4-T22-project-memory-falsification-D40-ADDENDUM-DONE.md`; `G2-T22-project-memory-ledger.md` | ADDENDUM joined; not impl |
| S-77 | G5 | EXECUTE DONE · GREEN | **T-19 S2 independent GREEN rerun** only. Tip `g2/t16-integration@5bd667cf` · path `~/.treehouse/fc-opc-ibot-678696/13/fc-opc-ibot` · `tests/unit/project-scope-hint-api.test.ts` SHA256 `f9bb0830133c1b5839e24be8debb2357526312d202442d483474cec244809215` **MATCH** · `npm run test:unit -- --run tests/unit/project-scope-hint-api.test.ts` → **7/7 PASS exit 0** · no test/product diff · suite residuals none. Log: `.ship/evidence/g5-t19-s2-green-rerun-5bd667cf.txt`. Handoff: `G5-T19-S2-redacted-hint-green-rerun-DONE.md`. **T-22 separate / not touched.** No `:78`. Affirms S-72 eng READY G5 leg. | evidence + handoff; `G2-T19-S2-redacted-hint-ledger.md` | T-19 GREEN reconfirm DONE |
| S-78 | G2/Secretary | T-19 AUTHORITATIVE CORRECTION | Frozen spec L31 kind = **`approved_source_may_be_relevant`**. G3 accepted slice = **`bd3efa01`** (`afeedbc5^..bd3efa01`). Post-`bd3efa01` kind-change through **`8f2ea27c`** = **contract-wrong / not authorized / not tip**. Any G2/G3 claim of **8f2 as production tip = VOID**. Acceptance candidate remains integrated **`5bd667cf`**. **G4 PASS valid** on that tip. Post-G4 correct wait was G5+G6 — already completed on `5bd667cf` (S-77 + G6 8/8), never on 8f2. | `t19-s2-d27-d38-redacted-hint-spec.md` L31; `G2-T19-S2-redacted-hint-ledger.md` | Contract corrected |
| S-79 | G6 | EXECUTE DONE · 8/8 PASS | **T-19 S2 RERUN** @`5bd667cf` · path `~/.treehouse/fc-opc-ibot-678696/13/fc-opc-ibot` · runtime **:3320 stopped** · primary `data/knowledge` · **no** product edits · **no** Owner substitute. **S1–S5 all PASS** (S2a–d). kind=`approved_source_may_be_relevant` · message 固定 · no scion/B/CONTEXT/card/hash leak · grant `5acf1e30…` · pin `cf9768ce…` unchanged on S5. Evidence: `G6-T19-S2-redacted-hint-rerun-DONE.md` · `G6-T19-S2-redacted-hint-rerun-runtime.json` · `.ship/evidence/g6-t19-s2/execute-report.json`. **T-22 separate.** Completes eng-evidence set with G4+G5 (S-78 tip). | handoff + runtime + execute-report; `G2-T19-S2-redacted-hint-ledger.md` | T-19 G6 DONE 8/8 |
| S-80 | G1 | Individual DONE · T-22 join | **G1 T-22 local folder/Git observation research.** Research: `G1-T22-local-git-observation.md`. Handoff: `G1-T22-local-git-observation-DONE.md`. Delivered: materials/Bridge/T-20 seams map; Chokidar/libgit2/isomorphic-git **evidence-only** compare; unfrozen authorized-observe / versioned-event / matter-candidate-match interface; replay/overflow/tombstone/privacy matrix + unexecuted fixture proposal. D-40 originals→events→understanding aligned. **No** deps/watcher/production/Agent runtime. Joined T-22 ledger. **G3B still pending.** T-19/T-21 unchanged. | research + handoff; `G2-T22-project-memory-ledger.md` | G1 joined; not impl |
| S-81 | Lead/Owner | Decision reaffirm FINAL | **D-41 + D-42 OWNER DECISION (reaffirmed).** **D-41:** trust = **traceability**, never opaque score; show provenance, conflict, freshness, use history. **D-42:** primary retrieval = **project-state** for an active matter: now · past-time state · what changed · why · **impacted dependents** · exact evidence revisions; **not** document/card search. **D-31** keyword/metadata/relations/semantic/external = subordinate tools only. **No** document-only or vector-search product implementation authorized. Corrected T-20/T-22 narrative + T-20 BDD-08–11 wording. **Existing statuses preserved** (T-18/T-19/T-21/T-22 joins unchanged). ROADSHOW + T-20 spec aligned. | OWNER DECISION D-41/D-42; `t20-d29-d31-d32-retrieval-contract-spec.md`; ROADSHOW | FINAL reaffirm; no impl unlock |
| S-82 | Lead/Owner | Capture · Decision refine + OA open | **D-41 field-fixed (Q-10/OA-17):** no confidence score; trust = source kind/exact revision · derivation/Owner decision · last checked · conflicts/gaps · downstream use. **D-42 deepened (Q-06–Q-08):** retrieves **project state + state transitions**, not knowledge/doc chunks; for a matter: current · historical · what changed · why · depends · exact evidence; keyword/semantic/relations = tools under purpose. **Canonical terms** (Lead wording → CONTEXT/ROADSHOW): **state@t** = source revisions + facts/judgments/decisions + unknowns + actions + results; **transition** preserves before/change/after. **[historical] OA-18/Q-11 then OPEN** → **answered D-43 (S-97/S-99)**. ROADSHOW + T-20/T-22 narrative aligned. **Statuses preserved** (T-18–T-21; T-22 G1/G3/G4/G5 joined · G3B PENDING). | PRODUCT_DEV_TASKS + ROADSHOW + CONTEXT; T-20 BDD field align | D-41/D-42 refined FINAL; OA-18 → D-43 via S-97/S-99; no impl unlock |
| S-83 | G2/Secretary | T-19 S2 ENGINEERING FINAL + ledger D-41/D-42 | **T-19 S2 ENGINEERING FINALIZED** @ tip **`5bd667cf`**: G5 + four commits **`afeedbc5^..bd3efa01`**; frozen kind **`approved_source_may_be_relevant`**; **G5 7/7 GREEN · G4 PASS · G6 8/8 PASS**. Optional **`8f2`** and post-tip kind changes **rejected**. Hygiene: **`next-env.d.ts` restored**; generated **`pnpm-lock` removed**; evidence/handoffs **preserved**. **T-20 + T-22 ledgers** corrected for D-41/D-42: trust = provenance/conflict/freshness/use history; retrieval = **state reconstruction scenarios**; **no** opaque score / document-only / vector-only path. **T-21 still held**. Owner hands-on product accept still non-substitutable (D-02). T-22 G3B still PENDING. | `G2-T19-S2-redacted-hint-ledger.md`; `G2-T20-safe-prep-ledger.md`; `G2-T22-project-memory-ledger.md`; PRODUCT_DEV_TASKS + ROADSHOW | T-19 eng FINAL; T-20/T-22 narrative only; no T-21 unlock |
| S-84 | G1 | ADDENDUM DONE · D-41/D-42 | **G1 D-41/D-42 ADDENDUM DONE.** Updated existing **T-20 contract** + **T-22 observation research** + **two handoffs**. Retrieval = six-way project-state reconstruction: **now / then / changed / why / depends / evidence**. Every state must expose **provenance · conflict · freshness/effective/stale · use history**. Keyword / semantic / vector / rank = subordinate diagnostics only; **opaque trust score = direct FAIL**. **Docs/research only** — **no** runtime / schema / production. Joined on T-20 + T-22 ledgers. Statuses preserved (T-19 eng FINAL; T-21 held; T-22 G3B PENDING). | `docs/research/2026-07-16-t20-source-registry-contract.md`; `G1-T20-source-registry-contract-DONE.md`; `G1-T22-local-git-observation.md` + `G1-T22-local-git-observation-DONE.md`; T-20/T-22 ledgers | ADDENDUM joined; not impl |
| S-85 | G2/Secretary | T-19 S2 FINAL READY EVIDENCE | **T-19 S2 FINAL READY EVIDENCE COMPLETE** @ integrated tip **`5bd667cf`** = **G5 frozen + G3 inclusive four through `bd3efa01`**; kind **`approved_source_may_be_relevant`** per frozen spec. **G2:** focused **30/30**, full **210/210**, lint **0 errors**. **G4:** G1–G8/P1–P7 **PASS**. **G5:** byte-equal **7/7 GREEN**. **G6:** S1+S2a–d+S3–S5 **8/8 PASS**, port **3320 stopped**. Post-tip **`8f2` kind changes remain forbidden**. **READY evidence complete.** **No T-21 unlock · no Owner substitute.** T-18/T-20/T-22/G3B statuses unchanged. | `G2-T19-S2-redacted-hint-ledger.md`; PRODUCT_DEV_TASKS + ROADSHOW | READY eng complete; not Owner; T-21 held |
| S-86 | G5 | ADDENDUM DONE · D-41/D-42 | **G5 D-41/D-42 ADDENDUM** on **T-20 + T-22 research only**. Retrieval product = six-way project-state (**now/then/changed/why/depends/evidence**); methods incl. semantic/vector **subordinate**; trust = provenance/conflict/freshness/use-history **not** opaque score. **T-20** plan **§0** + primary file `project-state-retrieval.test.ts` (proposal). **T-22** **§0.5** + gate **M9**. Docs: `G5-T20-retrieval-red-bdd-plan.md` · `G5-T22-project-memory-red-prep.md`; DONE handoffs updated. **No** runtime/framework/schema/prod · **no** `:78`. Joined T-20/T-22 ledgers. Statuses preserved (T-19 READY; T-21 held; G3B PENDING). | G5 T-20/T-22 research + DONE handoffs; T-20/T-22 ledgers | ADDENDUM joined; not impl |
| S-87 | G2/Secretary | T-22 ledger join reaffirm | **T-22 ledger: G1 D-41/D-42 DONE joined** — six-way state reconstruction; visible **provenance / conflict / freshness / effective-stale / use-history**; **opaque trust score FAIL**. **Joined lanes now G1 / G3 / G4 / G5**; **awaiting G3B only**. **No** schema / runtime / production changes. T-19 READY separate; T-21 held. | `G2-T22-project-memory-ledger.md`; PRODUCT_DEV_TASKS + ROADSHOW | PREP partial; G3B only |
| S-88 | G3 | ADDENDUM DONE · D-41/D-42 | **G3 D-41/D-42 ADDENDUM** on active **T-22** (+ **Q-06** retrieval map). **D-41:** trust = traceability only — provenance+revision · conflicts · freshness/staleness · use history; rank/score diagnostic only, never opaque trust product. **D-42:** primary = six-way project-state (**now/then/changed/why/depends/evidence**); keyword · relation · semantic/vector · GitHub · browser = subordinate tools with reason/scope/receipt. Corrected: `G3-T22-memory-revision-analysis-interface.md` **§12**; `G3-Q06-staged-retrieval-execution-map.md` (stages demoted); handoffs T-22 DONE (+ Q-06 DONE note). Docs commit **`80bcb0b7`**. **No** runtime/framework/schema/production · idle. Joined T-22 ledger. G3B still PENDING. | research §12 + Q-06 map; T-22/Q-06 DONE handoffs; `G2-T22-project-memory-ledger.md` | ADDENDUM joined; not impl |
| S-89 | G4 | ADDENDUM DONE · D-41/D-42 | **G4 T-20/T-22 D-41+D-42 ADDENDUM DONE.** Authority Owner D-41+D-42 · ASSIGN-T20-T22-D41-D42. Mode research/BDD only. **D-42:** six-way now/then/what-changed/why/what-depends/what-evidence; D-31 tools subordinate. **D-41:** provenance+conflict+freshness+use history; opaque score/confidence-as-trust **FAIL**. **T-20:** **R8** primary + **R9** trace trust; **R4** demoted diagnostics. **T-22:** D-40 layers replay **S1–S6** + D-41 fields; anti-gates **MX-doc/vector/score/latest**. Expected current product: **R8/R9/MX Gap-FAIL** (not execute verdict). Evidence: `G4-T20-retrieval-fail-gates-PREP.md` · `G4-T22-project-memory-fail-gates.md` · `G4-T20-T22-D41-D42-ADDENDUM-DONE.md`. Report **:82+:80 only · never :78**. Joined T-20/T-22 ledgers. G3B PENDING. | G4 research + ADDENDUM DONE; T-20/T-22 ledgers | ADDENDUM joined; not exec |
| S-90 | G6 | ADDENDUM DONE · D-41/D-42 · T-20 only | **G6 T-20 D-41/D-42 ADDENDUM · research correction DONE.** Authority Owner D-41+D-42. Mode docs/research only · **no** runtime/framework/schema/production · **no execute** · **no Owner substitute**. Product = six-way **now/then/changed/why/depends/evidence**. Trust = provenance+rev · conflicts · freshness · use history · **never** opaque score. D-31 tools subordinate. Later execute **FAIL** if document-only / latest-only / vector-only / score-as-trust / history-losing / unpinned. Edited: `G6-T20-retrieval-owner-scenario.md` · `G6-T20-owner-scenario-PREP.md` · `G6-T20-D41-D42-state-retrieval-ADDENDUM-DONE.md`. **T-22: no G6 file · not edited.** Joined T-20 ledger only. | G6 T-20 research + PREP + ADDENDUM DONE; `G2-T20-safe-prep-ledger.md` | ADDENDUM joined; not exec |
| S-91 | G2/Secretary | T-22 ledger addenda reaffirm | **T-22 ledger:** **G3/G4/G5 D-41/D-42 research corrections joined** (with G1). **G6 T-20 addendum remains T-20-only** — **not** mislabeled as T-22 evidence. Product shape: **six-way reconstruction primary**; trust **traceability-only**; anti-gates tool/doc/vector/latest/opaque-score. **G3B remains the only unjoined T-22 lane.** No schema/runtime/production. | `G2-T22-project-memory-ledger.md`; PRODUCT_DEV_TASKS + ROADSHOW | PREP partial; G3B only |
| S-92 | G2/Secretary | T-20 authoritative contract docs-only amend | **T-20 authoritative contract amended docs-only** at `t20-d29-d31-d32-retrieval-contract-spec.md`: **project-state reconstruction** (now/then/changed/why/depends/evidence) is **primary**; stages **1–5** subordinate tools; **BDD-08..11** add traceability + anti-gates for document/latest/vector/history-loss/unpinned/opaque-score. **No code/adoption changes.** **T-22** will carry the **same queries after G3B DONE join**. Ledgers + ROADSHOW aligned. | `t20-d29-d31-d32-retrieval-contract-spec.md`; `G2-T20-safe-prep-ledger.md`; `G2-T22-project-memory-ledger.md` | Contract frozen (docs); no impl |
| S-93 | G2/Secretary | T-22 all lanes + interface PREP | **T-22 all five research lanes joined; G3B DONE incorporated.** Interface proposal created (**PREP, not frozen**): `t22-d39-project-memory-interface-spec.md`. Covers immutable originals/events/understanding/projections; six state queries; permission/replay/failure/migration; alternatives/open approvals. Aligns T-20 six-way (S-92). **No** schema/runtime/implementation/adoption. **T-21 unchanged.** G6 remains T-20-only. | `G2-T22-project-memory-ledger.md`; `t22-d39-project-memory-interface-spec.md`; PRODUCT_DEV_TASKS + ROADSHOW | PREP complete (lanes); proposal not frozen; no impl |
| S-94 | G2/Secretary | T-22 interface PREP expand | **T-22 interface PREP expanded** per completeness request (still **non-frozen / docs-only**): canonical **reuse/gap table**; **source-event** and **understanding-proposal** transitions; **trigger / coalesce / idempotency / failure-retry** rules; **fixture-only spike** boundary + pass evidence; explicit **Owner decisions** and **OSS disagreements**. Path: `t22-d39-project-memory-interface-spec.md`. **No** runtime/schema/implementation. **T-21 unchanged.** Lanes remain all joined. | `t22-d39-project-memory-interface-spec.md`; `G2-T22-project-memory-ledger.md`; ROADSHOW | PREP expanded; not frozen; no impl |
| S-95 | Lead/Secretary | Capture · Organizer primary source + OA-19 | **Organizer primary-source input** from `Downloads/2026-07-13 10_01 记录_原文.pdf` recorded into roadshow/research. Organizer: Agent in concrete business scene for real role/task; tools=means; fewer steps/time/mistakes; efficiency examples = phase/task decompose, delay risk, reminders, **project-state updates** (collab ≠ chat only), customer follow-up from background/history/current product materials + next actions; small/deep scenario + clear output; scoring = real scene/clear user, commercial potential, innovation, runnable/easy demo. **Lead synthesis OPEN (not FINAL):** **consistency** = tools/people/actions agree on same current project state; **continuity** = today continues causally from yesterday with history intact. Retrieval/knowledge/workflow = **internal ingredients, not the pitch**. **Proposed focused user story:** project lead/solo operator returns to a **changed** project → source-backed **current state · why changed · affected actions · next decision**. **OA-19 opened** for Owner: make this primary demo/market entry? No eng unlock. | PDF primary; `docs/research/2026-07-16-organizer-primary-source-20260713-briefing.md`; ROADSHOW; OA-19 | Superseded scene status by S-96 / D-44 |
| S-96 | Lead/Owner | Decision FINAL · D-44 + OA-20 open | **OA-19 confirmed → D-44 FINAL.** Primary entry/roadshow scene: solo operator or project lead returns after days/weeks of changes across **authorized** files/code/tools; Agent reconstructs **current state**, explains **why changed**, identifies **stale/affected actions**, helps **next decision with exact sources**. ROADSHOW + Q-18/Q-19 inputs updated. **OA-20 opened** (pain/solution wording only): recommended pain/solution strings recorded; not frozen until Owner. Metric candidate: **return-to-decision time**; **no numeric claim before measurement**. Eng statuses preserved (T-18–T-22). | OWNER D-44; ROADSHOW; PRODUCT_DEV_TASKS Q-18/Q-19; research briefing | Superseded open OA-20 by S-97 / D-45 |
| S-97 | Lead/Owner | Decision FINAL · list correct · no dispatch | **D-43 (Q-11):** new results never overwrite old understanding; create new current-understanding revision; retain old/conflict/source versions; mark dependents review-needed. **D-44 (Q-18):** first primary scene = return after days/weeks to **authorized local project**; Agent reconstructs **now/then/changed/why/impact/exact evidence**; helps next decision. **D-45 (Q-19):** pain = files/understanding/tasks/comms out of sync after change; solution = observe authorized sources + version/history + reconstruct state + flag stale/affected; metric = **return-to-decision time**. **Q-11/Q-18/Q-19 = 已决定** (no longer 待讨论). **Q-33:** research returned, **WAIT_OWNER adoption** (no framework adopted). **OA-21** first usable MVP candidate **WAIT_OWNER** — must not decide for Owner. ROADSHOW aligned. **No eng unlock / no :78 interrupt.** | Lead correction 2026-07-16; PRODUCT_DEV_TASKS + ROADSHOW | D-43/D-44/D-45 FINAL; OA-21 WAIT_OWNER; no dispatch |
| S-98 | Lead | Dual-secretary · no dispatch | **D-46 active.** Sec2 `surface:83` = current MVP fast inbox (`SECRETARY_2_PROTOCOL.md` · sole writer `MVP_FAST_INBOX.md`). Sec1 `surface:82` = sole writer `PRODUCT_DEV_TASKS.md` + `ROADSHOW_PRODUCT_LOGIC.md`; continues existing ~19-item backlog; **does not** reprocess raw MVP handoffs; merges **only** Sec2 phase digests. **Never concurrent same-file write.** Ordinary ACK silent to Lead. | Lead→Sec1 2026-07-16; `docs/product/SECRETARY_2_PROTOCOL.md` | Boundary active; Sec1 on backlog |
| S-99 | Lead/Owner | Priority correct · D-43 | **OA-18/Q-11 Owner-confirmed in current dialogue → D-43 FINAL answered.** Never overwrite; append-only reviewable transition/new revision; current pointer moves only after confirmation; history retained. Correct any residual open/待讨论 language. ROADSHOW D-43 aligned. Current MVP PRD already executes. | Lead→Sec1 Owner decision priority 2026-07-16 | D-43 answered; not open |
| S-100 | Owner/Sec1 | Ops · D-47 throughput | **Owner agreed** three MVP-wave efficiency rules → **D-47**. WIP≤2 builders+1 integrate; single board=`MVP_FAST_INBOX`; no deep G4/G6 PREP until integrate READY then ≤15min start. Critical path G3B→G2→one unit→G4/G6. Recorded in PRODUCT_DEV_TASKS + SECRETARY_2_PROTOCOL + TEAM_CMUX. **Notify Lead :78** (+ G2/Sec2 operational). | Owner chat Sec1; `SECRETARY_2_PROTOCOL.md` §Throughput | D-47 active |
| S-101 | Sec1 | Research · tech selection code-grounded | **Read main tree + G2 MVP project-memory.** Opinion to Lead (no code): keep SQLite+CAS+parcel+pure reducer+split ports; reject LangGraph/Mastra/Temporal/vector-as-truth for MVP; dual truth + AI SDK as later topics. **Lead answered → D-48 (S-105).** Note: AgentModelLoop↔`shared/llm` already wired ≠ AI SDK. | `docs/research/2026-07-16-tech-stack-code-grounded-selection.md`; Lead :78 | Closed by D-48 |
| S-102 | Sec2→Sec1 | Phase · MVP-V0 integrate READY | **Sec2 phase digest only** (no raw handoff reprocess). MVP-V0 integrate **[READY]** tip **`7bc7980a`** @ treehouse slot16 `g2/mvp-v0-integration` clean; full unit **30 files / 252 PASS**; includes Node22/watcher lock · G5 · G3A UI. G4/G6 **unlocked ≤15m**. Lead :78 already escalated by Sec2. Process truth remains `MVP_FAST_INBOX.md`. **Not** Owner product acceptance. | Sec2 digest 2026-07-16; `MVP_FAST_INBOX.md` | Superseded tip by S-103 `ae567899` |
| S-103 | Sec2→Sec1 | Phase · READY tip update | **READY tip → `ae567899`** (watcher fix: `next.config.ts` serverExternalPackages += `@parcel/watcher`). Prior READY `7bc7980a` (unit 252 · G4 PASS) stands as parent. Lead-proved grants **500→200**. **G6 unlocked · final single-browser re-run** on `ae567899`. Runtime dirt (next-env/package/pnpm/data) not product commit. Process: `MVP_FAST_INBOX.md`. **Owner accept still pending.** | Sec2 digest 2026-07-16; `MVP_FAST_INBOX.md` | Superseded tip by S-106 `3b6c33a1` |
| S-104 | Sec1 | Roster · G3A/G3B → Grok handshake | Owner switched **G3A (`:79`) + G3B (`:77`)** from GPT to **Grok**. TEAM_CMUX + G-SEATS updated. Handshake sent both seats: team map, report route G2+Sec2, D-47 WIP, current MVP tip `ae567899`, no Lead spam, exclusive worktree ownership. G2/Lead notified. | `docs/product/TEAM_CMUX.md`; cmux :79 :77 :80 :78 | Handshake sent |
| S-105 | Lead | Decision FINAL · D-48 | **Lead received S-101.** **D-48:** MVP keeps node:sqlite + FS CAS + watcher + reducer + existing ports; **no** new orchestration frameworks; **JSON/SQLite dual truth not merged this wave**; **AI SDK deferred**. Supplement: **AgentModelLoop already uses `shared/llm` adapter ≠ AI SDK unification**. Stage decision closed; **do not re-nag**. ROADSHOW + research header aligned. | Lead CAPTURE via Sec1; PRODUCT_DEV_TASKS + ROADSHOW + research | D-48 FINAL; S-101 closed |
| S-106 | Sec2→Sec1 | Phase · READY tip update | **READY tip → `3b6c33a1`** (G3A wiring: analysis matched events · delete `beforeRevisionId`; focused **4/4 PASS**). Supersedes `ae567899` G6 path. Prior unit 252 + G4 @ `7bc7980a` stand. **G6 unlocked final browser** · wait real candidate ~15s. Process: `MVP_FAST_INBOX.md`. **Owner accept pending.** | Sec2 digest 2026-07-16; `MVP_FAST_INBOX.md` | Tip `3b6c33a1`; G6 final; Owner pending |
| S-107 | Sec1 | Roster · G1 → Grok handshake | Owner switched **G1 (`:63`)** GPT → **Grok**. TEAM_CMUX + G-SEATS updated. Full handshake sent: 11-window map, D-22/D-46/D-47/D-48, report routes, sources of truth, current MVP tip `3b6c33a1`. **Lead `:78` notified.** | `docs/product/TEAM_CMUX.md`; cmux :63 :78 :80 | Handshake + Lead report |
| S-108 | Sec2→Sec1 | Phase · MVP acceptance-ready | **MVP-V0 acceptance-ready** tip **`3b6c33a1`**. **G6 browser PASS** (Owner-scenario Lead checks). **G4 unit 252 + H1–H11 retained** @ `7bc7980a`. Wiring 4/4 retained. Evidence on disk. Next: **Owner accept** (not substituted). Process: `MVP_FAST_INBOX.md`. Lead already notified by Sec2. | Sec2 digest 2026-07-16; `MVP_FAST_INBOX.md`; G6 DONE handoff | Eng acceptance-ready; Owner pending |
| S-109 | Lead | Team reset · Owner feedback delivery | Ten supporting seats reorganized by accountability: Sec1 product record; G2 delivery; Sec2 execution intake; G1 research; G3/G3A/G3B/G5 builders; G4 independent verdict; G6 browser evidence. Ordinary traffic cannot interrupt Owner/Lead discussion. The Owner's “levels” were an information-flow example, not mandated names. | `docs/product/TEAM_OPERATING_MODEL.md`; TEAM_CMUX; G-SEATS; SECRETARY_2_PROTOCOL | Active; handshakes sent |
| S-110 | Sec1 | ACK · D-49 立即生效 | **Sec1 ACK D-49.** Role = **产品秘书 only** (Owner+Lead 产品讨论). Record each feedback: 问题 · 真实例子 · 已定方案 · 可见验收行为 · 路演逻辑 · 未回答问题. **不派工 · 不吞普通员工汇报.** File boundary (D-46) unchanged: sole writer PRODUCT_DEV_TASKS + ROADSHOW; merge Sec2 phase digests only. 协作硬规则: 问题不得原样退回 → 推进或证据/阻塞依赖/建议下一负责人交 G2. **cmux ACK → Sec2 `:83` only; no ordinary status to Lead `:78`.** Authority: `docs/product/TEAM_OPERATING_MODEL.md`. | Owner/Lead reorg instruction; PRODUCT_DEV_TASKS S-00/D-46/D-49/Q-29 aligned | ACK'd · operational |
| S-111 | Sec2→Sec1 | Phase · MVP eng ready + D-49 ACK wave | **Phase digest only** (Sec2 不写 PRODUCT_DEV_TASKS). **MVP-V0 engineering acceptance-ready** tip **`3b6c33a1`**. **G6 final** Owner browser **PASS** (matched events · delete prior · real candidate wait · 3ch/六问/accept/review/reload). **G4** unit **252** + H1–H11 retained. Evidence on disk: `G6-MVP-V0-owner-scenario-DONE.md` · `.ship/evidence/g6-mvp-v0/final-*`. Execution sole: `MVP_FAST_INBOX.md`. **D-49:** Sec2 收 **9 席 ACK 中**；**roster-ready 只发 G2+Sec1**（不打扰 Owner/Lead 产品对话）. **OA-21 Owner accept still WAIT** — eng READY ≠ Owner. No dispatch. | Sec2 digest → :82 2026-07-16; evidence paths verified present | Merged · Owner pending |
| S-112 | Owner/Lead→Sec1 | Capture · F-06/D-50 · solution→G2 | **Owner feedback #1 recorded.** F-06 + **D-50 FINAL**. Onboarding must not expose projectId/rootPath/watch syntax. Durable solution written; **path sent to G2 `:80` only** (not Lead routine). Roadshow section added. Evidence screenshot durable under `.ship/evidence/f06-onboarding-internal-ids/`. Sec1 **no seat dispatch**. | `docs/product/SOLUTION-F-06-mvp-onboarding-folder-picker.md`; ROADSHOW; PRODUCT_DEV_TASKS | Recorded · G2 notified |
| S-113 | Sec2→Sec1 | Phase · D-50 dual-write dispatched | **Phase digest only** (Sec2 不写 PRODUCT_DEV_TASKS). **D-50/F-06** G2-dispatched dual writers base **`3b6c33a1`**: **G3B** native folder connection · **G3A** onboarding folder choice. **G5 本轮排除**（G2 归属裁定）. ASSIGN on disk: `ASSIGN-G3B-D50-native-folder-connection.md` · `ASSIGN-G3A-D50-onboarding-folder-choice.md` (verified present). Execution sole: `MVP_FAST_INBOX.md`. Product acceptance still Owner-only after integrate+G4/G6. No Lead routine. | Sec2 digest → :82 2026-07-16; ASSIGN paths verified | Merged · eng in flight |
| S-114 | Owner→Sec1 | Capture · D-50 deepen · re-send G2 | **Owner confirmed deeper conclusion on feedback #1.** Not folder-picker-only. Root = **responsibility reverse** (user as configurator). Responsibility model + acceptance **sequence** + roadshow meaning written into durable solution. **One path re-sent to G2 `:80` only** (not Lead). Sec1 no seat dispatch; G2 reclassifies if dual-write scope insufficient for post-folder understanding. | `docs/product/SOLUTION-F-06-mvp-onboarding-folder-picker.md` rewritten; PRODUCT_DEV_TASKS F-06/D-50; ROADSHOW | Deepened · G2 notified |
| S-115 | Owner/Lead→Sec1 | Open Q · product Agent architecture | **Opened Q-34 + OA-22** for Owner/Lead discussion. Scope: product Agent **read / reason / retrieve / model-runtime**. **Code facts only, no decision.** Observer FS reads; model sees events+accepted+snippets not general files; StepFun `step-3.7-flash` via local CC Switch Anthropic-compatible adapter; deterministic fallback; no tool loop; no provider/fallback receipt. **Keep open until Lead conclusion.** Distinct from Q-33 framework adoption. Lead notified once via decision path. Sec1 no eng unlock. | PRODUCT_DEV_TASKS Q-34/OA-22; `observer.ts` · `agent-model-loop.ts` · `reconstruct.ts` · `shared/llm/adapter.ts` | Superseded core by S-116 / D-51 |
| S-116 | Owner→Sec1 | Decision FINAL · D-51 · Q-34 core | **Owner confirmed Q-34 core architecture + MVP model → D-51.** Agent loop: observe authorized project → project map → selective tool read/retrieve → reason on exact revisions → continue until sufficient or unknown → source-backed candidate → Owner correct/confirm → persist + monitor. MVP primary = **StepFun**; Anthropic-compatible Messages (adapter appends `/v1/messages`; base = gateway root); **high** effort for reconstruction; model replaceable; project truth never belongs to model; receipt = provider/model/effort/fallback; **never record API key**. Core of Q-34/OA-22 **closed**; follow-ups: tool list + Q-33 runtime. Durable solution written; Lead decision path + G2 path sent. Sec1 no seat dispatch. | `docs/product/SOLUTION-D-51-product-agent-architecture-mvp-model.md`; PRODUCT_DEV_TASKS; ROADSHOW | Superseded pin detail by S-117 |
| S-117 | Owner→Sec1 | Pin · D-51 model + base URL | **Owner re-confirmed D-51 with exact MVP model/transport.** Model id = **`step-3.7-flash`**. Base URL = **`https://api.stepfun.com/step_plan`** (adapter still appends `/v1/messages`). Loop/effort/receipt/replaceability/truth ownership unchanged. **Never record API key.** Durable SOLUTION + ROADSHOW + D-51/Q-34/OA-22 rows pinned. Lead + G2 notified of pin only. | same SOLUTION-D-51 path | Superseded by S-118 dedicated pin file |
| S-118 | Sec1→G2 | Durable pin · D-51 LLM config for G2 | **G2 reported formatting omitted exact non-secret values.** One durable accepted-solution pin written and **sent to G2 `:80` only:** `docs/product/SOLUTION-D-51-mvp-llm-endpoint-config.md`. Contains: base `https://api.stepfun.com/step_plan` · append `/v1/messages` · model `step-3.7-flash` · effort field `effort`=`high` · secret env key name `LLM_API_KEY` only (no value). **G5 activates only after D-50 final acceptance.** No secret value. Sec1 no seat dispatch. | pin file + D-51 rows | G2 has exact pin |
| S-119 | Owner→Sec1 | Decision FINAL · D-52 autonomy | **Owner confirmed D-51 follow-up: sufficient autonomous capability.** **D-52 FINAL.** In-root auto tools + iterate; no per-read confirm; D-10/D-18 external with receipt; confirm for expand/sensitive/write-send-delete-commit; Owner see+interrupt; tool receipts + stopping reason; no API keys. Durable written; Lead decision path + G2 path sent. Q-34 tool-autonomy follow-up closed. Sec1 no seat dispatch. G5 still after D-50 final accept. | `docs/product/SOLUTION-D-52-agent-autonomous-tools-in-authorized-root.md` | D-52 FINAL · G2 notified |
| S-124 | EL2→产品话事人1/2 | 唯一产品向工程汇总（D-54） | **EL2 :65 综合（非工人流水）。** (1) **D-50 CLOSED PASS @ `c2641d3b`** — 首启/授权边界工程验收；不重开。 (2) **D-51/D-52 PREP 核心已齐**；receipt 四字段现码全 GAP；:74 residual **不挡产品方向**。 (3) 下一步工程内：EL1 packet（盘上已有 `EL1-D51-D52-engineering-packet.md`）→ EL2 互斥派实现 → 独立席验 → 集成 READY **只再向两位产品话事人报一次**。 (4) env READY with WARN（主仓脏 · treehouse）。 (5) treehouse 租约近满 · 不强制清脏 lease。 **产品侧:** 记录/未决归 :63；Owner 连续对话归 :78；三节点与 :80+:65 双向同步。**不吞工人 ACK。** | EL2 汇总 2026-07-16；PRODUCT_DEV_TASKS D-50/D-51/D-52 行更新 | 产品话事人2 已吸收 |
| S-125 | EL2→产品话事人1/2 | D-50 验收进夹路径更正 | **Owner/D-50 浏览器验收进项目路径** 更正为**仅** **`/tmp/mvp-v0-g6-d50-fixture`**（指向仓内标准 fixture `.ship/fixtures/mvp-v0-g6-owner-project`）。后续验收与演示**勿**用其它本地工程路径冒充。钉：`.ship/fixtures/MVP-V0-G6-FIXTURE-ENTRY.md`。**不**改变 D-50 产品责任模型；**不**重开 D-50 eng close。 | EL2 一句 2026-07-16 | 产品话事人2 已入 D-50 行 + ROADSHOW |
| S-126 | Owner/组织→产品话事人2 | D-55 工程双负责人共同承接 | **权责纠正 · 立即生效。** 作废「员工信息只由工程话事人2 汇总」。EL1 接调研/架构/技术/风险/验收含义；EL2 接状态/依赖/工作区/集成/READY；BLOCKED 双发；START/DONE 共享可见；两人分流并**共同**出产品向汇总；全栈不得只对一人扔完就走。`TEAM_OPERATING_MODEL.md` 已更。D-54 入口分摊条款以 D-55 为准。 | 组织纠正 2026-07-16 | 产品记录已入 D-55 |
| S-127 | EL2→产品话事人1/2 | P0 控制面收口 | **产品向唯一汇总。** Owner/验收 URL **`http://127.0.0.1:3331/track/knowledge/mvp`** · slot16 · **非** 脏主树 :3000。D-50 tip **`c2641d3b`**（含 `3b6c33a1`+4）。Fixture **仅** `/tmp/mvp-v0-g6-d50-fixture`。容量 free=2（已还 14+15；脏 12/13/16 保留）。风险：槽紧 · 勿混 3000/3331 · slot16 运行期脏不 force-return · :74 residual 非阻塞。钉：`EL2-P0-CONTROL-PLANE-READY.md`。 | EL2 汇总 2026-07-16 | 产品话事人2 已吸收 |
| S-128 | EL2→产品话事人1/2 | 工程 tip 更正 | **工程线 tip 现 `8acc36af`**（= `c2641d3b` + TEAM 权责两文档）。**Owner 验收关闸产品 tip 仍报 `c2641d3b`**；URL 仍 **`http://127.0.0.1:3331/track/knowledge/mvp`**。不改 D-50 关闸结论。 | EL2 一句 2026-07-16 | 产品话事人2 已入 D-50 行 |
| S-129 | EL2→产品话事人1/2 | P0 控制面再汇总 | **URL 仍** `http://127.0.0.1:3331/track/knowledge/mvp` · cwd slot16 · 数据 `/tmp/fc-opc-ibot-c264-owner-runtime-3331`。**关闸 tip `c2641d3b`** · 运行 tip `8acc36af`（文档 only）。Fixture 仅 `/tmp/mvp-v0-g6-d50-fixture`。验收覆盖：隐藏内部 ID · 取消无残留 · folder 边界 · reconcile 进度 · 来源理解+unknown · Owner 确认分离 · reload Continue。**free=9**。勿用 :3000。浏览器全场景仍需在 3331 复跑。 | EL2 2026-07-16 | 产品话事人2 已吸收 |
| S-130 | EL1+EL2→产品话事人 | D-55 再确认 | **内部汇报不经单一工程话事人汇总。** EL1=架构/技术含义；EL2=派工/集成/READY；产品仅在关键节点收**共同**一份汇总。权威 `TEAM_OPERATING_MODEL.md` · 与 D-55 一致。 | 工程双负责人 2026-07-16 | 产品话事人2 已对齐 |

---

## 产品共识待办（本窗口与主人共同回答）

以下问题全部进入清单。每个问题保留原因、备选方案、决定和被事实推翻的记录。状态依次为: 待讨论 → 方案待确认 → 已决定 → 已交工程 → 待主人试用 → 已验证 / 被反例推翻。

### K. 知识系统: 产品究竟记住什么

#### Q-02 我们需要什么样的知识库？

**为什么必须回答:** 检索、知识管理和工作流都会读写它。定义错误，三个能力会再次割裂。

**需要分析:**

- 可核对原件: 文件、网页、会议、邮件、聊天、代码和执行产物。
- 提炼出的知识: 事实、判断、问题、关系、决定、SOP 和案例。
- 行动与过程: 工作项、责任人、状态、期限、确认、执行日志和结果。
- 原件、知识和行动如何通过稳定 ID、来源、时间、版本、状态和项目边界连接。
- 关键词索引、语义索引、关系图各自负责什么；哪些数据丢失后可以重建。

**三个可选形态:**

1. 文件 + 向量库。搭建快，擅长相似内容问答；事实状态、版本、行动回流和审计较弱。
2. 原件 + 结构化知识 + 行动事件 + 可重建检索索引。能支撑完整循环，也能沿用现有领域对象。
3. 全事件账本。追溯最强；读取、迁移和产品复杂度最高。

**决定:** 采用方案 2 作为目标真相模型。原始材料层、结构化知识层、行动/事件层保存真实记录；关键词、语义和关系索引用来加速查找，并可从真实记录重建。现有 Material / KnowledgeCard / Relation / ActionItem / WorkEvent 作为实现骨架。T-16 已在集成分支实现材料 hash/引用新鲜度、服务器禁止 Agent 自确认、执行结果生成候选知识且不自动晋升；G4/G6 已通过领域与 API 验收。前端身份可见性、旧字节留存和公共事件入口仍是独立缺口。见 D-24、F-04。

**产出:** 知识对象表、层级关系、每类对象的真相来源、生命周期和权限边界。  
**交工程条件:** 同一组对象能够完整表达“一条外部资料进入，被判断，产生行动，得到结果，再修正旧知识”。  
**状态:** 已决定；T-16 三项领域/API行为已通过 G4/G6，最终 no-mistakes ship gate 进行中。

#### Q-03 什么算知识，什么只是候选信息？

**需要分析:** 搜索命中、Agent 摘要、Agent 推断、人的决定和执行结果分别处于什么状态；谁能确认、修改、否决、标记过期和删除；新旧说法冲突时如何保留事实。

**决定:** 检索命中首先是候选信息；每次检索保存原因、范围、来源和时间。真正用于判断或行动的结果保存为稳定项目依据。Agent 推断保持候选，并保留提出者、依据和时间。Owner 确认后，相关判断或决定成为已确认知识；执行结果作为新依据回流，经复查后更新当前结论。见 D-16。

**产出:** 候选 → 已引用 → 已确认 → 已过期 / 被推翻的状态规则。  
**状态:** 已决定；已交 G1/G2。

#### Q-04 知识的范围如何划分？

**需要分析:** 当前项目知识、跨项目可复用知识、个人长期知识、团队共享知识的可见性与引用规则；项目能否默认看见其他项目；敏感材料如何隔离。

**当前代码事实:** 主工作台的项目画布、材料和项目搜索按当前 `projectId` 工作；但全局 library map、部分读取/搜索/状态 API 在未传 `projectId` 时会返回跨项目内容。因此界面上的项目隔离只覆盖部分路径，系统边界尚未项目硬隔离。显式跨项目复用、个人长期知识、团队共享和敏感级别均不存在。

**决定:** 默认只读取和写入当前项目；缺少 `projectId` 不是“查看全部”，而是错误。跨项目复用必须由 Owner 明确批准并建立引用，不复制原件；引用保留来源项目、来源对象、精确版本和最后核对时间，来源变化后所有使用方进入复查。敏感项目默认不向其他项目暴露标题或命中。个人长期知识和团队共享知识不进入首批实现。见 D-27/T-19。

**产出:** 知识范围和权限模型。  
**状态:** **T-19 S2 FINAL READY EVIDENCE COMPLETE** @ tip **`5bd667cf`**（S-85）：G5 frozen + G3 四 commits 至 **`bd3efa01`**；kind **`approved_source_may_be_relevant`**；G2 **30/30 · 210/210 · lint 0**；G4 G1–G8/P1–P7 PASS；G5 byte-equal 7/7 GREEN；G6 S1+S2a–d+S3–S5 8/8 PASS（:3320 stopped）；**post-tip `8f2` kind 禁止**。**无 T-21 解锁 · 无 Owner 代办**（D-02）。

### R. 资料检索: 从哪里找，找到后怎么用

#### Q-05 产品从哪些来源检索？

**需要分析:**

- 产品内: 当前项目材料、知识卡、关系、工作项、事件、历史检索和执行结果。
- 本地: 用户授权的文件夹、代码仓、笔记库。
- 工作工具: 邮件、日历、会议、消息、任务和项目系统。
- 外部世界: 公开网页、官方文档、论文、数据库和竞品信息。
- 每类来源的授权、时效、成本、可引用性和失效方式。

**当前判断:** 默认先查当前项目真相；项目内信息不足、用户明确要求调研或任务依赖新鲜外部事实时，再扩展到其他本地来源与外部世界。每次扩大范围都应在结果中可见。

**决定:** 首批检索来源为：当前项目真相；Owner 选定的本地文件夹/代码仓；公开网页；一个选定 GitHub 仓只读。Google Drive 仅 Picker 选定文件后置。Gmail、日历、消息、整账号同步暂缓。见 D-29。本决定不裁定 Q-06。

**T-20 授权范围:** 仅研究/接口预备——最小来源注册表、授权回执、检索轨迹；不得选 Q-06 算法、访问外部来源/账号、处理凭据、启用写入。派工证据：`ASSIGN-G1-T20-source-registry-contract.md`、`ASSIGN-G3B-T20-source-registry-interface-prep.md`。

**产出:** 来源地图、授权方式、接入优先级和来源失效处理。  
**状态:** 已决定（OA-04 → D-29）；T-20 已派 G1/G3B 预备；生产接入仍须后续正式授权与 D-13/T-11 证据。

#### Q-06 资料检索使用什么方法和工具？

**需要分析:** 文件名和全文关键词、标签与时间过滤、语义检索、关系遍历、混合排序、Web/官方文档/学术/数据库工具、Agent 改写查询与多轮深挖；何时使用哪种方法，如何解释“为什么找到了它”。

**方法 (D-31，从属工具):** 关键词/元数据、关系、语义、外部结构化、浏览器回退——**仅为服务 D-42 目的的工具**，不是产品主面。排序与“为何出现”仍适用。索引可重建、非真相。

**产品主检索 (D-42 FINAL · S-82 加深 · 链 Q-06–Q-08):** 检索的是**项目状态与状态变迁**，**不是**知识/文档片段或卡片命中。对**一件事项**重建：**当前状态** · **历史状态** · **改了什么** · **为什么改** · **依赖它的是什么** · **精确支持证据**。**state@t** = 来源 revision + 事实/判断/决定 + 未知 + 行动 + 结果；**transition** 保留 before / change / after。信任字段见 D-41。**禁止** document-only / vector-search 产品实现授权。

**产出:** 状态+变迁六问（D-42）+ 从属工具（D-31）+ 可追溯信任字段（D-41）。  
**状态:** 已定；T-20 BDD-08–11 已写；**无**生产实现/schema/外连写入。

#### Q-07 检索结果在产品中处于什么地位？

**需要分析:** 结果是临时候选、项目材料、可引用依据还是已确认知识；什么动作促使身份转变；原网页变化或失效后怎么处理。

**决定:** 未采用命中仅留在紧凑检索轨迹；被采用的结果成为钉住版本的项目依据；Agent 主张保持候选；Owner 确认后主张成为知识；来源变化使依赖标记待复查，同时保留旧快照。见 D-32（对齐 D-16/D-24）。

**产出:** 检索结果转换规则和引用体验。  
**状态:** 已决定（OA-07 → D-32）。

#### Q-08 检索结果如何被复用？

**需要分析:** 同一依据如何被项目判断、回答、关系、SOP、工作项、邮件草稿和下一次检索引用；如何去重；如何查看反向引用；原依据变化时哪些下游需要复查。

**决定:** 保存一份依据对象，以稳定 ID 复用；向每个判断/行动/草稿/结果暴露反向引用；按稳定 locator + 精确 revision 去重；新 revision 保持独立并向所有依赖扇出待复查；跨项目复用仍须 D-27 显式 Owner 批准。见 D-34。

**产出:** 稳定引用、反向引用、去重和影响分析规则。  
**工程:** **T-21** 最小 BDD/实现切片，映射既有 T-16 evidenceIds / sourceFileId+sourceContentHash / relations / events 与 T-19 跨项目复查身份；禁止重复 Evidence/Draft schema。**状态：** T-19 S2 工程证据 READY（S-72）；**T-21 仍 held**（无自动开工，须 G2/Owner 显式解锁）。  
**状态:** 已决定（OA-08 → D-34 再确认）；路演见 `docs/product/ROADSHOW_PRODUCT_LOGIC.md`。

### M. 知识管理: 知识如何生长、冲突和过期

#### Q-09 “管理知识”具体管理什么？

**需要分析:** 接收、解析、去重、切分、摘要、提取事实/问题/决定、建立关系、分配范围、确认/否决、合并、版本、过期、归档、删除和恢复；哪些自动完成，哪些必须让人看见或确认。

**本质 (D-35，已确认):** 知识管理 = 持续维护一份**有来源、可修订的项目理解**，使人与 Agent 不必从散落材料重建上下文。

**可见单位 (D-36，已确认):** 维护单位 = **一件正在推进的具体事项**（问题/判断/决定/目标），携带：目的、依据、未知、当前理解、决定、行动、执行方、结果、修订历史。不是以文件为唯一单位，也不是只剩整项目摘要。

**产品化仍未完成:** 跨 Web 控制面与本地/SaaS/浏览器/外部 Agent 的持续同步见 **Q-30 / OA-10**（未决）。

**关联地图（不新建 ID）:** 检索 Q-05～08 · 知识库 Q-02～04/09 · Agent Q-15～17 · 工作流/结果 Q-12～14 · 界面 Q-27/28 · 多 Agent 真相 Q-17。

**产出:** 知识生命周期、可见单位、同步方式与用户控制点。  
**状态:** D-35/D-36 已定；Q-09 产品化**未完成**；**不**整体标 Q-09 已决定；**不**授权实现。

#### Q-10 知识的质量和可信度怎么表达？

**决定 (D-41 FINAL · OA-17 · S-82 字段定型):** 信任 = **可追溯性（traceability）**，**永不**置信分 / opaque score。须展示：
1. **来源种类 + 精确 revision**
2. **推导过程或 Owner 决定**
3. **上次核对时间（last checked）**
4. **冲突 / 缺口**
5. **下游使用**

排序/相关度/相似度仅可作诊断，不可当信任。

**产出:** 可追溯信任展示规则。  
**状态:** 已决定（D-41）；T-20 BDD-09 / T-22 提案须服从；**无**生产/schema 授权。

#### Q-11 新结果如何更新旧知识？

**需要分析:** 添加新版本、修正原知识、标记过期、保留冲突、追加反例、合并重复知识的规则；已经被工作流使用的知识发生变化时，如何通知并复查下游行动。

**决定 (D-43 FINAL · OA-18 已答 · S-99 Owner 再确认):**
- 新结果**永不覆盖**旧理解
- **只追加**可审 **transition** / **新 revision**（不就地改写）
- **current 指针**仅在**确认后**移动
- **历史保留**（旧版 · 冲突 · 来源版本可点回）
- 向**依赖对象**标记**需复查**

对齐 D-32/D-34/D-40/D-41。当前 MVP PRD 已按此执行。

**产出:** 知识版本、可审变迁、冲突处理与下游影响复查规则。  
**状态:** **已决定 / answered（D-43）** — **非 open · 非待讨论**；本条不另开实现授权。

### W. 协作工作流: 知识如何真正变成行动

#### Q-12 “协作工作流”在产品里是什么？

**需要分析:** 什么信号会产生工作流；目标、输入依据、责任人/Agent、状态、下一步、期限、工具、人的确认点、验证标准和结果记录；单人独立工作为什么也需要协作。

**当前判断:** 协作包括人与人、人与 Agent、Agent 与 Agent 共享同一任务真相。工作流是可追踪的行动对象及其执行过程，可以生成任务、文档、邮件、日程、消息或外部工具操作。

**范围 (D-39，已确认):** 核心不是监控 Claude/Codex/Grok 或全机活动；只观察 **Owner 授权项目来源**；范围外**理应未知**。外部 Coding-Agent 编排 **非核心/延后**。**OA-12 仍未批准。**

**硬原则（仍有效）:** **沉默 ≠ 进度 ≠ 完成**；无授权痕迹不得推断进度/完成。

**产出:** 工作流对象和状态模型（记忆结构见 D-40）。  
**状态:** D-39 + D-40 已确认；OA-12 **未批准**；生产实现未授权。

#### Q-13 Agent 能在工作流中做到什么程度？

**需要分析:** 提建议、生成草稿、更改产品内状态、调用外部工具、对外发送消息/邮件、自动重试、交给另一个 Agent 各自需要什么授权；风险如何决定确认点。

**产出:** Agent 行动权限矩阵和确认规则。  
**决定:** 项目内读取、检索、整理、候选内容和草稿自动完成；对外发送、删除、付费、敏感操作与未授权访问先确认；Agent 不得自我确认。见 D-15。  
**状态:** 已决定；已交 G1/G2。

#### Q-14 执行结果如何回流？

**需要分析:** 每次执行记录谁在何时基于哪版依据、调用什么工具、产生什么输出、验证是否通过、失败原因、新发现和下一步；哪些结果自动成为候选知识，哪些更新原工作项或项目状态。

**当前判断:** 执行必须生成结果事件。结果事件指向精确输入与输出，更新工作项状态，并产生待确认的知识变更。验证失败同样是有价值的结果。

**待确认 (OA-12，未批准):** Result 字段与回流规则仍开放。**不得**标为已批准。D-39 候选将「结果」偏向授权来源上的可观察效果，而非 coding-agent 网关回传。

**产出:** 结果事件格式、回流规则和失败处理。  
**状态:** OA-12 **未批准**。

### G. Agent: 产品为什么能主动帮人工作

#### Q-15 Agent 在我们的产品里是什么？

**需要分析:** Agent 的持续身份、目标、可见上下文、记忆、工具、权限、规划、执行、等待人确认、写回和解释能力；它与一次聊天回答、一个模型、一个固定工作流的区别。

**历史决定 (D-12):** Agent 持续读取项目状态，选择检索和执行工具，提出或完成行动，在需要时等待人的决定，并把结果写回项目。

**首版定义 (D-39 FINAL / OA-14 已答):** **主 Agent** 持续观察 Owner 授权项目来源变化；维护项目记忆；对照历史；发现影响/缺口/冲突/过期；仅在需要 **且已授权** 时再检索；提议当前理解 / 下一步决策更新。外部 Coding-Agent 编排延后/非核心。术语见 `CONTEXT.md`。

**工程预备:** **T-22** = 项目记忆 D-13 调研/接口预备 only（对齐 D-40/D-41/D-42）。**T-21** 依据复用 **原样保留**。运行时/记忆基础库选型见 **Q-33 / OA-16**（开放）。

**记忆结构 (D-40 FINAL · 仅产品要求):** 版本化不可变原件 + 只追加变更事件 + 版本化当前理解；可重建索引（永非真相）。

**信任 (D-41 FINAL · S-82):** 信任 = **可追溯字段**；须展示 来源种类+精确 revision · 推导/Owner 决定 · last checked · 冲突/缺口 · 下游使用；**禁** 置信分 / opaque 分。

**检索产品 (D-42 FINAL · S-82):** **项目状态 + 状态变迁**（非知识/文档片段/卡片搜）：当前 · 历史 · 改了什么 · 为什么 · 依赖 · 精确证据；D-31 从属；state@t 与 transition 术语见 CONTEXT；**无** document-only/vector 产品实现。

**知识更新 (D-43 FINAL · Q-11 · answered):** 永不覆盖；只追加可审 transition/新 revision；current 指针确认后移动；历史保留；依赖需复查。

**架构选型 (Q-33 / OA-16):** 调研**已返回**；**WAIT_OWNER 采纳**；**无框架已采纳**；**无实现**直至 Owner 审阅推荐 + 隔离 spike 证据。

**状态:** D-39 + D-40 + D-41 + D-42 + **D-43** FINAL；Q-33 WAIT_OWNER adoption；T-22 prep only；**无**生产/schema。

#### Q-16 产品与 Agent 是什么关系？

**需要分析:** 产品是 Agent 本身、Agent 的工作台、多 Agent 的共享环境，还是组合；用户主要与聊天、项目画布、工作项或具体产物交互；Agent 暂时不工作时哪些价值仍然成立。

**决定:** 用户、Agent 和其他协作者在同一个持久化工作环境中行动。工作台保存真相、状态和过程；一个对用户负责的主 Agent 持续理解并推动工作，内部可调用专业 Agent、模型和工具；用户控制方向、授权和最终判断。主交互采用聊天 + 项目工作台：聊天处理目标、问题、方向和授权，工作台展示依据、状态、行动、进度与结果；两边共用同一 Agent 身份和项目记忆。见 D-12、D-14。

**产出:** 人—Agent—工作环境的责任边界和主交互模式。  
**状态:** 已决定；已交 G1/G2。

#### Q-17 多 Agent 如何共享一个项目真相？

**需要分析:** Agent 身份、责任、权限、领取任务、并发写入、冲突、交接、失败恢复和可追溯性；哪些内部细节不应成为普通用户负担。

**联动:** 跨工具执行可见性依赖 Q-31 派发/回传与 Q-32 状态 provenance；OA-12 未批准前不冻结执行者合同。

**产出:** 多 Agent 协作模型，并用“我们开发这个产品”的真实过程验证。  
**状态:** 待讨论；与 Q-31/Q-32/OA-12 联动。

### V. 整个循环如何被证明有用

#### Q-18 什么行为证明循环真的成立？

**需要分析:** 从真实材料或外部调研开始，直到产生一个被确认并执行的行动，结果再修正项目知识；每个节点用户看到什么、可以改什么、出错后怎么回来。

**决定 (D-44 FINAL · 首个主场景):** 用户 **数日/数周后** 回到一个 **已授权本地项目**；Agent 重建：

1. **现在**（current state）  
2. **当时**（historical state）  
3. **变化**（what changed）  
4. **原因**（why）  
5. **影响**（impact / dependents）  
6. **精确依据**（exact evidence）  

并帮助用户做出 **下一个决定**。次要场景可后置，不替代本主场景。

**产出:** 以 D-44 为主的端到端验收故事 + 可选次要场景。  
**状态:** **已决定（D-44）**；完整脚本与 UI 可见点待产品化；**无**新实现授权。

#### Q-19 如何判断效率真的提高？

**需要分析:** 回到项目后形成正确判断的时间、关键结论可引用率、重复寻找次数、知识复用率、从决定到行动的时间、结果回流率、冲突/过期知识发现率；同时记录 Agent 误导、错误自动化和新增管理负担。

**决定 (D-45 FINAL · OA-20 已答):**
- **首要痛点:** 项目变化后，**文件、人的理解、任务和沟通不同步**  
- **方案:** Agent **观察授权来源**，**保留版本与变化历史**，**重建当前状态**，并**指出过期理解 / 受影响行动**  
- **首要指标:** **return-to-decision time**（从重新进入项目到做出**有依据的**下一步决定所需时间）

**硬规则:** **测量前不得宣称数字提升**（无 “快 X 倍 / 省 Y 分钟” 类口号，除非有实测基线）。

辅指标仍可分析：可引用率、重复寻找、过期/冲突发现率、Agent 误导与新增管理负担。

**产出:** 主人可感知的验收问题 + return-to-decision time 测量设计 + 少量辅指标。  
**状态:** **已决定（D-45）**；**无**实现授权。

### O. 开源复用: 哪些能力直接采用成熟实现

#### Q-20 每项能力有哪些真正适合业务的开源方案？

**需要分析:** 围绕资料接入与解析、全文/语义/混合检索、知识对象与关系、Agent 记忆、工作流编排、工具连接、权限、执行记录和可观测性分别寻找候选；阅读核心源码和真实部署方式；核对许可证、维护活跃度、数据可迁移性、TypeScript/Next.js 适配、引用与版本能力、扩展边界和接入成本。

**选择规则:** 业务行为先明确；源码能力逐项对应业务；优先直接依赖或通过稳定接口接入，其次做薄适配，再次 fork；只有成熟方案无法满足关键行为时才自行实现缺口。Star 数、宣传文案和演示效果不能单独决定采用。

**产出:** 候选矩阵、源码证据、最小验证结果、采用/适配/fork/自研建议，以及替换和退出成本。  
**状态:** 首轮源码矩阵已完成；具体候选只有通过 D-13/T-11 的隔离验证后才能采用。OpenConnector 首个只读验证已获 D-20 授权。

### T. 已确认的检索规则仍需细化

#### Q-21 发现依据不足、冲突或过期后，默认自动查还是先询问？

需要分别规定产品内检索、已授权外部检索、敏感/付费来源和高风险领域。  
**决定:** 产品内部自动；已预先授权的外部来源自动并告知；敏感数据、付费来源、未授权来源先询问。见 D-10。  
**状态:** 已决定；已交 G1/G2。

#### Q-22 “过期”如何判断？

需要按事实类型、来源变化速度和当前任务决定；30/90 天只作为待验证候选，不能直接成为统一规则。  
**决定:** 来源有效期优先；新版本、冲突或项目变化触发复查；类型周期只做提醒；依赖实时事实的任务强制重新检索；保留旧知识并展示最后核对时间与复查原因。见 D-11。  
**状态:** 已决定；已交 G1/G2。

#### Q-23 外部检索如何授权？

需要比较来源白名单、按连接器授权、按任务授权和单次确认；同时规定付费、隐私和敏感数据边界。  
**决定:** 采用按来源 + 范围 + 有效期授权，可随时撤销；敏感和付费来源始终单独确认。见 D-17。  
**状态:** 已决定；首批范围见 D-18，首个 GitHub 仓与对象范围见 D-20。

#### Q-24 检索结果何时进入项目知识？

需要决定全部先生成 Raw 记录，还是只记录检索轨迹并由用户/Agent 选择纳入；无论哪种方式，搜索命中都不能自动获得事实地位。  
**决定:** 每次检索保留紧凑轨迹；只有实际被判断或行动引用的结果进入项目依据；Agent 判断保持候选；Owner 确认后才成为已确认知识；结果回流后再复查更新。见 D-16。  
**状态:** 已决定；已交 G1/G2。

#### Q-25 “外部来源”具体包含什么，首批接哪些？

需要区分：公开互联网搜索/浏览器；已连接的私人账户（邮箱、日历、云盘、消息、笔记）；主动推送的 feed/webhook；企业数据库或 SaaS；以及会改变外部世界的发送/创建/修改工具。研究每类来源的授权、同步方式、读取范围、撤销、审计、结果进入项目的方式和用户负担。

**调研结论:** 外部来源是项目真相层之外、能提供内容的系统；公开网页、已连接私人账户、入站事件和企业数据是读取来源。发送、创建、修改、删除、支付属于外部操作，必须与读取授权分开。首批建议为公开只读检索 + 用户选定 GitHub 仓库的只读资料/事件；之后只试点一个由用户明确选中文件或页面的私人文档来源。邮箱全量同步和所有外部写操作暂不进入首批。
**当前代码事实:** AnySearch 客户端与公开检索 API 已存在，但尚未形成 D-17 授权记录，也没有 D-16 的“检索轨迹 → 被采用依据”完整链；主页面未接通完整公开检索使用过程。
**状态:** 已决定；T-14 调研完成，首批范围见 D-18，首个 GitHub 仓与对象范围见 D-20。OpenConnector 仅获只读隔离验证授权，不授权生产接入。

#### Q-26 OpenConnector 与浏览器操控插件各自解决什么？

OpenConnector 候选负责有稳定 API 的 SaaS：GitHub、Gmail、Notion 等账号连接、凭证隔离、Action 发现和执行。浏览器操控候选负责没有合适 API、必须使用用户现有登录态和网页界面的读取或操作。主 Agent 应优先使用项目内部能力，其次使用结构化 API/Connector，最后才使用浏览器；外部写操作无论通过哪条路径都遵守 D-15。

**当前事实:** 过去确实做过 `oomol-lab/open-connector` 的 `github.create_issue` 技术验证（commit `44e5950e`），但因没有真实 smoke 且确认/幂等边界可绕过而未合并。用户的「持节 / Chijie」Chrome 插件已经具有页面观察、Google 搜索、跳转、点击、输入和标签页控制；当前只接受自身 side panel 的运行时消息，没有给本产品调用的外部接口。

**产品结论:** Connector 用于稳定、可定位的 SaaS API 对象读取；浏览器仅在 API 不够、确需用户网页会话/渲染页面时作为显式回退。产品顺序为项目内真相 → 结构化只读 API/Connector → 浏览器回退。OpenConnector 只是候选 transport，不能替代 D-15 人类确认、D-16 证据生命周期或 D-17 授权记录；Chijie 有内部观察/审批能力，但尚无本产品调用接口。D-18 首批只做公开只读检索 + 一个 Owner 选定 GitHub 仓的只读对象；Drive 选定文件后置试点，Gmail/全量同步/全部外写继续后置。旧 `github.create_issue` 实验不符合上述边界，不能视为已接入。
**状态:** 工具分工已由 Owner 确认为 D-19；首个仓库与最小只读对象已确认为 D-20。G2 可立即准备并运行符合 D-13/T-11 的隔离验证；不授权生产接入或外部写操作。见 `docs/product/2026-07-16-q26-connector-browser-product-conclusion.md`。

### F. 前端交互：关系如何变成可直接判断的界面

#### Q-27 主界面如何体现原件、依据、知识、行动与结果的关系？

**用户要完成的事:** 不需要先读懂整张关系图，就能看清当前判断来自哪里、哪些只是 Agent 候选、什么等待自己确认、执行结果会改动什么，以及旧来源变化后哪些结论要复查。

**三个方向:** 

1. 工作台 + 按需关系轨迹：主界面只显示当前判断、依据、待确认变化和下一步；点击任一对象后，在侧栏展开它的来源与影响链。
2. 关系画布：把对象和连线作为主要操作界面，关系最直观，但日常判断容易被全局结构淹没。
3. 时间线：以发生顺序呈现检索、判断、确认、行动和结果，过程最清楚，但跨对象关系与当前状态较弱。

**当前推荐:** 方向 1。全局关系图保留为检查和追溯工具；日常主界面围绕“当前判断 → 依据 → 待确认变化 → 下一步”。

**状态:** Owner 暂选方向 1；普通线性工作台仍不够，继续讨论 Q-28 的非线性交互。

#### Q-28 工作台怎样支持非线性思考和行动？

**此前调研结论:** 用户真正感兴趣的是把发散与收敛分开，让长对话和零散材料自动形成可点击的中间对象；结构能够继续变成任务，执行路径能够回看。参见 `docs/research/2026-07-14-content-structure-task-audit-alignment.md`。

**当前建议:** 保留工作台作为稳定外壳，中央使用可移动焦点的一层关系画布。项目、问题、判断、材料、行动或结果都能成为当前中心；点击后只重排它的直接关系。对话中新出现的想法先成为候选节点或分支，Agent 说明为什么提取以及引用了什么。检索、引用、行动和结果形成可开关的足迹叠层；结果回流为待确认节点，确认后才改变当前项目局面。

**要避免:** 固定从左到右的流程、无限全图、自由摆放但没有业务含义的白板、用画布位置代替项目事实。

**状态:** Owner 已确认方向并接受审查修正；D-26/T-18 已授权可点击原型，不代表生产前端完成。

#### Q-31 Web 主 Agent 如何派发本地 coding agents 并收回结果？

**D-39:** 外部 Coding-Agent 编排 **非核心 / 延后**。只读调研 / 未来证据 only。**无实现授权。**

**状态:** 非核心；**OA-12 未批准**。

#### Q-32 人的状态如何被产品知道？

**原则:** **沉默永不表示进度或完成。**

**需要分析:** 人的状态在无自报或已连接产物/工具事件时**不可知**。状态须带 **provenance**，至少区分：assigned · acknowledged · activity observed · self-reported · evidence-verified · disconnected/unknown。

**状态:** 待讨论；与核心观测-记忆模型联动；无实现授权。

#### Q-33 选什么 Agent 运行时与记忆基础库？（若需要）

**为什么必须回答:** OA-15/D-40 只定了**产品记忆结构**；Owner 明确要求先做稳定、高质量的 Agent 架构调研，再谈技术选型。

**调研状态 (OA-16 · S-97):** **调研已返回**，**尚待 Owner 采纳**。  
证据路径（非采纳）: `docs/research/2026-07-16-main-agent-runtime-architecture.md` · `docs/research/2026-07-16-project-memory-architecture-foundations.md` · `docs/research/2026-07-16-open-source-foundations-matrix.md`。

**采纳状态:** **无框架已采纳。** 候选仍仅作对照（如 LangGraph、Temporal、AI SDK、Agents SDK、Letta、Zep 等）。

**选型门槛（全部满足后才能推荐）:**
- 一手源 / 钉死源码评估
- 许可与传递依赖审查
- TypeScript / Next.js / 本地 companion 适配
- 持久化 · checkpoint · 中断 · 事件 · 工具 · 重放 · 测试行为
- 运维复杂度
- 领域记忆归属（domain-memory ownership）
- 替换/退出边界（D-13）

**执行约束:** **禁止实现**，直到 Owner 审阅推荐方案 + 隔离 spike 证据。

**联动:** D-06 · D-13 · D-40 · T-22 · T-12（隔离验证提案仍等 Owner 授权，不预决选型）。**产品侧“如何读/推理/检索/用何模型”见开放题 Q-34（≠ 本项框架采纳）。**

**状态:** **调研已返回 · WAIT_OWNER 采纳**（OA-16）；非 READY；无实现授权。

#### Q-34 产品 Agent 如何读、推理、检索，用什么模型/运行时？

**为什么必须回答:** D-39/D-44/D-50 要求 Agent 在授权边界内形成有来源的当前理解；若不先说清**读什么、怎么想、怎么补材料、用哪条模型链路**，工程会继续把“配置表单 + 单次 complete”误当产品 Agent。与 **Q-33**（是否采纳某框架/记忆库）不同：本题是**产品 Agent 行为与模型职责**。

**决定 (D-51 · Owner 确认 · 核心已答):**

| 字段 | 内容 |
|------|------|
| Agent 循环 | 观察已授权项目 → 建 **project map** → **工具选择性**读/检索 → 对 **精确 revision** 推理 → 证据足够则继续，否则 **标 unknown** → 产出 **有来源候选** → Owner 纠正/确认 → **持久化并持续监视** |
| MVP 主模型 | **StepFun `step-3.7-flash`** |
| 传输 | 直连 **Anthropic-compatible Messages**；adapter **拼接 `/v1/messages`**；**base URL = `https://api.stepfun.com/step_plan`**（公开配置，非密钥） |
| 推理力度 | MVP 项目重建使用 **high** reasoning effort |
| 可替换性 | 模型可换；**项目真相永不属于模型** |
| 回执 | 必须留下 **provider / model / effort / fallback**；**永不记录或引用 API key** |

**历史代码事实（目标态之前，供对照）：** observer 读盘；单次 prompt 曾为 events+accepted+snippets；本地网关默认；确定性回退；尚无 tool loop / 标准 receipt。

**工具自主 (D-52 · Owner 确认):** 在**已明确授权的项目根内**，Agent 可**自动**（**无需每次读确认**）：建结构图；读相关文件与精确 revision；搜文本/符号/关系；Git status/log/diff/show/blame；跟随引用；对照历史；**迭代 tool calls** 直到有证据可答或 **明确 unknown**。公开/预授权外部读遵循 D-10/D-18 且**可见 receipt**。**须确认：** 扩大文件系统范围；敏感/付费/未批准来源；任何 **写/发/删/commit**。Owner **可见并可中断**。须 **tool receipts** + **stopping reason**。**无 API key。**

**仍开:**

- **框架/运行时采纳** 仍见 **Q-33 / OA-16**（D-51/D-52 不采纳框架）
- 具体 tool **API 名/实现** 属工程细节，服从 D-52 原则

**状态:** **核心 D-51 + 自主 D-52 已决定**；Q-33 仍开；无 API key 入档。

#### Q-30 活跃事项如何与 Web 控制面持续同步？

**用户要完成的事:** 审阅/决策在 Web，工作却在本地文件、代码仓、SaaS、浏览器、人和外部 Agent 上；每件活跃事项仍要连续更新，且不要全账号监控或强迫手工重传。

**架构方向 (D-37，已确认):**  
Web = 决策/审阅/授权工作台。Local companion + 结构化 SaaS connectors + 显式浏览器扩展 + Agent Bridge **只感知已授权真实工作**，写回 **来源 + 版本化变更事件**。手工上传/粘贴为兜底。变更进入后为 **候选**，匹配受影响事项，**永不静默改写**项目理解。

**D-39 已确认叠加:** 主 Agent 只观察授权项目来源；范围外未知正确；外部 Coding-Agent 编排非核心。

**两条线已合并进 D-39:** 业务逻辑（记住演变、恢复判断上下文）+ Agentization（感知+记忆+推理+工具+有界自主，只服务该逻辑）。

**授权边界:** D-13 只读调研/提案 only。记忆结构 = **D-40 FINAL**；生产实现仍未授权（T-22 prep only）。

**同步范围 (D-38，已确认):** 项目级来源授权；事项级 Agent 维护可见 watch set；版本化变更事件；相关变化带匹配理由；无关仅紧凑轨迹；Owner 可检查/关闭；不越权。

**当前运行时证据（非目标态）:** 本地一次性拷贝；无 watcher/webhook/产品轮询；无 GitHub/OpenConnector/浏览器产品接入；AnySearch UI 未挂；Agent Bridge 未接仓库/时间线。

**状态:** D-37 + D-38 已定；调研 ledger 已建；spike/生产等 OA-12。

#### Q-29 秘书向 Lead / Owner 的报告节奏是什么？

**为什么必须回答:** 工程席位多、handoff 密时，进度若直接进入产品对话会淹没判断；若完全不报，Owner 又看不见 blocker 与可体验结果。

**决定:** 普通 handoff 静默吸收。有状态变化时，摘要最多每 30 分钟一次、最多五行。阶段边界、晚饭前、日终强制摘要。无变化不报。仅对下列情况立即升级：未解决 blocker 超过 10 分钟；与已接受产品规则冲突；安全/数据/返工风险；需要 Owner 决策；集成后达到可 Owner 验收。秘书先报 Lead；Lead 仅在决策或可体验时打断 Owner。见 D-30。

**双秘书 (D-46) + 产品秘书 (D-49):** 秘书1=`:82` **只服务 Owner+Lead 产品讨论**；记录问题/真实例子/已定方案/可见验收行为/路演逻辑/未回答问题；权威清单/路演唯一写手；只合并秘书2阶段摘要；**不派工、不吞普通员工汇报**。秘书2=`:83` 普通 handoff + 当前执行板；互不同时写同一文件。协作硬规则：问题不得原样退回，须推进或带证据/阻塞/建议下一负责人交 G2。协议：`TEAM_OPERATING_MODEL.md` + `SECRETARY_2_PROTOCOL.md`。

**状态:** 已决定（OA-05 → D-30；双秘书 → D-46；Sec1 角色 → **D-49 立即生效**）。

### 产品设计交付任务

| ID | 产出 | 依赖问题 | 交接条件 | 状态 |
|---|---|---|---|---|
| T-03 | 知识对象、状态、来源、版本和范围设计 | Q-02～Q-04 | 主人确认设计文档 | 产品规则已确认；Q-02 见 T-16，Q-04 见 T-19 |
| T-04 | 检索来源、工具选择、排序、结果转换与复用设计 | Q-05～Q-08、D-42、D-41 | 主人确认设计文档 | Q-05 D-29；Q-06 D-31 从属；**D-42 状态+变迁**；Q-07 D-32；Q-08 D-34；信任 D-41 五字段 |
| T-05 | 知识生命周期、质量、冲突与更新设计 | Q-09～Q-11、D-35/D-36、D-41、**D-43**、Q-30 | 主人确认设计文档 | D-35/D-36 已定；Q-09 产品化未完（Q-30）；**Q-10 → D-41**；**Q-11 → D-43 FINAL** |
| T-06 | 工作流、Agent 权限与结果回流设计 | Q-12～Q-14 | 主人确认设计文档 | 待产品共识 |
| T-07 | Agent 定义、人机关系与多 Agent 协作设计 | Q-15～Q-17 | 主人确认设计文档 | 待产品共识 |
| T-08 | 端到端验收场景与效率判断 | Q-18～Q-19、**D-44**、**D-45** | 主人确认设计文档 | **已决定：** 主场景 D-44 · 痛点/方案/指标 D-45；待写验收脚本；**无** eng 解锁 |
| T-09 | 开源方案源码调研与复用建议 | D-04、D-06 与 Q-02～Q-20 当前业务要求 | 候选矩阵 + 源码证据 + 最小验证 | 已完成；矩阵是决策输入 |
| T-10 | Grok KAL PRD 逐项评审并融入正式设计 | D-08、D-09、Q-02～Q-24 | 采用/修改/暂缓清单 + 正式设计映射 | 评审中 |
| T-11 | 为每个获批 adapter/spike 建立开源采用记录 | D-06、D-13 与所服务的业务决定 | 固定版本 + 源码符号 + 采用映射 + 许可 + 验证 + 退出边界 | OpenConnector 首个只读隔离验证已获 D-20 授权；由 G2 立即建立记录并执行 |
| T-12 | 主 Agent 隔离验证提案 | D-10～D-13、F-03 | 可逆种子场景 + D-13 合规的 LangGraph JS/TS adapter 对照实验；不改生产真相层 | 等待 Owner 授权 |
| T-13 | 聊天 + 项目工作台的主 Agent 行为设计 | D-12、D-14、F-03 | 两个表面的职责、共享状态、双向同步、权限停点和可观察验收 | 已交 G1/G2；不授权生产实现 |
| T-14 | 外部来源分类、授权和首批接入研究 | D-10、D-15～D-17、Q-25 | X 实践 + 官方文档/源码 + 产品方案对比；不授权接入 | 已完成；Owner 决定见 D-18/D-20 |
| T-15 | OpenConnector 与持节浏览器工具适配研究 | D-10、D-13、D-15～D-18、Q-26 | 固定源码、真实能力/缺口、旧验证失败复盘、最小安全接口与退出边界；不访问账号、不改生产 | 已完成；D-19/D-20 已确认，转 T-11 只读隔离验证 |
| T-16 | Q-02 目标模型红色缺口实现 | D-15、D-16、D-24、Q-02 | ① 原件 hash/revision 与稳定引用；② 服务器禁止 Agent 自确认；③ WorkEvent result 只生成可审阅候选知识变化。隔离工作区、BDD/测试先行、G4/G6独立验收 | 集成 `2130ea0f`；179/179；G4/G6 PASS；最终 no-mistakes ship gate 进行中，前端与两个持久化/入口 residual 单列 |
| T-18 | 非线性工作台可点击原型 | D-26、Q-28、T-17 | 三个可切换结构方案；真实可点的换中心/一层关系/候选/结果回流/足迹；不写生产数据；浏览器证据交 Owner 判断 | **原型证据 READY**；G3A+G4+G6；Owner 选变体非代办；非生产 |
| T-19 | 项目硬隔离与显式跨项目引用 | D-27、Q-04 | 缺项目上下文即拒绝；当前项目读写不泄漏；跨项目引用必须显式确认且钉住版本；变化触发复查；敏感项目零暴露 | **S-85 READY EVIDENCE** @`5bd667cf`；30/30·210/210·lint0；G4/G5/G6 全过；8f2 禁；**无 T-21 解锁** |
| T-20 | 检索来源/方法 工程 spec·BDD·验收预备 | D-29、D-31、D-32、**D-41**、**D-42**、Q-05～Q-07/Q-10 | 主产品=状态重建场景（D-42）·信任=provenance/conflict/freshness/use history·禁 opaque/document-only/vector-only | **S-92 权威合同 docs-only**；BDD-08..11；阶段 1–5 从属；**无 code/adoption** |
| T-21 | 依据复用 BDD/实现切片 | D-34、Q-08、T-16、T-19 | 稳定 ID 复用 + backlinks + locator/revision 去重 + 扇出复查；映射既有 identity；禁重复 schema | **原样保留**；**held**（T-19 READY 不自动解锁）；**不被 T-22 替换** |
| T-22 | 项目记忆 调研/接口预备 | D-39、D-40、**D-41**、**D-42**、Q-33/OA-16、D-13 | 六向主产品；信任=可追溯 only；禁 tool/doc/vector/latest/opaque-score 当产品 | 五 lane join；**S-94 PREP 扩写**（reuse/gap·变迁·幂等·fixture·开放决策）；仍未冻；无 runtime/schema/实现 |

**交付规则:** T-03～T-08 在产品结论得到主人确认前不进入业务实现。确认后由 G2 按 MATT 转成工程规格、BDD、实现任务和验证证据。

---

## 既有工程台账（保留历史，等待新设计复核）

以下 A/B/C 是本轮产品共识建立前已经形成或已经派出的工程任务。保留它们用于验收和追踪；它们不替代 Q-02～Q-19，也不自动决定完整产品的能力边界。

### A. 收口（已有实现 · 以你点头为完成）

| 任务 | 人怎么用算过 | 工程状态 |
|------|--------------|----------|
| A-1 诚实空库、禁假项目冒充 | 打开无演示灌库 | 已做 · 待你确认 |
| A-2 拖/传文件进当前项目 | 材料在该项目里 | 已做 · 待你试 |
| A-3 拖文件夹 → 每夹一项目并进入 | 新项目出现且切进去 | 已做 · 待你试 |
| A-4 材料能打开（文/图/音频） | 不乱码；音频能播或信息清楚 | 已做 · 待你试 |
| A-5 接入不硬弹烂材料库 | toast；可手动打开 | M1/M2 实现侧交 · 待你试 |
| A-6 空态/建完知道放资料 | 看得懂往哪放 | E1/P1 实现侧交 · 待你扫 |

→ **A 不新开大功能**；缺的是你试用反馈。有洞再修。

---

### B. 已派出的理解层任务

每条都是：**用户场景 + 做成什么样 + 建议开法**（不锁唯一流水线序号，可按依赖并行）。

### B-1 材料进项目后，能变成「可理解的对象」

**场景：** 拖进一堆文件后，不能只剩文件名列表。  
**做成：** 每个材料有稳定身份（已有材料卡则复用）；能被搜索、被引用、出现在「依据」里。  
**开发：** 材料 ↔ 知识卡/依据对象打通（导入时自动建或链上已有卡）；列表展示「可引用」而不只是磁盘名。  
**过：** 任选一材料，系统别处能指着它说话（见 B-2/B-3）。

### B-2 项目打开时：一条「现在怎样」+ 依据可点

**场景：** 人隔一阵点进项目，不想自己翻。  
**做成：** 项目主界面优先一条人话判断（现在怎样 / 卡在哪 / 建议看什么），每条判断带 **可点开的材料或记录**；指不回就不显示装懂。  
**开发：** 接上已有 `project-review` / 画布注意力能力，**输入改为「本项目材料 + 已有关系/事件」**，不只工作项空壳；UI 固定「一条主判断 + 依据链」。  
**过：** 有真实材料的项目，打开 3 秒内能看到有依据的「现在怎样」；空项目诚实说「还没材料」。

### B-3 材料之间的关系（可改、可否决）

**场景：** 多文档/纪要/代码说明搅在一起。  
**做成：** 系统提出可能关系（谁依据谁、相关、冲突等），**必须带来源句或可点材料**；人可确认/删/改。  
**开发：** 用已有 `relations` 模型；增加「从本项目材料提议关系」的 Agent/规则路径；画布或侧栏只展一层邻居。  
**过：** 至少在一个含 ≥3 材料的项目里，能看到 ≥1 条可核对关系，人能否决。

### B-4 项目后来怎样（变迁，不是假甘特）

**场景：** 期望变了、材料换了、人做了决定。  
**做成：** 项目时间线能看到：接入材料、关系确认、状态/截止变化、人写的决定——按时间排；点得开来源。  
**开发：** 统一写入 `WorkEvent`/时间线（材料新增、关系变更、改期、检查点）；画布底部时间线接真实事件，不接假日志。  
**过：** 对同一项目做「加材料 → 改一句判断/截止 → 再打开」，时间线能看出先后。

### B-5 改期/期望挂在项目事实上

**场景：** 截止日期、范围说法变了，要和材料/决定在一处。  
**做成：** 工作项或项目检查点上可改「期望/截止」；变更进 B-4 时间线；「现在怎样」能读到最新期望。  
**开发：** 已有工作项/截止字段则接通写回与事件；UI 改期不另开孤岛页。  
**过：** 改一次截止 → 时间线有记录 → 主判断不再引用旧截止当真理。

### B-6 问项目（可选同波）

**场景：** 人用一句话问「这个项目和 xx 的关系？」。  
**做成：** 回答只能基于本项目材料/关系/事件；每句关键结论能点回。  
**开发：** 项目范围 RAG/组装上下文 + 引用强制；无依据则明说不知道。  
**过：** 有依据的问题答得出并点得开；无依据不编。

---

### C. 既有后置边界

| 不做 | 原因 |
|------|------|
| 全量接管 Jira/飞书/微信 | 范围炸；先守住「进到本产品的项目真相」 |
| 强迫 PARA/双链宗教 | 增加混乱 |
| 以向量库当唯一知识本体 | 已定非目标 |
| 交卷演示叙事精修 | A 你点头 + B 有一条主路径可演示后再做 |

---

### 既有工程依赖记录

```
A 你点头收口
    │
    ├─ B-1 材料可引用  ─┬─ B-3 关系提议
    │                   │
    └─ B-2 现在怎样 ────┴─ B-4 变迁时间线 ── B-5 改期挂接
                              │
                              └─ B-6 问答（可并行）
```

B-1 与 B-2 可并行启动；B-3/B-4 吃 B-1 的对象身份；B-5 吃 B-4；B-6 吃 B-1～B-4 任意已有上下文。

---

## 给工程（D-54/D-55）

本文件是产品任务真相。sole writer = **产品话事人2**。工程只通过**综合后的**现实回产品（双工程话事人共同）。  
对产品只回三句：哪项设计已具备工程规格 / 哪项可让 Owner 试用 / 哪个问题必须由 Owner 决定。  
**eng READY ≠ Owner 验收。** 旧「G2 指挥」称呼废止。
