# 外部 Agent 写回执行结果

外部 Agent 可以把结果写入某个工作项的时间线。接口只接受结果正文；调用方不能指定审计身份，服务端统一记录为 `agent:external`。

```bash
curl -X POST http://127.0.0.1:3000/api/knowledge/work-items/ka-seed-1/events \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "result",
    "body": "已核对检索结果，来源字段完整；下一步检查 1280 像素布局。"
  }'
```

成功返回 `201`，结果会持久化并出现在该工作项的时间线。产品内的“交给 Agent”仍使用受控的 `/agent-run` 接口，因为它还负责读取依据、生成结构化复核结果和更新工作状态。
