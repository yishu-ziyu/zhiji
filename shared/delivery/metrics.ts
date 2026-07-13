import type { CommitmentSlip, DeliveryMetrics } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function isOverdue(
  slip: CommitmentSlip,
  now: Date = new Date(),
): boolean {
  if (slip.status === "client_accepted" || !slip.dueAt) return false;
  const due = parseLocalDate(slip.dueAt);
  if (!due) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < today.getTime();
}

export function computeMetrics(
  slips: CommitmentSlip[],
  now: Date = new Date(),
  cohortDays = 30,
  confirmWindowDays = 7,
): DeliveryMetrics {
  const cohortStart = now.getTime() - cohortDays * DAY_MS;
  const createdCohort = slips.filter((slip) => {
    const created = new Date(slip.createdAt).getTime();
    return created >= cohortStart && created <= now.getTime();
  });

  const confirmedAt = (slip: CommitmentSlip) =>
    slip.history.find(
      (entry) => entry.actor === "client" && entry.action === "confirm",
    )?.at;
  const eligibleCohort = createdCohort.filter((slip) => {
    const age = now.getTime() - new Date(slip.createdAt).getTime();
    return age >= confirmWindowDays * DAY_MS;
  });
  const allConfirmHours = createdCohort.flatMap((slip) => {
    const at = confirmedAt(slip);
    if (!at) return [];
    const duration =
      new Date(at).getTime() - new Date(slip.createdAt).getTime();
    return duration >= 0 ? [duration / (60 * 60 * 1000)] : [];
  });
  const confirmedWithinWindow = eligibleCohort.filter((slip) => {
    const at = confirmedAt(slip);
    if (!at) return false;
    const duration = new Date(at).getTime() - new Date(slip.createdAt).getTime();
    return duration >= 0 && duration <= confirmWindowDays * DAY_MS;
  }).length;

  const dueSlips = createdCohort.filter((slip) => {
    const due = parseLocalDate(slip.dueAt ?? "");
    if (!due) return false;
    due.setHours(23, 59, 59, 999);
    const accepted = slip.history.some(
      (entry) => entry.actor === "client" && entry.action === "accept",
    );
    return due.getTime() <= now.getTime() || accepted;
  });
  const acceptedOnTime = dueSlips.filter((slip) => {
    const acceptedAt = slip.history.find(
      (entry) => entry.actor === "client" && entry.action === "accept",
    )?.at;
    const due = parseLocalDate(slip.dueAt ?? "");
    if (!acceptedAt || !due) return false;
    due.setHours(23, 59, 59, 999);
    return new Date(acceptedAt).getTime() <= due.getTime();
  }).length;

  return {
    cohortSize: eligibleCohort.length,
    confirmedWithinWindow,
    confirmationRate:
      eligibleCohort.length === 0
        ? 0
        : confirmedWithinWindow / eligibleCohort.length,
    medianConfirmHours: median(allConfirmHours),
    acceptedOnTimeRate:
      dueSlips.length === 0 ? null : acceptedOnTime / dueSlips.length,
    overdueCount: slips.filter((slip) => isOverdue(slip, now)).length,
    openCount: slips.filter((slip) => slip.status !== "client_accepted").length,
  };
}

export function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  return `${Math.round(rate * 100)}%`;
}
