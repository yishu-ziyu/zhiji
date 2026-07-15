# FC-OPC iBot · 知识工作助手

效率赛道里做三件事：**资料检索、知识卡片、待办行动**。

> 搜得到、卡片带来源、下一步能勾掉。
> 不是编辑器，不是客户改约定工具，不是电商。

## 怎么跑

```bash
npm install
npm run dev
# 打开 http://localhost:3000/track/knowledge
```

## 页面和接口

| 地址 | 做什么 |
|------|--------|
| `/` | 进知识工作台 |
| `/track/knowledge` | 检索 / 卡片 / 行动 |
| `/api/knowledge/*` | 搜、加卡、纪要、拆任务、改状态、工具列表 |
| `data/knowledge/*.json` | 本地存盘（内容不进 git） |

## 已删掉的

- 客户改约定整条产品（页面、接口、领域代码、相关测试）
- 电商入口

旧调研在 `docs/research/`，只当档案。

## 测试

```bash
npm run test:unit
# 浏览器演示步骤（另起端口，避免占用 3000）
PORT=3011 BASE_URL=http://127.0.0.1:3011 npm run test:e2e
```

手测：打开知识页 → 搜「检索 来源」→ 改一条待办状态。

## 产品说明 / 交件

- `CONTEXT.md` — 本轮说法
- `.ship/tasks/knowledge-mainline-20260714-174246/product/08-prd.md` — 验收
- `docs/demo/SUBMIT_PACK.md` — 使用说明 · 演示 · ≤5 页路演 · 链接位
