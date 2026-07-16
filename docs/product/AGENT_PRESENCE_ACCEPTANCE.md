# 真读项目夹 · 严格验收

**产品定位：** 这是本产品的创新点，不是附属功能。  
**试用：** `http://127.0.0.1:3331/track/knowledge`  
**工程状态：** 门禁 A1–A6 + L1–L5 自动化已绿（2026-07-17）  
**产品状态：** 等 Owner 亲手说「过」

---

## 一句话

授权夹之后：先读真文件，再说话；说话必有出处；挂了就承认挂了。

---

## 你必须看见（过线）

当我授权本地项目夹并完成首次分析时，我应当：

1. **先干活再说话** - 顺序可感知：摸目录 → 搜 → 打开具体文件 → 再出理解  
2. **过程可见** - 右栏进度随真实动作变，不是静态八步装饰  
3. **结论有出处** - 每条关键说法能落到文件/片段；点出处能对上内容  
4. **或诚实不知道** - 读不够 / 搜不到时明确说还不知道，不硬编  
5. **能拍板** - 确认 / 改确认 / 拒绝后写入；重开仍在  
6. **不许假闭环** - 模型挂了或中断时，不得静默换成假理解（应失败/报错）

---

## 任一即 FAIL（严格）

| # | 现象 | 为何算假 |
|---|------|----------|
| F1 | 无 map / search / read 真实动作就出结论 | 没读夹 |
| F2 | 有候选但出处为空或对不上文件 | 空聊包装 |
| F3 | 只见最终一段话，看不见读了什么 | 过程不可验 |
| F4 | 网关挂了仍显示「读懂了」 | 静默降级 |
| F5 | 确认后刷新/换项目再进就丢 | 不可信记忆 |
| F6 | 确认卡被二次分析盖掉 | 假闭环 |

---

## 自动化门禁（工程完成定义）

```bash
# 工具环 + 确认闭环 + L3/L4/L5（可 deterministic）
AGENT_RUN_MODE=deterministic npx vitest run shared/project-memory/agent-presence.acceptance.test.ts

# 真模型 L1/L2/L3（需 .env.local 的 LLM_*）
npx vitest run shared/project-memory/agent-live-llm.acceptance.test.ts

# 整包 project-memory
npx vitest run shared/project-memory/
```

| ID | 断言 | 状态 |
|----|------|------|
| A1–A6 | 工具环 / poll / 确认 | 绿 |
| L1 | `complete()` 打到 live 网关 | 绿 |
| L2 | tool-loop + 真模型出 candidate，且 **无** deterministic fallback | 绿 |
| L3 | candidate ≥1 条非空 evidence，path/revision 在授权夹内 | 绿 |
| L4 | 模型网关失败 → `status=failed`，**不**产生假「读懂」候选 | 绿 |
| L5 | 过程步骤与 tool 收据对齐（map/search/read → 前序 done，owner active） | 绿 |

**实现要点：**

- `shared/project-memory/agent-evidence.ts` — 可用出处判定 + 强制写回  
- `agent-runtime` — 无可用出处 / 模型失败 → `failed`，不 `saveCandidate`  
- 默认禁静默降级；仅 `AGENT_ALLOW_DETERMINISTIC_FALLBACK=1` 或 `modelMode=deterministic` 可降级  
- API：`analysis-runs` 失败返回 502/422，`candidate: null`

---

## 配置

- `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`（`.env.local`）
- 默认真模型；仅 `AGENT_RUN_MODE=deterministic` 可关（自测用）
- `AGENT_ALLOW_DETERMINISTIC_FALLBACK=1`：**演示与产品验收禁止开**

---

## Owner 亲手补验（你说「过」才勾清单）

1. 授权含 md 的夹 → 进项目  
2. 右栏看见过程在动（地图 / 搜索 / 精读）  
3. 候选理解带可点出处；点开对得上  
4. 确认 → 再进项目仍显示已记住  
5. 关掉模型网关再分析 → 应失败，不能假装读懂  
