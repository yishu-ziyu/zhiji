import type { DeliveryStatus } from "./types";

const ALLOWED: Record<DeliveryStatus, DeliveryStatus[]> = {
  captured: ["in_progress"],
  in_progress: ["delivered"],
  delivered: ["confirmed", "in_progress"],
  confirmed: [],
};

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function transition(
  from: DeliveryStatus,
  to: DeliveryStatus,
): { ok: true; next: DeliveryStatus } | { ok: false; next: DeliveryStatus; reason: string } {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      next: from,
      reason: `非法转移: ${from} → ${to}`,
    };
  }
  return { ok: true, next: to };
}

export function isTerminal(status: DeliveryStatus): boolean {
  return status === "confirmed";
}
