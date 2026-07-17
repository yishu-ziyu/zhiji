# 项目情报 Agent · 比赛版开发说明

> 目标：在 `/track/knowledge` 内做出一条可录视频、可核验、不伪造的“重新进入项目”闭环。
> 叙事源：`docs/product/交付叙事与Agent业务逻辑.md`
> 状态源：`docs/product/产品清单.md` §3。本文是实现合同，不是第二份问题台账。

## 一、只做这一件事

当 Owner 重新进入一个已授权的真实项目时，Agent 真正读取项目，形成一份最小项目情报简报，并让 Owner 完成一个下一步决定。

极致工程不是继续增加架构层数，而是把这条最短真实闭环做稳：**真读、真依据、真状态、真确认、真恢复；任何失败都不伪装成功。**

## 二、用户必须看见的结果

1. 打开桌面客户端或 `/track/knowledge`，自动回到最近项目。
2. 未授权时，用户只需要选择项目文件夹并确认实际读取范围。
3. Agent 开始后，右栏显示真实的建图、搜索、读取、分析步骤；状态跟 Tool Receipt 走。
4. 完成后，右栏优先出现一份“项目情报简报”，而不是原始文件堆：
   - 当前判断；
   - 为什么现在重要；
   - 关键依据；
   - 相反证据或限制条件；
   - 关键未知；
   - 现在需要你决定什么。
5. 每条重要 Claim 都能点到授权范围内的精确 Revision 和片段。
6. Owner 可以逐条接受、修改、拒绝或暂缓；未确认内容不能显示成正式事实。
7. Agent 的下一步只能显示为“建议”；Owner 确认前不得自动创建正式任务或宣称已执行。
8. 刷新、切换项目再回来，Owner 的决定和当前判断仍然存在。
9. 模型、工具或依据失败时，显示失败或不知道，不生成假简报。

## 三、对象与现有实现的对应

| 产品对象 | 比赛版含义 | 优先复用 |
|---|---|---|
| Project | 授权和数据边界 | 现有 knowledge project / SourceGrant |
| Matter | 当前需要持续判断的问题 | 现有 Matter、WatchSet、Memory |
| Run | 一次真实分析过程 | 现有 analysis-runs + SSE/轮询 + receipts |
| Claim | 可逐条核验的最小判断 | 现有 Claim service / ClaimReviewPanel |
| Evidence | Claim 与精确 Revision 的支持、反驳或限制关系 | 现有 evidence anchor / link |
| Brief | 面向 Owner 的当前判断读模型 | 从 Matter + Candidate + Claims + resolutions 组装；不要另造真源 |
| WorkSuggestion | Agent 建议的下一步 | 只展示建议身份，不直接转正式 Work Item |
| Owner Resolution | 人对 Claim 或建议的裁决 | 现有 claim-resolutions / Project Memory |

第一版不必实现通用“竞争性假设系统”。只要简报能诚实展示支持依据、限制条件和未知，就已经证明分析纪律。以后再把多个 Hypothesis 变成正式对象。

## 四、界面落点

- 不新增页面；入口仍只有 `/track/knowledge`。
- 简报进入右侧 Inspector，位于原始动态和长对话之前；画布仍只展示当前焦点的一跳关系。
- 复用 `ProjectInspector`、`AgentPresenceRail`、`ClaimReviewPanel`，不要再造第二套 Agent 面板。
- 首屏只强调一个判断和一个待决定问题。Run 过程可展开，但不能用“正在思考”或固定百分比替代真实状态。
- Mini Map、时间线和原始材料在本次任务中只做配角，不再扩大功能。

主要代码入口：

- `app/track/knowledge/page.tsx`
- `app/track/knowledge/components/ProjectInspector.tsx`
- `app/track/knowledge/components/AgentPresenceRail.tsx`
- `app/track/knowledge/components/ClaimReviewPanel.tsx`
- `app/track/knowledge/workbench/`
- `app/api/knowledge/projects/[id]/analysis-runs/`
- `app/api/knowledge/projects/[id]/claim-resolutions/`
- `shared/project-memory/claims/`

## 五、最短实现顺序

### A. 冻结简报读模型

先定义纯函数，把现有 Matter、Candidate、Claims、Evidence 和 Owner Resolution 组装为 Brief。Brief 不单独持久化，不成为新的真源。

最小字段：

```ts
type ProjectIntelligenceBrief = {
  matterId: string;
  currentJudgment: string;
  whyNow: string;
  claimIds: string[];
  contraryOrLimits: string[];
  unknowns: string[];
  decisionPrompt: string;
  suggestion?: { text: string; status: "suggestion" };
  sourceRevisionIds: string[];
  generatedFromRunId: string;
};
```

字段缺失时宁可显示“尚不能判断”，不要用模板文字补成完整故事。

### B. 接通真实状态

- Run 只有收到对应 Tool Receipt 后才能推进 UI 步骤。
- Brief 只能来自成功 Run 的 Candidate；失败 Run 不得沿用旧 Candidate 冒充本次结果。
- 每个 Claim 必须逐条绑定 Evidence Link 和精确 Revision；不能只给整段简报挂一个文件。
- 普通聊天继续只进入 Dialogue Memory；只有显式 Owner Resolution 才能改变正式项目理解。

### C. 做一张强简报卡

先把右栏这一张卡做到可直接录屏：层级清楚、文字短、依据可点、未知可见、底部只有一个待决定问题。不要为本次 Demo 重做整张画布。

### D. 固定真实演示项目

优先使用 zhiji 自身：让 Agent 判断“工程已打包和测试，但 Owner 黄金路径尚未完成，因此还不能声称 accepted”。

演示材料必须来自真实文件和当前版本。录制前冻结材料副本或提交哈希，保证引用不会在并行开发中漂移；不得把 `e2e`、`smoke`、`fixture` 等测试标题放进默认中心视图。

## 六、视频黄金路径

```text
打开 .app
→ 最近项目出现
→ 授权真实项目夹（已授权可略过）
→ Agent 真实 map / search / read
→ 出现一份项目情报简报
→ 打开一条 Claim 的精确依据
→ 回到简报，看见未知与一个待决定问题
→ Owner 接受或修改判断
→ 刷新 / 重进，决定仍在
```

视频中不要展示调试台、测试命令、密钥、假进度或尚未实现的未来能力。等待时间可以剪辑，但不能把一次预制结果说成实时运行；口播应明确哪些画面经过时间压缩。

## 七、验收门

以下任一发生，本次 Demo 不得称为完成：

- 未经授权就读取文件；
- 没有 map / search / read 收据就生成当前判断；
- Claim 点不到精确 Revision；
- 聊天自动成为项目事实；
- Candidate 或 WorkSuggestion 显示成已确认事实/正式任务；
- 模型失败后仍显示“分析完成”；
- 点击确认后刷新丢失；
- 为演示新增第二入口或第二套产品面；
- 使用测试数据、固定进度或预制成功状态冒充真实 Agent 运行。

工程完成后只报告：改动路径、每个用户行为看到什么、真实验证证据、剩余风险。状态写 `implemented` / `tested` / `packaged`；只有 Owner 走完视频黄金路径并说“过”，才能写 `accepted`。

## 八、本轮明确不做

- 通用多 Agent 协作；
- 自动监控全机或扩大授权范围；
- 完整竞争性假设工作台；
- 自动修改源项目文件或执行任意命令；
- 自动把建议转成正式任务；
- 新的入口、第二套导航或大规模视觉重构；
- 为了“看起来像 Agent”增加无法验证的动画和进度。
