# G3-015 done · 首用户真实接入（实现）

**角色：** G3 Build · 只实现冻结合同  
**合同：** `docs/product/dev-contract-015-first-user-real-entry-v1.md`  
**验收细则：** `.ship/handoffs/G2-015-acceptance.md`  
**分支：** `feature/first-user-real-entry`  
**仓库：** `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot`

## 改了什么

| 路径 | 行为 |
|------|------|
| `shared/knowledge/repository.ts` | 默认**不** seed；`SEED_DEMO=1` 才注入示例项目/卡片/任务；示例项目名带「【示例】」；`normalizeCard` 保留 `sourceFileId` |
| `shared/knowledge/materials.ts` | `writeProjectMaterial` / `sanitizeMaterialFileName`：单文件写入 `files/{projectId}/` |
| `app/api/knowledge/projects/[id]/materials/route.ts` | `POST` 加文件 + 写归属该项目的 card（可搜/可开） |
| `app/track/knowledge/page.tsx` | 空环境诚实空态；新建项目（名称必填）；材料面板上传本地单文件 |
| `playwright.config.ts` | e2e 显式 `SEED_DEMO=1`（演示路径，非默认产品路径） |
| `tests/unit/first-user-real-entry.test.ts` | 空 data + 无 seed：空列表 → 建项目 → 上传文件 → 磁盘仍在 |
| `shared/knowledge/repository.test.ts` 等 | 空路径用例；既有 seed 套件显式 `SEED_DEMO=1` |

## 如何关 seed

- **默认关闭**：不设 `SEED_DEMO`，或任意非 `1` 值 → `seedIfEmpty` / 自动 `DEFAULT_PROJECT` **不执行**。
- **仅演示打开**：`SEED_DEMO=1` → 注入示例项目（名称含「【示例】」）与 seed 卡片/任务。
- 代码入口：`isDemoSeedEnabled()` → `process.env.SEED_DEMO === "1"`。

## 如何测

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot

# 空环境路径（合同 015 核心）
npm run test:unit -- tests/unit/first-user-real-entry.test.ts shared/knowledge/repository.test.ts

# 全量单测（本机已绿）
npm run test:unit
# 期望：14 files / 144 tests passed
```

G4 空 data 通关建议：

```bash
rm -rf /tmp/k015-empty && mkdir -p /tmp/k015-empty
# 不要设置 SEED_DEMO
KNOWLEDGE_DATA_DIR=/tmp/k015-empty npm run dev
# 打开 /track/knowledge → 应见「还没有项目」→ 新建 → 材料面板上传 1 文件 → 刷新仍在
```

## 验收对照（G3 自检，非 G4 代验）

| 项 | 状态 |
|----|------|
| A 空态诚实 | 单测 + UI empty-workspace |
| B 新建项目名称必填 | API/单测 + create form |
| C 单文件归属 projectId | materials POST + disk path |
| D 重启仍在 | 文件权威；单测读盘 |
| E 默认关 seed | `SEED_DEMO` 门控 |

## Commit

见分支 `feature/first-user-real-entry` 上本 handoff 对应 commits（`git log --oneline`）。

## 未做（合同非目标 / 留给 G4）

- 整夹递归
- G4 浏览器空环境证伪（W6）
- 不指挥 G4/G5/G6
