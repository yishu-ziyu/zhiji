import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_PROFILE,
  readWorkspaceProfile,
  resetWorkspaceProfileForTests,
  writeWorkspaceProfile,
} from "@/app/track/knowledge/lib/workspace-profile";

describe("workspace profile (local personalization)", () => {
  afterEach(() => {
    resetWorkspaceProfileForTests();
  });

  it("defaults when empty", () => {
    expect(readWorkspaceProfile()).toEqual(DEFAULT_WORKSPACE_PROFILE);
  });

  it("persists display name and avatar", () => {
    writeWorkspaceProfile({
      displayName: "奕枢",
      avatarUrl: "data:image/png;base64,abc",
    });
    expect(readWorkspaceProfile()).toEqual({
      displayName: "奕枢",
      avatarUrl: "data:image/png;base64,abc",
    });
  });

  it("trims and caps display name", () => {
    writeWorkspaceProfile({
      displayName: `  ${"长".repeat(40)}  `,
      avatarUrl: "/project-canvas/avatar-source.png",
    });
    const next = readWorkspaceProfile();
    expect(next.displayName.length).toBe(32);
    expect(next.displayName.startsWith("长")).toBe(true);
  });
});
