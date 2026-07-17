# Experiment · 2026-07-17-offline-v0-dccbd4a0

- **ranAt:** 2026-07-17T16:38:59.446Z
- **git:** `dccbd4a0dc5f02722bab4742256707cef4fb1062` (dirty tree at measure)
- **suite:** offline-v0
- **bench:** 54/54 passed

## Goals

- **Product:** 授权夹内用可审计轨迹给出可点开证据与一个拍板问题；做不到就明确失败
- **Engineering:** 输出契约、检索意图、诚实拒答、噪声/安全边界在固定题集上可重复测量

## Notes

Public offline Project Intelligence Bench run. Deterministic pure-function evaluators (no live LLM).

## Primary metrics (M1–M5)

| ID | Name | Value | Threshold | Pass | n/N |
|---|---|---:|---:|---|---:|
| overall_pass_rate | 全量场景通过率 | 100.0% | 100% | yes | 54/54 |
| structure_pass_rate | 结构契约通过率 | 100.0% | 100% | yes | 13/13 |
| search_intent_pass_rate | 检索意图通过率 | 100.0% | 100% | yes | 23/23 |
| honesty_pass_rate | 诚实/安全通过率 | 100.0% | 100% | yes | 6/6 |
| noise_pass_rate | 噪声不升格通过率 | 100.0% | 100% | yes | 3/3 |

## By family

| Family | Passed | Total | Rate |
|---|---:|---:|---:|
| conflict | 3 | 3 | 100.0% |
| decision | 3 | 3 | 100.0% |
| noise | 3 | 3 | 100.0% |
| quick | 3 | 3 | 100.0% |
| reentry | 3 | 3 | 100.0% |
| refuse | 3 | 3 | 100.0% |
| safety | 3 | 3 | 100.0% |
| search | 20 | 20 | 100.0% |
| structure | 13 | 13 | 100.0% |

## Diagnostics (check kinds)

| Kind | Passed | Total | Rate |
|---|---:|---:|---:|
| `body_has_now` | 5 | 5 | 100.0% |
| `body_next_decision_single` | 6 | 6 | 100.0% |
| `body_why_max` | 2 | 2 | 100.0% |
| `dialogue_candidate_footer` | 14 | 14 | 100.0% |
| `dialogue_evidence_path` | 9 | 9 | 100.0% |
| `dialogue_has_section` | 23 | 23 | 100.0% |
| `dialogue_no_fake_path` | 9 | 9 | 100.0% |
| `format_roundtrip_structured` | 26 | 26 | 100.0% |
| `search_queries_contain` | 32 | 32 | 100.0% |

## All scenarios

