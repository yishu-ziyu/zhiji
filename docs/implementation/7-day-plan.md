# 7 天实施倒排 · 实现骨架 · v2

> **配套**:docs/superpowers/specs/2026-07-04-killer-feature-design-v2.md §五
> **基础**:已 audit 的真实代码状态(shared/llm/adapter.ts、app/track/efficiency/page.tsx 等)
> **状态**:D2-D7 待实施,D1 spike 脚本已就绪待执行
> **核心约束**:不动现有 4 个 Workflow 的主流程,只加 Agent 编排层
> **2026-07-06 评分细则更新**:赛事实际评分为**90% 评委人工评分 + 10% AI 技术评分**。因此本 plan 的主线从"真 tool_use 技术深度"调整为"3 分钟人工评委看懂且稳定的 Agent Demo"。step-3.7-flash tool_use spike 仍做,但不再绑架主线。详见 `docs/score-rubric.md`。

---

## 0 · 评分细则后的优先级重排

| 优先级 | 任务 | 为什么 |
|---:|---|---|
| P0 | `docs/demo/DEMO_SCRIPT.md` 熟练演练 3 次,控制 180s | 90% 人工评分的核心 |
| P0 | 小掌柜 UI + 早报 + 4 动作链视觉跑通 | 场景价值 / 创新 / 体验可见 |
| P0 | Demo fallback:mock 数据 + 录像 | 稳定性 + 现场不翻车 |
| P1 | step-3.7-flash tool_use spike | AI 技术评分 10%,但不应牺牲 Demo 稳定 |
| P1 | E2E 回归 + build | 技术评分 10% + 稳定性 |
| P1 | 商业化一页答辩话术 | 商业化潜力 |
| P2 | adapter 真 tool_use 解析 | 只有 spike Go 且不影响 Demo 时做 |

**新原则**:如果真 tool_use 和稳定 Demo 冲突,**稳定 Demo 优先**。技术解释留到 Q&A,主路演只展示评委看得懂的 Agent 行为。

---

## D1 · 2026-07-04 晚 · spike 验证 + 决策

**目标**:15 分钟验证 step-3.7-flash tool_use,出 Go/No-Go 决策

**任务**:
1. 用户执行 `docs/spike/stepfun-tool-use-spike.md` 的 curl 命令
2. 验证 Go / 半 Go / No-Go
3. 写 `.progress/spike-result-YYYYMMDD.md`

**决策树**:
- Go → D3-D4 加 adapter.ts tool_use 解析(2-3h)
- 半 Go → D3 加 prompt example(1-2 天调试)
- No-Go → 老实降级,Trace Panel 改"思考过程可视化"

**产出**:spike-result.md

---

## D2 · 2026-07-05 · 小掌柜侧边栏 + 早报骨架

**目标**:右下角常驻 👨‍💼 emoji + 状态灯 + 早报弹层,**不带 LLM 调用**

**新增文件**:
- `shared/components/shopkeeper/ShopkeeperAvatar.tsx`
- `shared/components/shopkeeper/ShopkeeperPanel.tsx`
- `shared/components/agent-runtime/AgentRuntime.tsx`(顶层 Provider)

**改动文件**:
- `app/layout.tsx` — 包裹 `<AgentRuntime>{children}</AgentRuntime>`

**关键约束**(挡 P2-7 媒体评委追问):
- 用 2 次后可折叠成极小图标(state: 'collapsed' / 'full')
- 默认全屏右下角 64x64px
- z-index 高于 modal 但不阻挡点击穿透

**早报本期用 mock 数据**(挡 LLM 慢风险):
- `shared/agent/brief/mock-brief.json` — 硬编码场景数据
- `shared/agent/brief/types.ts` — MorningBrief 接口

**回归测试**:
- `npm run lint` 通过
- 11/11 E2E 仍跑通
- 暗色主题一致性(打开 `/track/ecommerce` 和 `/track/efficiency` 都看到小掌柜头像)

