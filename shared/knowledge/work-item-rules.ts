import type { ActionItem, ActionStatus } from "@/shared/types/knowledge";
import { TERMINAL_STATUSES } from "@/shared/types/knowledge";

export class WorkItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkItemValidationError";
  }
}

export function isTerminalStatus(status: ActionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Validate fields for a desired status (P0 hard rules). */
export function assertWorkItemForStatus(
  item: Pick<
    ActionItem,
    "assignee" | "nextStep" | "blockedReason" | "status"
  >,
  nextStatus: ActionStatus,
): void {
  if (nextStatus === "doing" || nextStatus === "confirmed") {
    const assignee = item.assignee?.trim();
    if (!assignee || assignee === "待定") {
      throw new WorkItemValidationError(
        "进入进行中/待确认前必须指定负责人",
      );
    }
  }

  if (!isTerminalStatus(nextStatus)) {
    if (!item.nextStep?.trim()) {
      throw new WorkItemValidationError("未完成的工作项必须有下一步");
    }
  }

  if (nextStatus === "blocked") {
    if (!item.blockedReason?.trim()) {
      throw new WorkItemValidationError("阻塞状态必须填写原因");
    }
  }
}

export function assertCanPatchTo(
  current: ActionItem,
  patch: Partial<
    Pick<
      ActionItem,
      | "status"
      | "assignee"
      | "nextStep"
      | "blockedReason"
      | "title"
      | "description"
    >
  >,
): void {
  const merged = {
    assignee: patch.assignee ?? current.assignee,
    nextStep: patch.nextStep ?? current.nextStep,
    blockedReason: patch.blockedReason ?? current.blockedReason,
    status: patch.status ?? current.status,
  };
  assertWorkItemForStatus(merged, merged.status);
}
