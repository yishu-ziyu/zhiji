import { describe, expect, it } from "vitest";
import {
  pickMostRecentProjectId,
  projectActivityAt,
  rankProjectsByActivity,
} from "./recent-project";
import type { ActionItem, Project, WorkEvent } from "@/shared/types/knowledge";

const baseProject = (id: string, updatedAt: string): Project => ({
  id,
  name: id,
  summary: "",
  status: "active",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt,
});

describe("recent project ranking", () => {
  it("picks the project with the latest work activity over older project.updatedAt", () => {
    const projects = [
      baseProject("old-shell", "2026-07-10T12:00:00.000Z"),
      baseProject("hot", "2026-07-01T12:00:00.000Z"),
    ];
    const workItems = [
      {
        id: "w1",
        projectId: "hot",
        title: "t",
        description: "",
        assignee: "me",
        deadline: "",
        status: "doing",
        verificationCriteria: "",
        evidenceIds: [],
        nextStep: "x",
        createdAt: "2026-07-14T00:00:00.000Z",
        updatedAt: "2026-07-15T08:00:00.000Z",
      },
    ] as ActionItem[];
    const events: WorkEvent[] = [];
    expect(pickMostRecentProjectId(projects, workItems, events)).toBe("hot");
    expect(rankProjectsByActivity(projects, workItems, events).map((p) => p.id)).toEqual([
      "hot",
      "old-shell",
    ]);
  });

  it("uses lastOpenedAt when it is the newest signal", () => {
    const projects = [
      { ...baseProject("a", "2026-07-10T00:00:00.000Z"), lastOpenedAt: "2026-07-15T10:00:00.000Z" },
      baseProject("b", "2026-07-14T00:00:00.000Z"),
    ];
    expect(projectActivityAt(projects[0], [], [])).toBe("2026-07-15T10:00:00.000Z");
    expect(pickMostRecentProjectId(projects, [], [])).toBe("a");
  });
});
