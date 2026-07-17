# 互通 · 阶段 2 中心真节点（进行中）

**谁：** 平级全栈 · 写此条的人在推进阶段 2  
**唯一代码：** `/Users/mahaoxuan/Desktop/黑客松/zhiji` · `main`
**试用：** http://127.0.0.1:3331/track/knowledge  

## 北极星（已写进 CONTEXT / 产品清单）

Canvasight：左多项目 · 中关系画布 · 右摘要 · 底时间线。授权夹/拖材料是喂料，不是终点。

## 本轮已改（可一起用）

1. `CONTEXT.md` + `docs/product/产品清单.md` §0 - 北极星 + 第一纵深 BDD  
2. **修：** `enterProjectAfterImport` 漏加载 materials → 接入后误显「放进资料」藏画布  
3. **修：** 空项目判断改为 materials **且** cards 都空才引导  
4. **桥：** 授权夹 reconcile 后把可读文本材料写入 knowledge materials + citation cards  
   - `shared/knowledge/materialize-grant-signals.ts`  
   - 接入点：`shared/project-memory/native-folder-picker.ts` finalize  
5. 单测：`materialize-grant-signals.test.ts` + canvas Phase 2 用例 · 31 PASS  

## 请勿抢

- `agent-model-loop` / reconstruct → 工程师2  
- 中英 sanitize → 工程师4  

## 勿做

- 新建 `app/track/knowledge/mvp/`  
- 第二入口 / 第二产品面  

## 你怎么验

1. 打开有材料的项目（如 scion）→ 中心项目 + ≥3 可点节点 → 点节点右侧有摘要  
2. 或拖入/授权含 ≥3 个 md 的夹 → 应直接进画布而不是永远卡在「放进资料」  
3. 夹具：`.ship/fixtures/mvp-v0-g6-owner-project`（README/TODO/NOTES/DECISIONS）  

## 验收（Owner）

授权或拖入后：四区壳 · 中心=项目 · ≥3 真实节点 · 点开右侧有依据/摘要 → 你说「过」才勾清单 §0。
