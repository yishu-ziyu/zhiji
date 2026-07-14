# AnySearch 接入说明（试用）

**日期：** 2026-07-15
**状态：** 已接入最小可用路径

## 做什么

给知识工作台加 **全网检索** 通道（AnySearch），与 **库内检索** 并列。

链路：

```text
全网搜 (AnySearch) → 选一条 → 入库为 doc 卡片（标签 web,anysearch，正文含 URL）
→ 再挂工作项 / 足迹 / 关系
```

## 怎么用

1. 打开 `/track/knowledge`
2. 点 **全网 AnySearch**
3. 输入查询 → **搜全网**
4. 结果点 **入库** → 自动切回库内并检索新卡

## API

- `POST /api/knowledge/web-search`
  body: `{ query, maxResults?, domain? }`
  服务端调 `https://api.anysearch.com/mcp`（tools/call search）
- Key：环境变量 `ANYSEARCH_API_KEY`（可选；无 key 走匿名，额度更低）

## 代码

| 路径 | 作用 |
|------|------|
| `shared/anysearch/client.ts` | MCP 客户端 + markdown 解析 |
| `app/api/knowledge/web-search/route.ts` | HTTP 代理 |
| `WebSearchPanel.tsx` | 结果列表 + 入库 |
| `KnowledgeSearch` | 库内 / 全网切换 |

## 验收

- 无 key 也能返回若干 hits（匿名）
- 入库后卡片 `source=doc`，tags 含 `web` / `anysearch`，正文含 URL
- 单测：`shared/anysearch/client.test.ts`

## 非目标（本轮）

- 不做完整垂直域 UI
- 不把 AnySearch 当向量库
- 不改库内检索算法
