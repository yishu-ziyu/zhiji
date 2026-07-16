# Q-07 / Q-08 Owner 输入：结果先有身份，复用只复用可核对依据

- 输入：D-16 已锁定的生命周期规则；G3B 首批来源定位/新鲜度补充；G4 Q-07 fail gates；G5 Q-07/Q-08 执行地图；G6 Q-07/Q-08 Owner 场景。
- D-23：OA-01/Q-02 是唯一待答 Owner 问题。本文件不新增决策请求、不替代 OA-01，也不授权实现。

## 共同目标：一条结果不能跳级

无论结果来自项目材料、本地绑定目录、公开网页还是 GitHub 对象，都应以同一条可见链被理解：

```text
检索观察 → 候选 → 已引用项目依据 → Agent 候选判断
→ Owner 已确认知识/决定 → 待复查 / 被修订 / 被否决
```

这是 D-16 的产品行为要求，不要求此刻选定新的数据库或 claim schema。OA-01/Q-02 回答后，工程再决定用哪些已有对象或最小扩展承载它。

## Q-07：结果身份的目标与当前事实

| 身份 | 目标行为 | 当前产品事实 |
|---|---|---|
| 检索观察 | 搜到一条材料、URL 或 GitHub 对象；显示来源、范围、方法、时间、稳定 locator；不是事实 | 项目搜索命中的是已存 Card/工作/事件；网页 hit 是短暂 JSON；GitHub 只有研究 probe。没有统一 hit identity。 |
| 候选 | Owner/Agent 可保留“可能有用”，但不等于项目依据或确认知识 | 没有一等 candidate 对象/状态；打开项目搜索卡即面对已持久化 Card。 |
| 已引用项目依据 | 只在被判断、关系或行动实际引用时形成；可回点到源定位/版本 | `ActionItem.evidenceIds`、材料 `sourceFileId` 与 Relation evidence sentence 已能支撑一部分；自动材料卡、裸 `addCard`、minutes/MCP 可绕过“先候选再引用”；没有 immutable revision。 |
| Agent 候选判断 | 结果列出 Agent、时间、依据；始终候选 | `WorkEvent.result` 和 `meta.review.evidenceIds` 存在；没有一般的 candidate claim，且 Agent 会把工作项写成 `confirmed/待确认`，造成语义混淆。 |
| Owner 已确认知识/决定 | 仅 Owner 可确认；确认人、时间、所确认的具体 claim/decision 与依据可查 | relation/checkpoint/work status 有零散 confirm 词汇；没有通用知识确认对象，Agent/API 的工作状态不等于知识确认。 |
| 待复查/修订/否决 | 源变更、失效、冲突或 Owner 否决后保留旧链，标明原因与新旧关系 | 文件和 Card 可原地覆盖；Bridge 的 request stale 不是知识生命周期；没有 card revision/supersede 链。 |

### 不可混用的词

- 工作项的 `confirmed`（界面语义为“待确认”）不能被解释成“已确认知识”。
- 一个搜索命中或 Agent result 不能因为被展示、被存储或得到分数而成为已确认知识。
- `sourceFileId`、URL、GitHub branch 名都只是定位的一部分；对需要复核的依据还需 revision/hash 或可说明的“当时版本”。

G3B 的首批来源补充使这个区别可具体落地：项目材料目前只有路径 + mtime/size；本地导入是副本而非原目录版本；网页只有 URL/snippet；GitHub 可用 commit/tree/blob SHA 固定已引用版本。它们都需要在“被引用”时保留足够定位，而不是把一次检索时间当作永久新鲜度。

## Q-08：复用的目标与当前事实

复用单位应是**已引用项目依据**，而不是原始搜索列表、整页网页或 Agent 结论的复制品。

| 能力 | 目标行为 | 当前产品事实 |
|---|---|---|
| 同一依据多处使用 | 同一个稳定 evidence id 可被多个工作项、关系、判断和后续回答引用，不复制正文 | 同项目 `ActionItem.evidenceIds` 已按 id 复用；Agent review 也引用 evidence ids。 |
| 去重 | 同一 source locator + revision 在同项目只形成一个依据；同内容不同路径/URL 必须可提示合并而非静默重复 | 材料 `sourceFileId` 与 relation key 有局部去重；没有 content hash、外部 locator 唯一键或跨路径去重。 |
| 反向引用 | 打开依据即可看到引用它的工作项、关系、Agent result、判断与检索使用 | 画布能部分反查工作项，关系/事件各有碎片；没有完整 backlinks 视图或 API。 |
| 变更影响 | 某个依据 revision 变化、URL 失效或复核失败时，所有下游被标为待复查；不自动改写结论或关闭任务 | Agent Bridge 可使请求 stale；没有面向 Card/Action/Relation/result 的影响 fan-out。 |
| 跨范围复用 | 仍服从 Q-04：默认不跨项目；显式引用时记录来源范围 | 当前 `linkEvidence` 保护同项目，但没有 Owner-visible 跨项目 reuse 模型。 |
| SOP/草稿 | 以后若有 SOP 或草稿对象，它们引用同一 evidence id 并进入 backlinks，不创建隐形副本 | 当前没有这些一等对象，不能假称已复用。 |

## 当前产品能诚实交付的片段

1. `CONTEXT.md` 等项目材料能有卡片定位，并能被多个同项目工作项引用。
2. 工作项、关系和 Agent result 已有部分 evidence-id 引用；同一路径材料卡与同形 confirmed relation 有局部去重。
3. 项目关键词搜索能再次找到已有卡；公开网页 client/API 会返回短暂 hit，且不会在 route 内自动建卡。

这些片段不构成完整 Q-07/Q-08：没有候选身份、Owner-only 知识确认、不可变来源版本、完整反向引用或变更影响链。

## OA-01/Q-02 之后的最小一致验收语言

```text
我能看出一条结果现在只是命中、候选、依据还是已确认知识。
Agent 的结论仍是候选；只有我的确认能改变知识状态。
我能打开同一依据，看见它被谁引用；来源变了时，我看到需要复查什么，而不是旧结论被悄悄改写。
```

无论 OA-01/Q-02 选择如何，以上是 D-16、D-15、新鲜度和可核对引用的行为下限；具体持久化对象与工程切片继续 HOLD。

## 证据

- `.ship/research/G3B-Q05-Q06-first-retrieval-set-addendum.md`
- `.ship/research/grok-followups/G4-Q07-result-identity-fail-gates.md`
- `.ship/research/grok-followups/G5-Q07-result-identity-execution-map.md`
- `.ship/research/grok-followups/G5-Q08-reuse-impact-execution-map.md`
- `.ship/research/grok-followups/G6-Q07-result-identity-owner-scenario.md`
- `.ship/research/grok-followups/G6-Q08-result-reuse-owner-scenario.md`

