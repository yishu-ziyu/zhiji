# Q-05 / Q-06 Owner 决策输入：先找对来源，再诚实说明方法

- 输入：G3/G4/G5/G6 的 Q-05、Q-06 证据；D-10、D-11、D-15～D-18、D-20。
- 边界：这是来源优先级与检索方法的产品输入，**不是实现规格或接入授权**。G3B 的补充源码研究到达后追加，不改变本版当前事实。

## 建议的产品规则

检索不是“把所有地方一起搜”。主 Agent 每次先说明：**为什么要找、先查哪里、是否扩大范围、用了什么方法、为什么这条排在前面**。

默认顺序应是：

```text
当前项目真相
→ Owner 明确绑定的本地资料
→ 与问题匹配的结构化外部读（选定 GitHub 仓）或公开网页/官方资料
→ 浏览器回退（仅 API/公开资料不够时）
```

GitHub 与公开网页不是固定先后关系：解释该仓变化时，GitHub 结构化只读优先；核对产品规则、论文或公开事实时，公开网页/官方资料优先。浏览器永远不是默认路径。Drive 选定文件是后续试点；Gmail、全量同步、外部写入不在此范围。

## Q-05：来源地图与优先级

| 来源 | 何时用 | 授权与范围 | 新鲜度/引用 | 当前产品事实 | 目标行为 |
|---|---|---|---|---|---|
| 当前项目材料、卡、关系、工作项、事件 | 默认第一步 | 当前项目；不得因缺少 filter 变成全局库 | 材料/卡稳定 ID；被实际使用才成依据 | 材料、当前项目搜索、引用卡真实；全局读取仍有泄漏，版本/复查不足 | 强制 project scope；显示 reason/time；保留 revision 与复查原因 |
| Owner 绑定的本地文件夹、代码仓、笔记 | 项目材料不足且 Owner 指定路径 | 明确 root/picker；只在该范围内读 | 导入为项目材料或记录绑定路径/快照；变更需复查 | 文件夹导入与 Agent Bridge bind 部分存在；没有统一授权台账 | 显示“本地已绑定范围”，不做整盘搜索 |
| 选定 GitHub 仓的只读 API | 问题涉及该仓的提交、文件、Issue、PR、活动 | D-20 仅 `yishu-ziyu/fc-opc-ibot`，GET/read-only；扩仓/私有访问先问 | sha、路径@ref、对象号、稳定链接、抓取时间；命中候选 | 公共 REST 读取已隔离验证；没有产品路径 | 项目后按需读取；区分不可用、未授权、404、限流、真实空结果 |
| 公开网页、官方文档、论文 | 项目与选定结构化源不足，或用户明确研究 | public read-only；按 D-10/17 显示 provider/范围/授权状态 | URL、标题、摘录、抓取/最后核对时间；命中候选 | AnySearch client/API 存在；主工作台未接通，缺 grant/完整 trace | 显示“已扩大至公开资料”；不把 snippet 自动入知识 |
| Drive 选定文件 | GitHub/public 仍不足后的下一阶段 | Picker 选定文件、只读、可撤销 | file ID/revision/time；引用后才留依据 | 未接入 | 后续单一受限试点 |
| Gmail、日历、消息、企业系统 | 不属于第一批 | 单独连接、范围、期限、撤销；敏感/付费先确认 | 不做全量复制 | 未接入 | 后置，不假装已搜索 |
| 浏览器 | API/结构化来源无法回答且需渲染页或用户会话 | URL/登录/操作范围显式；高风险操作先确认 | URL、页面定位/截图、时间；高噪声标记 | Chijie 无产品调用入口 | 仅回退，不替代 API，不自动点击/外发 |

每次范围扩大必须产生一条紧凑记录：`reason, sourceClass, scope, provider, query, time, grant/notice, result locators, lastVerifiedAt/recheckReason`。命中默认候选；只有实际支撑判断或行动时才成为项目依据（D-16）。

## Q-06：诚实的方法集

