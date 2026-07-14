# step-3.7-flash tool_use 验证 Spike 运行手册 v2

> **2026-07-04 修正版** · 基于代码现状审查
> **核心修正**:真实路径是 `shared/llm/adapter.ts`,**不是** `lib/llm/adapter.ts`
> **决策依赖**:Go/No-Go 决定 D2-D7 的 adapter.ts 改造路径

---

## 0 · 真实代码事实(必读)

| 项 | 真实情况 | 文件:行 |
|---|---|---|
| Adapter 路径 | `shared/llm/adapter.ts` | — |
| 协议 | Anthropic Messages `/v1/messages` | adapter.ts:57 |
| `tools` 字段透传 | **没有**(body 构造完全不含 tools) | adapter.ts:48-55 |
| `tool_use` block 解析 | **没有**(只 filter `type === "text"`) | adapter.ts:81-83 |
| 默认 model | `step-3.7-flash`(硬编码) | adapter.ts:6 |
| env 变量名 | `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` 或 `ANTHROPIC_AUTH_TOKEN` | adapter.ts:4-6 |
| Base URL 默认值 | `http://127.0.0.1:15721` | adapter.ts:4 |
| **已知踩坑** | dev server 改 .env 不重启不生效;reasoning model 拒收 response_format/temperature | memory `project_stepfun_3_7_flash_400.md` |

---

## 一、准备(2 分钟)

### 1.1 确认 .env.local 变量

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
cat .env.local
```

至少有以下之一(优先级 `LLM_API_KEY` > `ANTHROPIC_AUTH_TOKEN`):
- `LLM_API_KEY=<your_key>`
- 或 `ANTHROPIC_AUTH_TOKEN=<your_key>`

如果都没设,**spike 一定失败**,先去 `.env.local` 补。

### 1.2 确认代理在跑

```bash
curl -s -m 3 http://127.0.0.1:15721/health 2>&1 | head -5
# 或
curl -s -m 3 http://127.0.0.1:15721/v1/models 2>&1 | head -20
```

返回 200 = OK;返回拒绝/超时 = 启动 Anthropic 兼容代理(用户本机配置,见 memory `llm_provider_config.md`)。

---

## 二、第一波 · step-3.7-flash 原生 tool_use 测试(5 分钟)

### 2.1 测试请求

**真实可跑命令**(基于 `shared/llm/adapter.ts` 真实字段):

```bash
source .env.local  # 加载 LLM_API_KEY 和 LLM_BASE_URL

curl -s -X POST "${LLM_BASE_URL:-http://127.0.0.1:15721}/v1/messages" \
  -H "x-api-key: ${LLM_API_KEY:-$ANTHROPIC_AUTH_TOKEN}" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "step-3.7-flash",
    "max_tokens": 1024,
    "tools": [{
      "name": "create_task",
      "description": "Create a Kanban task card for tracking work",
      "input_schema": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "description": "Task title in Chinese" },
          "priority": { "type": "string", "enum": ["P0", "P1", "P2"] },
          "due": { "type": "string", "description": "ISO date or relative like today/tomorrow" }
        },
        "required": ["title", "priority"]
      }
    }],
    "messages": [{
      "role": "user",
      "content": "我需要为今晚发布的 SKU-12 短视频建一个 P0 任务,截止时间是今天 23:59"
    }]
  }' | python3 -m json.tool
