# CI 验收

PR 和 main push 的默认门禁不需要模型密钥：typecheck、lint 增量门、unit、security、54 题 bench、metrics compare、Next.js production build 和构建产物扫描必须通过。

`npm run lint` 保留完整 ESLint 的原始结果。目前 main `40d1ec13825bbf0c477abc26450ff26531fc460a` 有 28 条既有错误。按工程范式 §7.2，`npm run lint:ci` 执行同一完整扫描，仅容许 `config/eslint-baseline.json` 中逐条登记的文件、规则、严重度、行列和完整诊断文本 SHA-256（只将 checkout 根路径统一为 `<repo>`）；重复次数增加、新错误、解析失败或工具执行失败都会阻塞 CI。减少债务后应删除对应基线条目，不得重新生成基线来接受新错误。控制器负例测试在 CI 内运行。

债务负责人：yishu-ziyu；目标日期：2026-10-16；跟踪：https://github.com/yishu-ziyu/zhiji/issues/8 。CI 通过不代表 28 条旧 lint 错误已经解决。

`npm run test:live` 使用独立配置，只选择真实模型 acceptance 文件，默认 unit 继续排除 live。GitHub 手动运行时必须选择 main、设置仓库变量 `RUN_LIVE_LLM=true`，并配置 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` secrets；缺任何字段会明确失败。PR 不运行凭据任务。

`node scripts/scan-build.mjs` 扫描 `.next/standalone`、`.next/static` 和 `public` 中所有文件，拒绝 `.env*` 文件、常见 OpenAI key 模式及引用的 API key 字面量，只输出计数。扫描覆盖构建 runtime，不能证明任意格式密钥绝不存在，也不代表 macOS 安装包已签名或验证。macOS Electron 安装包仍须单独按发布门禁验收。

CI checkout 也要求没有缺少 `.gitmodules` 的 gitlink。历史 Owner 手动夹具 `.ship/fixtures/mvp-v0-g6-owner-project` 仅在本机维护，已从索引移除并忽略；它不是产品依赖，CI 使用仓库内自动化测试夹具。
