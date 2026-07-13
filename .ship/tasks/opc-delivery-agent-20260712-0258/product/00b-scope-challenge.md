# Scope Challenge — OPC Delivery Ops Agent

## Candidate requirements

| Requirement | Owner | Keep / Cut / Defer | Reason |
|---|---|---|---|
| 客户对话 → 承诺提取 | User (product owner) | **Keep** | 交付闭环入口 |
| 承诺 → 任务 + 状态机 | User | **Keep** | 核心业务对象 |
| 闭环率 / 漏项 / 逾期仪表盘 | User | **Keep** | 北极星可评测 |
| 主动提醒（今日待交付 / 逾期） | User | **Keep** | 「运营助手在盯」的可证伪信号 |
| 极致 Web UI（全场级） | User | **Keep** | 创客共鸣 + 90% 人工分主武器 |
| 固定金标准 Demo 剧本 + L1 回归 | Agent (quality) | **Keep** | yishuship / TDD 可测 |
| 会议纪要生成作为主功能 | Legacy dual-track | **Cut as core** | 用户明确：纪要不重要；可作输入格式 |
| 双赛道电商并行展示 | Legacy plan | **Cut** | 无电商账号；分散记忆点 |
| 真 tool_use / multi-agent 编排秀 | Old killer-feature plan | **Defer** | 10% 技术分，不绑架 Demo 稳定 |
| 微信原生小程序 | Platform ambition | **Defer** | 点火期 H5/作品页即可；内核 API 解耦预留 |
| 客户沟通报价完整 CRM | Track menu | **Defer** | 可扩展入口，非本周 must |
| 知识库 / 研究报告 Agent | Track menu / personal strength | **Defer** | 可作为第二幕加分，不当主标题 |
| 多用户 / 登录 / 数据库生产化 | Infra | **Cut** | 黑客松 in-memory / localStorage 足够 |
| SSE 流式打字 | Nice-to-have | **Defer** | 不挡闭环 |

## Deleted or deferred

- 电商主叙事、店铺数据、选品脚本（本场）
- 以「会议纪要」为首页的产品形态
- 原生小程序、桌面壳、真实多租户
- 第二个真决策链 / 复杂 tool_use 适配

## Must-ship this cycle (→ 7/18)

1. 一次客户对话输入 → 承诺列表（可改）→ 任务板 → 交付确认
2. 状态机：`Captured → In Progress → Delivered → Confirmed`
3. 仪表盘：闭环率、漏项/逾期可见
4. 失败定义在 UI 与测试中显式：无任务的长总结不算成功
5. Web UI 达到「像上架产品」水准 + 180s 路演可重复
6. mock fallback + 可选录像兜底

## Explicit non-goals

- 做第二个 Notion / 第二个 ChatGPT 包装
- 功能菜单覆盖赛道二全部 6 个子场景
- 为多端并行开发牺牲主 Web 完成度