**时间预算**:6-8 小时

---

## D3 · 2026-07-06 · Trace Panel + 早报触发

**目标**:小掌柜执行决策时,自动展开右侧 Trace Panel;早报进入页面时第一眼看到

**新增文件**:
- `shared/agent/trace/types.ts` — TraceStep 类型定义(折叠式)
- `shared/agent/trace/parser.ts` — CoT 文本 → TraceStep[]
- `shared/components/trace-panel/TracePanel.tsx`
- `shared/components/trace-panel/TraceCard.tsx`(默认折叠 + 点击展开 + 悬停问号)
- `shared/components/agent-runtime/BriefSkeleton.tsx`
- `shared/components/agent-runtime/BriefMock.tsx`

**改动文件**:
- `shared/components/agent-runtime/AgentRuntime.tsx` — 接入 useEffect 触发早报;200ms timeout → skeleton, 3s timeout → mock

**关键交互**:
- 进入页面 mount → 触发 `useEffect → briefProvider.getBrief()`
- 早报滑入动画(可被 prefers-reduced-motion 降级)
- 早报卡片点 "采纳建议" → 触发 `PendingDecision`(暂用本地 state,不接真工具)

**回归测试**:
- E2E:打开 `/track/ecommerce`,看到小掌柜 + 早报出现
- Trace Panel 折叠 / 展开交互正常
- 11/11 原有 E2E 通过

**时间预算**:1.5-2 天(高风险项)

---

## D4 · 2026-07-07 · adapter 升级 + tools registry

**目标**:**仅当 D1 spike 是 Go** 时,adapter.ts 加 tool_use block 解析

**改动文件**(Go 时):
- `shared/llm/adapter.ts:48-55` — 请求体加 `tools` 字段
- `shared/llm/adapter.ts:78-86` — 解析响应时增加 `tool_use` 和 `tool_result` block

**新增文件**:
- `shared/agent/tools/index.ts` — tools registry
- `shared/agent/tools/promote-sku.ts` — 真决策工具
- `shared/agent/tools/generate-scripts.ts`
- `shared/agent/tools/create-task.ts`
- `shared/agent/tools/notify.ts`

**改动文件**(No-Go 时):
- **不改 adapter.ts**,只改 spec/答辩话术
- Trace Panel 接受 CoT 文本而非 tool_use 结构(用正则切片)

**回归测试**:
- 4 个原有 API 路由仍跑通
- 11/11 原有 E2E 通过

**时间预算**:2-3 小时(Go) / 1 小时(改文案,No-Go)

---

## D5 · 2026-07-08 · 真决策动作 1 个深决策

**目标**:**自动调整选品库权重 + 一键确认**(挪库 + 预生成 3 条脚本 + 建看板任务 + 发通知)

**新增文件**:
- `shared/agent/decisions/types.ts` — PendingDecision 类型
- `shared/agent/decisions/store.ts` — zustand store(本期可用本地 state 简化)

**改动文件**:
- `app/track/efficiency/page.tsx` — 暴露 `window.__addTasksByShopkeeper = (tasks) => setTasks(...)`,跟现有 `__setEfficiencyMode` 同样模式(line 179)
- `shared/components/trace-panel/TraceCard.tsx` — Decision 卡片显示 5 秒撤回倒计时
- `shared/agent/decisions/withdraw.ts` — 5 秒撤回机制的状态机

**关键交互**:
- 早报点 "采纳建议" → 弹出"⚡ 执行中"动效
- 4 个 tool 依次执行(本期可走 mock 实现,真实逻辑后续接)
- 完成后显示"✅ 已完成 · 5 秒内可撤回"提示
- 5 秒后 LockIn

**回归测试**:
- E2E:打开 → 早报 → 采纳 → 看到 4 个动作执行结果
- 看板出现 "今晚发布 SKU-12 视频" 卡片(line 218 的注入模式)
- 11/11 原有 E2E 通过

