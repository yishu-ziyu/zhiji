# G3-015 done · 首用户接入 BDD（A1–A4 / B1 · A3=甲）

**角色：** G3 Build  
**仓库：** `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot`  
**分支：** `feature/first-user-real-entry`  
**BDD 板：** `.ship/tasks/first-user-real-entry-015/control/board.md`

## 行为对照

| BDD | 实现 |
|-----|------|
| **A1 拖拽** | 工作区 `onDrop` → `handleIncomingFiles` → 进**当前项目**；材料列表/画布可见 |
| **A2 上传** | 顶栏/空态/新建菜单/材料面板同一路径 `handleIncomingFiles` |
| **A3=甲** | 无项目时拖/传 → `pendingFiles` + 新建命名表单 → **确认后**再 `POST materials` 归入新项目 |
| **A4 重开** | `files/{projectId}/` + cards `sourceFileId`；磁盘权威 |
| **B1 诚实** | 默认无 seed；仅 `SEED_DEMO=1` 注入「【示例】」项目 |

## 关键路径

- `app/track/knowledge/page.tsx` — 拖放、上传、pending 建项
- `app/track/knowledge/project-canvas.module.css` — drop overlay
- `shared/knowledge/repository.ts` — `SEED_DEMO` 门控
- `shared/knowledge/materials.ts` — `writeProjectMaterial`
- `app/api/knowledge/projects/[id]/materials/route.ts` — POST 单文件
- `tests/unit/first-user-real-entry.test.ts` — 空环境单测

## 关 seed

`SEED_DEMO` 未设或不为 `1` → 不注入。演示：`SEED_DEMO=1`。

## 测

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
npm run test:unit -- tests/unit/first-user-real-entry.test.ts
npm run test:unit
```

## Commit

见 `git log --oneline feature/first-user-real-entry`；收工 HEAD 写在 board 进度备注。
