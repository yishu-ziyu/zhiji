# 项目画布设计验收

## 当前对照

- 视觉基准：`docs/design/project-canvas-selected.png`（2128 × 1408）
- 当前改动：去掉固定六点、同心圆、编号、星标和装饰工具条；只显示中心对象及一层真实关系；Agent 重点留在画布左上。
- 自动验证：单测 85、E2E 7、类型检查、lint、生产构建均通过。

## 仍未完成的视觉验收

当前没有可用的“改动后实现截图”。重启本地页面后，Codex 的应用内浏览器被 URL 安全策略禁止重新载入该用户页面；因此不能把旧的 `project-canvas-implementation-final.png` 或未加载完成的 `project-canvas-implementation-state-first.png` 当作本轮证据。

这意味着下列内容尚未验证：

- 连线是否在真实页面上正确贴合中心和每个关系节点；
- 1422 × 800 下左上 Agent 卡、关系节点和底部时间线是否互相遮挡；
- 与选定参考图的间距、层级和白色桌面质感是否达到要求。

下一次视觉验收必须在同一页面状态下重新获得实现截图，并与 `docs/design/project-canvas-selected.png` 并排对照。此前的历史截图和“通过”结论不适用于现在的画布实现。

final result: blocked
