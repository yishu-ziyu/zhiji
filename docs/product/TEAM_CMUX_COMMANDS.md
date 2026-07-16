# 全员 cmux 命令手册（官方 CLI · 团队协调）

> **来源：** `cmux --help`、`cmux docs`、GitHub `manaflow-ai/cmux` 的 CLI Contract / agents skill / agent-hooks。  
> **更新：** 2026-07-16  
> **全员必读。** 与 `TEAM_CMUX.md`（规则）配套；本文件是**可复制命令**。

---

## 0. 先懂四层（官方模型）

```text
window（窗口）
  └── workspace（侧栏一个工作区/「页」）
        └── pane（分屏格子）
              └── surface（格子里的标签：终端 / 浏览器）
```

- 默认引用：`window:N` · `workspace:N` · `pane:N` · `surface:N`
- **编号会变**。每次调度前用 `cmux tree` 解析，**禁止死记过期编号**。
- 环境变量（在 cmux 终端内）：`CMUX_WORKSPACE_ID` · `CMUX_SURFACE_ID` · `CMUX_TAB_ID`
- 官方能力边界：**连布局与终端**，**不合并**各窗 LLM 聊天大脑。互通仍靠 **盘上 handoff + 路径**。

---

## 1. 每天必会（团队协调核心 8 条）

### 1.1 看清谁在哪

```bash
cmux tree --all
cmux tree --workspace workspace:9          # 本团队常用工作区；编号以 tree 为准
cmux identify --json                       # 当前窗自己是谁
cmux list-workspaces
cmux list-pane-surfaces --workspace workspace:9
```

### 1.2 派任务（G1 → 某席）

```bash
# 发文字（多数 agent 还要再发 Enter）
cmux send --surface surface:NN "你的派工全文"

# 提交输入（等价回车）
cmux send-key --surface surface:NN enter
# 或：
cmux send --surface surface:NN $'\n'
```

**规范：** 长派工用 heredoc / 文件内容；路径必须是绝对路径。

### 1.3 收进度（读屏）

```bash
cmux read-screen --surface surface:NN --lines 40
cmux read-screen --surface surface:NN --scrollback --lines 80
# 别名
cmux capture-pane --surface surface:NN --lines 40
```

### 1.4 提醒某席

```bash
cmux notify --surface surface:NN --title "G1" --body "请读 handoff 路径 XXX"
cmux trigger-flash --surface surface:NN
```

### 1.5 侧栏状态（全组可见）

```bash
cmux set-status g3 "A6 doing" --workspace workspace:9 --color "#007aff" --priority 80
cmux set-status g3a "A7 doing" --workspace workspace:9 --color "#007aff" --priority 70
cmux clear-status g3 --workspace workspace:9
cmux list-status --workspace workspace:9

cmux set-progress 0.4 --label "015" --workspace workspace:9
cmux clear-progress --workspace workspace:9
```

### 1.6 工作区泳道状态（官方 workspace status）

```bash
cmux workspace status set working --workspace workspace:9
# 常见：todo | working | needs-attention | review | done 等（以 CLI 帮助为准）
cmux workspace status get --workspace workspace:9
```

### 1.7 改名（席位/页）

```bash
cmux rename-tab --surface surface:NN "G3·实现"
cmux rename-workspace --workspace workspace:9 "交产品 · 六席"
```

### 1.8 同项目多窗

```bash
cmux new-workspace --name "G3A" --cwd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
cmux workspace-group list
cmux workspace-group create --name "交产品" --from workspace:9,...
```

---

## 2. 本团队角色 × 你该敲的命令

| 席 | 你主要用 | 你几乎不用 |
|----|----------|------------|
| **G1** | `tree` · `send` · `send-key` · `read-screen` · `notify` · `set-status` · `workspace status` | 在小弟窗里手改业务当唯一进度 |
| **G2** | 写盘 handoff；可选 `notify` 喊 G1 `NEED_DISPATCH` | **禁止** `send` 直接命令 G3（只听 G1） |
| **G3/A/B** | 干活；收工写 `.ship/handoffs/`；可用 `set-status` 标自己 | 互 `send` 当老板 |
| **G4** | `read-screen` 自检自己窗；验收写 handoff | 改实现冒充过 |
| **G5/G6** | 同上；演示/体验 handoff | 横派实现 |

