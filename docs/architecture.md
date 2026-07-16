# Architecture（短）

> PR-02 · 本机能力层 vs 网页呈现层

## 两层

```text
┌─────────────────────────────────────────────────────────┐
│  网页呈现层（Next App Router + React）                   │
│  app/track/knowledge/* · components · CSS modules       │
│  职责：四区工作台、画布投影、右栏过程/对话、触发 API     │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP /api/*
┌───────────────────────────▼─────────────────────────────┐
│  本机能力层（Node shared/* · SQLite/CAS · 本机 FS/Git）   │
│  授权夹 · 观察 · Agent 工具环 · 候选理解 · Owner 确认     │
│  职责：边界内真读、证据、记忆、不可变 revision            │
└─────────────────────────────────────────────────────────┘
```

- **呈现层不持真相**：画布/列表是投影；刷新后应从 API + 磁盘重建。
- **能力层不依赖浏览器**：可在 route / 测试 / 未来 worker 中调用同一 `shared/*`。
- **本机单用户**：folder-picker、本地路径、loopback 信任；非公网多租户服务。

## 关键模块路径

| 能力 | 路径 |
|------|------|
| 产品页壳 | `app/track/knowledge/page.tsx` |
| 画布 UI | `app/track/knowledge/components/ProjectCanvas.tsx` |
| 画布图构建 | `shared/knowledge/project-canvas.ts` |
| Knowledge 仓库（JSON） | `shared/knowledge/repository.ts` |
| 授权 / Grant | `shared/project-memory/grants.ts` · `native-folder-picker.ts` |
| 观察器 | `shared/project-memory/observer.ts` |
| SQLite + CAS | `shared/project-memory/sqlite-store.ts` · `cas.ts` · `runtime.ts` |
| Agent 运行时 / 工具 | `shared/project-memory/agent-runtime.ts` · `agent-tools.ts` |
| 工具注册表（vNext） | `shared/project-memory/tool-registry.ts` |
| 候选证据门禁 | `shared/project-memory/agent-evidence.ts` |
| 对话记忆 | `shared/agent-memory/*` |
| 本机会话 | `shared/security/local-session.ts` |
| API 边界 | `app/api/**/route.ts`（清单见 `docs/api.md`） |
| 存储清单 | `docs/data-storage.md` |

## 数据双轨（当前）

| 轨 | 存储 | 语义 |
|----|------|------|
| Project Memory | SQLite + CAS | 授权夹观察、分析 run、候选/已接受理解 |
| Knowledge + Dialogue | JSON 文件 | 卡片、工作项、关系、对话、偏好 |

vNext 目标：元数据集中到版本化 SQLite；CAS/文件只放大对象（见 PRD PR-11+）。

## 主用户路径（行为）

1. 授权本地项目夹 → Grant + 观察对账 → 材料/节点可画。
2. 启动分析 / 问 Agent → 工具环在授权边界内 map/search/read（+ 可选 git）。
3. 候选理解带出处 → Owner 确认后进入项目记忆。
4. 画布与右栏展示结构与过程；对话记忆接话，不静默改写已接受理解。
