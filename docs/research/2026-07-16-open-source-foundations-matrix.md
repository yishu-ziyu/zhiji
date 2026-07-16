# 开源基础能力候选矩阵

日期：2026-07-16。范围：D-04、D-06、D-07、D-10～D-16 与 Q-02～Q-20 的源码级候选调研；不构成产品架构选择。

## 先给结论

当前产品应继续把 `Material`、`KnowledgeCard`、`KnowledgeRelation`、`ActionItem`、`WorkEvent` 作为项目真相层。解析器、索引、图、Agent 或 workflow 引擎只能通过明确 adapter 读写这些对象，不能替代它们。

- 当前最低成本的 **candidate/spike**：**MiniSearch**（MIT）用于 project-scoped 关键词索引；它已在隔离 spike 证明 `projectId` 过滤可用，但尚未通过 T-11 adoption record。
- 条件复用：**Orama/Qdrant** 做可重建的语义/混合索引；**Unstructured 或 Docling** 做二进制材料解析侧车。
- 仅在明确场景后 spike：**Temporal**（耐久长流程）、**LangGraph**（checkpoint/HITL）、**Graphiti/Jena**（时间图或 quad 查询）、**OpenHands SDK**（隔离执行）。
- 不作为产品核心依赖：Wikibase、lakeFS、RAGFlow、Dify/LlamaIndex/Haystack 整框、GraphRAG/LightRAG；其模型或子能力可借鉴，但整吞会把产品真相与运行栈交给外部框架。

## 已锁定的边界

| 约束 | 落到所有候选的实现要求 |
|---|---|
| D-04 / D-06 / D-07 | 复用优先、但不授权把开源框架当产品业务本体；生产实施仍暂停，任何 spike 要单独派工。 |
| D-10 检索授权 | 产品内检索可自动；预授权外部源可自动，但必须在结果中可见地告知；敏感、付费、未授权源必须在调用前等待确认。 |
| D-11 知识新鲜度 | 来源有效期优先；新版本、冲突和项目变化触发复查；类型周期只提醒；实时任务强制重检；历史保留，并显示最后核对时间和复查原因。 |
| D-12 主 Agent | 用户只面对一个负责任的主 Agent；内部可调用专业 Agent、模型与工具，但不能把内部拓扑或责任转嫁给用户。 |
| D-13 可审 OSS 选择 | 每项后续建议必须固定 tag/commit，列具体源码文件/符号、采用行为、现有 TS 映射、许可证与传递许可证审计、验证/差异/退出边界；只列项目名不构成建议。 |
| D-15 有边界的自动化 | 项目内读取/检索/整理/candidate/draft 可自动；对外发送、删除、付费、敏感与未授权访问必须先确认；自动输出不能自我确认。 |
| D-16 检索→知识生命周期 | 每次检索保留 query/reason/scope/sources/time；实际支撑判断或行动的结果才成为稳定项目依据；Agent 结论是 candidate；Owner 确认后才成为 confirmed knowledge/decision；结果回流复查。 |
| Q-07 | 命中只是候选；只有被引用/保存并带稳定定位快照后才成为项目依据。 |
| Q-14 | 执行事件绑定精确输入、输出、验证和 actor；失败同样写回，但 Agent 不能自证或把结果自动升格为已确认知识。 |

因此每个 connector/Agent adapter 必须统一提供：`sourceClass`（internal/preauthorized/sensitive/paid/unapproved）、`authorizationDecision`、`noticeShownAt`、`operationClass`（internal-read/candidate-draft/external-send/delete/payment/sensitive/unapproved）、`confirmationId`、`confirmedBy`、`actor`、`query`、`reason`、`scope`、`sources`、`searchedAt`、`resultLocator`、`capturedAt`、`sourceExpiresAt`、`lastVerifiedAt`、`recheckReason`、`inputRevision`、`eventId`。实时任务还必须记录 `freshnessCheckAt` 和所用 revision。没有这些钩子的候选只能留在执行器/解析器层，不能直接承担授权、确认、通知、审计、新鲜度或 D-16 生命周期决策；任何自动 output 只能写 candidate/draft，不能自我确认。

