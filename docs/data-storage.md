# Data Storage Inventory

> PR-02 · 2026-07-17
> 根目录默认：`data/knowledge`（可用 `KNOWLEDGE_DATA_DIR` 覆盖）
> Project Memory 子目录默认：`<knowledge>/project-memory`（可用 `PROJECT_MEMORY_DATA_DIR` 覆盖）

## 分层一览

| 层 | 形态 | 默认路径 | 真源角色 |
|----|------|----------|----------|
| Knowledge JSON | 整文件 JSON | `data/knowledge/*.json` | 卡片、项目、工作项、关系等产品面状态 |
| Materials files | 普通目录树 | `data/knowledge/files/<projectId>/` | 上传/登记的项目材料副本 |
| Dialogue / prefs JSON | 整文件 JSON | `data/knowledge/dialogue-*.json` 等 | 对话记忆与偏好（非项目真相） |
| Project Memory SQLite | SQLite + WAL | `data/knowledge/project-memory/project-memory.sqlite` | Grant、Revision、Event、Candidate、Run、Tool 收据 |
| CAS | 内容寻址 blob | `data/knowledge/project-memory/cas/blobs/ab/cd/<sha256>` | 观察原文（不可变） |
| Local trust | 目录/令牌 | `data/knowledge/.local-trust` | 本机会话信任（folder-picker 等） |
| Agent bridge | JSON 请求/响应 | `data/knowledge/agent-bridge/` | Agent 桥接排队（若启用） |

## JSON 文件（Knowledge / Agent Memory）

| 文件 | 写入方（主要） | 内容 |
|------|----------------|------|
| `projects.json` | `shared/knowledge/repository.ts` | 项目列表与元数据 |
| `cards.json` | repository | 知识卡片 |
| `actions.json` | repository | 行动项 |
| `events.json` | repository | 工作台事件时间线 |
| `relations.json` | repository | 卡片关系边 |
| `project-checkpoints.json` | repository | 项目检查点 |
| `footprint-events.json` | repository | 足迹事件 |
| `query-sessions.json` | repository | 检索会话 |
| `cross-project-refs.json` | repository | 跨项目引用 |
| `project-source-grants.json` | repository | Knowledge 侧 grant 投影 |
| `work-state-transaction.json` | repository | 工作状态事务临时文件（不应长期残留） |
| `dialogue-sessions.json` | `shared/agent-memory/dialogue-store.ts` | 对话会话 |
| `dialogue-messages.json` | dialogue-store | 对话消息 |
| `user-preferences.json` | `shared/agent-memory/user-preferences.ts` | 用户偏好 |
| `owner-project-statements.json` | `shared/agent-memory/owner-statements.ts` | Owner 陈述（vNext 将收紧） |
| `event-archives.json` | `shared/agent-memory/event-archive.ts` | 旧事件归档台账 |

解析失败策略因模块而异：Dialogue 等历史上可能静默空 Map（vNext PR-11 迁 SQLite 消除）。

## SQLite + CAS（Project Memory）

| 项 | 路径 / 规则 |
|----|-------------|
| 数据目录解析 | `shared/project-memory/runtime.ts` → `resolveProjectMemoryDataDir()` |
| SQLite 文件 | `<pmDataDir>/project-memory.sqlite`（及 `-wal` / `-shm`） |
| CAS 根 | `<pmDataDir>/cas` |
| Blob 布局 | `cas/blobs/<sha[0:2]>/<sha[2:4]>/<sha64>` |
| 写入顺序 | temp → fsync → atomic rename（`shared/project-memory/cas.ts`） |
| 表域 | Grant / Matter / WatchSet / OriginalRevision / ChangeEvent / Understanding / AnalysisRun / ToolReceipt 等（`sqlite-store.ts`） |

## 材料与其它目录

| 路径 | 用途 |
|------|------|
| `data/knowledge/files/<projectId>/…` | 材料文件落盘（`repository` materials） |
| `data/knowledge/project-memory-d50-residual/` | 历史/夹具残留（勿当生产真源） |
| `data/knowledge.bak-*` | 本地备份快照（不进运行契约） |
| `data/skills/` | 本地 skills 数据（若有） |

## 环境变量

| 变量 | 作用 |
|------|------|
| `KNOWLEDGE_DATA_DIR` | Knowledge JSON + 默认 PM 父目录 |
| `PROJECT_MEMORY_DATA_DIR` | 强制 Project Memory（sqlite+cas）独立目录 |

## 读写原则（现状 → vNext）

1. **项目长期真相**：优先 SQLite + CAS（观察与候选理解）。
2. **网页状态**：大量仍在 JSON 整文件读写；并发与损坏风险见 PRD P0-7。
3. **对话 ≠ 项目真相**：`shared/agent-memory` 与 `shared/project-memory` 分离。
4. **CAS 只存大对象原文**；元数据不放 blob 路径当唯一索引。
