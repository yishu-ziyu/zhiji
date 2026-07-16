import { describe, expect, it } from "vitest";
import {
  assertEntityInProject,
  assertOwnerApprover,
  ProjectAccessError,
  ProjectScopeError,
  requireProjectId,
} from "./project-scope";

describe("project-scope (T-19)", () => {
  it("requireProjectId rejects missing blank and non-string", () => {
    expect(() => requireProjectId(undefined)).toThrow(ProjectScopeError);
    expect(() => requireProjectId("")).toThrow(ProjectScopeError);
    expect(() => requireProjectId("   ")).toThrow(ProjectScopeError);
    expect(() => requireProjectId(null)).toThrow(ProjectScopeError);
    expect(requireProjectId(" proj-a ")).toBe("proj-a");
  });

  it("assertEntityInProject denies foreign project and missing entity", () => {
    expect(() =>
      assertEntityInProject({ projectId: "b" }, "a", "卡片"),
    ).toThrow(ProjectAccessError);
    expect(() => assertEntityInProject(null, "a")).toThrow(ProjectAccessError);
    expect(() =>
      assertEntityInProject({ projectId: "a" }, "a"),
    ).not.toThrow();
  });

  it("assertOwnerApprover rejects agent actors", () => {
    expect(() => assertOwnerApprover("agent:project-reviewer")).toThrow(
      ProjectScopeError,
    );
    expect(() => assertOwnerApprover("")).toThrow(ProjectScopeError);
    expect(assertOwnerApprover("owner")).toBe("owner");
  });
});