## 统一候选矩阵

本矩阵是候选输入而非依赖清单。表中所有上游 `main` 路径只证明当日研究线索；任何实施提案必须按 **T-11 adoption record** 把那一格升级为 D-13 记录：固定 tag/commit、文件/符号、拟采用的**具体行为**、对应的 `app/`/`shared/` TypeScript seam、直接与传递许可证、最小验证、与产品要求的差异，以及可迁移的退出边界。未完成此记录，候选只能写为 `candidate` 或 `spike`，不能写为 `adopted`，也不能引入依赖、fork 或架构结论。

| 能力 / 对应问题 | 候选（许可证） | 已检查源码证据 | 建议接入 | 授权、通知、审计适配 | 集成 / 退出成本 |
|---|---|---|---|---|---|
| 本地关键词检索 Q-05～Q-08 | MiniSearch（MIT） | `src/MiniSearch.ts`: `addAll`、`search`、filter；`LICENSE.txt` | **T-11 后的 direct-dependency candidate**，藏在 `searchKnowledge` / `searchProjectRecords` façade 后 | 只索引当前获授权项目；命中带 `projectId`、material/card ID、检索方法和 query event | 低 / 低 |
| 进程内混合检索 Q-06 | Orama（Apache-2.0） | `packages/orama`、`plugin-embeddings`、`plugin-parsedoc`、`plugin-data-persistence` | 语义需求成立后做 adapter | adapter 强制 project filter；embedding/index 仅为可重建投影，记录模型与索引版本 | 中 / 中 |
| 向量索引 Q-06 | Qdrant（Apache-2.0） | collections 与 payload filter 服务边界（G3 证据） | 小规模先不用；跨材料语义检索需要时 adapter | payload 必含 project/scope/revision；查询事件仍在产品审计；不得把向量命中升格为事实 | 中 / 中 |
| PDF/Office/mail 解析 Q-05、Q-09 | Unstructured（Apache-2.0） / Docling（MIT） | Unstructured `unstructured/partition/auto.py`、`partition/*`、`chunking/*`；Docling `document_converter.py`、`document_extractor.py`、`chunking/`、`pipeline/` | Python sidecar，输出结构化 element → Material | 调用前由 connector 判 D-10；保存原文件 locator、解析版本、element locator；付费/敏感文件先确认 | 中 / 中 |
| 大型解析/RAG 整体 Q-05～Q-09 | RAGFlow DeepDoc（Apache-2.0）、Haystack（Apache-2.0）、LlamaIndex（MIT） | `deepdoc/{parser,server,vision}`；Haystack `components/{converters,preprocessors,embedders,retrievers,rankers}`；LlamaIndex core/integrations | 只借解析/管道模式；不作为产品核心 | 框架自身的 document/index 状态不替代产品 audit/provenance | 高 / 高 |
| 外部/服务端混合搜索 Q-06 | Meilisearch（MIT AND BUSL-1.1） | `LICENSE*`、`crates/milli`、hybrid settings | 可选 HTTP adapter；先做许可证边界审查 | query gateway 执行 D-10，记录 source class、notice/confirmation；禁止 EE/BUSL 路径混入未审生产包 | 中 / 中+许可 |
| 关系检索 Q-06、Q-08 | 产品已有 relations/path；GraphRAG（MIT）、LightRAG（MIT） | GraphRAG `graphrag-*` packages；LightRAG `lightrag.py`、`operate.py`、`kg/`、`pipeline.py` | **先保留产品关系**；多跳叙事被证明需要时才 spike | 图检索返回 relation/card IDs 与路径证据；任何 LLM 生成边均是 proposal | 高 / 高 |
| 时间性、来源与图 Q-02～Q-04、Q-08～Q-11、Q-17 | Graphiti（Apache-2.0） | `graphiti_core/nodes.py`（`group_id`/Episodic）、`edges.py`（episode、valid/invalid/expired/reference time）、`edge_db_queries.py` | adapter/reference，非 TS 主库 | `valid_at`/`invalid_at`/`expired_at` 可作 D-11 来源变更触发线索；最终复查原因、last-verified 和实时强制重检由产品 adapter 审计 | 高 / 高（只读 adapter 中高） |
| claim/reference/revision 语义 Q-03、Q-08～Q-11 | Wikibase（GPL-2.0-or-later） | `Statement.php`、`Reference.php`、`EntityRevisionLookup.php`、`ChangeOpStatementRank.php` | **只借鉴语义**：claim GUID/reference/rank/revision | 有 forbidden-access 思路，但 GPL/PHP 栈不宜接入；产品自建 command/audit 才能执行 D-10 | 极高 / 极高 |
| named graph / 事务 Q-02、Q-04、Q-11、Q-17 | Apache Jena（Apache-2.0） | `DatasetGraph.java`、`DatasetGraphTDB.java`、`jena-fuseki/` | 关系规模/跨项目治理明确后再 Java sidecar spike | named graph 不等于权限；SPARQL gateway 必须附 scope、actor、query audit | 高 / 中高 |
| 原始材料快照 Q-02、Q-08、Q-11、Q-14 | lakeFS（Apache-2.0） | `pkg/graveler/` commit/branch/ref、`api/` | 只在对象存储与审计规模需要时评估 | snapshot version 可作为 D-11 的“新版本”触发；不承担 claim lifecycle、用户授权或复查策略 | 高 / 高 |
| 耐久工作流 / 重试 / 结果 Q-12～Q-14、Q-17 | Temporal TypeScript SDK（MIT） | `packages/workflow/src/interfaces.ts`、`workflow.ts`、`packages/client/src/workflow-client.ts` | 长运行、重试、跨 worker 需求被验证后再隔离 spike | workflow 启动前在产品 policy gateway 判 D-10；approval 不可用 retry 绕过；history/event IDs 回写 WorkEvent | 高 / 高 |
| checkpoint、HITL、工具调用 Q-12～Q-14、Q-17 | LangGraph（MIT） | `types.py`（`RetryPolicy`/`interrupt`/`Command`/`Send`）、checkpoint base、`tool_node.py` | Python adapter/spike；不是 Next 进程直依赖 | interrupt 只提供暂停原语；确认、通知和审计仍由产品 policy/event model 负责 | 中高 / 中高 |
| 隔离 Agent 执行 Q-13、Q-15、Q-17 | OpenHands Software Agent SDK（MIT） | `agent.py`、`conversation/state.py`、`confirmation_policy.py`、`event/base.py`、`local_conversation.py` | 仅作受控执行器候选 | 可映射 confirmation/event/tracing；T-11 必须证明 confirmation 在调用前并由产品人类 gate 记录，且输出只能 candidate/draft，不能 self-confirm | 中高 / 高 |
| Agent 身份/记忆/工具规则 Q-15～Q-17 | Letta（Apache-2.0） | `schemas/agent.py`、`schemas/memory.py`、`agent.py` | 参考或高成本 adapter；非 workflow 引擎 | 自有 AgentState/memory 不能成为项目真相；T-11 必须证明其 tool rules 不绕过 D-15，产品保留 identity、scope、approval 与 immutable events | 高 / 高 |

