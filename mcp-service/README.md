# 知几 · 比赛 MCP 适配器

独立、无状态、无写入的 Streamable HTTP MCP 服务。

- `analyze_project_state`：从调用者显式提交的材料生成有依据的项目态势。
- `verify_claim_evidence`：检查 Claim 与精确 Revision 证据的完整性。

本服务不读取用户硬盘、不存储输入、不修改项目、不调用付费模型。它是比赛能力出口，不是知几桌面客户端的公网化。

```bash
npm install
npm run dev
npm run deploy
```

MCP endpoint: `/mcp`
