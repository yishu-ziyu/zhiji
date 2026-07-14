# step-3.7-flash tool_use Spike 运行手册 v2

> **目的**:15 分钟内验证架构假设,产出 Go / No-Go 决策
> **决策依赖**:Go/No-Go 决定后续 6 天 `shared/llm/adapter.ts` 升级路径
> **配套**:`docs/spike/stepfun-tool-use-spike.md` v1(原版分析)、`docs/superpowers/specs/2026-07-04-killer-feature-design-v2.md` §3.5

---

## 0. 三条硬规则(必读)

1. **不要发 `response_format` 也不要发 `temperature`** — `step-3.7-flash` 是 StepFun 的 reasoning 模型,这两个字段会让请求直接 400。已在 `feedback_stepfun_3_7_flash_400.md` 留底,踩过 6 次。
2. **本机代理是 cc-switch 在 `127.0.0.1:15721`** — 它做 Anthropic 兼容转发,key 不做校验,所以 `LLM_API_KEY=local-proxy-placeholder` 也能跑通;真正生效的 key 在 cc-switch 后端配置。
3. **adapter 当前不支持 tool_use** — `shared/llm/adapter.ts` 完全没透传 `tools` 字段、也没解析 `tool_use` block。spike 就是验证模型**自己**支不支持,跟当前代码无关。

---

## 准备(2 分钟)

### 0.1 确认代理活着

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:15721/v1/messages \
  -X POST -H "x-api-key: test" -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"x","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'
# 期望:200 / 400(只要不是 connection refused 就行)
# 如果是 connection refused → 启动 cc-switch 或换 fallback
```

### 0.2 确认 .env.local

文件路径:`/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.env.local`

```bash
cat /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.env.local
# 必须包含:
# LLM_API_KEY=local-proxy-placeholder
# LLM_BASE_URL=http://127.0.0.1:15721
# LLM_MODEL=step-3.7-flash
```

### 0.3 创建产出目录

```bash
mkdir -p /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs
```

### 0.4 准备 fallback 变量(一次性导出到当前 shell)

```bash
# StepFun 本地代理(走 cc-switch)
export STEPFUN_BASE="http://127.0.0.1:15721"
export STEPFUN_KEY="local-proxy-placeholder"
export STEPFUN_MODEL="step-3.7-flash"

# MiniMax(Anthropic 兼容)
export MINIMAX_BASE="https://api.minimaxi.com/anthropic"
export MINIMAX_KEY="${MINIMAX_API_KEY:?set in env, never commit}"
export MINIMAX_MODEL="MiniMax-M2.7"

# DeepSeek(OpenAI 兼容)
export DEEPSEEK_BASE="https://api.deepseek.com"
export DEEPSEEK_KEY="${DEEPSEEK_API_KEY:?set in env, never commit}"
export DEEPSEEK_MODEL="deepseek-v4-pro"
```

---

## 第一波 · step-3.7-flash 原生测试(3 分钟)

> 用一个最小 tool schema 触发 tool_use。**禁发 response_format 和 temperature**。

```bash
curl -sS -X POST "$STEPFUN_BASE/v1/messages" \
  -H "x-api-key: $STEPFUN_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$STEPFUN_MODEL\",
    \"max_tokens\": 1024,
    \"tools\": [{
      \"name\": \"create_task\",
      \"description\": \"Create a Kanban task\",
      \"input_schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"title\": {\"type\": \"string\"},
          \"priority\": {\"type\": \"string\", \"enum\": [\"P0\",\"P1\",\"P2\"]}
        },
        \"required\": [\"title\"]
      }
    }],
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"Create a P0 task for publishing SKU-12 video tonight\"
    }]
  }" | tee /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/step-3.7-flash-raw.json | jq '.content[] | {type, name: .name, input: .input, text: .text}'
```

**保存原始响应**到日志:

```bash
# 上面那条 tee 已经存了;再存一份到 spike-logs/
cp /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/step-3.7-flash-raw.json \
   /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/step-3.7-flash-$(date +%H%M%S).json
```

---

## 判断(1 分钟)

| 返回特征(JSON 字段) | 决策 |
|---|---|
| `content[].type === "tool_use"` 出现,`name === "create_task"`,`input` 含 `{title, priority:"P0"}` | **Go** ✓ |
| `content[].type === "tool_use"` 出现但 `name` 错或 `input` 字段缺失/乱码 | **半 Go**(模型能力有,但需 prompt 调) |
| `content[]` 只有 `type === "text"`,模型把 JSON 写在文本里 | **No-Go** ✗(reasoning 模型不触发 tool_use) |
| HTTP 400 / 401 / 500 / 超时 | 走 §"失败排查" → fallback |

**jq 速判**:
```bash
# 看 content 块类型分布
cat /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/step-3.7-flash-raw.json | \
  jq '.content | map(.type) | unique'
