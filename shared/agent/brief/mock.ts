import type { MorningBrief } from "./types";

export const mockMorningBrief: MorningBrief = {
  id: "brief-sku-12",
  generatedAt: Date.UTC(2026, 6, 6, 9, 0, 0),
  customerMessages: [
    {
      from: "林小姐",
      intent: "咨询便携充电宝续航",
      autoReplied: true,
      templateId: "EP-07",
    },
  ],
  hotSearches: [
    {
      keyword: "骨传导耳机 2026 款",
      matchSkuId: "SKU-12",
      trend: "rising",
    },
  ],
  skuPerformance: [
    {
      skuId: "SKU-12",
      addToCartRate: 2.1,
      avgRate: 0.8,
      recommendation: "main_push",
    },
  ],
};
