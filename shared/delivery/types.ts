export type DeliveryStatus =
  | "draft"
  | "pending_client_confirm"
  | "client_confirmed"
  | "client_requested_changes"
  | "provider_delivered"
  | "client_accepted"
  | "client_rejected";

export type DeliveryActor = "provider" | "client";

export type DeliveryAction =
  | "create"
  | "send"
  | "confirm"
  | "request_changes"
  | "deliver"
  | "accept"
  | "reject"
  | "resend";

export interface DeliveryHistoryEntry {
  actor: DeliveryActor;
  action: DeliveryAction;
  at: string;
  note?: string;
}

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

export interface CommitmentSlip {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  dueAt?: string;
  priority: Priority;
  sourceExcerpt?: string;
  status: DeliveryStatus;
  clientToken?: string;
  history: DeliveryHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryMetrics {
  cohortSize: number;
  confirmedWithinWindow: number;
  confirmationRate: number;
  medianConfirmHours: number | null;
  acceptedOnTimeRate: number | null;
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
  draft: "待发送",
  pending_client_confirm: "待客户确认",
  client_confirmed: "客户已确认",
  client_requested_changes: "客户要求修改",
  provider_delivered: "已交付待验收",
  client_accepted: "客户已验收",
  client_rejected: "客户拒收",
};
