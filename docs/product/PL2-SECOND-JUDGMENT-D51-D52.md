# 产品话事人 2 · 第二判断 · D-51 / D-52

**席位:** 产品话事人 2 · surface:63 · Grok  
**对象:** 产品话事人 1 (:78) · Owner  
**日期:** 2026-07-16  
**性质:** 独立审阅 · **不是** 工程派工 · **不是** 假装共识  
**权威:** `docs/product/TEAM_OPERATING_MODEL.md` · 台账 `PRODUCT_DEV_TASKS.md`  
**审阅材料:**  
- `SOLUTION-D-51-product-agent-architecture-mvp-model.md`  
- `SOLUTION-D-51-mvp-llm-endpoint-config.md`  
- `SOLUTION-D-52-agent-autonomous-tools-in-authorized-root.md`  
- `docs/research/2026-07-16-project-state-agent-architecture-synthesis.md`  
- G5 live path: `.ship/research/grok-followups/G5-agent-runtime-live-path-audit.md` @ `3b6c33a1`  
- 对齐: D-15 · D-39 · D-40 · D-41 · D-42 · D-43 · D-48 · D-50

---

## 总判断（一段）

**D-51 的 Agent 循环与 D-52 的「授权根内充分自主」在产品方向上我同意，且与 D-39/D-15/D-42/D-50 同向。**  
**我不同意把它们当作「架构与模型问题已全部关死、工程只需接线」的表述。**  
当前代码仍是「事件元数据 + 单次 complete + 无 tool loop」（G5 [O]）。若工程只换 StepFun base URL 却不交付 toolful 循环与回执，就会在产品上**虚假完成** D-51/D-52。  
另有三处须 Owner/话事人1 明确，否则交付会漂移：**(1) 模型 pin 不是能力证据；(2) 多步 tool 必须有界；(3) 首次建图 vs 事项监视的范围。**

---

## 同意（可原样推进）

| # | 判断 | 证据 / 对齐 |
|---|------|-------------|
| A1 | Agent **是** observe → map → selective tools → exact revisions → sufficient/unknown → candidate → Owner → persist/monitor | 直接服务 D-39/D-44/D-50；纠正「扫文件 + 一次补全」失败形态 |
| A2 | 真相不属模型；模型可替换；原件/事件/理解在 project memory | D-40/D-43；与 D-48 可替换 `AgentModelLoop` 缝一致 |
| A3 | 必须 **provider/model/effort/fallback** 回执 | 直接修补 G5 缺口：fallback 只埋在中文句子、`AnalysisRun.error` 常空 |
| A4 | 授权根内 **不** 逐文件确认读；出界/写/敏感必须确认 | D-15 有界自动 + D-10/D-17；对 D-45 回项目时间正确 |
| A5 | Owner **可见可中断** + tool receipts + stopping reason | 信任=可追溯（D-41）；防静默副作用 |
| A6 | **不** 因 D-51/D-52 采纳 LangGraph/Temporal/AI SDK；Q-33 仍开 | 与 D-48 不打架；tool loop 可在 port 内自建 |
| A7 | G5 仅在 **D-50 终验后** 启动 | 责任模型先于 Agent 能力；顺序正确 |

---

## 不同意 / 必须上抛的分歧

### O1 · 「FINAL」不得掩盖实现缺口（产品表述风险）

| 方 | 立场 |
|----|------|
| 台账/路演现状 | D-51/D-52 标 **FINAL · Owner 确认**；Q-34 核心与 tool 自主关闭 |
| 话事人2 | 产品 **方向 FINAL** 可以；但必须并行写死：**当前 runtime 不满足 D-51/D-52 行为**（G5 [O]：无 tools、无 CAS 进模型、单次 complete）。**验收定义 = 行为**，不是 endpoint pin。 |

**若假装共识会怎样:** 工程把 `LLM_BASE_URL` 改成 StepFun、仍单次 JSON，即可声称「D-51 已落地」——Owner 仍得不到 D-44 要的有依据重建。

**我要求的记录补丁（产品，非工程细节）:**  
D-51/D-52 验收句固定为：  
「授权夹后：多步工具读 **exact revision** → 有 pin 的候选 **或** 诚实 unknown → 回执含 model **与** fallback **与** tool/stop」——任一缺失 = 未交付。

---

### O2 · StepFun 作为 MVP **主模型**是运营选择，不是架构研究结论

| 方 | 立场 |
|----|------|
| D-51 | MVP primary = `step-3.7-flash` + `https://api.stepfun.com/step_plan` + effort high |
| 话事人2 | **同意 Owner 可以 pin 供应商**（密钥名、base、可替换）。**不同意**暗示「已用一手源证明该模型最适合 tool/long-context/structured/中文 grounding」。G1 合成对 `step-3.7-flash` 官方能力卡 **缺失**（404）；structured/tools 在现 adapter **未用**。 |

**风险:** 把「能调用的网关」写成「架构最优解」，后续换模或失败时无法解释。

**我要求:**  
- 台账区分两行：**（a）产品默认供应商 pin（运营）** vs **（b）能力门槛（tool + schema + 中文夹具）未用独立评测关闭**。  
- 若 StepFun 网关 **不支持** `effort=high` 或 tools，不得静默降级为「看起来像模型」；必须走 fallback 回执（D-51 §4）。

---

### O3 · D-52「迭代直到证据」缺少 **产品级有界**（与 D-15 张力）