## 对 Q-02～Q-20 的可执行回答框架

| 问题组 | 本轮证据收束的产品不变量 | 可复用边界 |
|---|---|---|
| Q-02～Q-04 知识对象、状态、范围 | 真相为 project-scoped objects + stable typed refs；版本/冲突 append-only；跨项目可见性由产品权限判定 | Graphiti/Jena 只做 read-side 图投影；Wikibase 仅借模型语义 |
| Q-05～Q-08 来源、检索、候选与复用 | 每次检索留下 query/reason/scope/sources/time；connector → Material → cited Card → rebuildable index；hit/Agent output 先是 candidate，只有支撑判断/行动才成为稳定依据，Owner 确认后成为知识/决定；稳定引用绑定精确 revision 并可反查影响 | MiniSearch 是最低成本 candidate；Orama/Qdrant/parse sidecar 按需求加；Graph RAG 后置 |
| Q-09～Q-11 生命周期、可信度、更新 | agent extraction 是 proposal；人确认/否决/过期/合并是可审命令；历史不覆盖，旧 revision 继续支撑旧行动。D-11 的复查优先序为：来源有效期 → 新版本/冲突/项目变化 → 类型周期提醒；实时任务强制重检。 | 借 Graphiti time edges/Wikibase rank+revision；不要引入整个系统 |
| Q-12～Q-14 工作流、权限、结果回流 | action 有 inputs、actor、state、approval、verification、outputs/result event；retry 不能越过 approval；失败也有证据价值。D-15 允许内部 read/candidate/draft 自动化，但外发/删除/付费/敏感/未授权操作必须 confirmation-before-call，且自动 output 不得 self-confirm。实时任务的 workflow 输入必须包含 freshness check 成功的精确 revision。 | Temporal/LangGraph/OpenHands 只在对应运行问题出现时 spike |
| Q-15～Q-17 Agent、多 Agent、审计 | D-12 下用户只面对一个主 Agent；内部专业 Agent/模型/工具是受 scope/工具/权限约束的协作实现。共享真相只有产品 repository；并发写入用 revision/locking 与 event trail | Letta/OpenHands 供内部身份/执行器参考，非替代主 Agent、真相层或用户控制面 |
| Q-18～Q-20 循环验证、指标、开源选择 | 三个端到端场景应测“可引用、可确认、可执行、可回流”；选择以源码、许可、部署、可替换性和真实 spike 为证据 | 所有候选先 adapter；只有产品缺口被验证后才扩展依赖 |

