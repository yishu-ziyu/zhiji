# G3 · folder picker fix done

**席：** G3  
**听：** G1  
**诊断：** `.ship/handoffs/G1-diag-folder-picker-dead.md`  
**分支：** `feature/first-user-real-entry`

## 根因与修法

| 项 | 修法 |
|----|------|
| P0-1 FileList 活引用 | `onChange`：先 `Array.from(files)`，再 `value=""`，再处理（单文件 + 文件夹 input） |
| P0-2 只 text() | `fileToMaterialPayload`：文本 utf8；图/二进制 base64；`handleWebkitDirectoryFiles` + materials POST 带 `encoding` |
| P0-3 静默 | busy + 成功 notice（A6 进入文案）/ 失败 error toast；空选 cancel 不刷屏 |

## 改动路径

- `app/track/knowledge/page.tsx`
- `shared/knowledge/folder-import.ts`（`ImportFilePayload.encoding`）
- `shared/knowledge/folder-import.test.ts`

## 自测

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
npm run test:unit -- shared/knowledge/folder-import.test.ts shared/knowledge/a6-enter.test.ts
```

手工（主人路径）：

1. 顶栏左起第 2 个「上传文件夹」  
2. 选含 `*.md` + `*.png` 的夹  
3. **应见**：busy → 新建项目（名=夹名）→ 材料在 → A6 进入该项目；png 走 base64 不炸整夹  
4. 取消选夹：无报错刷屏  

结果：单测 encoding 保留 PASS；FileList 快照路径已合入。

## 未做

- 不扩 E1/P1  
- 不改 G4 文档  
- UX1 浏览器原生确认框

## Commit

`16aebe27` · fix(knowledge): folder picker FileList snapshot and base64 upload
