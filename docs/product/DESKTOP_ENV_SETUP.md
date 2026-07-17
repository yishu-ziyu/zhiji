# 比赛演示机 · Bring Your Own Key（BYOK）

`.app` **不预装、不打包**任何模型密钥。
每个使用者自己填自己的 Key。

配置只存在于本机 Electron `userData`：

```text
~/Library/Application Support/知几/.env.local
```

## 允许字段（仅这些）

| Key | 用途 |
|-----|------|
| `LLM_BASE_URL` | 你的模型网关 |
| `LLM_API_KEY` | 你的模型密钥 |
| `LLM_MODEL` | 你的模型名 |
| `AGENT_RUN_MODE` | 可选；`deterministic` 仅自测 |
| `AGENT_ALLOW_DETERMINISTIC_FALLBACK` | 可选；演示/验收禁止开 |
| `ANYSEARCH_API_KEY` | 可选；网页搜索 |

打包后的 `.app` **只读上述文件**。
父进程里的 `ANTHROPIC_*` / `OPENAI_*` / `AWS_*` 等 **不会** 进入能力层子进程，也 **不会** 被自动写入该文件。

## 用户自己填（推荐：应用内）

1. 打开工作台 `/track/knowledge`（`.app` 会直接进这里）
2. 顶栏点 **钥匙图标**（模型密钥），或点黄条「去填写」
3. 填三项：网关地址 · API Key · 模型名 → **保存并生效**（无需重启）

未配置时顶栏钥匙会偏橙色，并出现提示条。
GET 状态接口**从不返回**密钥明文。

## 备选：命令行写空白文件再手改

```bash
# 1) 生成空白模板（若不存在；不写入任何密钥）
node scripts/install-desktop-env.mjs

# 2) 用编辑器打开，自己填写三项
open -e "$(node scripts/install-desktop-env.mjs --print-path)"

# 3) 保存后，完全退出再打开 .app（或用应用内面板覆盖写入）
```

模板里是空的 `LLM_*=` 行。你自己粘贴网关与 Key。

权限：文件 `0600`（仅当前用户可读写）。

## 自检

日志（只显示是否已配置，不显示值）：

```text
~/Library/Application Support/知几/logs/desktop.log
```

- 已填：`LLM_API_KEY=configured` 等
- 未填：`missing` → 应用仍可启动工作台，但真模型理解会按产品语义失败/据实报错，不会假「读懂」

## 禁止

- 把仓库或 shell 里的 Key 预装进 `.app` / staging
- 用 `...process.env` 把整机密钥塞给子进程
- 在文档、工单、录屏字幕里贴真实 Key
- 代用户「提前写好」演示机密钥（演示机也应 BYOK 或现场填写）
