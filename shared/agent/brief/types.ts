export interface CustomerMessage {
  from: string;
  intent: string;
  autoReplied: boolean;
  templateId?: string;
}

export interface HotSearch {
  keyword: string;
  matchSkuId?: string;
  trend: "rising" | "stable" | "falling";
}

export interface SkuPerformance {
  skuId: string;
  addToCartRate: number;
  avgRate: number;
  recommendation?: "main_push" | "observe" | "discard";
}

export interface MorningBrief {
  id: string;
  generatedAt: number;
  customerMessages: CustomerMessage[];
  hotSearches: HotSearch[];
  skuPerformance: SkuPerformance[];
}
