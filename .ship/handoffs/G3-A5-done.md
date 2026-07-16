# G3 · A5 done · 整夹 → 多项目

**席：** 实现池 G3（整刀收口；与 G3A 目录切片对接）  
**听：** G1  
**行为：** board A5 / 进度#7  
**规范：** `.ship/handoffs/G2-A5-spec.md`  
**分支：** `feature/first-user-real-entry`

## 做完了什么

| BDD | 实现 |
|-----|------|
| 顶层夹 → 项目（名=夹名） | `handleFolderProjectImports` + `classifyTopLevelDrop` / `classifyWebkitRelativeFiles` |
| 夹内文件（含子路径）归该项目 | materials 支持相对路径 `sub/a.md`；POST materials `name` |
| 单层仅文件夹 = 一项目 | classify 单目录仍产出 1 个 projectName |
| 拖放读目录 | `read-drop-entries.ts` webkitGetAsEntry 递归 |
| 选夹 | `webkitdirectory` input + 上传夹按钮 |
| 与 A1–A4 共存 | 松散单文件仍走当前项目 / A3=甲 |
| 刷新仍在 | `files/{projectId}/…` 磁盘权威 |

## 路径

- `shared/knowledge/folder-import.ts` · `folder-import.test.ts`
- `app/track/knowledge/read-drop-entries.ts`
- `app/track/knowledge/lib/folder-drop.ts`（overlay 文案）
- `shared/knowledge/materials.ts`（嵌套相对路径读写列）
- `app/track/knowledge/page.tsx`（drop / folder pick / 建多项目）
- `tests/unit/a5-folder-projects.test.ts`
- `tests/unit/folder-drop.test.ts`

## 测

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
npm run test:unit -- shared/knowledge/folder-import.test.ts tests/unit/a5-folder-projects.test.ts tests/unit/folder-drop.test.ts
# 建议全量：npm run test:unit
```

## 自检（非 G4 验收）

- 空 data + 无 SEED_DEMO：两顶层夹 → 两项目；材料对位；磁盘有 `files/{id}/…`
- 单文件拖入：仍 A1/A3，不误建多项目

## 需要 G1 转

- **G4：** 读本文件 + 空环境拖 ≥2 顶层夹证伪 A5 PASS 表  
- 若 G3A 另有 `G3A-A5-done`：以本 handoff 为整刀对接入口，避免双真源

## 状态

`DONE · 等 G4 整条证伪`
