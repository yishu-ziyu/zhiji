# 比赛演示机 · 桌面模型环境配置

`.app` **不会**打包仓库 `.env.local` 或任何密钥。

模型与可选 AnySearch 只能写到 Electron `userData`：

```text
~/Library/Application Support/FC-OPC iBot/.env.local
```

## 允许字段（仅这些）

| Key | 用途 |
|-----|------|
| `LLM_BASE_URL` | 模型网关 |
| `LLM_API_KEY` | 模型密钥 |
| `LLM_MODEL` | 模型名 |
| `AGENT_RUN_MODE` | 可选；`deterministic` 仅自测 |
| `AGENT_ALLOW_DETERMINISTIC_FALLBACK` | 可选；演示/验收禁止开 |
| `ANYSEARCH_API_KEY` | 可选；网页搜索 |

父进程里的 `ANTHROPIC_*` / `OPENAI_*` / `AWS_*` 等 **不会** 进入 capability 子进程。

## 安装命令（不打印密钥）

在仓库根目录：

```bash
# 方式 A：当前 shell 已 export 允许字段
export LLM_BASE_URL="https://…"
export LLM_API_KEY="…"
export LLM_MODEL="…"
# 可选：export ANYSEARCH_API_KEY="…"
node scripts/install-desktop-env.mjs

# 方式 B：从本地私有文件读取允许字段（文件本身勿提交）
node scripts/install-desktop-env.mjs --from "$HOME/private/fc-opc-llm.env"
```

脚本会：

1. 只写入 allowlist 键
2. 文件权限 `0600`（仅当前用户可读写）
3. 控制台只打印 `configured` / `missing`，不打印值

然后**完全退出并重新打开** `.app`。

## 自检

日志（无密钥）：

```text
~/Library/Application Support/FC-OPC iBot/logs/desktop.log
```

应看到 `LLM_API_KEY=configured`（或 missing）以及 `health ok`、`loadURL …/track/knowledge`。

## 禁止

- 把 `.env.local` 拷进 `.app` 或 `.desktop-stage`
- 用 `...process.env` 把整机密钥传给 Next 子进程
- 在群聊/工单里粘贴真实 Key