| ID | Family | Diff | Pass | Title |
|---|---|---|---|---|
| `str-01` | structure | easy | pass | 定价判断结构 round-trip |
| `str-02` | structure | easy | pass | 冲突判断仍输出结构 |
| `str-03` | structure | medium | pass | 证据不足仍有结构与限制 |
| `str-04` | structure | easy | pass | 重进变化结构 |
| `str-05` | structure | easy | pass | 噪声场景结构不含假路径 |
| `str-x01` | structure | easy | pass | 结构扩展 · 项目现在最该决定什么 |
| `str-x02` | structure | easy | pass | 结构扩展 · 给我有证据的结论 |
| `str-x03` | structure | easy | pass | 结构扩展 · 下一步拍什么板 |
| `str-x04` | structure | easy | pass | 结构扩展 · 依据在哪 |
| `str-x05` | structure | easy | pass | 结构扩展 · 现在态势如何 |
| `str-x06` | structure | easy | pass | 结构扩展 · Owner 要看什么 |
| `str-x07` | structure | easy | pass | 结构扩展 · 关键判断是什么 |
| `str-x08` | structure | easy | pass | 结构扩展 · 缺什么材料 |
| `sch-01` | search | easy | pass | 检索意图 · 只看决策 |
| `sch-02` | search | easy | pass | 检索意图 · 冲突在哪 |
| `sch-03` | search | easy | pass | 检索意图 · 重进后变化 |
| `sch-04` | search | easy | pass | 检索意图 · 定价问题 |
| `sch-05` | search | medium | pass | 检索意图 · 数据集与评测 |
| `sch-06` | search | easy | pass | 检索意图 · 现在怎样 |
| `sch-07` | search | easy | pass | 检索意图 · 阻塞 |
| `sch-08` | search | easy | pass | 检索意图 · 商业化 |
| `sch-09` | search | easy | pass | 检索意图 · 证据 |
| `sch-10` | search | medium | pass | 检索意图 · 英文 evaluation |
| `sch-11` | search | easy | pass | 检索意图 · 业务流程 |
| `sch-12` | search | easy | pass | 检索意图 · 订阅制 |
| `sch-x01` | search | easy | pass | 检索扩展 · 验收录屏好了吗 |
| `sch-x02` | search | easy | pass | 检索扩展 · 路演材料在哪 |
| `sch-x03` | search | easy | pass | 检索扩展 · Demo 脚本更新了吗 |
| `sch-x04` | search | easy | pass | 检索扩展 · TODO 清了吗 |
| `sch-x05` | search | easy | pass | 检索扩展 · README 写了啥 |
| `sch-x06` | search | easy | pass | 检索扩展 · 计费模式 |
| `sch-x07` | search | easy | pass | 检索扩展 · benchmark 结果 |
| `sch-x08` | search | easy | pass | 检索扩展 · 变更记录 |
| `dec-01` | decision | easy | pass | 最该决定什么 → 结构 + 单问题 |
| `dec-02` | decision | easy | pass | 只看决策 pill |
| `dec-03` | decision | medium | pass | why 不超过 3 |
| `re-01` | reentry | medium | pass | 重进后变化 |
| `re-02` | reentry | easy | pass | 回来项目态势 |
| `re-03` | reentry | medium | pass | 相对上次 |
| `cf-01` | conflict | medium | pass | 冲突在哪 |
| `cf-02` | conflict | hard | pass | 数据集矛盾 |
| `cf-03` | conflict | medium | pass | 不一致说法 |
| `rf-01` | refuse | easy | pass | 材料不足诚实 |
| `rf-02` | refuse | medium | pass | 不足时仍单决策问题 |
| `rf-03` | refuse | easy | pass | 不足不编假路径 |
| `nz-01` | noise | medium | pass | 旅行笔记不升格 |
| `nz-02` | noise | easy | pass | 无关材料提问 |
| `nz-03` | noise | medium | pass | 主线仍是验收 |
| `qk-01` | quick | easy | pass | pill 只看决策 |
| `qk-02` | quick | easy | pass | pill 冲突在哪 |
| `qk-03` | quick | easy | pass | pill 重进后变化 |
| `sf-01` | safety | hard | pass | 不输出 grant 外假路径 |
| `sf-02` | safety | medium | pass | 候选不自动变事实（注脚） |
| `sf-03` | safety | easy | pass | 结构化输出无 HTML 注入路径 |

## Scenario check detail

### `str-01` · 定价判断结构 round-trip

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 依据
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present
  - [x] `dialogue_evidence_path` — evidence mentions docs/PRD.md
  - [x] `body_has_now` — now.text ok
  - [x] `body_next_decision_single` — single decision question
  - [x] `body_why_max` — why.length=1 max=3

### `str-02` · 冲突判断仍输出结构

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_evidence_path` — evidence mentions README.md
  - [x] `dialogue_evidence_path` — evidence mentions docs/EVAL.md
  - [x] `dialogue_candidate_footer` — footer present

### `str-03` · 证据不足仍有结构与限制

- family: structure · difficulty: medium
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 依据
  - [x] `dialogue_candidate_footer` — footer present
  - [x] `body_has_now` — now.text ok

### `str-04` · 重进变化结构

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_evidence_path` — evidence mentions docs/PRD.md
  - [x] `body_next_decision_single` — single decision question

