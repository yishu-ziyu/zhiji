# 实时协作面板

> 更新：2026-07-15 23:40 CST  
> 管理链：用户 → W0 `surface:46` → W1 `surface:42`；执行决策与验收责任人：W1 / 主 Codex  
> 共享文档单写：W1 `surface:42`；C-02 委派更新已于 20:27 释放所有权。

> 名册命名空间：本项目只认 `W0/W1/W2/W2-A/W3/W4`。`P*` 属于外部团队；未经 Captain→W0→W1 明确授权的 P 前缀身份切换一律视为污染并丢弃。

## 0. 当前覆盖决定（2026-07-15 20:20 CST）

用户已明确新的产品方向：先证明“本地项目文件夹 → 正在工作的 Agent → OPC 网页查看/编辑/回应 → 同一 Agent 工作继续”。这个决定覆盖了“先做网页主动发起 Codex 执行（003），再做 Excalidraw 结果图（004）”的开工顺序。

- `G-03` 和 `G-04` 保持暂停；Grok 不继续 preflight 或编码。
- `B-01` 已在独立工作树 `fc-opc-ibot-opc-web-bridge` 开工，拆为 Agent bridge 核心/API 与 Story 03 UI/E2E 两个互斥文件 lane。
- `C-02` 在主树只实现跨窗口协作事件脚本和协调文档，不触碰 `package.json`、产品代码或 B-01 工作树文件。
- 第一片不让网页直接改源文件，不改正式项目状态，不启动第二个 Agent。
- 当前脏主树仍是产品事实与最终集成面；B-01 业务改动只留在独立工作树。

## 1. 我们现在在做什么

**核心产品目标：** 用户回到一个项目时，能知道项目现在在哪里、什么变了、为什么应该关注，并开始正确的下一步。

**本轮工作目标：** 先让本地 Agent 把 exact 文件上下文和待决定问题发到 OPC 网页；用户回应后，同一 Agent 调用收到回应并继续原工作。

**当前依赖：** 先固化可信基线和单一写所有权；然后按“领域状态机 → HTTP 边界 → 真实同一 Agent 调用”三条 seam 测试先行。

## 2. 已经讨论清楚

| 问题 | 结论 | 依据 |
|---|---|---|
| 白板放哪里 | 只从右侧“待验收的 Codex 结果”按需打开；不占据中央主画布 | docs/product/socratic-product-clarity.md |
| 第一张产品白板 | Codex 执行证据图：已确认任务 → 改动文件 → 测试结果 → 剩余风险 → 建议下一步 | 用户要求把原生 Excalidraw 任务交给 Grok；主 Codex 采用已经给出的首选场景 |
| 生成方式 | 事件触发、按需生成、审阅时冻结；有新数据时生成新版本，不连续重画 | Lavish 源码机制会整图重建，连续重画会使批注失去对应位置 |
| 什么是正式事实 | 项目对象、执行结果版本、证据和用户确认；画布位置、手绘和拖线不是事实 | 现有 CanvasNodeRef / CanvasEdge / evidence 模型 |
| 是否直接嵌入 Lavish | 不嵌入。开发协作继续使用 Lavish；正式产品原生使用 @excalidraw/excalidraw | Lavish 是本机 CLI/Express，没有稳定 SDK；Excalidraw 官方包支持 React 19 |
| 白板编辑能否直接改状态 | 不能。编辑只产生待确认反馈；退回、继续执行、接受结果是三个独立动作 | 已定的人工确认边界 |
| 网页与本地项目的关系 | 网页是本地项目的可操作映射；对象点开后生成对应工作面，操作再精确回到 Agent 和原对象 | 用户 2026-07-15 明确总结，主 Codex 确认 |

## 3. 任务分派