```

### 2.2 判断返回(1 分钟)

**返回 JSON 必须包含 `content: [...]`,逐个 block 检查**:

| 返回特征 | 决策 | 后续动作 |
|---|---|---|
| `content[].type === "tool_use"` 出现,`name: "create_task"`,`input` 含 `title/priority` | **✓ Go** | D2 立即开始改 adapter.ts,加 tool_use 解析;Trace Panel 是真 trace |
| `content[].type === "tool_use"` 出现,但 `input` 字段错乱/空/中文 key | **△ 半 Go** | 需要 prompt 调试,加 1-2 个 example |
| 只返回 `text` block,完全没有 `tool_use` | **✗ No-Go** | adapter.ts 不升级,Trace Panel 改叫"思考过程可视化" |
| 401 / 500 / 超时 / model not found | **排查** | 验证 env / 代理 / model name,不是 Go/No-Go 决策 |

**关键字段示例(Go 时的期望)**:

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01abc...",
      "name": "create_task",
      "input": {
        "title": "发布 SKU-12 短视频",
        "priority": "P0",
        "due": "今天 23:59"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

---

## 三、No-Go 路径 · Fallback Provider 验证(5 分钟)

如果 step-3.7-flash 不支持 tool_use,**切到 fallback chain 验证**:

```
主链:step-3.7-flash → DeepSeek v4-pro → MiniMax-M2.7 → Agnes 2.0 Flash
```

### 3.1 改 model 名重跑(2 分钟)

```bash
# 同一个请求,只改 model 名
curl -s -X POST "${LLM_BASE_URL:-http://127.0.0.1:15721}/v1/messages" \
  -H "x-api-key: ${LLM_API_KEY:-$ANTHROPIC_AUTH_TOKEN}" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "max_tokens": 1024,
    "tools": [{ ... 同上 ... }],
    "messages": [{ ... 同上 ... }]
  }' | python3 -m json.tool
```

### 3.2 fallback chain 矩阵

| step-3.7-flash | deepseek-v4-pro | minimax-m2.7 | agnes-2-flash | 决策 |
|---|---|---|---|---|
| ✓ Go | - | - | - | **全 Go**,adapter.ts 升级 |
| ✗ No-Go | ✓ Go | - | - | 切 deepseek,Trace Panel 改"思考过程可视化" |
| ✗ | ✗ | ✓ Go | - | 切 minimax(Anthropic 兼容端) |
| ✗ | ✗ | ✗ | ✓ Go | 切 agnes,但质量差,文案诚实降级 |
| ✗ | ✗ | ✗ | ✗ | **全 No**,所有 LLM 走 mock fallback |

---

## 四、产出

### 4.1 写到 .progress/

```bash
# spike 结果记录
cat > /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-result-$(date +%Y%m%d).md << 'EOF'
# step-3.7-flash tool_use Spike 结果 · YYYY-MM-DD

## 第一波
- 时间: HH:MM
- 模型: step-3.7-flash
- 返回 stop_reason: ___
- 是否有 tool_use block: ✓ / ✗
- 决策: Go / 半 Go / No-Go

## Fallback 验证(如果第一波 No-Go)
- deepseek: ✓ / ✗
- minimax: ✓ / ✗
- agnes: ✓ / ✗

## 最终决策
[Go / 半 Go / No-Go / Fallback]

## 后续动作
[D2 开始做什么]
EOF
```

### 4.2 关键日志保留

```bash
mkdir -p /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/
# 把每次 curl 返回的 JSON 保存
curl ... | tee /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.progress/spike-logs/stepfun-$(date +%H%M).json
```

---

## 五、风险预案(回到 D2)

| spike 结果 | D2 调整 |
|---|---|
| **Go** | D2 写小掌柜组件 + D3-D4 同步改 adapter.ts 加 tool_use 解析(2-3h)+ Trace Panel 真 trace |
| **半 Go** | D2-D3 加 prompt example + example 测试,延后 1 天但保真 trace |
| **No-Go (有 fallback)** | Trace Panel 改"思考过程可视化",改 spec 措辞,adapter.ts 不动 |
| **全 No** | 所有 LLM 走 mock,fallback UI 三态全部走 mock 分支 |

---

## 六、不做的事

- ❌ 不写完整 adapter.ts 改造(留给 D3-D4 实际开发)
- ❌ 不写 tool schema 设计(spec v2 §五 已写,照抄即可)
- ❌ 不部署或改任何 .env / .env.local(只读 + spike)

---

*配套文档*:
- *spec: `docs/superpowers/specs/2026-07-04-killer-feature-design-v2.md` §3.5*
- *demo: `docs/demo/DEMO_SCRIPT.md` v2*
- *review: `.ship/tasks/review-killer-feature-spec/delivery/spec-review.md`*