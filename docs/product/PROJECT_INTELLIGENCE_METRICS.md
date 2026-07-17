# 知几 · Project Intelligence Metric 闭环

**状态：** 工程生效 · 2026-07-18  
**原则：** 没有 Metric，就没有稳定反馈。一次更新是进步还是「更漂亮」，只能看指标。

逻辑链（强制）：

```text
明确目标 → 定义指标 → 测量结果 → 比较版本 → 调整训练/实现 → 再测一次
```

对齐：`docs/product/优化方案-工程开发范式.md` · `tests/bench/project-intelligence/`

---

## 1. 明确目标（Goal）

**产品目标（可失败）：**  
授权夹内，用可审计工具轨迹，给出可点开证据与一个拍板问题；做不到就明确失败。

**工程本层目标（本文件度量）：**  
Agent 的**输出契约、检索意图、诚实拒答、噪声/安全边界**在固定题集上可重复测量，版本对比可判定涨跌。

本层**不**声称已度量 live 模型「读懂项目」的全部能力（那是 presence + live 门禁）。本层度量的是：**离线契约与意图是否退化**。

---

## 2. 定义指标（Metrics）

### 2.1 主键指标（Primary）

| ID | 名称 | 定义 | 公式 | 门槛 (gate) |
|---|---|---|---|---|
| **M1** | `overall_pass_rate` | 全量场景通过率 | `passed / total` | **≥ 1.00**（离线门禁：全绿才合入） |
| **M2** | `structure_pass_rate` | family=structure 通过率 | 该族 passed/total | **≥ 1.00** |
| **M3** | `search_intent_pass_rate` | family=search+quick 通过率 | 两族合计 | **≥ 1.00** |
| **M4** | `honesty_pass_rate` | family=refuse+safety 通过率 | 两族合计 | **≥ 1.00** |
| **M5** | `noise_pass_rate` | family=noise 通过率 | 该族 | **≥ 1.00** |

> 离线 Bench 当前全部为确定性断言，门槛为 1.0。  
> 将来引入 live/LLM-judge 子集时，可单独开 `M*_live` 与更低门槛（如 0.85），**不得**用 live 波动掩盖 offline 回退。

### 2.2 检查维指标（Diagnostic · 不单独合入门）

按 `BenchCheck.kind` 聚合 pass rate，用于定位「哪类契约坏了」：

| ID | kind | 含义 |
|---|---|---|
| D1 | `format_roundtrip_structured` | format→parse 仍为 structured |
| D2 | `dialogue_has_section` | 必备结构段存在 |
| D3 | `dialogue_evidence_path` | 依据含真实 path |
| D4 | `dialogue_candidate_footer` | 候选未写事实注脚 |
| D5 | `search_queries_contain` | 问句驱动检索词 |
| D6 | `body_next_decision_single` | 单决策问题 |
| D7 | `dialogue_no_fake_path` | 无假路径泄漏 |

### 2.3 非本层指标（另轨，防混淆）

| 指标 | 轨 | 命令 |
|---|---|---|
| 工具环 / fail-closed / HITL | presence | `AGENT_RUN_MODE=deterministic npx vitest run shared/project-memory/agent-presence.acceptance.test.ts` |
| 真模型读夹 | live | `npm run test:live`（需密钥，默认 CI 可关） |
| 包内无密钥 | 发布 | 打包后扫描 |

**禁止**用「回答更流畅」或单次 demo 手感替代 M1–M5。

---

## 3. 测量结果（Measure）

```bash
# 跑 Bench + 写出指标快照（本地 reports/，gitignore）
npm run metrics:measure

# 仅跑题集（无写文件）
npm run test:bench

# 公开归档：详细 JSON + 全场景 REPORT，写入 docs/metrics/（应 commit 并 push）
npm run metrics:publish
```

| 产物 | 路径 | 是否入仓公开 |
|---|---|---|
| 本地 latest | `tests/bench/project-intelligence/reports/latest.json` | 否（gitignore） |
| CI 基线 | `tests/bench/project-intelligence/baselines/offline-v0.json` | **是** |
| 公开 run | `docs/metrics/runs/<date>-offline-v0-<sha>/` | **是** |
| 实验日志 | `docs/metrics/EXPERIMENT_LOG.md` | **是** |
| 公开索引 | `docs/metrics/README.md` | **是** |

公开 run 至少包含：

- `snapshot.json` — 全量指标 + **逐题 checks**
- `index.json` — 摘要
- `REPORT.md` — 人读报告（目标、M1–M5、分族、逐题明细）

快照字段：

- `goals` / `metrics[]`（id, value, threshold, pass）
- `bench`（total/passed/failed/byFamily）
- `diagnostics`（by check kind）
- `scenarios[]`（publish 必带：id/family/title/pass/checks）
- `git`（commit, dirty）
- `ranAt`

---

## 4. 比较版本（Compare）

```bash
# 当前测量 vs 仓库基线
npm run metrics:compare

# 显式两份
npm run metrics:compare -- path/to/baseline.json path/to/candidate.json
```

比较规则：

| 情况 | 结果 |
|---|---|
| 任一 Primary 当前 < 门槛 | **FAIL gate** |
| 任一 Primary 相对基线 **下降** | **REGRESSION**（默认 FAIL） |
| Primary 持平或上升且过门槛 | **PASS** |
| 仅 Diagnostic 波动 | **WARN**（不单独拦合入，须写进 PR） |

基线文件（受控、入仓）：

`tests/bench/project-intelligence/baselines/offline-v0.json`

**更新基线：** 仅当确认进步时：

```bash
npm run metrics:measure
cp tests/bench/project-intelligence/reports/latest.json \
   tests/bench/project-intelligence/baselines/offline-v0.json
# 再 commit，说明「为何算进步」
```

禁止在 Primary 下降时偷偷改基线。

---

## 5. 调整训练 / 实现（Adjust）

指标掉了 → 只允许以下动作（写进 commit/PR）：

1. **修实现**（format / parse / extractOwnerSearchQueries / runtime 契约）  
2. **修坏题**（题本身错了才改 catalog，须注明）  
3. **加题锁回归**（先红后绿）  
4. **训练数据**（SFT/DPO）— 须附 measure 前后两份 JSON  

不允许：

- 只改提示词文案不做 measure  
- 删题使 M1 变绿  
- 用 live 一次好运掩盖 offline 回退  

---

## 6. 再测一次（Re-measure）

调整后必须：

```bash
npm run metrics:measure
npm run metrics:compare
```

两份报告并排：基线 vs latest。Primary 全过且无 regression 才可合入。

---

## 7. CI 挂钩

| Job 步骤 | 作用 |
|---|---|
| `npm run test:bench` | 场景全绿（M1 的硬形式） |
| `npm run metrics:compare` | 相对基线无 Primary 回退 |

本地发版前同样跑。

---

## 8. 版本记录（人工）

| 日期 | 基线文件 | overall | 备注 |
|---|---|---|---|
| 2026-07-18 | `baselines/offline-v0.json` | 1.0 | 首版 54 题离线契约基线 |

---

*没有 Metric 的「优化」不计分。*