| ID | 负责人 | 任务 | 执行状态 | 验收状态 | 采纳状态 | 分派/接收 | 下一个动作 |
|---|---|---|---|---|---|---|---|
| R-01 | Agent lavish_product_fit | 收敛白板产品入口、路径和 BDD | 已交付 | 通过 | 全部采纳 | 18:42 / 18:43 | 结果已进入 004，关闭 |
| R-02 | Agent lavish_technical_fit | 核对仓库接入点、数据绑定和测试接缝 | 已交付 | 通过 | 部分采纳 | 18:42 / 18:43 | 采纳稳定引用/证据/版本绑定，不采纳通用关系白板 |
| R-03 | Agent lavish_technical_fit | 独立审计 003/004 的安全、hash、Git 结果和重启恢复 | 已交付 | 通过 | 全部采纳 | 19:16 / 19:16 | 阻塞项已写回 003/004，关闭 |
| G-02 | Grok | OpenConnector `github.create_issue` 技术验证 | 已交付 | **退回** | 不进入主路径 | 已交付 / 已接收 | 保留 commit 作技术试验，不合并 |
| C-01 | 主 Codex | 建立讨论/分派/交付/验收面板 | 已交付 | **部分通过** | 继续使用 | 用户要求 / 已完成 | 作为人可读决策与验收真集；运行中通知由 C-02 补上 |
| R-05 | Agent three_window_context_sync | 设计三窗口自动共享上下文的最小技术方案 | 已交付 | 通过 | 部分采纳 | 已分派 / 已接收 | 先交付 common-dir JSONL CLI；SQLite/HTTP 延后到出现真实查询需求 |
| C-02 | Agent `resume_grok_review` | 三窗口共享事件 `publish/status/follow` + 真实分工面板 | 已交付 | **通过** | 支撑当前协作 | 20:14 / 20:15 | W4 独立验收 5/5 通过；关闭 |
| G-03 | Grok | 真实 Codex 执行、可信写回和普通接受/退回 | 已暂停 | 未验收 | 被 B-01 替代顺序 | 19:32 / — | 不再 preflight，不编码 |
| G-04 | Grok | 原生 Excalidraw 执行证据图与精确退回 | 已暂停 | 未验收 | 延后决定 | 19:15 / — | 等 B-01 真实证据，不得先接主路径 |
| B-01 | 主 Codex | 本地项目网页桥最小闭环 | **FINAL_FREEZE v2 已废止：W3 新 HIGH** | 退回修改 | 已决定 | 19:56 / 19:56 | W4 已停止且无 verdict；收齐 FINDING_V2-01 后只派最小修复与回归，再建立 v3 |
| B-01A | W2-Core `surface:32` | Agent bridge 领域、CLI、HTTP/cancel、显式 consumer ACK | 已交付并冻结只读 | 待集成验收 | 待 B-01 集成 | 已接单 / 已交付 | W1 独立复跑 full unit 123/123、tsc、lint、build、diff-check 全部 exit 0；真实同一 Agent smoke 未跑 |
| B-01B | 历史实现 lanes | Story 03 AgentBridgePanel / Inspector / E2E 初版 | 已交付 | 被 W3 findings 触发返修 | 作为 W2-A seed | 已交付 / 已收件 | 初版证据不作为 FINAL_FREEZE v2 验收结论 |
| B-01C | W2-A `surface:58` / UUID `415F…` | F04/F05/F06 UI 可靠性与用户层 Playwright 证据 | 已交付并释放写权 | W1 已验指纹并集成；整体未验收 | 已采纳 owned-file diff | 21:46 / 22:55 | owned diff `8d06f690…`、manifest `25f661b8…`；W1 只集成 3 文件且逐字一致 |
| V-B01 | W1 + W3 + W4 | 验收 B-01 | v2 终审已停止 | **FAIL / 无整体 verdict** | 不适用 | 23:30 / 23:39 | W3 确定性复现 HIGH；W4 按令停止，旧自动绿不再构成冻结验收 |
| A-01 | W2 · Attention `surface:59` / UUID `0683…` | 管理者注意力/决策队列领域规格准备 | 已交付；W1 已审查并集成 | 待真实场景确认与后续 W3 规格审查 | MATT 部分采用 | 23:19 / 23:25 | spec `d653c085…`；仍不是实现合同，不授权 UI/产品代码 |

## 4. 交付验收记录

| 任务 | 交付 | 验收结论 | 证据 | 处理 |
|---|---|---|---|---|
| R-01 | 产品验收收敛 | **通过** | 004 第 1、3、4、7、9、11 节；明确入口、冻结版本、人工确认和不占据主画布 | 全部采纳 |
| R-02 | 仓库与 Excalidraw 技术核对 | **通过** | 核对 `shared/types/knowledge.ts`、`shared/knowledge/project-canvas.ts`、Inspector 与现有 API；测试数字无固定 SHA，不作为验收证据 | 交付质量通过；产品建议只部分采纳 |
| R-03 | 003/004 独立审计 | **通过** | 实测 Codex 0.144.4 的读取边界、proxy 网络绕过、CLI 参数；核对 hash、Git index、lease 和 revision lineage | 六个阻塞缺口已写回 003/004 |
| G-02 | `44e5950e` | **退回** | unit 12/12、typecheck、lint、build、E2E 7/7 独立通过；真实 OpenConnector smoke 未跑；确认内容和幂等 key 可被客户端绕过 | 不合并；保留为技术实验，后续若需重做服务端冻结确认 |
| C-01 | 实时协作面板 | **部分通过** | 已能记录决策、任务、交付、验收、风险和工作树 | 只是共享事实源，还不会自动通知其他窗口 |
| C-02 | `scripts/collab-events.mjs` | **通过** | W4 独立复跑 node:test 3/3、syntax、owned lint、diff-check、产品代码无 `.git/collab` 读取，全部 exit 0；证据 `/tmp/c02-accept-w4-8316`；此前三个真实 session status/follow 证据仍保留 | 已验收并关闭；JSONL 只作运行通知，不作产品状态 |
| G-03 | 未交付 | — | — | — |
| G-04 | 未交付 | — | — | — |
| B-01 freeze v1 | tracked `c45d0013…` / untracked `f21eaadf…` | **退回修改** | W3 顺序复现：request revision 1 已 answered，rebind 到 revision 2 后，新 capability 仍可读取并 ACK 为 delivered | v1 废止；W2 只写领域层与回归测试，W4 的移动树运行不得作为验收证据 |
| B-01 FINAL_FREEZE v2 | source `f23a3e13…` / change `2c94c8dd…` | **废止 / 退回修改** | W1 自动 gate 全绿，但 W3 在同一指纹上确定性复现 FINDING_V2-01 HIGH | W4 已停止、无 verdict；旧指纹只作失败基线，不得恢复为 PASS |

## 5. 主 Codex 验收规则

Grok 说“完成”不算完成。主 Codex 只按以下证据判断：

