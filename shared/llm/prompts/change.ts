import type { PublicChangeProject } from "@/shared/delivery/change";

export const CHANGE_SYSTEM = `你负责比较“项目当前约定”和“客户的新消息”。

只返回 JSON：
{
  "scopeChange": "客户新增或删除的工作；无法判断时写空字符串",
  "scopeQuote": "原消息中的连续原文",
  "deliveryQuote": "与交付日期有关的连续原文",
  "priceQuote": "与价格有关的连续原文"
}

要求：
- 三个 quote 必须逐字来自客户消息，不能改写或拼接。
- 不要替服务方决定新价格或新交付日期。
- 只有消息确实涉及相应内容时才引用。
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
