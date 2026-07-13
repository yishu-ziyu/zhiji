import type { PublicChangeProject } from "@/shared/delivery/change";

export const CHANGE_SYSTEM = `你负责比较“项目当前约定”和“客户的新消息”。

只返回 JSON：
{
  "scopeChange": "客户新增或删除的工作；无法判断时写空字符串",
  "scopeQuote": "支持工作范围变化的连续原文；没有则为空字符串",
  "deliveryQuote": "支持交付日期可能变化的连续原文；没有则为空字符串",
  "priceQuote": "支持价格可能变化的连续原文；没有则为空字符串"
}

要求：
- 三个 quote 必须逐字来自客户消息，不能改写或拼接。
- 不要替服务方决定新价格或新交付日期。
- 只有原消息确实支持某项变化时才引用；没有依据必须返回空字符串。
- 只返回 JSON。`;

export function buildChangePrompt(
  project: PublicChangeProject,
  sourceText: string,
): string {
  return `项目当前约定：
- 工作范围：${project.scope}
- 交付日期：${project.deliveryMilestone.date}
- 总价：${project.totalPriceMinor / 100} 元
- 已付款：${project.paidMinor / 100} 元

客户的新消息：
${sourceText}`;
}
