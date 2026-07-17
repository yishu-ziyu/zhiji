# Project Change Intelligence Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one honest Demo path where a newly added file is observed, judged by the real Agent, and shown with the Owner decision on the existing timeline.

**Architecture:** Resume the existing local watcher when a persisted Agent session is hydrated. Poll only the lightweight session view, detect post-hydration incremental `ChangeEvent`s, run one source-change analysis, and project source events, the current candidate, and Claim resolutions into the timeline without creating duplicate durable records.

**Tech Stack:** Next.js App Router, React, TypeScript, Project Memory, `@parcel/watcher`, Vitest.

## Global Constraints

- Work only on `main` in `/Users/mahaoxuan/Desktop/黑客松/zhiji`, as required by the project ledger.
- The only product entry remains `/track/knowledge`.
- Authorization must exist before watcher start or file reads.
- Model failure must remain fail-closed: no Candidate and no fake success timeline event.
- Suggestions and Candidates never become accepted facts or formal tasks without Owner action.
- Preserve unrelated dirty-worktree changes.

---

### Task 1: Real intelligence timeline projection

**Files:**
- Create: `app/track/knowledge/lib/project-intelligence-timeline.ts`
- Create: `tests/unit/project-intelligence-timeline.test.ts`
- Modify: `app/track/knowledge/components/ProjectTimeline.tsx`
- Modify: `app/track/knowledge/page.tsx`

**Interfaces:**
- Consumes: `ChangeEventView[]`, current `UnderstandingRevision`, `AnalysisRun` summary, `Claim[]`, and `OwnerResolution[]`.
- Produces: `buildProjectIntelligenceTimeline(input): CanvasTimelineEvent[]` and `selectNewIncrementalChanges(events, seenIds): ChangeEventView[]`.

- [ ] **Step 1: Write the failing projection tests**

```ts
expect(selectNewIncrementalChanges(events, new Set(["old"]))).toEqual([added]);
expect(buildProjectIntelligenceTimeline(input).map((event) => event.body)).toEqual(
  expect.arrayContaining([
    "发现新材料：与本项目无关的旅行清单.md",
    "这份旅行清单与当前项目目标无关，建议移出项目夹。",
  ]),
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/project-intelligence-timeline.test.ts`

Expected: FAIL because `project-intelligence-timeline.ts` does not exist.

- [ ] **Step 3: Implement the pure projection**

```ts
export function selectNewIncrementalChanges(
  events: ChangeEventView[],
  seenIds: ReadonlySet<string>,
) {
  return events.filter((event) => event.kind !== "reconciled" && !seenIds.has(event.id));
}

export function buildProjectIntelligenceTimeline(input: TimelineInput) {
  // Map real ChangeEvent, Candidate, and OwnerResolution timestamps to
  // CanvasTimelineEvent rows whose ref is the current project.
}
```

- [ ] **Step 4: Merge projected events into `ProjectTimeline`**

Add optional `intelligenceEvents` to the component, merge them with `snapshot.timeline`, and show the projected event body in the timeline pill while retaining existing filters and click-to-focus behavior.

- [ ] **Step 5: Run the focused test and typecheck**

Run: `npx vitest run tests/unit/project-intelligence-timeline.test.ts && npm run typecheck`

Expected: PASS.

### Task 2: Observe one real post-open change and run the Agent once

**Files:**
- Modify: `app/api/knowledge/projects/[id]/agent-session/route.ts`
- Modify: `app/track/knowledge/components/AgentPresenceRail.tsx`
- Modify: `app/track/knowledge/page.tsx`
- Modify: `docs/product/产品清单.md`

**Interfaces:**
- `agent-session` returns `run.createdAt`, `run.updatedAt`, `run.eventIds`, and `run.candidateRevisionId`.
- The page polls the existing GET route and invokes `runAnalysis(projectId, matterId, newEventIds, { trigger: "source_change", ownerUtterance })` once per newly observed event set.

- [ ] **Step 1: Resume the persisted watcher safely**

```ts
const manager = getDefaultSourceGrantManager();
manager.register(grant);
void manager.start(grant).catch(() => undefined);
```

This occurs only after loading an active persisted local grant; `SourceGrantManager.start` is idempotent per grant and the observer enforces the authorized root.

- [ ] **Step 2: Return the real Run fields needed by the view**

```ts
runSummary = {
  id: latest.id,
  status: latest.status,
  progressSummary: latest.progressSummary,
  candidateRevisionId: latest.candidateRevisionId,
  eventIds: latest.eventIds,
  createdAt: latest.createdAt,
  updatedAt: latest.updatedAt,
};
```

- [ ] **Step 3: Add the active-project monitor**

On session hydration, seed a `Set` with all current event IDs. Every 2.5 seconds, skip hidden tabs and in-flight analysis, fetch the session, and use `selectNewIncrementalChanges`. Add all fetched IDs to the baseline before starting a run so a failed run does not loop.

- [ ] **Step 4: Trigger a source-change Run with an explicit relevance question**

```ts
await runAnalysis(projectId, matterId, newEvents.map((event) => event.id), {
  trigger: "source_change",
  ownerUtterance:
    "刚检测到项目文件发生变化。请先读取发生变化的文件，再比较它与当前项目目标和已确认判断是否相关；若无关，明确说明不影响当前项目，并只给出忽略或移出项目夹的建议，等待我决定。",
});
```

Update the session from the returned Run and fresh memory. Do not resolve any Claim automatically.

- [ ] **Step 5: Record the product result and run focused verification**

Add the Demo behavior to `docs/product/产品清单.md` §3. Run:

`npx vitest run tests/unit/project-intelligence-timeline.test.ts && npm run typecheck`

Expected: PASS.

### Task 3: Fast local Demo smoke and desktop refresh

**Files:**
- No product source beyond Tasks 1–2.
- Rebuild candidate `.app` only after the web path works.

**Interfaces:**
- Input: an already authorized small Demo folder and a real connected model.
- Output: a new candidate `知几.app`; the existing fallback package is not overwritten.

- [ ] **Step 1: Start the product and open the authorized Demo project**

Run: `npm run dev` or reuse the active desktop candidate.

- [ ] **Step 2: Add one real unrelated Markdown file in Finder**

The file must be inside the authorized root and contain obvious unrelated content. Expected UI: “检测到项目变化，知几正在判断…”.

- [ ] **Step 3: Observe the real result**

Expected: timeline shows the new path and the model-backed candidate. If the model fails, the Run is failed and no Agent-result pill appears.

- [ ] **Step 4: Repackage without overwriting the fallback**

Run: `DESKTOP_PACKAGE_OUT=out/zhiji-change-demo-candidate npm run desktop:package`

Expected: `out/zhiji-change-demo-candidate/知几-darwin-arm64/知几.app`.