| 方法 | 什么时候用 | Owner 应看见 | 当前事实 | 目标定位 |
|---|---|---|---|---|
| 精确关键词/元数据 | 文件名、短语、标签、来源、工作项状态明确时；默认首轮 | 项目范围；命中 title/body/tag/source 的原因 | **已有** substring 关键词与部分 filters；排序理由未展示 | v1 基础方法 |
| 关系查看/遍历 | 已有一条依据，追问支持、矛盾、上下游时 | 关系类型、方向、证据句；无关系要诚实提示 | **部分已有** neighbors/path；不是默认搜索阶段，真实数据常无关系 | 先作为显式 inspector，不称“混合搜索” |
| 结构化 GitHub 对象读 | 查仓变化、文件@revision、Issue/PR 时 | repo、GET/read-only、sha/对象链接、失败类别 | **研究验证存在**，产品未接入 | D-20 目标方法；不走浏览器抓页面 |
| 公开网页/官方资料检索 | 需要外部公开事实且项目内不足时 | provider、query、URL、抓取时间、候选标签 | **后端部分已有**；主界面未接通 | D-18 公开只读方法 |
| 语义相似 | 问题按意思表达、关键词不足时 | `semantic` 方法标签与模型/索引状态，或明确“当前未启用” | **不存在** embeddings/vector path | 未来可选，不能写成当前混合检索 |
| Agent 改写/多轮深挖 | 首轮无结果或证据不足时 | 原 query → 改写 query、理由、每轮来源/范围；可拒绝扩大 | **不存在** query planner；现有 Agent 是工作项复核 | 未来可选，不能写成当前能力 |

对每个结果，最低解释字段是：`method`、`why`、`source`、`scope`、`locator`、`time`。分数只能帮助排序，不能被呈现为事实置信度。

## 失败与回退规则

| 情况 | 产品应说什么 | 不可做什么 |
|---|---|---|
| 当前项目无关键词命中 | “当前项目无关键字命中”；建议 Owner 改写或允许下一来源 | 用无关卡片填充、假称语义已查 |
| 语义/Agent 方法未启用 | 明确“当前未启用”，退回关键词或请求扩大范围 | 把 keyword miss 伪装成 semantic 结论 |
| 无关系 | “没有可遍历关系” | 编造上下游 |
| Web/GitHub 失败 | 区分 provider 不可用、未授权、404、限流、真实空结果 | 空数组伪装为“没有变化”或 mock 当真 |
| 外部资料命中 | 保持候选并等待引用/确认 | 自动生成已确认知识、完成工作项或外写 |

## 当前行为与目标不可混淆

今天能诚实说的是：项目内关键词检索与材料引用可用；关系 API 和公开网页后端存在部分能力；项目外 GitHub 读取只有隔离证据。今天不能说的是：已混合语义检索、关系已自动补全、Agent 会多轮选工具、公开网页/GitHub 已在主工作台可用、或已经有 D-10/D-11/D-17 完整授权/新鲜度控制。

## 请 Owner 决定的范围

1. 是否确认上述“项目优先、任务匹配的结构化 API/公开资料第二层、浏览器最后”的来源顺序？
2. 第一版是否只承诺“关键词 + 显式关系查看 + 结构化 GitHub + 公开网页”，并把语义与 Agent 改写明确列为后续能力？
3. 范围扩大是否必须由 Agent 提示并显示，还是部分低风险公开检索可在预授权下自动并告知？建议沿用 D-10：预授权公开读可自动，但必须可见。
4. 关系在第一版是“显式查看”还是要进入默认检索排序？建议先前者，避免把当前没有的数据/证据句包装成混合检索。

## 证据

- `.ship/research/grok-followups/G4-Q05-source-map-fail-gates.md`
- `.ship/research/grok-followups/G5-Q05-source-trace-execution-map.md`
- `.ship/research/grok-followups/G6-Q05-source-map-owner-scenario.md`
- `.ship/research/grok-followups/G4-Q06-retrieval-method-fail-gates.md`
- `.ship/research/grok-followups/G6-Q06-retrieval-method-owner-scenario.md`
- `.ship/research/grok-followups/G3-Q05-first-external-read-execution-map.md`

