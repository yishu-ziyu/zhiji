import { describe, expect, it } from "vitest";
import { computeMetrics, formatRate, isOverdue } from "./metrics";
import type { CommitmentSlip } from "./types";

const NOW = new Date("2026-07-13T12:00:00Z");

function slip(
  partial: Partial<CommitmentSlip> & Pick<CommitmentSlip, "id" | "status">,
): CommitmentSlip {
  return {
    title: partial.title ?? partial.id,
    priority: partial.priority ?? "中",
    createdAt: partial.createdAt ?? "2026-07-10T12:00:00Z",
    updatedAt: partial.updatedAt ?? "2026-07-10T12:00:00Z",
    history: partial.history ?? [],
    id: partial.id,
    status: partial.status,
    dueAt: partial.dueAt,
  };
}

describe("computeMetrics", () => {
  it("returns an empty cohort without fake precision", () => {
    expect(computeMetrics([], NOW)).toMatchObject({
      cohortSize: 0,
      confirmedWithinWindow: 0,
      confirmationRate: 0,
      medianConfirmHours: null,
    });
  });

  it("uses one created cohort for the 7-day client-confirmation rate", () => {
    const slips = [
      slip({
        id: "confirmed-in-window",
        status: "client_confirmed",
        history: [
          {
            actor: "client",
            action: "confirm",
            at: "2026-07-12T12:00:00Z",
          },
        ],
      }),
      slip({
        id: "mature-pending",
        status: "pending_client_confirm",
        createdAt: "2026-07-01T12:00:00Z",
      }),
      slip({
        id: "old-outside-cohort",
        status: "client_confirmed",
        createdAt: "2026-05-01T00:00:00Z",
        history: [
          {
            actor: "client",
            action: "confirm",
            at: "2026-05-02T00:00:00Z",
          },
        ],
      }),
    ];

    expect(computeMetrics(slips, NOW)).toMatchObject({
      cohortSize: 2,
      confirmedWithinWindow: 1,
      confirmationRate: 0.5,
      medianConfirmHours: 48,
    });
  });

  it("does not penalize an immature window and keeps late confirms in duration", () => {
    const slips = [
      slip({
        id: "late-confirm",
        status: "client_confirmed",
        createdAt: "2026-07-01T12:00:00Z",
        history: [
          {
            actor: "client",
            action: "confirm",
            at: "2026-07-12T12:00:00Z",
          },
        ],
      }),
      slip({
        id: "immature-pending",
        status: "pending_client_confirm",
        createdAt: "2026-07-12T12:00:00Z",
      }),
    ];

    expect(computeMetrics(slips, NOW)).toMatchObject({
      cohortSize: 1,
      confirmedWithinWindow: 0,
      confirmationRate: 0,
      medianConfirmHours: 264,
    });
  });

  it("counts overdue until the client accepts", () => {
    const slips = [
      slip({ id: "open", status: "provider_delivered", dueAt: "2026-07-10" }),
      slip({
        id: "accepted",
        status: "client_accepted",
        dueAt: "2026-07-10",
        history: [
          { actor: "client", action: "accept", at: "2026-07-10T10:00:00Z" },
        ],
      }),
      slip({ id: "future", status: "provider_delivered", dueAt: "2026-07-20" }),
    ];
    expect(isOverdue(slips[0], NOW)).toBe(true);
    expect(isOverdue(slips[1], NOW)).toBe(false);
    expect(computeMetrics(slips, NOW)).toMatchObject({
      overdueCount: 1,
      acceptedOnTimeRate: 0.5,
    });
  });
});

describe("formatRate", () => {
  it("formats a candidate rate as a percentage", () => {
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(1 / 3)).toBe("33%");
    expect(formatRate(1)).toBe("100%");
  });
});
