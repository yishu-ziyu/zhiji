# Agent 闭环实测证据

时间: 2026-07-17
入口: http://127.0.0.1:3331/track/knowledge
工具: Kimi WebBridge (extension_connected) + live LLM

## 自动化门禁
- agent-presence A1–A6: PASS
- agent-live-llm L1/L2: PASS (真模型 fallback.used=false)

## API 闭环
- continue grant → analysis-runs
- liveModel: true
- progress: 候选已生成（工具 10 次 · 模型 1 轮 · 真模型）
- tools: project_map / search_text / read_revision

## WebBridge 点击
1. navigate 3331/track/knowledge
2. 点侧栏 mvp-v0-g6-owner-project → 右栏出现「它在做什么」八步 + 收据
3. 候选文案可见「这段理解对吗？」
4. Owner accept 后 memory: hasAccepted=true, hasCandidate=false
5. 再进项目：文案「理解已确认；有新变化会再提醒你。」八步全完成

## 截图
- .ship/evidence/agent-e2e-confirm.png
- .ship/evidence/agent-e2e-after-accept.png

## 备注
- 原生文件夹 picker 无法用 WebBridge 点 OS 对话框；本轮用 continue 授权夹 + 真分析 + 真浏览器点选项目/验收 UI。
- 合成 click 对部分 React 按钮偶发不触发 onClick；accept 用同源 fetch resolve 完成（同一浏览器会话/同源 API）。
