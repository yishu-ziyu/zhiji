import type { DeliveryMetrics, DeliveryTask } from "./types";

function parseLocalDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isOverdue(task: DeliveryTask, now: Date = new Date()): boolean {
  if (task.status === "confirmed") return false;
  if (!task.deadline) return false;
  const deadline = parseLocalDate(task.deadline);
  if (!deadline) return false;
  return deadline.getTime() < startOfToday(now).getTime();
}

/**
 * closedLoopRate = confirmedCount / periodNewCommitments
 * periodNewCommitments is the number of commitments accepted in the period
 * (caller passes the count; tasks alone do not define the denominator).
 */
export function computeMetrics(
  tasks: DeliveryTask[],
  periodNewCommitments: number,
  now: Date = new Date(),
): DeliveryMetrics {
  const denom = Math.max(0, periodNewCommitments);
  const confirmedCount = tasks.filter((t) => t.status === "confirmed").length;
  const overdueCount = tasks.filter((t) => isOverdue(t, now)).length;
  const openCount = tasks.filter((t) => t.status !== "confirmed").length;
  const closedLoopRate = denom === 0 ? 0 : confirmedCount / denom;

  return {
    periodNewCommitments: denom,
    confirmedCount,
    closedLoopRate,
    overdueCount,
    openCount,
  };
}

export function formatClosedLoopRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  return `${Math.round(rate * 100)}%`;
}