## 已验证、未验证与后续

- 已验证：MiniSearch 7.2.0 隔离 spike 中 `projectId` filter 通过；`npx vitest run shared/knowledge/search.test.ts shared/knowledge/folder-import.test.ts shared/knowledge/materials.test.ts` 为 18/18，通过，exit 0。
- 未验证：二进制解析质量、embedding/向量召回、Temporal/LangGraph 的真实项目 event 回写、D-10 确认 UX/审计字段，以及 D-11 触发与实时重检 UX。它们均需新 assignment、独占文件和真实项目样本。
- 当前不应做：引入 Python/Java worker、向量数据库、耐久 workflow server，或把外部框架的数据模型迁入生产代码。
- 后续选择门槛（D-13）：固定 upstream tag/commit；重新审直接与传递许可证；把源码行为映射到一个现有 TypeScript seam；隔离 spike 证明差异；明确数据/事件/索引的退出迁移路径。
- D-15 候选门槛：任何 Agent/workflow/tool candidate 必须在 T-11 证明“确认在高风险调用之前”、确认由人类 actor 留痕、自动输出保持 candidate/draft、没有 framework status/tool policy 可自我确认或绕过 D-10/D-15；否则只能作为研究反例，不能进 spike。
- D-16 候选门槛：任何 retrieval/knowledge candidate 必须在 T-11 证明可保留检索轨迹与稳定引用；它可以返回 hit/candidate，却不能把命中、Agent 结论或执行结果自动提升为 confirmed knowledge，也不能让索引成为项目真相层。

## 证据来源

- G3 ingestion/retrieval：`.ship/handoffs/G3-ingestion-retrieval-DONE.md`、`.ship/handoffs/G3-TO-G1-ingestion-retrieval-summary.md`、`tmp/g3-ingest-retrieval-spike/`。
- G3A lifecycle：`.ship/handoffs/G3A-knowledge-lifecycle-DONE.md`。
- G3B workflow/Agent：`.ship/handoffs/G3B-open-source-workflow-agent-DONE.md`、`.ship/research/open-source/G3B-workflow-agent.md`。
- 上游 URL、许可证和逐文件符号路径均记录在三条 DONE 证据中；实现前必须固定 tag/commit，并复核顶层与传递许可证。