| 方 | 立场 |
|----|------|
| D-52 | iterate tool calls until evidence **or** mark unknown |
| 话事人2 | 方向对，但 **缺预算** 即 **无界**。D-15 = bounded automation。无 max steps / max files / wall-clock / token 的产品上限，会变成无限读盘或烧钱，且 Owner 中断变成唯一刹车。 |

**我要求 Owner/话事人1 二选一（产品决定，不是 eng 私自定）:**

1. **补进 D-52：** 默认硬顶（例：单次重建 ≤N tool steps、≤M 文件读、≤T 秒；触顶 → stopping reason=`budget` + unknown/partial candidate）；或  
2. **新开 Q：** 「首版 tool 预算默认值」进 Owner 队列。

**在未答前：** 工程不得以「无预算」实现无限 loop；G2 须在 packet 内写临时顶并 **标明未产品冻结**。

---

### O4 · 全根 map / Git vs 事项监视（D-38/D-42）范围未钉

| 方 | 立场 |
|----|------|
| D-52 | 授权根内可 map / Git / 搜 / 跟引用 |
| D-38/D-42 | 持续产品面 = **一件事项** 的状态重建；watch set 决定相关变化 |

**话事人2:** 不反对 **首次**（D-50 进门）在授权根内建工作地图。  
**反对** 把「每次 analysis 默认可全仓 git log + 全树搜」写成常态——会冲掉 D-42 事项主检索，也易把无关材料塞进候选。

**我要求产品补一句:**  
- **进门/首次理解（D-50）:** 根内 map + 选择性深读 OK。  
- **事项分析/持续监视:** 工具默认 **matter/watch 相关**；全根扫描须显式理由并进 receipt。

---

### O5 · 外部公开读写进 D-52 首版范围过大（相对 D-39）

D-52 §4 允许公开/预授权外部读 + 可见 receipt。  
D-39 首版主 Agent = **观察 Owner 授权项目来源**；外部检索「仅在需要且已授权时」。

**话事人2:** 原则不反对，但 **首版交付切片** 应默认 **仅授权根内 tools**；外部公开读作为 **第二切片**，避免 D-51 工程同时吞 D-18 全套。

**若话事人1/Owner 坚持首版含外部:** 必须在可见验收中强制「外部读 receipt 可见」，且不得静默扩大 grant。

---

## 与代码事实的对照（挑战「已可 ship 叙述」）

| D-51/D-52 要求 | `3b6c33a1` G5 [O] | 差距阶级 |
|----------------|-------------------|----------|
| selective tools / iterate | **无** tools；单次 `complete` | **P0 行为** |
| reason on exact revision **content** | 模型见 event 元数据；**无** CAS 字节 | **P0 grounding** |
| fallback 一等可见 | 中文句子；`AnalysisRun.error` 常空 | **P0 诚实** |
| tool receipts + stopping reason | 不存在 | **P0 可追溯** |
| effort=high | adapter **未** 见 effort 字段 | **P1 配置** |
| StepFun 生产 base | 代码默认 `127.0.0.1:15721` | **P1 配置**（历史，非目标） |

**结论:** 产品决定超前于实现是正常的；**不正常**的是把「已定」读成「已有」。

---

## 对 Q-33 的边界（防混谈）

- D-51/D-52 **不** 关闭 Q-33（框架选型）。  
- 话事人2 **同意** 在 D-48 波内用 **产品 port 内自建 tool loop**，不引新编排框架。  
- 若有人用「要做 tool loop」反推必须上 LangGraph/AI SDK — **反对**；证据不足且违 D-48。

---

## 给话事人1 / Owner 的明确请求

请对下列 **产品分歧** 表态（不必一次答完工程细节）：

| ID | 问题 | 话事人2 建议 |
|----|------|--------------|
| **PL2-Q1** | D-51/D-52 的验收是否强制「toolful + receipt」，禁止「只换 endpoint」算完成？ | **是** |
| **PL2-Q2** | StepFun pin 是否明确为 **默认供应商**，能力门槛另用夹具/回执验证，而非「架构最优」？ | **是** |
| **PL2-Q3** | 是否把 **tool 预算硬顶** 写入 D-52（或开 OA）？ | **写入 D-52 默认顶** |
| **PL2-Q4** | 全根 map 是否仅限 **进门/首次**；事项分析默认 matter/watch 范围？ | **是** |
| **PL2-Q5** | 首版 D-51 工程切片是否 **仅根内 tools**，外部公开读后置？ | **仅根内** |

未答前：话事人2 **不** 把 O1–O5 写成「团队已同意」；工程 packet 应引用本文件为 **开放产品风险**。

---

## 同意继续执行的工程闸（不代 Owner 验收）

在 **D-50 终验** 且 **PL2-Q1 未被否决** 的前提下，G2 可派 G5 做：

1. 根内 tool gateway（读 revision 摘录 / 搜 / git 只读）+ 有界 loop  
2. D-51 模型 pin + **真实** effort 字段或显式「网关不支持」→ fallback 回执  
3. model receipt + tool receipts + stopping reason 持久化  
4. 禁止 Agent 自确认；候选仍走 Owner  

**不做:** 代 Owner 点 D-50/OA-21；不 merge；不把 Q-33 框架采纳夹带进 D-51。

---

## 记录动作

- 本文件为 durable 第二判断路径。  
- `PRODUCT_DEV_TASKS.md` 追加 **PL2-D51-D52-REVIEW** 与开放问题指针。  
- 路由：**直达** 产品话事人1 (:78) + Owner；**不** 进普通员工 ACK 信道。
