import { describe, expect, it } from "vitest";
import { computeMetrics, formatClosedLoopRate, isOverdue } from "./metrics";
import type { DeliveryTask } from "./types";

function task(
  partial: Partial<DeliveryTask> & Pick<DeliveryTask, "id" | "status">,
): DeliveryTask {
  return {
    commitmentId: partial.commitmentId ?? `c-${partial.id}`,
    title: partial.title ?? partial.id,
    priority: partial.priority ?? "中",
    createdAt: partial.createdAt ?? "2026-07-12T00:00:00Z",
    updatedAt: partial.updatedAt ?? "2026-07-12T00:00:00Z",
    deadline: partial.deadline,
    isMock: partial.isMock,
    id: partial.id,
    status: partial.status,
  };
}

describe("computeMetrics", () => {
  it("returns 0 rate when no period commitments", () => {
    const m = computeMetrics([], 0);
    expect(m.closedLoopRate).toBe(0);
    expect(m.periodNewCommitments).toBe(0);
    expect(m.confirmedCount).toBe(0);
  });

  it("computes closed-loop rate as confirmed / period commitments", () => {
    const tasks = [
      task({ id: "1", status: "confirmed" }),
      task({ id: "2", status: "in_progress" }),
      task({ id: "3", status: "captured" }),
    ];
    const m = computeMetrics(tasks, 3);
    expect(m.confirmedCount).toBe(1);
    expect(m.periodNewCommitments).toBe(3);
    expect(m.closedLoopRate).toBeCloseTo(1 / 3, 5);
    expect(m.openCount).toBe(2);
  });

  it("counts overdue only for non-confirmed past deadlines", () => {
    const now = new Date(2026, 6, 13); // 2026-07-13 local
    const tasks = [
      task({ id: "1", status: "in_progress", deadline: "2026-07-10" }),
      task({ id: "2", status: "confirmed", deadline: "2026-07-10" }),
      task({ id: "3", status: "captured", deadline: "2026-07-20" }),
      task({ id: "4", status: "delivered" }), // no deadline
    ];
    const m = computeMetrics(tasks, 4, now);
    expect(m.overdueCount).toBe(1);
    expect(isOverdue(tasks[0], now)).toBe(true);
    expect(isOverdue(tasks[1], now)).toBe(false);
  });
});

describe("formatClosedLoopRate", () => {
  it("formats as percent", () => {
    expect(formatClosedLoopRate(0)).toBe("0%");
    expect(formatClosedLoopRate(1 / 3)).toBe("33%");
    expect(formatClosedLoopRate(1)).toBe("100%");
  });
});