1. **固定标准：** 逐条对照开发约束中的 BDD，不用“大概符合”。
2. **代码：** 审查实际 diff，检查是否修改任务外文件、产生第二套事实源或使用假执行结果。
3. **自动验证：** 主 Codex 自己重跑目标单测、类型检查、lint、生产构建和 Playwright。
4. **真实路径：** G-03 必须证明真的 codex exec 在隔离工作树修改指定文件并运行指定测试；G-04 必须在真实待验收结果上打开白板。
5. **视觉与交互：** 同一视口对照当前 Apple 式参考；打开、选择元素、写反馈、退回、打开新版、接受都要可操作。
6. **失败路径：** 旧版本、跨项目引用、Excalidraw 加载失败、测试失败、超时和用户未提交改动都必须有明确结果。

## 6. 工作树与文件所有权

### W0–W4 surface 名册

`workspace:4` 内由 W0 负责用户治理，W1–W4 组成执行团队；cmux 寻址必须使用 `--surface`。正式管理链、握手和交接规则见 `docs/product/FOUR_WINDOW_COLLAB.md`。

| 窗口 | surface | 角色 / 工作面 | 当前握手 |
|---|---|---|---|
| W0 | `surface:46` | 用户代理治理；只向 W1 下令并接收关键状态汇总 | 管理链已确认；不常态直达 W2–W4 |
| W1 | `surface:42` | 主 Codex 编排/集成/验收；主树 cwd | 活跃；共享文档唯一写入者 |
| W2 | `surface:32` | W2-Core；B-01 Core/API/CLI/unit 实现 | F03-R2 单一 writer：修 dead-owner recovery 线性化与 raw tuple/type exactness；F02 仍 HOLD |
| W2-A | `surface:58` / UUID `415F…` | Codex 会话；隔离 treehouse lease 的 UI / E2E 实现 | handoff 已验证并集成；ownership 释放，lease 只读保留 |
| W2 · Attention | `surface:59` / UUID `0683…` | W2-Core 的独立领域规格轴 | handoff `d653c085…` 已收；ownership 释放，lease 只读保留 |
| W3 | `surface:39` | B-01 v2 独立审查，只读 | 已报 FINDING_V2-01 HIGH；收敛完整 FAIL handoff，不修 |
| W4 | `surface:43` | B-01 v2 独立验收，只读源码 | 已停止剩余命令；保留局部证据，无 verdict，不写源码 |

W1 当前可直接使用 cmux `send/read-screen/send-key` 调度各 surface；消息只有在目标 screen 或显式回执可验证后才记为已送达。

| 路径 | 负责人 | 规则 |
|---|---|---|
| /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot | 主 Codex + C-02 | 主 Codex 做决策/集成/验收；C-02 只写协调文档和 `scripts/collab-*`；不叠加 B-01 业务代码 |
| /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-grok-docs | Grok 原窗口 | 保留原有 001/002 与未提交文档；不用于 G-03，不重置、不清理 |
| /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-grok-codex-execution | Grok G-03 | 分支 `grok/codex-execution-003`；基线 `225b08e7`；只做 G-03，不带入已放弃的 002 |
| /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-opc-web-bridge | 主 Codex B-01 | 分支 `codex/opc-local-project-web-bridge`；基线 `1cac84f6`；只做 B-01，不修改脏主树业务代码 |
| /Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/2/fc-opc-ibot | W2-A | handoff 已完成；owned diff `8d06f690…`、manifest `25f661b8…`；只读保留证据 |
| /Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/3/fc-opc-ibot | W2 · Attention | 独立 treehouse lease；只写 `.ship/tasks/attention-protocol-v0-20260715/plan/spec.md` |
| docs/product/LIVE_COLLABORATION_BOARD.md | W1 `surface:42` | 唯一共享任务与验收记录；委派写入结束后必须显式收回 |
| `.git/collab/events.jsonl` | 所有工作树/session | 只能经 `scripts/collab-events.mjs publish` 追加；是运行通知流，不取代本面板的产品决策 |

### 工作树决定

- 原 Grok 工作树 HEAD `44e5950e` 包含已不再作为产品主路径的 002，并且有未提交文档，因此不用于 G-03。
- G-03 工作树已从已接受的 001 提交 `225b08e7` 创建且保持 clean，但任务当前暂停。
- B-01 Core 工作树从 `1cac84f6` 创建；W2-A 不与 Core 共树写入，而在独立 treehouse lease 上按冻结 seed/core manifest 工作。

### 当前互斥写入矩阵

| Lane | 工作树 | 独占写入路径 | 当前状态 |
|---|---|---|---|
| C-02 `resume_grok_review` | 主树 | `docs/product/LIVE_COLLABORATION_BOARD.md`、`WORKTREE_MAP.md`、`FOUR_WINDOW_COLLAB.md`、`scripts/collab-*`、`AGENTS.md` 指定 lesson | 已交付并释放所有权；collab tests 3/3 GREEN |
| W2-Core `surface:32` | B-01 Core 工作树 | F03-R2 独占 `agent-bridge.ts/test`、ACK route/route test、CLI/CLI test；不得触碰 UI/E2E/spec/package/F02 | 01:38 重新授权；R1 59/59 因 recovery race 与 exact raw tuple 两类 BLOCKER 失效，完成 RED→最小修复→handoff 后释放 |
| W2-A `surface:58` / UUID `415F…` | treehouse lease slot 2 | `AgentBridgePanel.tsx`、CSS、B-01 E2E owned diff | 已交付、集成并释放；lease 只读 |
| W2 · Attention `surface:59` / UUID `0683…` | treehouse lease slot 3 | 仅 `.ship/tasks/attention-protocol-v0-20260715/plan/spec.md` | 已交付并释放；W1 主树集成逐字一致；不影响 B-01 关键路径 |

