# 开发上下文

## 当前目标

按 `docs/design/project-canvas-selected.png` 实现 `/track/knowledge`，并让四个已确认状态通过真实数据和操作发生。

## 检查方式

- 单个领域故事：`npm run test:unit -- <test-file>`
- 全部单元测试：`npm run test:unit`
- 浏览器测试：`npm run test:e2e`
- 静态检查：`npm run lint`
- 生产构建：`npm run build`

## 测试接缝

- 项目归属、重点排序、原计划判断和一层关系：纯函数与 repository 单元测试。
- 接口：直接调用 Next.js route handler。
- 四个状态：Playwright 从 `/track/knowledge` 操作节点、右侧动作和刷新。
- 视觉：同一视口并排比较确认图和页面截图。

## 复用位置

- 类型：`shared/types/knowledge.ts`
- JSON 持久化：`shared/knowledge/repository.ts`
- 关系查询：`shared/knowledge/relations.ts`
- 模型调用：`shared/llm/adapter.ts`
- 工作项与事件接口：`app/api/knowledge/work-items/`
- 当前页面操作：`app/track/knowledge/page.tsx`
- 图标：现有 `lucide-react`

## 实现顺序

1. 项目归属和旧数据兼容。
2. 项目状态、重点排序、判断和一层画布读取。
3. 项目接口和一个受控 Agent 动作。
4. 确认图四区界面、重新居中、决定和执行写回。
5. 全量检查与视觉对比。

这些改动共享类型、repository 和页面，顺序执行，避免并行覆盖同一文件。
