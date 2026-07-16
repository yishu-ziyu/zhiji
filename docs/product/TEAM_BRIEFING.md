# 全员通报（人事 · 系统 · 规范）

> **任何大变动写进本文件顶部。**  
> **最近大事（2026-07-16）：G5/G6 改 Builder；全池干活。G1 聊产品；G2 规划·派发·验收。演示/体验归主人。**  
> G1 更新通报；**全体必读**；G2 通知 Builder 池。

**最近更新：** 2026-07-16

---

## 1. 协作总规则（现行）

| 条 | 内容 |
|----|------|
| 主人 | 定行为；亲手判断好不好用；交卷极高质量；演示自己来 |
| G1 | 主裁：只对主人聊产品；意图给 G2 |
| G2 | 工程指挥：Matt 序规划；派 Builder；**自己验收**；不灌过程给主人 |
| Builder×6 | G3/G3A/G3B/**G4/G5/G6** 全是写码的；只听 G2 |
| 互通 | 只认 handoff · `HANDOFF_PROTOCOL.md` |
| 顺序 | Matt：to-spec → to-tickets → implement/tdd → verify → handoff |

---

## 2. 人事（现行编制）

| 席 | 身份 | 备注 |
|----|------|------|
| G1 | 主裁 · 对主人 | 不收全池技术汇报 |
| G2 | 工程指挥 | 规范·派发·验收 |
| G3 · G3A · G3B · **G4 · G5 · G6** | **Builder 池×6** | 无终身工种；每刀切片 |

**已作废：** G5=演示交付；G6=体验专席；G4=终身验收官；运维席；「体验靠 G6」。


---

## 3. 规范与材料（G2 必修）

| 类 | 路径 |
|----|------|
| 范式总册 | `/Users/mahaoxuan/Desktop/黑客松/docs/agent-product-paradigm/`（00–13） |
| 提示词 | `即时学习/你没活干吗_提示词怎么写/transcript.md` |
| 项目负责 | `即时学习/玄米4S_如何设计负责一个项目/transcript.md` |
| 评测/context 等 | 见范式 `01-sources.md` |
| cmux 运转 | `docs/product/TEAM_CMUX.md` |
| 席位 | `docs/product/G-SEATS.md` |
| **Handoff 互通** | `docs/product/HANDOFF_PROTOCOL.md` |
| 当前主刀合同 | `docs/product/dev-contract-015-first-user-real-entry-v1.md` |

G2 能力证明：`.ship/handoffs/G2-norm-mastery.md`（须覆盖本通报变更）。

---

## 4. 产品行为冻结（现行主刀摘要）

- 资料进产品：拖拽和/或上传  
- **A3=甲：** 无项目时先新建命名，确认后再收文件  
- 默认禁止假 seed 冒充用户局面  
- 本版不做整夹自动拆多项目  
- 交卷：2026-07-17 12:00；质量不降  

---

## 4.1 防卡循环（改版后）

主人用法反馈 → G1 记台账 + 意图给 G2 → **G2（Matt）spec/tickets → 派 Builder → G2 验收** → 更板 → **一行**回 G1 → **主人亲手点头**。

G1 不积压；G2 不空挡；Builder 不默认报 G1；**无闲置演示/体验席**。

## 4.2 主人报缺陷

G1 同轮：记 `OWNER_FEEDBACK` → 整包给 G2 → G2 派 Builder 修 → G2 工程验收。  
体验好不好：**主人说了算**。

## 4.3 台账

| 谁 | 干什么 |
|----|--------|
| 主人 | 用法、好不好用、演示自己来 |
| G1 | 台账 + 优先级 + 只对接 G2 |
| G2 | BDD、派发、验收、工程板 |
| Builder×6 | 只回 G2 |

台账：`.ship/tasks/first-user-real-entry-015/control/OWNER_FEEDBACK.md`

## 4.4 长程任务对照（本机 skill）

| 层 | 本机 | 本编制映射 |
|----|------|------------|
| 人只在首尾 | **agentic-ops** | 主人≈首尾；中间 G2 管 |
| 想法→交付 | **ship**（12 步，长程可 Long Run） | G1 不预占 12 步甩给主人 |
| 隔夜可验证环 | **gnhf** | 有明确 stop 才用 |
| 并行 worktree | **treehouse** | G2 派实现时防撞 |
| 合并门 | **no-mistakes** | 交卷/合入前 |
| 多 agent 舰队 | **firstmate** | 可选；日常用 cmux 六席 |

细节：`~/.grok/skills/agentic-ops/SKILL.md` · `~/.agents/skills/ship/SKILL.md` · `~/.codex/docs/AGENTIC_ENGINEERING_STACK.md`

## 5. 变更日志

| 日期 | 变更 |
|------|------|
| 2026-07-16 | 建作战板；015 真实接入；A3=甲 |
| 2026-07-16 | G5→演示交付；运维出范围 |
| 2026-07-16 | 实现池 G3+G3A+G3B；不锁死身份 |
| 2026-07-16 | TEAM_CMUX；G2 必修全材料 |
| 2026-07-16 | **本通报制度：大事必更本文 + 全员/G2 必读** |
| 2026-07-16 | 主人反馈台账 OWNER_FEEDBACK；G2 不空挡；G1=主裁不堆码 |
| 2026-07-16 | **G5/G6→Builder；G4→Builder；验收归 G2；演示/体验归主人** |

- 2026-07-16 全员：TEAM_CMUX_COMMANDS.md（官方 CLI 调研）必读
