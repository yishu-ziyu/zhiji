import { describe, expect, it } from "vitest";
import {
  formatFolderImportProgress,
  formatUploadProgress,
  resolveCopilotIntent,
} from "@/app/track/knowledge/lib/copilot-intent";

describe("resolveCopilotIntent · AI Copilot = folder Agent", () => {
  it("asks for a project when none selected", () => {
    const i = resolveCopilotIntent({
      projectId: null,
      hasFolderAgent: false,
      hasCandidate: false,
      hasAccepted: false,
    });
    expect(i.kind).toBe("need_project");
  });

  it("asks for folder grant when project has no agent session", () => {
    const i = resolveCopilotIntent({
      projectId: "p1",
      hasFolderAgent: false,
      hasCandidate: false,
      hasAccepted: false,
    });
    expect(i.kind).toBe("need_folder_grant");
    expect(i.message).toMatch(/授权/);
  });

  it("shows agent without re-run when candidate awaits owner", () => {
    const i = resolveCopilotIntent({
      projectId: "p1",
      hasFolderAgent: true,
      hasCandidate: true,
      hasAccepted: false,
    });
    expect(i).toMatchObject({ kind: "show_agent", rerun: false });
    expect(i.message).toMatch(/确认/);
  });

  it("shows agent without re-run while analysis is running", () => {
    const i = resolveCopilotIntent({
      projectId: "p1",
      hasFolderAgent: true,
      hasCandidate: false,
      hasAccepted: false,
      runStatus: "running",
    });
    expect(i).toMatchObject({ kind: "show_agent", rerun: false });
  });

  it("re-runs when folder agent is idle with no candidate", () => {
    const i = resolveCopilotIntent({
      projectId: "p1",
      hasFolderAgent: true,
      hasCandidate: false,
      hasAccepted: false,
    });
    expect(i).toMatchObject({ kind: "show_agent", rerun: true });
  });

  it("re-runs after accepted understanding to check for changes", () => {
    const i = resolveCopilotIntent({
      projectId: "p1",
      hasFolderAgent: true,
      hasCandidate: false,
      hasAccepted: true,
    });
    expect(i).toMatchObject({ kind: "show_agent", rerun: true });
  });
});

describe("upload progress copy", () => {
  it("names the current file", () => {
    expect(
      formatUploadProgress({ index: 2, total: 5, fileName: "a.html" }),
    ).toBe("正在上传 2/5：a.html");
  });

  it("names the folder being imported", () => {
    expect(
      formatFolderImportProgress({
        index: 1,
        total: 3,
        folderName: "my-app",
      }),
    ).toBe("正在接入项目 1/3：my-app");
  });
});
