# G3A · knowledge lifecycle · DONE

- Assignment: `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/handoffs/TEAM-WAVE-open-source-foundations.md`, G3A knowledge lifecycle lane.
- Worktree: `/Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/12/fc-opc-ibot`; HEAD `b8ac6077645b03216425851812c9b1094321d5da`; detached isolated worktree.
- Scope: provenance, stable references, claim/knowledge state, versioning, conflict, graph relations, scope, permissions, downstream impact. No production business code changed.

## Result

结论：产品当前应继续以自己的 project-scoped `KnowledgeCard` / `ActionItem` / `WorkEvent` / `KnowledgeRelation` 记录为真相层；开源项目只通过薄 adapter 或 sidecar 提供缺失的时间图、RDF/quad、材料快照能力。没有候选适合直接替换现有 TypeScript/JSON 领域模型。

### 候选与源码证据

1. **Graphiti (`getzep/graphiti`) — Apache-2.0 — adapter/reference**
   - Source: `graphiti_core/nodes.py`（node UUID、`group_id` 分区、Episodic node、按 group 删除）；`graphiti_core/edges.py`（EntityEdge 的 `episodes`、`valid_at`、`invalid_at`、`expired_at`、`reference_time`、UUID）；`graphiti_core/models/edges/edge_db_queries.py`；`pyproject.toml`；`LICENSE`。
   - Primary: https://github.com/getzep/graphiti · https://github.com/getzep/graphiti/blob/main/graphiti_core/nodes.py · https://github.com/getzep/graphiti/blob/main/graphiti_core/edges.py · https://github.com/getzep/graphiti/blob/main/LICENSE
   - Fit: provenance、时间有效性、事实失效但保留历史、关系图、按 group 查询/删除；可映射 Q-02/Q-04/Q-08/Q-09/Q-10/Q-11/Q-17/Q-20。
   - Integration cost: high — Python service, Neo4j/FalkorDB/Neptune/Kuzu，以及 embedding/LLM 运行依赖；需将 project/source/revision 映射到 group/episode/edge。
   - Exit cost: high — 图 schema、UUID、episode 回填和索引迁移；若只做 read-side adapter，可把退出降为中高。
   - Boundary: `group_id` 是分区，不等于产品授权；不能让 Graphiti 自动确认 claim 或绕过 Owner verification。

2. **Wikibase (`wikimedia/mediawiki-extensions-Wikibase`) — GPL-2.0-or-later — model reference only**
   - Source: `lib/packages/wikibase/data-model/src/Statement/Statement.php`（GUID、qualifiers、references、preferred/normal/deprecated rank）；`lib/packages/wikibase/data-model/src/Reference.php`（Snak 集合与 hash）；`lib/includes/Store/EntityRevisionLookup.php`（按 revision/latest revision 读取、拒绝 forbidden access）；`repo/includes/ChangeOp/ChangeOpStatementRank.php`（显式状态变更与并发编辑冲突）；`COPYING`、`composer.json`。
   - Primary: https://github.com/wikimedia/mediawiki-extensions-Wikibase · https://doc.wikimedia.org/Wikibase/master/php/classWikibase_1_1DataModel_1_1Statement_1_1Statement.html · https://doc.wikimedia.org/Wikibase/master/php/classWikibase_1_1DataModel_1_1Reference.html · https://doc.wikimedia.org/Wikibase/master/php/interfaceWikibase_1_1Lib_1_1Store_1_1EntityRevisionLookup.html · https://www.mediawiki.org/wiki/Extension:Wikibase
   - Fit: stable claim GUID、来源 reference、rank/弃用状态、revision、可拒绝访问、显式 ChangeOp；最贴 Q-03/Q-08/Q-09/Q-10/Q-11/Q-17/Q-20。
   - Integration cost: very high — MediaWiki/PHP/Composer/数据库及其扩展服务，不适合当前 Next.js/TypeScript 进程。
   - Exit cost: very high — GPL 运行栈与数据模型绑定；建议只借鉴 claim/reference/revision 语义，不直接依赖或 fork。

3. **Apache Jena — Apache-2.0 — sidecar/reference**
   - Source: `jena-arq/src/main/java/org/apache/jena/sparql/core/DatasetGraph.java`（named graph、quad、事务接口）；`jena-tdb2/src/main/java/org/apache/jena/tdb2/store/DatasetGraphTDB.java`；`jena-fuseki/`；`LICENSE`、`NOTICE`。
   - Primary: https://github.com/apache/jena · https://github.com/apache/jena/blob/main/jena-arq/src/main/java/org/apache/jena/sparql/core/DatasetGraph.java · https://github.com/apache/jena/blob/main/jena-tdb2/src/main/java/org/apache/jena/tdb2/store/DatasetGraphTDB.java · https://jena.apache.org/documentation/tdb2/index.html
   - Fit: named graph/quad 可承载项目范围、来源图与关系；TDB2 事务适合一致写入；对应 Q-02/Q-04/Q-08/Q-11/Q-17/Q-20。
   - Integration cost: high — Java sidecar、RDF/IRI/quad mapping、SPARQL 边界与部署；直接引入会重复当前 repository。
   - Exit cost: medium-high — 若只经 SPARQL/HTTP adapter 可控；若业务对象变成 RDF 本体则迁移成本高。

4. **lakeFS (`treeverse/lakeFS`) — Apache-2.0 — material snapshot reference only**
   - Source: `pkg/graveler/`（commit/branch/ref 版本控制核心）、`api/`、`README.md`、`LICENSE`。
   - Primary: https://github.com/treeverse/lakeFS · https://docs.lakefs.io/project/ · https://docs.lakefs.io/dev/
   - Fit: 原始材料/导出物的 branch、commit、merge、rollback、可重现快照；对应 Q-02/Q-08/Q-11/Q-14/Q-20；不表达 claim state、reference 或关系语义。
   - Integration cost: high — 独立 server、S3/Azure/GCS/object-store、hooks 与运维；当前本地 JSON knowledge store 不需要它。
   - Exit cost: high — 存储 provider、ref/commit 语义与下游读写都需迁移；只在材料规模/审计需要时再评估。

