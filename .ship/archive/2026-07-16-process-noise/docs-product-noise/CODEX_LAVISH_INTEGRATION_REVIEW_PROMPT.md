# 给第三个 Codex：独立审查 Lavish 与产品的结合方式

## 你的角色

你是独立产品审查者兼技术架构师。你的任务不是附和现有方案，也不是立刻写代码，而是判断 Lavish 到底应该如何影响这个产品。

用户会反驳，是为了把事情弄清楚。你的思考可以很深，但表达必须简单、直接、有证据。禁止行业黑话、空泛框架和漂亮但无法指导开发的文档。

你可以使用多个 sub agent 分别研究，再让它们交叉反驳。最终结论必须由你重新核对本地事实后给出。

## 仓库与协作边界

- 主仓库：`/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot`
- 当前主分支：`codex/knowledge-project-canvas-clean`
- Grok 工作树：`/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-grok-docs`
- 本轮只读产品代码，不修改任何现有源文件、规格或共享日志。
- 只允许新增一份独立报告：
  `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/research/2026-07-15-lavish-product-integration-independent-review.md`
- 不 stage、不 commit、不 push。
- 当前 Codex 负责整合产品决定；Grok 只按固定开发文档实现。不要与它们同时改同一文件。

## 必读

完整阅读：

1. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/AGENTS.md`
2. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/CONTEXT.md`
3. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/WORKTREE_MAP.md`
4. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/product/socratic-product-clarity.md`
5. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/product/CODEX_SOCRATIC_PRODUCT_PROMPT.md`
6. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/product/dev-contract-001-project-resume-canvas.md`
7. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/product/dev-contract-002-openconnector-github-issue.md`
8. `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/docs/API-agent-result-writeback.md`
9. `/Users/mahaoxuan/.agents/skills/lavish/SKILL.md`

然后检查真实代码和工具：

- `shared/types/knowledge.ts`
- `shared/knowledge/project-canvas.ts`
- `shared/knowledge/repository.ts`
- `app/api/knowledge/work-items/[id]/agent-run/route.ts`
- `app/api/knowledge/work-items/[id]/events/route.ts`
- `app/track/knowledge/components/ProjectInspector.tsx`
- `app/track/knowledge/components/ProjectCanvas.tsx`
- `tests/e2e/app.spec.ts`
- `~/.local/bin/lavish-axi` 指向的安装包、命令、许可证和实际数据流

## 已确认的产品事实

不要重新争论这些前提，除非代码或证据证明其内部矛盾：

- 产品帮助用户回到已经记不清进度的项目，迅速理解当前目标、已确认事实、进行中、阻塞或等待，并开始正确的下一步。
- Agent 持续记录变化，但只有变化可能推翻已确认的下一步、依据明确、存在具体动作且完成标准清楚时，才主动提出执行。
- 外部写操作必须由用户确认。
- 第一次真实执行已经确定：Agent 准备具体任务、操作对象、依据和完成标准；用户确认；Codex 修改代码并运行测试；结果写回项目。
- OpenConnector 负责有 API/Action 的 SaaS；它不是产品 Agent，也不是唯一执行器。
- GitHub Issue 目前只是 OpenConnector 技术验证候选，不是产品主行为。
- 主画布的职责是帮助用户判断现在该看什么，不是塞满全部资料。

## 你必须回答的问题

### 1. Lavish 解决的到底是哪一个问题

分别判断：

- 我们开发这个产品时，用 Lavish 审阅方案、截图、规格和代码结果。
- 最终产品为用户提供类似的“可视化结果、局部批注、反馈给 Agent、再次执行”能力。
- 直接把 Lavish 运行时或页面嵌入最终产品。

不要把这三件事混成一句“可以结合”。

### 2. 它应该出现在用户流程的哪里

以这条过程为基准：

`恢复项目 → 看懂当前状态 → 选择下一步 → 用户确认 → Codex 执行 → 代码/测试/截图写回 → 用户判断是否接受 → 正式更新项目状态`

逐段判断 Lavish 是否应该出现、解决什么摩擦、何时不应该出现。

### 3. 为什么它优于普通聊天、画布、代码评论或现有检查区

必须给出具体任务例子。若普通聊天或现有 UI 已经足够，明确说不需要 Lavish。

### 4. 最小产品行为是什么

不要设计通用 HTML 编辑器。给出一个可以独立验收的最小用户行为，包括：

- 触发条件
- 用户看到什么
- 用户能指出什么
- 反馈怎样回到同一次 Agent 执行
- 新版本怎样产生
- 哪一步才允许改变正式项目状态

### 5. 真实技术接入

比较并核实：

- 只把 Lavish 当外部开发工具，不改产品。
- 产品自己实现结果接受、退回、局部批注和版本记录。
- 直接依赖或嵌入 Lavish。

说明每条路径需要改哪些现有文件/API/数据结构，哪些能力可以复用，哪些不能假设。核实许可证、网络、分享默认值、凭证、数据本地性、部署和持久化风险。

### 6. 反方审查

找出至少五种“看起来很爽，但实际降低效率”的方式。尤其检查：

- 是否让每个简单结果都多一次审阅仪式。
- 是否把主画布变成结果展厅。
- 是否让漂亮页面替代证据和验收。
- 是否制造第二套事实来源。
- 是否与本机、无账号、数据跟机器走的边界冲突。

### 7. 最低成本实验

设计一个不改产品代码的实验：用当前产品的一次真实 Codex 交付，生成 Lavish 审阅页，让用户批注，再测量它是否减少定位反馈和返工。给出继续、调整、停止的标准。

## 研究方法

- 先查本地代码和 Lavish 安装包，不凭印象。
- 可使用 sub agent：建议分别负责产品价值、技术可行性、反方审查；拿到结果后互相交叉评审。
- 对事实标明文件、行号或命令；对推断明确写“判断”。
- 不把开源许可证、可嵌入性、API 或本地数据边界写成猜测。
- 不修改产品代码，不启动第二个 Lavish 审阅会话。

## 报告格式

写入指定独立报告，并在聊天中只回复最重要的结论、文件路径和阻塞。

报告必须包含：

1. `Executive verdict`：不超过 10 行。
2. 三种结合方式的比较：现在做 / 有证据后做 / 不做。
3. 一条完整用户过程，明确 Lavish 出现与不出现的位置。
4. 技术事实表：现有代码接点、Lavish 能力、许可证与风险。
5. 最小实验及量化判断标准。
6. 反方意见与停止条件。
7. 对下一份 SDD/BDD/TDD 开发文档应写什么、不应写什么的建议。

质量标准只有一个：当前 Codex读完后，能够直接决定是否进入产品、先做什么、哪些坚决不做，而不需要再猜你的意思。
