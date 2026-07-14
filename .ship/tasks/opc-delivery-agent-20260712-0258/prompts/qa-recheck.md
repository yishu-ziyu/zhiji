You must use Skill('yishuship:qa'). Skip preamble and auth gate.

Recheck after fixes: re-test previously failing criteria + check for regressions.
Skip exploratory testing (already done in first pass).

IMPORTANT: You MUST start the application and re-test interactively — use the
same testing method (browser, electron, API, CLI) as the original QA pass.
Do NOT skip interactive testing. Verify fixes in the running application with
evidence (screenshots, curl output, command output).

spec: .ship/tasks/opc-delivery-agent-20260712-0258/plan/spec.md
run_state: .ship/tasks/opc-delivery-agent-20260712-0258/control/run_state.yaml
task_dir: .ship/tasks/opc-delivery-agent-20260712-0258
Write reports to: .ship/tasks/opc-delivery-agent-20260712-0258/qa/
Mode: /yishuship:auto staged workflow recheck — no user questions.
