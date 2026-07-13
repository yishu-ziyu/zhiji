import type {
  DeliveryActor,
  DeliveryStatus,
} from "./types";

const ALLOWED: Record<
  DeliveryStatus,
  Partial<Record<DeliveryStatus, DeliveryActor>>
> = {
  draft: { pending_client_confirm: "provider" },
  pending_client_confirm: {
    client_confirmed: "client",
    client_requested_changes: "client",
  },
  client_confirmed: { provider_delivered: "provider" },
  client_requested_changes: { pending_client_confirm: "provider" },
  provider_delivered: {
    client_accepted: "client",
    client_rejected: "client",
  },
  client_accepted: {},
  client_rejected: { provider_delivered: "provider" },
};

export function canTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
  actor: DeliveryActor,
): boolean {
  return from !== to && ALLOWED[from][to] === actor;
}

export function transition(
  from: DeliveryStatus,
  to: DeliveryStatus,
  actor: DeliveryActor,
):
  | { ok: true; next: DeliveryStatus }
  | { ok: false; next: DeliveryStatus; reason: string } {
  if (!canTransition(from, to, actor)) {
    return {
      ok: false,
      next: from,
      reason: `${actor} 无权执行状态转移: ${from} → ${to}`,
    };
  }
  return { ok: true, next: to };
}

export function isTerminal(status: DeliveryStatus): boolean {
  return status === "client_accepted";
}
