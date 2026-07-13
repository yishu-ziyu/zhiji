export type DeliveryStatus =
  | "captured"
  | "in_progress"
  | "delivered"
  | "confirmed";

export type CommitmentKind = "hard" | "soft" | "clarification";

export type Priority = "高" | "中" | "低";

export interface Commitment {
  id: string;
  text: string;
  kind: CommitmentKind;
  sourceExcerpt?: string;
  accepted: boolean;
  suggestedDeadline?: string;
  suggestedPriority?: Priority;
}

export interface DeliveryTask {
  id: string;
  commitmentId: string;
  title: string;
  status: DeliveryStatus;
  deadline?: string;
  priority: Priority;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryMetrics {
  periodNewCommitments: number;
  confirmedCount: number;
  closedLoopRate: number;
  overdueCount: number;
  openCount: number;
}

export interface ExtractedCommitment {
  text: string;
  kind: CommitmentKind;
  sourceExcerpt?: string;
  suggestedDeadline?: string;
  suggestedPriority?: Priority;
}

export interface ExtractCommitmentsResponse {
  summary?: string;
  commitments: ExtractedCommitment[];
  risks: string[];
  _mock?: boolean;
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  captured: "已捕获",
  in_progress: "进行中",
  delivered: "已交付",
  confirmed: "已确认",
};

export const DELIVERY_COLUMNS: DeliveryStatus[] = [
  "captured",
  "in_progress",
  "delivered",
  "confirmed",
];
