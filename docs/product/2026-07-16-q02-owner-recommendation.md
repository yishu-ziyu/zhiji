# Q-02 Owner 建议：先批准目标真相模型，不把当前代码当成已完成

- 输入：G4 `Q-02 knowledge-truth fail gates`、G5 最小实现地图、G6 `existing domain loop fit`。
- 边界：本建议不授权生产改动；Q-02 仍须 Owner 确认后才交工程。

## 建议

建议 Owner 批准 **方案 2 作为目标模型**：

```text
可核对原件 + 结构化知识/依据 + 行动与事件
→ 关键词、语义、关系投影只用于检索加速，可重建
```

这批准的是产品的“什么算真相”规则，**不是**“当前实现已经满足该规则”，也不是新建事件账本或向量库的授权。

## 目标规则（批准后必须成立）

| 层 | 产品规则 |
|---|---|
| 原件 | 每一份被引用的文件/网页/外部对象都有稳定 ID、时间与不可变 revision/hash；后续更新产生新 revision，不抹去旧依据。 |
| 结构化知识 | Card/Relation/claim 是候选、已引用、已确认、过期/被推翻等可见状态；关系必须明确是结构化知识还是可重建投影。 |
| 行动与事件 | 工作项和事件保存责任、动作、结果；结果是新依据，不自动成为已确认知识或完成任务。 |
| 人的终判 | Agent 只能产生候选、草稿与 result 事件；只有 Owner 的可审计动作能确认知识/决定或完成任务。 |
| 索引 | keyword/semantic/图检索不能是唯一真相；丢失后可从上述真实记录重建。 |

## 当前实现：可复用骨架，不是方案完成

现有对象已经能表达前六段：`MaterialFile → KnowledgeCard → KnowledgeRelation → ActionItem → WorkEvent(result)`。真实 scion 项目能看到材料与来源卡；关系、工作项和事件在当前真实数据里尚未完整填充，但模型和代码路径存在。

当前缺口不能被“已有这些类型”掩盖：

| 缺口 | 为什么阻塞“当前实现已符合 Q-02” |
|---|---|
| 原件可被同一路径覆盖 | 没有 revision/hash，后来无法证明某个判断引用的是哪一版原文。 |
| Agent 可写 `confirmed` | `agent-run` 用 Agent actor 把工作项推进到人类确认语义，违背 D-15/D-16。 |
| result 没有知识回流对象 | result 只停在 WorkEvent/工作项；不会形成带来源的候选 Card/Relation/claim 更新。 |
| 已确认知识没有显式 supersede 规则 | Card/材料可原地重写，历史依据没有版本链。 |
| 读范围与关系语义未收紧 | project filter 不是所有读取的硬要求；Relation 目前是持久记录而非纯可重建索引。 |

因此应使用两个不同的结论：

1. **目标方案：建议批准方案 2。** 这是产品规则与后续设计的共同基线。
2. **当前实现：不可标记为 Q-02 已完成。** 在以下最低规则落地并验证前，不能声称已交工程完成。

## 最小工程前置条件（不是本次实施任务）

1. 原件 revision/hash 与依据的稳定回点；确认知识只能追加 revision 或显式 supersede。
2. 服务器硬禁止 Agent/system 设置人类门状态或确认知识；先移除现有 Agent 自确认。
3. result 以候选知识变化回流，或 Owner 明确决定“result 只留事件、不回流知识”；无论哪种都不可自动确认。
4. 产品读取默认项目硬隔离；跨项目规则见 Q-04。
5. 明确 Relation 是有确认生命周期的知识记录，还是可重建索引；不能混用。

最小的独立安全切片是第 2 项：禁止 Agent 自确认。它不依赖最终 Q-02 细节，但不等于已实现或已授权。

## Owner 可用的一句话

> 我们批准“原件、知识、行动事件各有真相；索引可重建”的目标，不批准把今天的 Card/文件/Agent 状态直接说成已经做到：旧版本可核对、结果已回流、且只有我能确认。

## 证据

- `.ship/research/grok-followups/G4-Q02-knowledge-truth-fail-gates.md`
- `.ship/research/grok-followups/G5-Q02-confirmation-result-execution-map.md`
- `.ship/research/grok-followups/G6-Q02-existing-domain-loop-fit.md`

