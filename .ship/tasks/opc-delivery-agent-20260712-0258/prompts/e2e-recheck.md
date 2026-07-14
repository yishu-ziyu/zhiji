You must use Skill('yishuship:e2e'). Skip preamble and auth gate.

Recheck after fixes: re-run the previously-failing tests plus the full
existing E2E suite to confirm no regressions.

IMPORTANT:
- Do NOT write new tests. The first pass already authored them.
- Restart services (prior run cleaned up), run the suite, collect artifacts.
- If a test fails, decide: test issue (tighten selector, fix arrangement)
  or real bug (assertion mismatch). Real bugs → FAIL. Test issues → fix
  and rerun up to 3 times, then PASS if stable.
- Cleanup is mandatory.

spec: .ship/tasks/opc-delivery-agent-20260712-0258/plan/spec.md
previous_report: .ship/tasks/opc-delivery-agent-20260712-0258/e2e/report.md
run_state: .ship/tasks/opc-delivery-agent-20260712-0258/control/run_state.yaml
task_dir: .ship/tasks/opc-delivery-agent-20260712-0258
Write evidence to: .ship/tasks/opc-delivery-agent-20260712-0258/e2e/
Mode: /yishuship:auto staged workflow recheck — no user questions.