### 三窗口运行事件

- 存储：`$(git rev-parse --git-common-dir)/collab/events.jsonl`，所有 linked worktree 共用，不污染任一工作树。
- 并发：`mkdir` 原子锁 + 单行 JSON 追加；每条自动记录 agent/session/worktree/branch/HEAD SHA/time/summary。
- 发布：`./scripts/collab-events.mjs publish --agent codex --session <id> --summary '<state>'`。
- 快照：`./scripts/collab-events.mjs status` 或 `status --json`，每个 agent/session 只显示最新一条。
- 跟随：`./scripts/collab-events.mjs follow`（启动后新事件）或 `follow --json`。

## 7. 当前等待队列

1. FINAL_FREEZE v2 已因 W3 的 FINDING_V2-01 HIGH 废止；旧指纹保持为失败基线，当前仍禁止写入，直到 W1 宣布最小修复 ownership。
2. W3 停止扩展，只回完整 deterministic repro、影响、验收条件与 FAIL verdict；不修代码。
3. W4 已停止剩余验收、确认测试端口释放并保留局部日志；不得给 v2 verdict。
4. W1 收齐 finding 后只派一个 Core 最小修复轴，新增失败回归后再验证并建立 FINAL_FREEZE v3。
5. W2 · Attention 单一领域 spec 已交付并由 W1 集成；报告与 spec 显式排除 B-01 FINAL_FREEZE v2，等待真实场景确认与后续 W3 规格审查。
6. C-02 已由 W4 独立验收通过；W4 转为待命 B-01 最终验收。
7. G-03/G-04 保持暂停，除非用户重新排序。

## 8. 讨论进度

| 时间 | 讨论问题 | 结论 | 对开发的影响 | 状态 |
|---|---|---|---|---|
| 2026-07-15 | Lavish 能否用于产品 | 开发协作继续用 Lavish；产品不嵌入 Lavish 运行时 | 产品使用官方 Excalidraw React 包 | **已结束** |
| 2026-07-15 | 白板是否放在中央 | 不放中央；从右侧待验收结果按需打开 | 不修改 ProjectCanvas 中心布局 | **已结束** |
| 2026-07-15 | 第一张产品白板解释什么 | 解释 exact Codex 执行结果，不做通用项目关系图 | 生成 004 开发约束 | **已结束** |
| 2026-07-15 | 白板依赖什么真实数据 | 必须先有真实 Codex 执行、runner 验证和不可变结果版本 | G-03 先于 G-04 | **已结束** |
| 2026-07-15 | 白板反馈能否自动改项目状态 | 不能；反馈、退回继续修改、接受结果分开 | 所有写入继续使用 exact-version 确认 | **已结束** |
| 2026-07-15 | 产品网页本质是什么 | 本地项目的可操作映射，不是另一个项目存储地 | 主画布只筛选当前重点；对象工作面承载具体协作 | **已结束** |
| 2026-07-15 | 下一步讨论什么 | 继续讨论 Agent 何时主动提出执行，何时保持安静 | 形成独立可验收行为后再分派 | **待讨论** |

## 9. 任务状态规则

| 状态 | 什么时候能写 |
|---|---|
| 待讨论 | 只有问题，还没有可验收的用户行为 |
| 已定义 | 已有用户路径、边界、BDD 和实现约束，但尚未交给执行者 |
| 已分派 | 负责人、工作树、输入、交付物和验收方式已明确 |
| 进行中 | 负责人已回传开工证据，并且没有被依赖阻塞 |
| 待验收 | 已回传 commit、文件、命令结果、BDD 对照和所需页面证据 |
| 验收不通过 | 主 Codex 已列出可复现问题和退回条件 |
| 已验收 | 主 Codex 已独立重跑验证，且产品行为与开发约束一致 |
| 已取消 / 已替换 | 用户或新证据已明确改变方向，原任务不再继续 |

## 10. 交付质量记录方式

每个开发交付按五项记录，任一关键项不通过就退回，不用平均分掩盖问题。

| 验收项 | 主 Codex 要回答什么 |
|---|---|
| 范围 | 是否只改了分派范围；是否混入他人文件 |
| 产品 | 用户是否真能完成 BDD 中的动作；是否用假数据冒充真实能力 |
| 安全与一致性 | 是否越权、跨工作树、接受旧版本或产生第二套事实源 |
| 验证 | unit、API、typecheck、lint、build、E2E 和真实 smoke 是否分别有独立证据 |
| 体验 | 真实页面是否降低理解成本；异常、刷新、退回和过期是否可用 |

验收结论只有三种：**通过**、**退回修改**、**环境阻塞**。每次必须附实际证据和下一个负责人。

## 11. 风险和阻塞

