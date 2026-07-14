# Provenance：一人公司效率 Agent 决策稿

> 对应文档：`2026-07-13-solo-operator-efficiency-agent-decision.md`
> 核验日期：2026-07-13

## 方法

研究分为三条独立证据线：

1. 赛事一手规则：官方公众号、官方报名/提交页、用户提供的 7 月 13 日赛事会议原文。
2. 目标用户行为：2024-2026 自由职业者、小企业主、多项目知识工作调查与原始研究。
3. 先验方法与竞品：GTD、Kanban、PPM、TOC/CCPM、CRM 和当前 AI work management 官方资料。

筛选原则：优先一手官方、原始调查和同行评审研究；厂商调查降权；论坛与搜索标题不用于关键结论。来源可信度和产品验证阶段分为两轴：A/B/C 描述来源，V0-V3 描述产品验证。未获得可观察目标用户行为/实物不标 V2，未获得合同、流水、留存或量化业务结果不标 V3。

## 赛事来源

### 当前一手来源

- `2026-07-13 10_01 记录_原文.pdf`，用户提供并标注为当天赛事会议，8 页自动转写原文。用于较新的评分、赛道、赛程、彩排、路演和官方产品导向；提交字段仍以实时官方表单/选手群通知为准。路径：`/Users/mahaoxuan/Downloads/2026-07-13 10_01 记录_原文.pdf`；SHA-256：`1ce887b0dfde542be6a564830782faa14da25b5431fe23974ff99d8c4568858f`。
- [官方作品提交页](https://chuxinopc.yiyouliao.com/work-submit.html?eventId=contest_2026_chuxin_hackathon)，服务器 Last-Modified 为 2026-07-13。用于提交窗口、提交字段和 7 月 19 日线下要求。
- [官方活动目录](https://chuxinopc.yiyouliao.com/events.html)，服务器 Last-Modified 为 2026-07-13。用于当前活动日期与入口。

会议页码索引：赛道与效率示例 p.2-3；提交建议 p.3-4；90/10 与人工维度 p.4-5；AI 技术检测与创客共鸣 p.5；彩排 p.5-6；原则 5 分钟展示 + 5 分钟问答及现场代表要求 p.6。

### 历史来源及冲突

- [2026-06-24 招募公众号文章，06-29 修改](https://mp.weixin.qq.com/s/Y2rC3KXWRIcRhFJrS0YZcg)及其[官方规则长图](https://mmbiz.qpic.cn/sz_mmbiz_jpg/wdwjadXgY4CQ3H96cohPcTETbuqOnqQDukvC0uNLPMFg3aHFtOvn4vicUzwtP0lKz8ibhT47iaWgSXWcUkrOpa5nKA9t32HWqqxLzLlXlL7PDU/0?wx_fmt=jpeg)。旧图写评委 70% / 选手互评 20% / AI 10%，且赛期为 7 月 11-12 日。
- 7 月 13 日会议给出与旧图冲突且更晚的口径：评委 90% / AI 10%，创客共鸣奖单独由选手互评产生；赛程为 7 月 13-17 日开发、17 日中午提交、18 日彩排、19 日线下路演。会议未逐字宣布旧图废止，本文暂按较新会议执行。
- 官方报名页截至 7 月 13 日仍残留 7 月 11-12 日到场字段，说明官网存在部分未同步；涉及冲突时以 7 月 13 日会议和选手群最终通知为准。

### 转写边界

会议 PDF 为自动转写，存在明显识别错误，例如把“一人公司”识别为“艺人公司”、把 Agent/MCP 等英文转写错。决策稿只使用上下文无歧义、重复出现或可由总分校验的事实；不引用无法判定的专有名词。

## 目标用户与痛点来源

1. [Leapers - Mental Health in Freelancing 2025](https://www.leapers.co/research/2025/report/)
   - 2025 年调查、2026-01-07 发布；1,013 名英国自雇者；在线开放链接、自选、未加权。
   - 支持：客户沟通、反馈缺失和客户失联是高频关系/心理压力源。
   - 限制：没有直接测量交付延期；不能证明服务者会忘记 Waiting-for。

2. [Malt - Freelancing in Europe 2024](https://pages.malt.uk/hubfs/FIE_2024/PDF/FIE-2024_EN_FINAL.pdf)
   - 总报告覆盖 5,092 名欧洲平台注册自由职业者；相关障碍题有效 panel 约 3,600；调查在 2023 年 5-6 月执行，另有企业访谈与平台数据。
   - 支持：不现实预期、沟通不清、brief 不充分；长期客户关系的重要性。
   - 限制：平台成熟数字专业人才偏差；不直接证明最终验收错位。

3. [Slack/Salesforce - Small Business Productivity 2024](https://www.salesforce.com/news/stories/small-business-productivity-trends-2024/)
   - Talker Research 对 2,000 名美国小企业主的在线调查。
   - 支持：多工具状态查找、应用切换、错误位置找信息、跨平台重复消息。
   - 限制：“小企业”可到 2,000 人，且样本按世代均分；外推到一人公司为中等。

4. [State of Freelance Writing 2025](https://www.jacklimebear.com/post/state-of-freelance-writing-report)
   - 350 人便利样本，约 78% 全职自由职业者；作者披露科技/B2B 过度代表。
   - 支持：多客户并发是可行细分条件。
   - 限制：不能从多客户直接推导日常冲突。

5. [Huddle 2026 freelancer tools survey](https://huddle.app/blog/what-freelancers-say-about-managing-client-tools)
   - 500 人受邀、410 人回应；包含自由职业者、小团队与微型机构。
   - 支持：跨客户工具漏项与同步摩擦的方向性信号。
   - 限制：厂商利益相关，招募、地域、原始问卷和题目措辞披露不足；正文还存在“Nobody uses one tool”与“3% 使用一个工具”的内部矛盾，降为 C/V1 探索信号。

6. [ETH Zürich / CHIWORK 2025](https://www.research-collection.ethz.ch/items/3d26f221-841b-4a89-9b54-5df8caa4d3a0)
   - 15 名知识工作者，各自拍摄并标注 1 小时真实工作。
   - 支持：上下文偏离机制真实。
   - 限制：小样本且非自由职业者专样；多任务不必然降低效率。

7. [Write the Docs 2025 Salary Survey](https://www.writethedocs.org/surveys/salary-survey/2025/)
   - 48 国 755 人，contractor 子样本 80 人。
   - 支持反证：contractor 并非普遍工作失控。
   - 限制：行业与子样本较窄；多客户比例和工作量可控比例没有交叉表，不能证明多客户者同样可控。

8. [Project Overload 原始研究](https://www.sciencedirect.com/science/article/abs/pii/S0263786306000329)
   - 2006 年研究；9 家瑞典大型制造/制药/建筑企业、392 人。
   - 支持：项目过载与并行项目、流程、恢复不足相关的历史机制。
   - 限制：不是 2024-2026 市场证据，也不等同于一人公司。

## 方法与竞品来源

- [GTD Weekly Review 官方清单](https://gettingthingsdone.com/2018/08/episode-43-the-power-of-the-gtd-weekly-review/)：Waiting For、follow-up 与 next action 原则。
- [Kanban University 官方指南](https://kanban.university/kanban-guide/)：WIP limit、pull、完成优先。
- [TOCICO 术语表](https://www.tocico.org/_files/ugd/af4d5f_d4914b5dc3664c94888503caa0de960a.pdf)：drum、错峰释放、多任务切换。
- [PMI Portfolio Standard](https://www.pmi.org/-/media/pmi/documents/public/pdf/certifications/standard-for-portfolio-management-third-edition.pdf?rev=67c367d7cf8f483d8e67f99af78205f7)：战略、价值、风险、容量与持续组合优化。
- [Engwall & Jerbrant 多项目资源配置案例](https://www.diva-portal.org/smash/get/diva2%3A907024/FULLTEXT01.pdf)：延期、事后优先级、资源囤积和政治博弈。
- [Asana AI Teammates 触发与自我排期](https://help.asana.com/s/article/triggering-ai-teammates)及[能力边界](https://help.asana.com/s/article/ai-teammates)：证明 AI 主动跟进已存在，且仍受工作图和权限限制。
- [monday Agents](https://support.monday.com/hc/en-us/articles/33347027353746-AI-Agents-on-monday-com)：持续监控、依据定义优先级执行与 guardrails。
- [Dynamics 365 Assistant](https://learn.microsoft.com/en-us/dynamics365/sales/use-assistant-guide-customer-communications)：等待回复、长期不活跃和临近关闭日期检测。
- [HubSpot Sequences](https://knowledge.hubspot.com/sequences/create-and-edit-sequences?swcfpc=1)：自动邮件序列、任务和 follow-up 已是成熟能力。

## 尚缺证据

- 没有目标细分用户群体的真实工作日志或项目实物样本。
- 没有“等待事项被服务者忘记”的外部强 V2；目前只有创始人自述，尚未记录事故时间线、后果与脱敏实物。
- 没有 Agent 优先级建议的正确率、采纳率或业务结果。
- 没有客户链接点击/确认行为样本。
- 没有价格、合同、流水、复购或留存证据。

因此，“Waiting-for 异常雷达”是综合赛事契合、现场可见性、创始人自述和现有实现复用后的当前比赛赌注，不是已验证市场结论。