## Q mapping

| Q | 业务不变量 | 源码证据与判断 | G3A建议 |
|---|---|---|---|
| Q-02 | 原件、结构化知识、行动/事件通过稳定 ID、来源、时间、版本、项目边界连成可重建循环 | 产品已有 `KnowledgeCard.id/projectId/source/timestamp/sourceFileId`、`ActionItem.evidenceIds`、`WorkEvent`、`KnowledgeRelation`；Graphiti episode→edge、Wikibase claim/reference/revision、Jena quad 可供映射 | 产品对象继续做真相层；检索/图为可重建投影，禁止把向量/图当唯一本体 |
| Q-04 | 默认不跨项目可见；范围与授权可核验 | 产品使用 projectId；Graphiti `group_id` 只做分区；Jena named graph 可做范围边界；Wikibase revision lookup 可拒绝 forbidden access | 授权必须在产品 adapter/repository 校验；group/graph 不能替代权限 |
| Q-08 | 稳定引用、去重、反向引用、变更影响可追踪 | 产品 `evidenceIds`、relation `evidenceSentence`、`relationDedupKey` 与 status 已有骨架；Wikibase GUID/reference hash、Graphiti UUID/episodes 是可借鉴实现 | 为 source/claim/work/result 设计稳定 typed refs 与 reverse impact 索引；保留精确 revision |
| Q-09 | 接收、解析、提取、关系、确认/否决、合并、过期、归档由清晰状态控制 | Wikibase ChangeOp 可显式改 rank/reference；Graphiti episode 增量写入与事实 invalidation；lakeFS hooks 可做材料质量门 | 自动抽取只能 proposal；Owner 才能 confirm/reject/supersede；状态变更写 WorkEvent |
| Q-10 | 来源、快照、作者/Agent、时间、新鲜度、置信与确认差异必须可解释 | Graphiti episode provenance + valid/invalid 时间；Wikibase reference + rank；产品已有 source/timestamp/evidenceSentence/mode | 增加/规范 capturedAt、sourceLocator、excerptHash、actor、verifiedAt、state；rank 不等同于真理 |
| Q-11 | 新结果不覆盖历史；保留版本、冲突，并能找到受影响下游 | Graphiti invalid_at/expired_at 保留旧事实；Wikibase EntityRevisionLookup 按 revision 取历史；lakeFS commit/branch/rollback；Jena TDB2 MVCC/transaction | 采用 append-only claim revision + supersedes/conflicts + impact edges；旧版本仍可被原工作项引用 |
| Q-14 | 执行结果指向精确输入/输出，验证后才回流知识 | 产品 `WorkEvent` 有 result/actor/meta，Agent Bridge 有 project generation lock 与 source drift/stale response 保护；Graphiti episode 可记录输入事件但不提供 Owner gate | result immutable；Agent 只能 report，Owner verify/reject/qualify；verified result 才进检索/项目判断 |
| Q-17 | 多 Agent 共用项目真相，身份、权限、并发、冲突、交接可审计 | 产品 `agent-bridge.ts` 已按 project 绑定、revision、generation lock 处理并发；Wikibase revision/ChangeOp 有并发冲突语义；Jena 有事务边界 | 维持单一 project repository；所有写入带 actor/provenance；加入 optimistic revision check；Agent 不自证 |
| Q-20 | 源码级评估后选择 direct dependency/adapter/fork/self-build，并可退出 | 四候选都已给出源码路径、许可证、部署形态、适配与退出成本；Graphiti/Jena/lakeFS Apache-2.0，Wikibase GPL-2.0-or-later | 当前建议：产品自研 lifecycle command/repository；Graphiti/Jena 仅 adapter 候选；Wikibase/lakeFS 仅语义/快照参考，待主人确认再立项 |

## Verification

- `git rev-parse HEAD` → `b8ac6077645b03216425851812c9b1094321d5da`。
- `git diff --quiet -- app shared tests` → exit `0`（未改生产业务代码）。
- `rg` 对 `shared/types/knowledge.ts`、`shared/knowledge/relations.ts`、`shared/knowledge/repository.ts`、`shared/knowledge/agent-bridge.ts` 的字段/边界核验 → exit `0`；确认了 project scope、source/evidence、relation status/dedup、event/result、transaction recovery、Agent generation lock/source drift。
- `npm run lint` → exit `127`，隔离 worktree 没有安装 `eslint`（`node_modules` 缺失）；未因失败修改任何文件。
- 公开源码 git clone 尝试因外部 GitHub 连接失败；改用 GitHub 官方仓库页、官方源码页、官方文档与 Doxygen primary source，链接已列出；未把外部源码复制进项目。

## Evidence paths and handoff

- Isolated evidence path: `/Users/mahaoxuan/.treehouse/fc-opc-ibot-678696/12/fc-opc-ibot/.ship/handoffs/G3A-knowledge-lifecycle-DONE.md`
- Portable primary-repo copy: `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/handoffs/G3A-knowledge-lifecycle-DONE.md`
- Changed paths: only the two unique G3A DONE handoff copies; no `app/`, `shared/`, `tests/`, `data/`, config, or business source changes.
- Next owner: G1 merges this evidence into the unified Q-02/Q-20 candidate matrix; G2/Codex decide whether any adapter spike is separately assigned.
- Residual risk: external source versions and license notices must be rechecked at implementation time; current candidate evidence is research/selection input, not an architecture approval.
