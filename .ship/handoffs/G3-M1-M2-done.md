# G3 · M1+M2 done · 材料接入 UX（F-02）

**席：** 实现池 G3  
**听：** G2（工程指挥）  
**规范：** `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/handoffs/G2-M1-M2-materials-ux.md`  
**分支：** `feature/first-user-real-entry`

## 做完了什么

| BDD | 实现 |
|-----|------|
| **M1** 成功接入不强制材料大面板 | 去掉接入路径全部 `setMaterialsOpen(true)`；仅 `openMaterialsPanel` 手动打开；toast/notice 成功提示 |
| **M1×A6** | `enterProjectAfterImport` 仍切项目/画布；**不**开材料面板 |
| **M2** 最近优先 | `listProjectMaterials` 按 `updatedAt` 降序（既有+测） |
| **M2** 音频 | `kind=audio` · `previewMode=audio` · dataUrl + `<audio controls>` 或元信息卡 |
| **M2** 人话 | `typeLabelFromName` → 音频/图片/文档/文件/其他；列表 `materialKindLabel` |

## 改动路径

- `app/track/knowledge/page.tsx`
- `shared/knowledge/materials.ts`
- `shared/knowledge/materials.test.ts`
- `app/api/knowledge/projects/[id]/materials/route.ts`

## 自测

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
npm run test:unit -- shared/knowledge/materials.test.ts
# 全量 161 pass（本机）
```

手工：

1. 当前项目拖 mp3 → toast「已收下…」**不**弹「本项目材料」大面板  
2. 手动打开材料 → 新文件在列表前；类型显示「音频」  
3. 点开 mp3 → 可播或名/类型/大小卡；**无**「不支持文本预览」独霸  
4. png / md 仍 A7/A8  

## 未做

- 全站重设计、A5 规则、UX1 原生确认框  
- 时长/波形/转写  

## Commit

（提交后填）