**时间预算**:1.5 天(v2 评审把第二个真决策动作砍了,这个做深)

---

## D6 · 2026-07-09 · 早报数据 + fallback UI + User Test

**目标**:早报数据从 mock 切到 live provider;fallback UI 三态;2 个非项目人员 user test

**新增文件**:
- `shared/agent/brief/provider.ts` — BriefProvider 抽象
- `shared/agent/brief/mock-provider.ts` — mock 实现
- `shared/agent/brief/live-provider.ts` — live 实现(调 LLM)
- `shared/agent/brief/fallback-ui.tsx` — 三态(skeleton / mock / live)切换逻辑

**改动文件**:
- `shared/components/agent-runtime/AgentRuntime.tsx` — 接入 BriefProvider
- `shared/llm/prompts/morning-brief.ts`(NEW)— 早报生成 prompt

**user test**(挡 P3-6 reviewer 攻击):
- 找 2 个非项目人员(义乌电商朋友 / 朋友的朋友)
- 远程看 30s demo 录屏
- 问 3 个问题:
  1. "你看明白小掌柜在干嘛吗?"
  2. "你会为这个付 99 元/月吗?为什么?"
  3. "哪个功能你觉得'假'或'多余'?"
- 把回答写到 `.progress/user-test-2026-07-09.md`

**回归测试**:
- LLM 慢时 fallback 到 mock 分支(skeleton 200ms → mock 3s)
- 11/11 原有 E2E 通过

**时间预算**:1 天

---

## D7 · 2026-07-10 · polish + 录像 + 演练 + 自查

**目标**:UI polish + 录 4 段 demo 录像兜底 + 演练 DEMO_SCRIPT 三次 + 跑 narrative-framework §五 6 个失败模式自查

**任务清单**:
1. **UI polish**(0.5 天):小掌柜头像动画流畅度、暗色主题一致性、Trace Panel 折叠/展开过渡
2. **录 4 段 demo 视频兜底**(0.5 天):
   - 90s 完整版(覆盖 v2 DEMO_SCRIPT 6 幕)
   - 单独"小掌柜 + Trace Panel"30s 段
   - 单独"真决策 4 动作"30s 段
   - fallback UI 演示 30s 段
3. **演练 DEMO_SCRIPT 三次**(0.2 天):确保 180s 不超时,关键数字大声说
4. **失败模式自查**(0.1 天):跑 narrative-framework.md §五 的 6 个失败模式
   - ChatGPT Wrapper 陷阱
   - 功能堆砌陷阱
   - 技术自嗨陷阱
   - 没有痛点陷阱
   - 空愿景陷阱
   - Demo 翻车陷阱
5. **README + DEVLOG 更新**:加 "Agent 编排层"章节
6. **Git 操作**:commit + push 到 ship branch

**回归测试**:
- `npm run build` 通过
- `npm run test:e2e` 通过(11/11 + 新增 1-2 个 Agent E2E)
- 备用设备装好同版本代码

**时间预算**:1 天(必须严格守时,D7 没 buffer)

---

## D7 EOD 实际能 ship 的最小子集(挡 Reviewer P3-7 攻击)

> 这一段必须在 D7 上午写出来,自检"如果只能 ship 半天,我们交什么?"

| 功能 | 必 ship | 可砍 | 砍了影响 |
|---|---|---|---|
| 小掌柜头像 + 早报弹层 | ✅ | | 杀手锏核心 |
| Trace Panel(默认折叠) | ✅ | | 评审问"为什么是 Agent"时答不上 |
| 真决策动作(挪库 + 4 工具链) | ✅ | | 杀手锏核心 |
| 5 秒撤回机制 | ✅ | | 不影响评审但影响安全分 |
| 早报 live provider | ⚠️ | 可用 mock | 现场 LLM 慢就降级 |
| 第二个真决策动作 | | ❌ 已砍(v2 §五) | 评审不会问"只做了 1 个?" |
| 跨轨道跳转动画 | | 可砍 | 评审可能不看 |
| prefers-reduced-motion 检测 | | 可砍 | 现场投影不会卡 |
| 多语言 | | 可砍 | 中文评审足够 |
| 流式打字效果 | | 可砍 | mock fallback 已经够演示 |

