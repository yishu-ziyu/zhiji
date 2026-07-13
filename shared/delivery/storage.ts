import type { Commitment, DeliveryTask } from "./types";

export const DELIVERY_STORAGE_KEY = "fc-opc-ibot-delivery-v1";

export interface DeliveryStoreV1 {
  version: 1;
  commitments: Commitment[];
  tasks: DeliveryTask[];
  periodNewCommitments: number;
}

export function emptyStore(): DeliveryStoreV1 {
  return {
    version: 1,
    commitments: [],
    tasks: [],
    periodNewCommitments: 0,
  };
}

export function loadDeliveryStore(): DeliveryStoreV1 {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(DELIVERY_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as DeliveryStoreV1;
    if (parsed?.version !== 1) return emptyStore();
    if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.commitments)) {
      return emptyStore();
    }
    return {
      version: 1,
      commitments: parsed.commitments,
      tasks: parsed.tasks,
      periodNewCommitments:
        typeof parsed.periodNewCommitments === "number"
          ? parsed.periodNewCommitments
          : parsed.commitments.filter((c) => c.accepted).length,
    };
  } catch {
    return emptyStore();
  }
}

export function saveDeliveryStore(store: DeliveryStoreV1): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota
  }
}
