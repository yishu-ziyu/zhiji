# Nonlinear Workbench Concept v1 Review

## Evidence

- Concept: `docs/design/2026-07-16-nonlinear-workbench-concept-v1.png`
- Current UI reference: `.ship/tasks/first-user-real-entry-015/e2e/artifacts/g5-agent/04-search-retrieval.png`
- Behavior brief: `docs/product/2026-07-16-nonlinear-workbench-owner-options.md`

## Verdict

Approve the interaction direction with required semantic corrections. The image successfully shows candidate expansion, focus recentering with one-hop context, and result writeback. It is a design reference, not implementation approval.

## What works

1. The project remains a stable shell while the center object changes.
2. Candidate nodes are visible before they become project truth.
3. The second state suppresses unrelated objects instead of rendering the whole graph.
4. The third state returns execution results into the same project and exposes an Owner review card.
5. The visual language remains close to the existing white workbench.

## Required corrections

1. **Focus must not use confirmed green.** Selection/focus needs a neutral or blue treatment. Green is reserved for Owner-confirmed knowledge.
2. **A material is not an Agent candidate.** `CONTEXT.md · v3` and source excerpts use the source/material treatment; only extracted claims, questions, or judgments use candidate purple.
3. **A footprint is not a green relation chain.** Encode touch/use depth and time separately from relation status. The view must explain what was retrieved, opened, cited, acted on, and when.
4. **The main Agent needs a real conversation surface.** The top search field cannot silently serve as search, chat, and command input. Preserve one Agent identity and make the current input mode visible.
5. **Used path must not imply confirmed truth.** Teal/neutral emphasis can show the path used in this run; green remains confirmation only.
6. **State must not rely on color alone.** Keep text badges such as `候选`, `已确认`, and `需复查`; connector and small-body contrast need runtime accessibility checks.

## Acceptance behavior for the next prototype

1. Enter from chat, a material, a work item, or a result.
2. Click any visible object and see it recenter while unrelated objects collapse.
3. Open the exact source/revision behind a claim.
4. See candidate, focus, confirmed, stale, and result as five distinct identities.
5. Review a result-to-knowledge change without Agent self-confirmation.
6. Toggle or scrub a real footprint derived from recorded events.

## Limits

This is a static concept image. Motion, focus restoration, keyboard navigation, source opening, touch-depth playback, responsive layout, and contrast cannot be accepted until a runnable prototype exists.