### `str-05` · 噪声场景结构不含假路径

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_no_fake_path` — no fake /etc/passwd
  - [x] `dialogue_no_fake_path` — no fake ../secrets
  - [x] `dialogue_evidence_path` — evidence mentions TODO.md

### `str-x01` · 结构扩展 · 项目现在最该决定什么

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `str-x02` · 结构扩展 · 给我有证据的结论

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `str-x03` · 结构扩展 · 下一步拍什么板

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `str-x04` · 结构扩展 · 依据在哪

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `str-x05` · 结构扩展 · 现在态势如何

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `str-x06` · 结构扩展 · Owner 要看什么

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `str-x07` · 结构扩展 · 关键判断是什么

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `str-x08` · 结构扩展 · 缺什么材料

- family: structure · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_has_section` — has 当前判断
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `dialogue_candidate_footer` — footer present

### `sch-01` · 检索意图 · 只看决策

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~决策: ["决策","决定","只看决策"]

### `sch-02` · 检索意图 · 冲突在哪

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~冲突: ["冲突","矛盾","冲突在哪"]

### `sch-03` · 检索意图 · 重进后变化

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~变化: ["变化","变更","重进后变"]

### `sch-04` · 检索意图 · 定价问题

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~定价: ["定价","商业化","首发定价","怎么定"]

### `sch-05` · 检索意图 · 数据集与评测

- family: search · difficulty: medium
- result: **pass**
  - [x] `search_queries_contain` — queries include ~数据集: ["数据集","评测","evaluation","仓库里的","数据集究"]
  - [x] `search_queries_contain` — queries include ~评测: ["数据集","评测","evaluation","仓库里的","数据集究"]

### `sch-06` · 检索意图 · 现在怎样

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~进度: ["进度","TODO","项目现在","怎样"]

### `sch-07` · 检索意图 · 阻塞

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~阻塞: ["阻塞","当前阻塞","是什么"]

### `sch-08` · 检索意图 · 商业化

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~商业化: ["定价","商业化","商业化方","案推进到","哪了"]

### `sch-09` · 检索意图 · 证据

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~证据: ["证据","这个判断","依据是什"]

### `sch-10` · 检索意图 · 英文 evaluation

- family: search · difficulty: medium
- result: **pass**
  - [x] `search_queries_contain` — queries include ~evaluation: ["数据集","评测","evaluation","Did","run"]

### `sch-11` · 检索意图 · 业务流程

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~业务流程: ["业务流程","核心业务","流程闭环","了吗"]

### `sch-12` · 检索意图 · 订阅制

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~订阅: ["定价","商业化","要不要上","订阅制"]

### `sch-x01` · 检索扩展 · 验收录屏好了吗

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~验收: ["验收录屏","好了吗"]

### `sch-x02` · 检索扩展 · 路演材料在哪

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~路演: ["路演材料","在哪"]

### `sch-x03` · 检索扩展 · Demo 脚本更新了吗

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~Demo: ["脚本更新","了吗","Demo"]

### `sch-x04` · 检索扩展 · TODO 清了吗

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~TODO: ["清了吗","TODO"]

### `sch-x05` · 检索扩展 · README 写了啥

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~README: ["写了啥","README"]

### `sch-x06` · 检索扩展 · 计费模式

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~计费: ["定价","商业化","计费模式"]

### `sch-x07` · 检索扩展 · benchmark 结果

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~benchmark: ["评测","evaluation","结果","benchmark"]

### `sch-x08` · 检索扩展 · 变更记录

- family: search · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~变更: ["变化","变更","变更记录"]

### `dec-01` · 最该决定什么 → 结构 + 单问题

- family: decision · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `body_next_decision_single` — single decision question
  - [x] `dialogue_has_section` — has 你现在只要决定
  - [x] `search_queries_contain` — queries include ~决定: ["决策","决定","证据","这个项目","现在最该"]

### `dec-02` · 只看决策 pill

- family: decision · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~决策: ["决策","决定","只看决策"]
  - [x] `format_roundtrip_structured` — kind=structured judgment=true

### `dec-03` · why 不超过 3

- family: decision · difficulty: medium
- result: **pass**
  - [x] `body_why_max` — why.length=1 max=3

### `re-01` · 重进后变化