| ID | 风险 | 严重度 | 负责人 | 当前处理 | 解除条件 |
|---|---|---|---|---|---|
| K-01 | 原 Grok 基线包含已放弃的 002 | 高 | 主 Codex | 已创建不含 002 的 G-03 工作树 | 已解除 |
| K-02 | 交接文档只在主树且尚未纳入 Git | 高 | 主 Codex | 使用绝对路径 + SHA-256 冻结 | Grok 回传 hash 一致证据 |
| K-03 | Codex `workspace-write` 不是读取隔离 | 高 | Grok / 主 Codex | 003 已降低承诺并加环境门禁 | preflight 明确证明能力与剩余边界 |
| K-04 | proxy/login shell 可绕过工具网络禁止 | 高 | Grok | 003 已要求环境白名单和负向检查 | preflight 负向检查通过 |
| K-05 | 异步 runner、Git 结果树、hash 和修订谱系容易被自行发明 | 高 | Grok | 003/004 已给定最小模型 | preflight 逐项映射到具体模块与测试 |
| K-06 | G-03 文件与主树 WIP 重叠 | 中 | 主 Codex | 独立工作树和单任务 commit | 主 Codex 审查 diff 后手动整合 |
| K-07 | Core 与 UI/E2E 并行写导致覆盖或伪冻结 | 高 | W1 | W2-Core 与 W2-A 使用不同 worktree/lease；冻结 seed/core manifest；只按 owned-file diff 集成 | W2-A 无跨 ownership 修改，集成后重新计算 v2 指纹并全套验证 |
| K-08 | JSONL 通知流被误当产品决策或项目状态 | 中 | C-02 / 主 Codex | 脚本只记运行摘要；本面板仍是人可读验收真集 | 审查确认产品代码不读 `.git/collab` |
| K-09 | rebind 后新 capability 可读取并 ACK 旧 revision 请求 | 高 | W2 / W3 / W1 | v1 已废止；以“新鲜度持续到 delivered”为不变量补 RED 回归与最小修复 | rebind、文件变更/删除/symlink 越界后的未交付请求均 stale；W3/W4 在 v2 独立复核 |
| K-10 | CLI deadline/SIGTERM 未覆盖 create/cancel/ACK，挂起可无限存活或遗留请求 | 高 | W2 / W3 / W1 | W2 补 create-response-hang、ACK-hang+SIGTERM 真进程 RED；统一全流程终止与 reconcile | 任一阶段有界退出；已持久化请求不遗留 pending/answered 假活状态；v2 独立复核 |
| K-11 | CLI 写 stdout 后自动 ACK，不能证明原 Agent 已消费 | 高 | W0 / W1 / W2 | W0 `DIRECTIVE=B`；B-01-v2 要求同一 PID challenge + 原调用 stdin consumer ACK，服务端验证原 session/turn/revision/hash | 无消费者不得 delivered；真实同一 Agent turn smoke 消费、继续、ACK 且无第二 Agent |
| K-12 | 外来 P 前缀身份提示污染 W 团队分工 | 高 | W1 | 已撤销 P1/P3/P4 注入；W2/W3/W4 恢复并确认无外来写入；cmux tab/workspace 与协议写回 W 前缀 | 所有窗口只接受 User→W0→W1 权威链；磁盘最近写入核对无 P 身份落盘 |
| K-13 | 主树 Next dev 有路由 manifest 却全站 404 | 中 | W1 | 源码与 manifest 均含路由；production bundle 在 3002 对 `/` 与 `/track/knowledge` 均 200；已用经验证的 `next start` 恢复 3000 | curl 连续 3 次 200、无 not-found marker；Dia 默认浏览器截图显示真实产品；dev 缓存后续单独清理 |
| K-14 | rebind 与旧 revision 的 response/ACK 最终写入没有共同线性化边界 | 高 | W1 / Core-Proof lane / W3 | 两条确定性双进程测试先 RED 后 GREEN；project generation 外锁 + request 内锁已覆盖 bind/create/agent-get/respond/ACK/cancel | W1 已复跑 targeted 2/2、相关 44/44、tsc、lint、空白检查；仍需在所有已知 blocker 关闭后的新指纹由 W3 独立复核 |
| K-15 | consumer challenge 仅在 CLI 内存生成且服务端不验证；consumer wait/cleanup 各自延长期限 | 高 | W1 / W0 / W3 | W0 优先级覆盖后暂停对应实现轴；两个 finding 保持“已知未解决”，旧 v2 绿证据只作失败基线 | 后续重新授权时仍须满足 missing/mismatch/replay、challenge 不泄露和单一 deadline；在此之前不得建立 PASS |

## 12. 任务事件记录

