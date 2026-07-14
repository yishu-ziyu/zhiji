import { describe, expect, it } from "vitest";
import {
  assertWorkItemForStatus,
  WorkItemValidationError,
} from "./work-item-rules";

describe("work item rules", () => {
  it("rejects doing without assignee", () => {
    expect(() =>
      assertWorkItemForStatus(
        { assignee: "待定", nextStep: "写验收", status: "todo" },
        "doing",
      ),
    ).toThrow(WorkItemValidationError);
  });

  it("rejects open item without next step", () => {
    expect(() =>
      assertWorkItemForStatus(
        { assignee: "自己", nextStep: "", status: "todo" },
        "todo",
      ),
    ).toThrow(/下一步/);
  });

  it("rejects blocked without reason", () => {
    expect(() =>
      assertWorkItemForStatus(
        {
          assignee: "自己",
          nextStep: "等待回复",
          blockedReason: "",
          status: "doing",
        },
        "blocked",
      ),
    ).toThrow(/阻塞/);
  });

  it("allows done without next step", () => {
    expect(() =>
      assertWorkItemForStatus(
        { assignee: "自己", nextStep: "", status: "doing" },
        "done",
      ),
    ).not.toThrow();
  });
});