**最坏情况 D7 EOD 真只能 ship 6 项**:小掌柜头像 + 早报(可 mock) + Trace Panel + 真决策 1 个 + 5 秒撤回 + 演练录像

---

## 失败模式自查清单(D7 上午跑)

按 `docs/narrative-framework.md` §五 的 6 条:

- [ ] 1. ChatGPT Wrapper 陷阱:v2 已经改成"独立 Workflow → Agent 编排层"叙事,不主动提"我们之前是 wrapper"
- [ ] 2. 功能堆砌陷阱:v2 砍了第二个真决策动作,只 ship 1 个深决策
- [ ] 3. 技术自嗨陷阱:不展开 LangGraph 实现细节,只讲"小掌柜 + 真决策 + 99 元/月"
- [ ] 4. 没有痛点陷阱:开场所提数字大声说"2.4 万/月 vs 99 元/月"
- [ ] 5. 空愿景陷阱:v2 收尾金句"一个 AI 团队,你的运营助理叫小掌柜,99 元/月——这就是一人公司"
- [ ] 6. Demo 翻车陷阱:4 段录像兜底 + 备用设备 + 现场网络切 mock

---

## 风险预案总表

| 风险 | 概率 | 应对 |
|---|---|---|
| step-3.7-flash 不支持 tool_use | 30-40% | D1 spike 验证后走 No-Go 路径,改文案不动代码 |
| 现场 LLM 慢 | 40% | 按"Replay Demo"走 mock fallback |
| Trace Panel 动画太快评审没看清 | 20% | `prefers-reduced-motion` 降级 + 重放按钮 |
| 确认按钮误点 | 10% | 5 秒撤回窗口 |
| 现场网络断 / 电脑崩 | 5% | 备用设备 + 90s 录像 |
| 评审追问"AI 运营助理真做了决策吗" | 60% | 诚实回答"挪库 + 4 个动作一次完成,这是商业决策不是 UI 自动化" |

---

## 时间总预算核查

| Day | 预算 | 真实风险 | 累计 buffer |
|---|---|---|---|
| D1 | 0.5h(spike) | spike 失败切 fallback | 6h |
| D2 | 6-8h | E2E 回归崩 | -2h |
| D3 | 12-16h | parser 写不出 → 降级 mock | -16h |
| D4 | 2-3h (Go) / 1h (No-Go) | adapter 改错 | -19h |
| D5 | 12h | 4 个工具链接不上 | -31h |
| D6 | 8h | user test 没空 → 砍 | -39h |
| D7 | 8h | 不可压缩 | -47h |

**真实 buffer**:**47h** ≈ **6 个工作日**。D1-D7 共 7 天,但实际可用 ≈ **5.5 个完整工作日 + 0.5 天文档**。**buffer 紧但够用**。

---

## 立即可执行(本 session 内)

按用户"全部都同意进实现"的指令,**今晚 session 内**能落的事:

1. ✅ 已完成:spec v2 / DEMO_SCRIPT v2 / spec-review / spike 脚本
2. **可做(D2 启动前的设计准备)**:
   - 写 ShopkeeperAvatar 组件骨架(stub 即可,D2 实际填)
   - 写 AgentRuntime Provider 骨架
   - 写 MorningBrief 类型定义
   - 写 TraceStep 类型定义
3. **不要做(留给 D2 真实开工)**:
   - 完整组件实现
   - 真接 LLM 逻辑
   - E2E 测试更新

如果你想让我直接落地 #2 的 stub,告诉我;否则 D1 spike 由你执行,我等结果。

---

*配套:spec v2 / DEMO_SCRIPT v2 / spike 脚本 / spec-review.md 全部已 ship-ready*