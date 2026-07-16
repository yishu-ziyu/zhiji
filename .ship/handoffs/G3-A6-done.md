# G3 · A6 done · 接入后主动进入新项目

**席：** 实现池 G3  
**听：** G1  
**规范：** `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/handoffs/G2-A6-enter-new-project.md`  
**分支：** `feature/first-user-real-entry`

## 做完了什么

| 要求 | 实现 |
|------|------|
| 拖夹/上传夹成功后进入新项目 | `enterProjectAfterImport`：`setProjectId` + 左栏依赖 `projectId` 高亮 + `loadSnapshot`/`loadProjectCards` + 打开材料面板 |
| 多项目默认进本批第一个成功创建 | `pickA6EnterProjectId(createdIds)` → `created[0]` |
| 不停留旧项目空壳 | 列表先 `mergeProjectsForA6Enter` 再 enter；整批失败**不**切换 + `setError` |
| 左/中/材料同一 projectId | enter 内 token 校验；materials 仅在 `activeProjectIdRef === id` 时写入 |

## 改动路径

- `shared/knowledge/a6-enter.ts` — 进入目标规则 + 列表合并  
- `shared/knowledge/a6-enter.test.ts` — 规则单测  
- `app/track/knowledge/page.tsx` — `enterProjectAfterImport` + `handleFolderProjectImports` A6 闭环  
- 板进度 #11：做完  

## 多项目进入规则（写死）

**本批 `created` 数组中第一个成功 `POST /projects` 的项目。**

## 自测

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
npm run test:unit -- shared/knowledge/a6-enter.test.ts
```

手工（有当前项目「旧」时）：

1. 顶栏「上传文件夹」或拖入新顶层夹  
2. 成功后：左侧高亮 = 新项目名；中央为该项目；材料面板打开  
3. 不应仍停在旧项目空壳  

结果：规则单测 PASS；UI 路径按上表绑定。

## 未做（非本刀）

- UX1 浏览器原生 Upload 确认框  
- A5 拆夹语义改动  
- 自宣布整条 015 验收  

## Commit

见本提交 `git log -1 --oneline`（实现后写入）。
