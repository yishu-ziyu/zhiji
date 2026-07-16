# API Inventory

> 扫描基线：`app/api/**/route.ts`（2026-07-17 · PR-02）
> 产品入口：`http://127.0.0.1:3331/track/knowledge`
> 说明：本表冻结 method / 路径 / 职责；请求体与错误码以各 route 实现为准，后续契约 PR 再补 OpenAPI。

| Method | Path | 职责 |
|--------|------|------|
| GET, POST | `/api/knowledge/add` | 新增 / 列表知识卡片 |
| GET | `/api/knowledge/cards/[id]/neighbors` | 卡片一跳邻居关系 |
| GET, POST | `/api/knowledge/cross-project-refs` | 跨项目引用（列表 / 批准） |
| POST | `/api/knowledge/dissect` | LLM 拆解目标为行动项 |
| GET, POST | `/api/knowledge/footprint` | 知识足迹视图与记录 |
| GET | `/api/knowledge/library-map` | 资料库地图数据 |
| GET, POST | `/api/knowledge/mcp` | Knowledge MCP 风格工具列表 / 调用 |
| POST | `/api/knowledge/minutes` | 会议纪要解析入库 |
| GET | `/api/knowledge/path` | 两卡之间关系路径 |
| GET, PATCH | `/api/knowledge/preferences` | 用户偏好读写 |
| GET, POST | `/api/knowledge/project-memory/connections` | 项目夹连接列表 / 建立授权连接 |
| POST | `/api/knowledge/project-memory/folder-picker` | 本机 macOS 文件夹选择器（需 local-session 信任） |
| POST | `/api/knowledge/project-memory/preflight` | 授权前元数据-only 扫描预检（PR-03；不读文件正文；需 local-session） |
| GET, POST | `/api/knowledge/projects` | 项目列表 / 创建 |
| GET | `/api/knowledge/projects/[id]/agent-session` | 当前项目 Agent 会话投影 |
| GET, POST | `/api/knowledge/projects/[id]/analysis-runs` | 分析运行列表 / 启动（同步工具环） |
| POST | `/api/knowledge/projects/[id]/analysis-runs/[runId]/interrupt` | 中断进行中的分析 |
| GET | `/api/knowledge/projects/[id]/canvas` | 项目关系画布快照 |
| GET, POST | `/api/knowledge/projects/[id]/canvas-view` | 画布呈现命令读写（`set_canvas_view`） |
| POST | `/api/knowledge/projects/[id]/checkpoints` | 项目检查点 |
| GET, POST | `/api/knowledge/projects/[id]/cross-project-references` | 项目维度跨项目引用 |
| GET, POST | `/api/knowledge/projects/[id]/dialogue` | 对话会话列表 / 追加消息 |
| GET, POST | `/api/knowledge/projects/[id]/materials` | 本项目材料列表 / 上传或登记 |
| GET, PUT | `/api/knowledge/projects/[id]/matters/[matterId]/watch-set` | Matter 观察范围（WatchSet） |
| GET | `/api/knowledge/projects/[id]/memory` | 项目记忆重建视图（matter 维度） |
| GET, POST | `/api/knowledge/projects/[id]/owner-statements` | Owner 陈述生命周期列表 / propose·confirm·withdraw（PR-06；聊天不自动写入） |
| POST | `/api/knowledge/projects/[id]/open` | 打开/激活项目（最近项目等） |
| GET | `/api/knowledge/projects/[id]/redacted-hints` | 红acted / 敏感提示 |
| GET, POST, PATCH | `/api/knowledge/projects/[id]/source-grants` | 源文件夹授权列表 / 创建 / 更新 |
| GET, DELETE | `/api/knowledge/projects/[id]/source-grants/[grantId]` | 单条授权详情 / 撤销 |
| POST | `/api/knowledge/projects/[id]/source-grants/[grantId]/reconcile` | 对授权根做观察对账 |
| GET | `/api/knowledge/projects/[id]/workbench` | 工作台 bundle（对话+记忆摘要） |
| GET, PATCH, DELETE | `/api/knowledge/relations/[id]` | 关系详情 / 更新 / 删除 |
| GET, POST | `/api/knowledge/relations` | 关系列表 / 创建 |
| POST | `/api/knowledge/relations/extract` | 从文本抽取关系 |
| GET | `/api/knowledge/revisions/[id]` | 材料/修订内容读取 |
| GET, POST | `/api/knowledge/search` | 知识检索 |
| GET, POST | `/api/knowledge/state` | 工作台聚合状态读写 |
| POST | `/api/knowledge/understanding/[id]/resolve` | Owner 确认/拒绝候选理解 |
| GET, POST | `/api/knowledge/web-search` | Web 搜索（可选外网能力） |
| GET, POST | `/api/knowledge/work-items` | 工作项列表 / 创建 |
| GET, PATCH | `/api/knowledge/work-items/[id]` | 工作项详情 / 更新状态 |
| POST | `/api/knowledge/work-items/[id]/agent-run` | 针对工作项触发 Agent |
| GET, POST | `/api/knowledge/work-items/[id]/events` | 工作项时间线事件 |
| POST, DELETE | `/api/knowledge/work-items/[id]/evidence` | 工作项依据绑定 / 解除 |
| GET | `/api/knowledge/work-items/[id]/island` | 工作项岛视图（局部子图） |
| POST | `/api/llm/completions` | 通用 LLM 补全代理 |
| GET | `/api/llm/health` | LLM 网关健康检查 |
| GET | `/api/local-session` | 本机会话 / 信任令牌 |

**Route 文件数：49**（每个 `route.ts` 一行路径；多 method 合并；2026-07-17 surface:84 补 preflight + owner-statements）。

## 约定

- 实现路径：`app/api/**/route.ts` → URL 去掉 `app` 与 `/route.ts`。
- 业务逻辑优先在 `shared/*`；route 只做 HTTP 边界。
- 信任模型：本机单用户原型；folder-picker / 部分写操作依赖 `shared/security/local-session`。
