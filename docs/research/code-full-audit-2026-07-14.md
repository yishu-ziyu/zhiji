# 全量源码通读纪要（2026-07-14）

> 方法：两个只读 subagent 分治 `app/`+`lib/` 与 `shared/`+`tests/`+`components/`，对本机 49 个业务 TS/TSX 做穷尽阅读（非摘要猜测）。  
> 本文件是给后续思考用的**代码事实层**，不是产品定论。

## 一句话

**活产品 = 客户变化处理（带证据的约定版本更新）。**  
并行还躺着：完整可用的承诺单状态机、几乎无 UI 的会议纪要巨石 API、开放 LLM 代理。全是内存 Map。

## 文件规模

| 区域 | 约略 |
|------|------|
| app + lib TS | 17 文件 / ~2660 行 |
| shared + tests + ui | 其余至合计 49 个 ts/tsx |
| 最大单文件 | `minutes/route.ts` 981 行（规则引擎内联） |
| 主 UI | `track/efficiency/page.tsx` 483 行 |
| 主领域 | `change.ts` 546 行 |

## 活路径（用户能点到）

```text
/ 首页
  → /track/efficiency  服务方：seed → 粘贴消息 → analyze → 填方案 → send
  ↔ /c/[token]         客户：先当 change token，否则当 slip token
```

- Analyze：fixture 规则 或 LLM（失败 502，无 mock 顶替）  
- 服务方 secret：sessionStorage  
- 客户：guest link，无登录；文案已声明非电子签  

## 半死 / 死路径（代码在、主 UI 不进）

| 能力 | 状态 |
|------|------|
| `use-provider-slips.ts` + slips API | 服务方工作台已不挂；API 无鉴权 |
| 客户 `ClientActions` 承诺单 | `/c` 仍可进，但主 demo 不发 slip token |
| commitments API | 有 LLM+mock；无页面 fetch |
| minutes API | 981 行；**不**用 `shared/llm/prompts/minutes.ts`；无页面 |
| llm/completions | 开放任意 prompt；无页面 |
| EfficiencyMode `board` | 类型有，UI 无 |
| `Commitment.accepted` 候选流 | 类型有，无实现 |

## 两套领域模型

### A. 客户变化（主轴）

- 对象：Project（版本、范围、价、交付日、已付）+ Proposal + Grant  
- 状态：draft → pending_client → applied | changes_requested  
- 硬规则：quote 必须是原文子串；价/日由人填；总价≥已付；grant 48h、消费、吊销兄弟链接；baseVersion 乐观锁  
- 身份：`guest_link`  

### B. 承诺单（完整第二状态机）

- 7 态：draft → 待确认 → 已确认/要改 → 已交付 → 验收/拒收  
- Token 长期复用、无过期；无 providerSecret  
- Metrics：30 日 cohort、7 日成熟确认率等  

## LLM

| 用途 | Prompt | 失败 |
|------|--------|------|
| change analyze | shared `prompts/change` | 502 |
| commitments | shared `prompts/commitments` | mock |
| minutes | **route 内联**超长 system | mock 空纪要 |
| completions/health | 运维/透传 | - |

默认上游：`127.0.0.1:15721`，模型 `step-3.7-flash`。

## 安全（demo 级诚实）

- 对的：secret/token 投影剥离；服务方不能代客户 confirm；证据防幻觉  
- 风险：链接即权力；slips/completions 无鉴权；sessionStorage 存 secret；无多实例/持久化  

## 测试

- 强：change 领域 + e2e 主路径 + state-machine/repository/metrics  
- 弱/无：minutes 巨石、commitments route、slip e2e、grant 时钟过期  

## 与「理解项目」相关的结论

1. 不是通用 Agent 运行时，是 **垂直业务状态机 + 局部 LLM 抽取**。  
2. 历史叠了三层叙事（纪要 → 承诺单 → 客户变化），代码未拆干净。  
3. 要谈「环环相扣」，代码层面**尚未把多环串成一条编译流水线**，只把**变更环**做实。
