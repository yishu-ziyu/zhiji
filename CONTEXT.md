# CONTEXT — Knowledge Loop Agent

Shared language for this delivery cycle (freeze 2026-07-14 → submit ~7/18).

## Communication rules

1. Speak in direct, ordinary Chinese. Do not use industry shorthand or invented labels.
2. Never say “比赛第一刀”, “楔子”, “侧车” or “建账”.
3. State the conclusion, then the evidence, then the consequence. Keep the causal link explicit.
4. If a technical term is unavoidable, explain it in plain Chinese before using the code name.
5. No slogans, filler, vague claims or a question without explaining why the decision matters.
6. Research before claiming facts. 事事有调研.

## Mainline (frozen)

**主线 = 知识闭环。**  
路径：`/track/knowledge`  
一句话：搜得到 → 收成卡 → 能推进。  
不是编辑器，不是微信 CRM，不是客户变更主 demo。

## Domain terms

| Term | Canonical meaning | Avoid saying |
|---|---|---|
| Knowledge worker | 用检索、笔记、会议材料推进工作的人；首要用自身 | 「所有一人公司」空泛画像 |
| Knowledge card | 一条可复用、可溯源的事实或结论 | 随便一篇长笔记 |
| Source | meeting / email / chat / doc / manual | 无来源的「AI 总结」当事实 |
| Action item | 可执行任务 + 验收标准 + 状态 | 空待办标题 |
| Action status | todo → doing → confirmed → done | 任意自定义状态迷宫 |
| Knowledge loop | 检索 → 沉淀 → 行动 →（再检索） | 第二个 Notion |
| Gold script | 固定演示步骤，可重复 | 每次随机点 |
| Failure | 无来源结果、重启丢数据、状态推不动、与 Notion 说不清差异 | 仅 UI 报错码 |
| Legacy customer-change | `/track/efficiency` 已有代码；路演一句带过 | 主叙事 |

## Hard decisions

1. Track = **efficiency only**（电商已删）。
2. **Main product = knowledge loop**（用户 2026-07-14 冻结）。
3. Customer-change = **legacy**，不投入主 pitch。
4. 不主打个人微信私聊深度对接。
5. Agent = 理解/拆解候选；系统 = 保存事实；人 = 推进状态。
6. Visual: DESIGN.md（真黑 + 蜡笔红 + 暖纸 + 手写/mono）。
7. Quality: yishuship lite freeze + unit tests；E2E 金路径覆盖知识主流程。
8. Submit ~7/18，pitch ~7/19。
9. **2026-07-14 已从运行时删除**客户变更整线与电商入口；仓库只保留知识闭环可执行代码。

## Active task

`.ship/tasks/knowledge-mainline-20260714-174246/`

## Gold script (short)

1. 打开 `/track/knowledge`  
2. 搜「检索 来源」→ 看带来源的卡片  
3. 推进一条行动状态  
4. （可选）手记或粘贴会议入库  
5. 对评委：搜得到、收成卡、能推进。