**硬规则（与 TEAM_CMUX 一致）：**

1. 只听 **G1** 的 `send`。  
2. 结果真相在 **`.ship/handoffs/*.md`**，不是聊天记录。  
3. 要别人干：handoff 写 `需要 G1 转 Gx：…`，**不要**自己 `cmux send` 指挥他席。  
4. G2 交规范后 handoff 标 `NEED_G1_DISPATCH`；**G1 同轮必须转发**。

---

## 3. G1 标准调度脚本（复制改 surface）

```bash
# 0) 解析编号
cmux tree --workspace workspace:9

# 1) 派 G2 写规范
cmux send --surface surface:G2 "【G1】读 board… 写 handoff… NEED_G1_DISPATCH"
cmux send-key --surface surface:G2 enter

# 2) 读 G2 是否 DONE
cmux read-screen --surface surface:G2 --lines 30

# 3) 同轮派实现 + 验收（禁止积压）
cmux send --surface surface:G3 "$(cat .ship/handoffs/G2-xxx.md 里的派发正文)"
cmux send-key --surface surface:G3 enter
cmux send --surface surface:G4 "【G1】等 G3 handoff 后证伪…"
cmux send-key --surface surface:G4 enter

# 4) 状态
cmux set-status pipe "A6→G3 A7→G3A" --workspace workspace:9 --priority 100
```

---

## 4. 各席收工最小动作（高效）

```bash
# 1) 写文件（必须）
#    .ship/handoffs/G3-A6-done.md

# 2) 可选：通知 G1 所在 surface（编号每次 tree）
cmux notify --title "G3" --body "DONE · .ship/handoffs/G3-A6-done.md"

# 3) 可选：状态 pill
cmux set-status g3 "DONE A6" --color "#34c759" --priority 90
```

**禁止：** 只在自己屏幕上说「做完了」却不写 handoff。

---

## 5. 事件流（高级 · 可选）

```bash
cmux events --category notification --limit 20
cmux events --reconnect --cursor-file ~/.cache/cmux/events.seq
```

用于长时间盯通知，不代替 handoff。

---

## 6. 多 Agent 启动（官方团队入口）

```bash
cmux claude-teams          # Claude Code agent teams + cmux 分屏
cmux codex-teams           # Codex 子 agent 原生 pane
cmux omo / omx / omc       # 其他 agent 集成
```

本产品线默认仍是：**已开好的 G 席 + G1 send**，不必每次 claude-teams。

---

## 7. 键位类 send-key（常用）

```bash
cmux send-key --surface surface:NN enter
cmux send-key --surface surface:NN escape
cmux send-key --surface surface:NN ctrl+c
```

完整键名以 `cmux send-key --help` 为准。

---

## 8. 文档入口（官方）

```bash
cmux docs
cmux docs agents
cmux docs api
cmux docs settings
cmux docs shortcuts
```

原始契约（网络）：

- Skill：`https://raw.githubusercontent.com/manaflow-ai/cmux/main/skills/cmux/SKILL.md`
- CLI Contract：`https://raw.githubusercontent.com/manaflow-ai/cmux/main/docs/cli-contract.md`
- Agent hooks：`https://raw.githubusercontent.com/manaflow-ai/cmux/main/docs/agent-hooks.md`

---

## 9. 本仓协作文件索引

| 文件 | 内容 |
|------|------|
| `docs/product/TEAM_CMUX.md` | 规则：谁听谁、handoff |
| `docs/product/TEAM_CMUX_COMMANDS.md` | **本文件 · 命令** |
| `docs/product/TEAM_BRIEFING.md` | 人事与大事 |
| `docs/product/G-SEATS.md` | 席位职责 |
| `.ship/handoffs/` | 唯一交卷目录 |

---

## 10. 自检（全员回一行）

读完本文件后，在自己窗回 G1（或写 handoff 一行）：

```text
ACK · <席位> · 会 tree/send/read-screen/handoff · 不横派
```