| 时间 | 任务 | 操作者 | 事件 | 证据 | 下一动作 |
|---|---|---|---|---|---|
| 18:42 | R-01 / R-02 | 主 Codex | 分派并行产品/技术核对 | Agent 任务记录 | 等待交付 |
| 19:06 | R-01 / R-02 | 主 Codex | 验收并写入 004 | 004 第 1–11 节 | 准备 G-03/G-04 交接 |
| 19:16 | R-03 | 主 Codex | 分派 003/004 独立审计 | Agent 任务记录 | 等待技术风险 |
| 19:25 | R-03 | 技术核对 Agent | 交付六个阻塞缺口 | Codex 0.144.4 实测 + 文件行号 | 主 Codex 修正 003/004 |
| 19:32 | G-03 | 主 Codex | 创建干净工作树并分派 preflight | `grok/codex-execution-003` @ `225b08e7` | Grok 核对 hash 并接收 |
| 19:38 | G-03 / G-04 | 主 Codex | 冻结开发约束 v2 | 第 13 节 SHA-256 | 等待 Grok 接收 |
| 19:55 | G-02 | 主 Codex | 独立验收并退回 | `44e5950e`；12 unit、typecheck、lint、build、7 E2E | 不合并，保留技术试验 |
| 19:55 | C-01 / R-05 | 主 Codex | 验收面板并收敛三窗口同步方案 | 面板 + 独立方案审查 | 转为本地共享事件流开发任务 |
| 19:56 | G-03 / G-04 / B-01 | 主 Codex | 用户新决定覆盖开工顺序；暂停 003/004，启动本地项目网页桥 | 本面板第 0 节 + B-01 spec | 独立工作树 TDD |
| 20:12 | B-01 Story 01 | 主 Codex | 完成领域/HTTP tracer bullet，进入独立 peer 复核 | 13 tests + `npx tsc --noEmit` | peer PASS 后才进入 Story 02 |
| 20:14 | B-01 / C-02 | 主 Codex | 把可写任务拆成三个互斥文件 lane，C-02 开始实现 common-dir 协作流 | Agent 分派 + 项目 lesson | 子 lane 自己产出 GREEN 证据 |
| 20:18 | C-02 | Agent `resume_grok_review` | `publish/status` 转 GREEN，并从主树发布第一条真实事件 | linked-worktree + 16 并发 node:test | 补 follow 和三窗口实证 |
| 20:20 | C-02 / B-01B | 两个 subagent | `follow` 3/3 GREEN；Story 03 lane 从 B-01 工作树发布真实事件 | `.git/collab/events.jsonl` + event `001bb623-ee90-4c16-aa81-103efd349545` | 等 B-01A publish，再做三 session 快照 |
| 20:24 | B-01A / C-02 | 两个 subagent | B-01A 交付完整验证摘要；C-02 `status --json` 读回三个真实 session | event `52c5ed4b-43f1-413f-af15-fa99a266a117` + status JSON | 主 Codex 验收两个交付 |
| 20:26 | C-02 / B-01B | Agent `resume_grok_review` | 主树 follow 实时读到 B-01 worktree publish 与 Story 03 GREEN 更新 | events `aeb26afd-8329-4d71-b3a4-c05cd7fac459`、`3c125ee7-693e-4a19-b7b8-58709edfc038` | 写回四窗协议后结束 C-02 |
| 20:27 | W1 / C-02 | 主 Codex 委派 lane | 固化 W1–W4 surface 名册、ACK/ownership/handoff 协议；共享文档所有权收回 W1 | `docs/product/FOUR_WINDOW_COLLAB.md` + `WORKTREE_MAP.md` | C-02 结束，W1 集成验收 |
| 20:28 | W1–W4 | 四个 surface | W2 补回 ACK，W4 补齐 branch/SHA 与只读验收边界；四窗握手全部完成 | surfaces 42/32/39/43 | W1 按冻结 contract 启动下一批 |
| 20:29 | B-01B / C-02 | 两个 subagent | Story 03 回传 tsc/lint 0、unit 105/105、Playwright 7/7；C-02 发布最终 handoff 事件并结束 lane | events `fa3975ec-9fe6-4ac0-838a-9b15eb44a8f1`、`7c480f43-7acc-4473-a22f-629a7d4d8dd7` | W1 集成验收 |
| 20:55 | C-02 | W4 `surface:43` | 独立验收协作事件脚本与产品隔离边界，5/5 检查通过 | `/tmp/c02-accept-w4-8316`；所有命令 exit 0 | C-02 关闭；W4 待命 B-01 验收 |
| 21:00 | B-01 freeze v1 | W3 `surface:39` | 复现 rebind/旧 revision ACK 漏洞，否决 v1 | revision 1 answered → rebind revision 2 → 新 capability get/ACK → delivered | W2 获得 FIX-01 互斥写 ownership；修复后生成 v2 |
| 21:01 | B-01 验收 | W1 / W4 | W2 开始写后立即停止 W4 的 v1 suite，避免移动树产生伪证据 | `/tmp/b01-accept-w4-13103` 标记 `INVALID_MOVING_TREE` | 只接受静止 v2 指纹上的终审证据 |
| 21:03 | B-01 freeze v1 | W3 `surface:39` | 复现 CLI create/ACK 挂起不受 timeout/SIGTERM 约束，追加第二个 HIGH | create 已持久化但 response hang；ACK hang 后需 SIGKILL | W2 扩展到 FIX-02 CLI/真进程回归；v1 继续保持废止 |
| 21:05 | B-01 审查 | W3 `surface:39` | 交付完整独立审查报告并停止扩发现 | `docs/product/reviews/B01_W3_FINAL_REVIEW.md`；SHA-256 `7067ec562cd0f84431f41190edd254af13a02c9944ba126d0a4cc21605e2edc6` | W3 只读等待 v2 |
| 21:06 | B-01 ACK 语义 | W0 `surface:46` | `DIRECTIVE=B`：transport 写出不等于原 Agent 消费，禁止 CLI 自动制造 delivered | B-01-v2 spec/issue/dev-context 已写盘 | W2 实现最小 consumer ACK seam；真实 Agent smoke 为最终门 |
| 21:20 | B-01 Core v2 | W2 `surface:32` / W1 | W2 交付 FIX-01/02/03 与显式 consumer ACK；W1 独立复跑 unit 123/123、tsc、lint、build、diff-check 全绿 | B-01 worktree；Core manifest `f615089c…` | W2-Core 冻结只读；W2-A 基于同一 Core manifest 开工 |
| 21:22 | B-01 UI/E2E | W1 / W2-A `surface:47` | 创建独立 treehouse lease 并投递互斥 ownership、F04–F06 与 consumer seam 任务 | lease slot 2；tracked `c45d0013…`、untracked `1202fb51…`、UI seed `9b6aa8c9…` | 等正式 ACK 与 owned-file handoff；当前运行不形成 PASS |
| 21:36 | 团队上下文 | 外来跨窗提示 / W1 | W2/W3/W4 被误注入 P3/P1/P4 身份；W1 立即撤销并恢复 W 名册 | W2/W3/W4 `RESET_ACK`；主树最近写入仅 W1 三份协作文档 | P 前缀永不作为本项目隐式别名；继续核对 W2-A scope |
| 21:41 | 主产品服务 | W0 / W1 | 纠正“3000 已恢复”的错误报告；dev 路由全 404，切到同主树经验证的 production server | PID 40665、cwd 主树；curl 3× HTTP 200、marker 0；`/tmp/opc-default-browser-recovered.png` | 用户默认浏览器已显示真实产品；dev 缓存另列技术债 |
| 21:46 | W2-A 上下文 | W1 | 关闭残留无效 7/7 结论且无法接收纠正的旧 surface；机械恢复越界 config、删除越界 evidence doc；在同一 lease 新建干净 W2-A Codex 会话 | `cmp playwright.config=0`、evidence doc absent；UUID `415F751D-6EBB-411F-9AF1-ECA03AA07E39` | 等正式 RESET_ACK；只接受 3127 + 真实 exit 的新证据 |
| 22:55 | B-01 UI/E2E | W2-A / W1 | W2-A 回传真实 build、3127、Playwright 7/7、tsc/lint/diff-check；W1 复算 owned diff/manifest 并只集成 3 文件 | diff `8d06f690…`；manifest `25f661b8…`；集成后 3 文件逐字一致 | ownership 释放；W1 在 3128 跑全量 E2E 后建立 v2 freeze |
| 23:19 | Attention spec | W0 / W1 / W2-Core | W1 完整校验 MATT 479 行报告并冻结领域骨架；采用三机制/双环/四块表达/责任闭环，暂缓最终术语与 UI | MATT `82ea709a…`；spec seed `543535df…`；decision log `791a3b24…` | lease slot 3 单文件起草；明确排除 B-01 FINAL_FREEZE v2 |
| 23:25 | Attention spec | W2-Core / W1 | W2 在单文件 ownership 内交付对象边界、状态机、门槛合同与三条真实回放；W1 审查后逐字集成主树 | spec `d653c085…`；main/lease cmp 0；untracked diff-check 通过 | ownership 释放；保持非实现合同，等待 Captain/W0 真实场景 |
| 23:30 | B-01 FINAL_FREEZE v2 | W1 | W1 在静止集成树完成 unit 123/123、tsc、lint、build、full E2E 13/13 与 diff-check；三次源指纹一致 | HEAD `1cac84f6…`；diff `21df08aa…`；untracked `16493c4a…`；change `2c94c8dd…`；source `f23a3e13…` | 冻结写入；派 W3/W4 对同一指纹独立终审；真实 Agent smoke 仍为最终门 |
| 23:39 | B-01 FINAL_FREEZE v2 | W3 / W1 / W4 | W3 在同一 v2 指纹上确定性复现新的 HIGH implementation defect；W1 立即废止 v2 并停止 W4 | FINDING_V2-01，`shared/knowledge/agent-bridge.ts:443-447,458-480,805-855`；完整 repro 待 W3 handoff | 旧自动绿不得称 PASS；不继续浪费验收时间，收齐 finding 后最小修复 |
| 23:51 | B-01 v3 repair | W1 / Core-Proof / CLI-Deadline | W3 v2 终审收敛为 HIGH 竞态、HIGH proof 绕过、MEDIUM deadline；W1 公布互斥写权并启动两条可编辑 TDD 轴 | W3 evidence `/tmp/b01-w3-v2-final-review.txt` SHA-256 `976861c9…`；Core 只写 domain/ACK route tests，CLI 只写 CLI/tests | 先观察精确 RED，再整合 v3；完整门禁后才建立新 freeze，W3/W4 独立复核 |
| 00:00 | B-01 F01 critical path | W0 / W1 / Core-Proof | 优先级覆盖：CLI/proof 扩展轴在写文件前中止，只保留 FINDING_V2-01；ACK-vs-rebind 与 respond-vs-rebind 均取得确定性 RED | `/tmp/b01-v3-f01-red.md`；旧 ACK 实际 rev2 后 delivered，旧 response 实际 rev2 后 answered | 只做 project 外/request 内最小线性化；V2-02/V2-03 继续列为未解决 blocker |
| 00:11 | B-01 F01 critical path | Core-Proof / W1 | 最小线性化修复交付并由 W1 独立复核；无 test worker/control-dir 残留，写权释放 | source `ab1719e9…`、test `87989c9a…`、RED evidence `b4504bb3…`；targeted 2/2、相关 44/44、tsc/lint/空白检查均 exit 0 | 只确认 F01 局部修复；不建立 v3 freeze，不掩盖 V2-02/V2-03 与真实同 Agent smoke 缺口 |
| 00:13 | B-01 F03 critical path | W0 / W1 / W2-Core | 按已知 HIGH 顺序重新授权单一 writer；只修服务端一次性 consumer proof 及 CLI 协议适配 | ownership：domain+ACK route+CLI 与各自 unit；UI/E2E/spec/package 禁写 | 先证明 capability-only/missing challenge 当前可 delivered 的 RED，再最小修复；局部门绿并释放后才启动 F02 |
| 01:04 | B-01 F03-R1 gate repair | W1 / W2-Core | 稳态 50/50 虽绿，但独立审查与 W1 fault probe 复现死 request lock、活 owner lock 被偷、terminal sidecar 清理伪失败；F03 重新打开 | `/tmp/b01-f03-w1-fault-repro.md` SHA-256 `606145e2…`；B1 stale 优先误报已驳回，B5 ACK 模糊成功归入 F02 | W2 单一 writer 先加失败回归，再修 owner-token/recovery 与 request-state-authoritative cleanup；不建 freeze |
| 01:15 | B-01 F03 claim gate | W0 / W1 / W2-Core | 最终口径收窄：F03 只证明 capability 保护下服务端一次性 delivery challenge 的签发、精确校验、原子消费与 invalid-proof 拒绝 | 禁止把 tuple 校验表述为 parent/originating Agent 已语义消费或继续；same live session/turn 只由独立 live-thread smoke/G3 证明且不得重复计数 | 当前 R1 源码注释、测试名/断言、GREEN 与 handoff 全部按此核验；旧 claim 不接纳 |
| 01:38 | B-01 F03-R2 gate repair | W1 / W2-Core | R1 handoff 后 W1 相关门 59/59 绿，但三条独立复核发现并复现 3 个遗漏：双 recoverer 可删 live successor；服务端 trim 后接受非 exact session/turn；CLI 类型强转后接受非 exact stdin tuple | lock repro `/tmp/b01-f03-r1-recovery-race.mjs` SHA-256 `30d46e31…` exit 42；protocol review `045e7e94…`；W1 两个 tuple 复现均 exit 0 且错误 delivered | R1 GREEN 作废；W2 同六文件单写，先将 project/request recovery race 与 domain/route/CLI raw exactness 打 RED，再最小修复；F02 继续 HOLD |