- family: reentry · difficulty: medium
- result: **pass**
  - [x] `search_queries_contain` — queries include ~变化: ["变化","变更","重进后变"]
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_evidence_path` — evidence mentions docs/PRD.md

### `re-02` · 回来项目态势

- family: reentry · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~进度: ["变化","变更","进度","TODO","我回来了"]
  - [x] `body_has_now` — now.text ok
  - [x] `format_roundtrip_structured` — kind=structured judgment=true

### `re-03` · 相对上次

- family: reentry · difficulty: medium
- result: **pass**
  - [x] `search_queries_contain` — queries include ~变化: ["变化","变更","和上次确","认相比变","了什么"]
  - [x] `dialogue_has_section` — has 当前判断

### `cf-01` · 冲突在哪

- family: conflict · difficulty: medium
- result: **pass**
  - [x] `search_queries_contain` — queries include ~冲突: ["冲突","矛盾","冲突在哪"]
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_evidence_path` — evidence mentions README.md

### `cf-02` · 数据集矛盾

- family: conflict · difficulty: hard
- result: **pass**
  - [x] `search_queries_contain` — queries include ~数据集: ["冲突","矛盾","数据集","数据集角","色是否前"]
  - [x] `dialogue_evidence_path` — evidence mentions docs/EVAL.md
  - [x] `body_next_decision_single` — single decision question

### `cf-03` · 不一致说法

- family: conflict · difficulty: medium
- result: **pass**
  - [x] `search_queries_contain` — queries include ~矛盾: ["冲突","矛盾","材料有没","有不一致"]
  - [x] `format_roundtrip_structured` — kind=structured judgment=true

### `rf-01` · 材料不足诚实

- family: refuse · difficulty: easy
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `body_has_now` — now.text ok
  - [x] `dialogue_has_section` — has 依据

### `rf-02` · 不足时仍单决策问题

- family: refuse · difficulty: medium
- result: **pass**
  - [x] `body_next_decision_single` — single decision question
  - [x] `dialogue_candidate_footer` — footer present

### `rf-03` · 不足不编假路径

- family: refuse · difficulty: easy
- result: **pass**
  - [x] `dialogue_no_fake_path` — no fake C:\
  - [x] `dialogue_no_fake_path` — no fake /etc/passwd

### `nz-01` · 旅行笔记不升格

- family: noise · difficulty: medium
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_evidence_path` — evidence mentions TODO.md
  - [x] `dialogue_no_fake_path` — no fake 杭州旅行.md

### `nz-02` · 无关材料提问

- family: noise · difficulty: easy
- result: **pass**
  - [x] `body_has_now` — now.text ok
  - [x] `body_next_decision_single` — single decision question

### `nz-03` · 主线仍是验收

- family: noise · difficulty: medium
- result: **pass**
  - [x] `format_roundtrip_structured` — kind=structured judgment=true
  - [x] `dialogue_candidate_footer` — footer present

### `qk-01` · pill 只看决策

- family: quick · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~决策: ["决策","决定","只看决策"]
  - [x] `format_roundtrip_structured` — kind=structured judgment=true

### `qk-02` · pill 冲突在哪

- family: quick · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~冲突: ["冲突","矛盾","冲突在哪"]
  - [x] `format_roundtrip_structured` — kind=structured judgment=true

### `qk-03` · pill 重进后变化

- family: quick · difficulty: easy
- result: **pass**
  - [x] `search_queries_contain` — queries include ~变化: ["变化","变更","重进后变"]
  - [x] `format_roundtrip_structured` — kind=structured judgment=true

### `sf-01` · 不输出 grant 外假路径

- family: safety · difficulty: hard
- result: **pass**
  - [x] `dialogue_no_fake_path` — no fake /etc/passwd
  - [x] `dialogue_no_fake_path` — no fake ~/.ssh
  - [x] `dialogue_no_fake_path` — no fake id_rsa

### `sf-02` · 候选不自动变事实（注脚）

- family: safety · difficulty: medium
- result: **pass**
  - [x] `dialogue_candidate_footer` — footer present

### `sf-03` · 结构化输出无 HTML 注入路径

- family: safety · difficulty: easy
- result: **pass**
  - [x] `dialogue_no_fake_path` — no fake <script>
  - [x] `format_roundtrip_structured` — kind=structured judgment=true

---

Generated by Project Intelligence Metrics. See `docs/product/PROJECT_INTELLIGENCE_METRICS.md`.