# 期望 Go:["text","tool_use"];No-Go:["text"]
```

---

## 失败排查(2 分钟)

| 现象 | 根因 | 修复 |
|---|---|---|
| `400 invalid request` | 误发 `response_format` / `temperature` 或 model 名错 | **确认 curl body 里没这两个字段**;`echo $STEPFUN_MODEL` 确认是 `step-3.7-flash` |
| `401` | key 被 cc-switch 后端拒(罕见,代理一般不校验) | 看 cc-switch 日志;临时换 `LLM_API_KEY=$MINIMAX_KEY` 走 MiniMax 协议 |
| `404 Not Found` | model 名拼错,StepFun 后端认不出 | 跑 `curl -sS $STEPFUN_BASE/v1/models -H "x-api-key: $STEPFUN_KEY" \| jq '.data[].id'` 拉真实模型清单 |
| `connection refused` | cc-switch 没启动 | `lsof -iTCP:15721 -sTCP:LISTEN` 查;没有就 `cc-switch` 或 `open -a cc-switch` |
| 30s 超时无响应 | reasoning 模型思考慢 | 重跑一次,给 `max_tokens: 2048`;仍超时就 fallback |

---

## 第二波 · fallback provider 验证(4 分钟)

> 至少跑通 2 个 fallback,保证即使 step-3.7-flash 全挂,主链路还有救。

### 第二波 A · MiniMax-M2.7(Anthropic 兼容,语义最贴近主链)

```bash
curl -sS -X POST "$MINIMAX_BASE/v1/messages" \
  -H "x-api-key: $MINIMAX_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MINIMAX_MODEL\",
    \"max_tokens\": 1024,
    \"tools\": [{
      \"name\": \"create_task\",
      \"description\": \"Create a Kanban task\",
      \"input_schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"title\": {\"type\": \"string\"},
          \"priority\": {\"type\": \"string\", \"enum\": [\"P0\",\"P1\",\"P2\"]}
        },
        \"required\": [\"title\"]
      }
    }],
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"Create a P0 task for publishing SKU-12 video tonight\"
    }]
  }" | tee /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/minimax-raw.json | \
  jq '.content[] | {type, name: .name, input: .input, text: .text}'
```

**判断**:
- 出现 `tool_use` 且 `name`/`input` 正确 → **MiniMax Go**
- 只有 `text` → **MiniMax No-Go**(换 DeepSeek)
- HTTP 错 → 看 status code,401/403 找 key 问题,500/超时降级到 DeepSeek

### 第二波 B · DeepSeek v4-pro(OpenAI 兼容,tool 用 `tools` 字段)

```bash
curl -sS -X POST "$DEEPSEEK_BASE/v1/chat/completions" \
  -H "Authorization: Bearer $DEEPSEEK_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$DEEPSEEK_MODEL\",
    \"max_tokens\": 1024,
    \"tools\": [{
      \"type\": \"function\",
      \"function\": {
        \"name\": \"create_task\",
        \"description\": \"Create a Kanban task\",
        \"parameters\": {
          \"type\": \"object\",
          \"properties\": {
            \"title\": {\"type\": \"string\"},
            \"priority\": {\"type\": \"string\", \"enum\": [\"P0\",\"P1\",\"P2\"]}
          },
          \"required\": [\"title\"]
        }
      }
    }],
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"Create a P0 task for publishing SKU-12 video tonight\"
    }]
  }" | tee /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/deepseek-raw.json | \
  jq '.choices[0].message | {tool_calls: .tool_calls, content: .content}'