## 13. 冻结的交接输入

| 文件 | 版本 | SHA-256 |
|---|---|---|
| `docs/product/dev-contract-003-codex-execution-writeback.md` | 003-v2 | `ed26f077eb508f5e3993dc49b93e488977baaaa7d494d77a6c62cd92fd177d69` |
| `docs/product/dev-contract-004-native-excalidraw-execution-review.md` | 004-v2 | `cd7d027ce1cc824f015bf56f369d80ac4a607531219aa4eefa5a2d49fb528087` |

任一规范内容变化都必须升版并重新计算 hash；已接收的旧 hash 不会被静默替换。实时协作面板会继续更新，不参与自身 hash。

## 14. 历史冻结的 G-03 指令（当前暂停，不得执行）

> 以下只保留为历史交接证据。当前有效顺序以第 0、3、7 节为准。

```text
你负责 G-03：真实 Codex 执行、可信写回和普通接受/退回。

工作树固定为：
/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-grok-codex-execution
分支：grok/codex-execution-003
基线：225b08e77f153c1578018e2834b73aecbe605084

开工前只读主树这些文件：
/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/CONTEXT.md
/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/product/LIVE_COLLABORATION_BOARD.md
/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/product/dev-contract-003-codex-execution-writeback.md
/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/product/dev-contract-004-native-excalidraw-execution-review.md

先核对主 Codex 给出的 003/004 SHA-256。面板是实时文档，不做自身 hash。不一致立即停止。

003-v2：ed26f077eb508f5e3993dc49b93e488977baaaa7d494d77a6c62cd92fd177d69
004-v2：cd7d027ce1cc824f015bf56f369d80ac4a607531219aa4eefa5a2d49fb528087

第一次交付只做只读 preflight，证明：
1. exact Codex 参数、工具网络策略、proxy/token/login-shell 清理；
2. acceptanceCommands 的执行边界；
3. 202 runner 所有权、launch handshake、lease、restart/reconcile/cancel；
4. ExecutionPlan 持久化，plan/result hash 如何排除自身；
5. 临时 Git index 如何包含 untracked 文件并生成 patch/result tree；
6. 依赖预检和 runner scratch 清理；
7. 004 所需 executionSeriesId、parentResultVersionId 和 feedbackHash。

任一项只能靠“模型会听提示”或最终 diff 猜测时，停止并报告。主 Codex 回复“可以开始编码”之前，不得修改代码。

通过 preflight 后再严格按 003 的 TDD 顺序实现。不要开始 004；004 必须等主 Codex 验收 003 通过。

不得切回或清理原 `fc-opc-ibot-grok-docs` 工作树。不修改主工作树，不合并，不推送 main，禁止 `git add -A`。

交付时一次性回传：
1. commit SHA 和实际文件列表；
2. 11 个 BDD 场景逐项证据；
3. 全部验收命令、退出码和失败摘要；
4. 真实 codex exec 隔离工作树 smoke 证据；
5. 同一视口的计划确认、运行中、待验收、接受/退回页面证据；
6. 未实现、未验证、环境阻塞和主动缩减项。

只能说“已交付，等待主 Codex 验收”，不得自行声称整体完成。
```
