You must use Skill('yishuship:design'). Skip preamble and auth gate.

Planning request:
---

OPC Delivery Ops Agent (效率赛道).
North star: closed-loop rate (customer-confirmed deliveries / new commitments).
Submit 2026-07-18, pitch 2026-07-19.
Quality process: yishuship full (pm-intake → design → dev → e2e → review → qa).

next: /yishuship:dev starting Slice A1 (vitest + state machine)
---

IMPORTANT: You MUST write both spec.md and plan.md to the artifacts directory.
The orchestrator validates these files exist and are non-empty before advancing
to the dev phase. Do NOT respond conversationally — write the artifacts to disk.

If this task involves frontend/UI changes and no DESIGN.md exists at project root,
note in spec.md that one should be created via /yishuship:visual-design before or
after this pipeline run.

task_id: opc-delivery-agent-20260712-0258
Artifacts: .ship/tasks/opc-delivery-agent-20260712-0258/plan/
Raw input: .ship/tasks/opc-delivery-agent-20260712-0258/input/requirement.md
Run state: .ship/tasks/opc-delivery-agent-20260712-0258/control/run_state.yaml
Branch: feature/ai-agent-platform
HEAD: d521df75889411f3ecf675adc78e9ebf15c46c68
Scope mode: full
Mode: /yishuship:auto staged workflow — no user questions, treat escalations as blocked.

If lightweight YAML planning notes would help this specific task, you may write
them under .ship/tasks/opc-delivery-agent-20260712-0258/control/. Choose the schema yourself and keep
Markdown/code as the real deliverables.

Scope mode `refactor` means the task is behavior-preserving (refactor,
simplify, rename, extract, dedupe, etc.). In that mode, skip Phase 6
(Execution Drill) — the "every step is implementable" check adds little
value when the steps are small code movements. Peer investigation and
diff still run. See design SKILL.md "Scope Mode" for details.
Scope mode `full` runs all six phases.