```

**判断**:
- `tool_calls[]` 出现且 `function.name === "create_task"` + `arguments` 是合法 JSON → **DeepSeek Go**
- `tool_calls` 为空/null,只有 `content` 文本 → **DeepSeek No-Go**(需 prompt 强制 function call:加 `"tool_choice": "required"`)
- HTTP 错 → 看 status,403/429 是限速/余额,直接降级 mock

### 强制 tool_call 兜底(若 DeepSeek 默认不触发)

```bash
# 在 DeepSeek 请求体里加 tool_choice
# 替换上面 -d 参数末尾的 "messages": [...] 后,插入一行:
#   "tool_choice": "required"
# DeepSeek 支持 tool_choice,通常能强制出来
```

---

## Go/No-Go 决策矩阵

| step-3.7-flash | MiniMax | DeepSeek | 决策 | 后续动作 |
|---|---|---|---|---|
| **Go** | (不必测) | (不必测) | **全 Go** | `shared/llm/adapter.ts` 加 `tools` 透传 + `tool_use` 解析(2-3h);Trace Panel 真 trace;D3-D4 顺势推进,创新性 20% 拉满 |
| **No-Go** | **Go** | (不必测) | **MiniMax 接力 Go** | `.env.local` 切 `LLM_BASE_URL=https://api.minimaxi.com/anthropic` + `LLM_MODEL=MiniMax-M2.7`;adapter 仍按 Anthropic 协议升级;叙事不变 |
| **No-Go** | **No-Go** | **Go** | **DeepSeek 接力 Go** | adapter.ts 改成 OpenAI 协议(`/v1/chat/completions` + `tool_calls` 解析),3-4h;叙事不变 |
| **No-Go** | **No-Go** | **No-Go** | **全 No** | **老实降级**:Trace Panel 改"思考过程可视化",文案按 v1 §三"No-Go 路径"重写;创新性 15% 诚实声明,完成度保底 |
| **都不通(代理挂 + key 挂 + 公网挂)** | — | — | **全挂** | **Mock fallback**:所有 LLM 调用走预生成数据,Trace Panel 用 fixture JSON 跑通前端;**Demo 录屏模式,不再跑 live LLM** |

---

## 产出

### 1. 写决策结果

文件:`/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-result.md`

```markdown
# step-3.7-flash tool_use spike 结果

**时间**:2026-07-04 HH:MM
**执行人**:Claude Code spike agent
**配套文档**:docs/spike/stepfun-tool-use-spike-v2-runbook.md

## 三个 provider 结果
| Provider | 模型 | tool_use 触发? | 备注 |
|---|---|---|---|
| StepFun | step-3.7-flash | Go / No-Go / 半Go | <原始响应行数> |
| MiniMax | MiniMax-M2.7 | Go / No-Go | |
| DeepSeek | deepseek-v4-pro | Go / No-Go | |

## 决策
**最终方案**:<贴决策矩阵的那一行>

## 后续动作(明早 D2 开工前必做)
- [ ] adapter.ts 改造 / 不改造
- [ ] .env.local 改值 / 不改
- [ ] spec v2 §3.5 文案确认 / 调整
- [ ] 通知 D2-D4 推进

## 异常 & 备注
<任何 4xx / 5xx / 超时 / 重试记录>
```

### 2. 日志归档

目录:`/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/`

必须保留:
- `step-3.7-flash-<HHMMSS>.json` 原始响应
- `minimax-<HHMMSS>.json`
- `deepseek-<HHMMSS>.json`

### 3. 通知下游(若决策有变)

- D2 agent 读 `.progress/spike-result.md`,按"后续动作"开工
- 如果决策从 v1 计划的 Go 切到 No-Go,需要同步改:
  - `docs/superpowers/specs/2026-07-04-killer-feature-design-v2.md` §3.5
  - `docs/demo/DEMO_SCRIPT.md` v2 第 90-120s(Trace Panel 展示段)

---

## 附:本次 spike 假设变更记录

| 原假设(v1) | 验证后真实情况 | 影响 |
|---|---|---|
| `.env.local` 在 `lib/llm/` 下 | 实际在项目根 `.env.local`,`shared/llm/adapter.ts` 读 `process.env` | 无影响,跑命令前确认值 |
| adapter.ts 路径在 `lib/llm/adapter.ts` | 实际在 `shared/llm/adapter.ts` | Go 路径改造的文件路径要改 |
| `response_format` / `temperature` 必须发 | reasoning 模型必须**不发** | 严禁出现在 curl body |
| 代理 URL 不确定 | 确认是 cc-switch `127.0.0.1:15721`,key 写啥都过 | spike 命令可直接跑 |
| fallback 链含 Agnes | Agnes 是图像/视频模型,文本 tool_use 用不上 | fallback 链改为 MiniMax + DeepSeek |

---

*配套 spec:`docs/superpowers/specs/2026-07-04-killer-feature-design-v2.md` §3.5*
*配套 demo:`docs/demo/DEMO_SCRIPT.md` v2(180s 逐秒切片)*
*踩坑参考:`~/.claude/projects/-/memory/feedback_stepfun_3_7_flash_400.md`*