# FC-OPC iBot · 项目理解（知识工作台）

授权本地项目文件夹后：在边界内真读材料 → 有出处的理解 → 你确认 → 画布上看得见结构与任务。

> 入口唯一：`/track/knowledge`  
> 不是全机监控，不是 Coding 网关，不是纯搜文档。

## 克隆后怎么跑

```bash
git clone https://github.com/yishu-ziyu/fc-opc-ibot.git
cd fc-opc-ibot
npm install

# 可选：真模型（Agent 读夹）
# 复制 .env.example 或自建 .env.local：
# LLM_BASE_URL=...
# LLM_API_KEY=...
# LLM_MODEL=...

npm run dev
# 打开 http://127.0.0.1:3000/track/knowledge
# 演示常用端口也可：npx next dev --port 3331
```

## 产品面

| 地址 | 做什么 |
|------|--------|
| `/track/knowledge` | 多项目 · 关系画布 · Agent 过程 · 确认理解 |
| `/api/knowledge/*` | 项目、材料、分析、记忆 |
| 顶栏 **AI Copilot** | 打开右侧「问 Agent」+ 真读授权夹 |
| 画布 **自动布局** | Dagre 层次排布 · 01/02 任务卡 |

夹具（可选演示）：`.ship/fixtures/mvp-v0-g6-owner-project`  
约定路径：`/tmp/mvp-v0-g6-d50-fixture`（本机可 symlink 到夹具）。

## 测试

```bash
npm run test:unit
# 浏览器 E2E（另起端口）
PORT=3011 BASE_URL=http://127.0.0.1:3011 npm run test:e2e
```

## 该读哪些文档

| 文件 | 用途 |
|------|------|
| `CONTEXT.md` | 当前产品说法 |
| `docs/product/产品清单.md` | 未完成 / 已完成清单 |
| `docs/product/AGENT_PRESENCE_ACCEPTANCE.md` | 真读夹严格验收 |
| `docs/product/首页规范.md` · `合并规范.md` · `代码在哪.md` | 入口与壳规范 |
| `docs/research/2026-07-17-knowledge-canvas-tech.md` | 画布技术决策 |

## 不会进仓库的（本地噪音）

- `node_modules/` · `.next/` · `.env.local`
- `data/knowledge/**` 运行时数据
- `.ship/tasks` · `handoffs` · 协作过程档案
- `.agents/` · `.claude/` · `.firecrawl/` 等工具目录

## License

以仓库内声明为准。
