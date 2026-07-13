# Engineering Handoff — OPC Delivery Ops Agent

## Engineering Goal

在现有 `fc-opc-ibot` 上，把效率赛道改造成可演示的 **交付闭环工作台**，北极星指标闭环率在 UI 可见，达到 7/18 提交、7/19 路演的全场最佳产品标准。

## Product Context

- 用户：一人公司（自用）
- 问题：客户对话后承诺无人钉
- 解法：运营助手驱动 Captured→…→Confirmed
- 非目标：纪要工具、电商、多端原生

## Requirements

见 `product/08-prd.md` P0–P1。

## Acceptance Criteria

见 `product/08-prd.md` Acceptance Criteria 清单。

## Constraints

- 质量流程：yishuship design → dev（TDD）→ e2e → review → qa
- 不破坏可 build；优先垂直切片
- 稳定优先于真 tool_use
- UI 质量不降级为「能用就行」

## Source Artifacts

- `input/idea.md`
- `product/00-product-type.json`
- `product/00b-scope-challenge.md`
- `product/03-problem-solution.md`
- `product/08-prd.md`
- `product/09-tech-project-plan.md`
- 会话共识：闭环率北极星、台风改期 7/18–19

## Next engineering phase

`/yishuship:design` — 基于本 handoff 与代码现状写 `plan/spec.md` + `plan/plan.md`，peer drill 后进 dev。
