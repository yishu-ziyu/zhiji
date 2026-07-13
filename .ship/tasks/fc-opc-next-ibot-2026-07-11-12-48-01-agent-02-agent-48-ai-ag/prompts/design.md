You must use Skill('ship:design'). Skip preamble and auth gate.

Planning request:
---

FC-OPC Next iBot 黑客松项目（2026-07-11~12，48小时，杭州）。双赛道并行：01 电商经营 Agent（商品选品、种草脚本、私域运营、售后与店铺分析）和 02 效率 Agent（项目管理自动化、会议纪要自动、企业知识库与团队协同）。从零开始，48小时内产出可演示的 AI Agent 应用。包含 Web 前端界面 + 后端 AI Agent 逻辑。参考 HACKATHON_DEV_RULES.md。
---

IMPORTANT: You MUST write both spec.md and plan.md to the artifacts directory.
The orchestrator validates these files exist and are non-empty before advancing
to the dev phase. Do NOT respond conversationally — write the artifacts to disk.

If this task involves frontend/UI changes and no DESIGN.md exists at project root,
note in spec.md that one should be created via /ship:visual-design before or
after this pipeline run.

task_id: fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag
Artifacts: .ship/tasks/fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag/plan/
Raw input: .ship/tasks/fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag/input/requirement.md
Run state: .ship/tasks/fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag/control/run_state.yaml
Branch: ship/fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag
HEAD: 9a61c4b3fea9192428dec210ebc7e309571724c7
Scope mode: full
Mode: /ship:auto staged workflow — no user questions, treat escalations as blocked.

If lightweight YAML planning notes would help this specific task, you may write
them under .ship/tasks/fc-opc-next-ibot-2026-07-11-12-48-01-agent-02-agent-48-ai-ag/control/. Choose the schema yourself and keep
Markdown/code as the real deliverables.

Scope mode `refactor` means the task is behavior-preserving (refactor,
simplify, rename, extract, dedupe, etc.). In that mode, skip Phase 6
(Execution Drill) — the "every step is implementable" check adds little
value when the steps are small code movements. Peer investigation and
diff still run. See design SKILL.md "Scope Mode" for details.
Scope mode `full` runs all six phases.
