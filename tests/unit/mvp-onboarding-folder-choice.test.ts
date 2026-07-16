import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMISSION_COPY,
  ONBOARDING_FORBIDDEN_FIELD_LABELS,
  connectPayloadForContinue,
  connectPayloadForNewSelection,
  fixtureModeFromSearch,
  folderNameFromPath,
  onboardingExposesInternalFields,
  phaseAfterPickerCancel,
  phaseAfterPickerSelected,
} from "@/app/track/knowledge/mvp/lib/onboarding-folder-choice";
import { createMvpApi } from "@/app/track/knowledge/mvp/lib/api";
import fs from "node:fs";
import path from "node:path";

const pageSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/track/knowledge/mvp/page.tsx",
  ),
  "utf8",
);

describe("D-50 onboarding folder choice contract", () => {
  it("never requires internal free-text fields on entry", () => {
    for (const label of ONBOARDING_FORBIDDEN_FIELD_LABELS) {
      expect(pageSource).not.toContain(`>${label}<`);
      expect(pageSource).not.toContain(`<span>${label}</span>`);
    }
    expect(onboardingExposesInternalFields([])).toBe(false);
    expect(
      onboardingExposesInternalFields(["项目 ID", "本地 rootPath"]),
    ).toBe(true);
    expect(pageSource).not.toMatch(/webkitdirectory/i);
    expect(pageSource).not.toMatch(/type=["']file["']/);
    expect(pageSource).toContain("选择项目文件夹");
    expect(pageSource).toContain("继续");
    expect(pageSource).toContain("连接");
  });

  it("builds connect payload from selectionId only for new folders", () => {
    expect(connectPayloadForNewSelection("sel-abc")).toEqual({
      selectionId: "sel-abc",
    });
    expect(() => connectPayloadForNewSelection("  ")).toThrow(/文件夹选择/);
  });

  it("builds continue payload from persisted projectId+grantId only", () => {
    expect(
      connectPayloadForContinue({
        projectId: "proj-1",
        grantId: "grant-1",
      }),
    ).toEqual({ projectId: "proj-1", grantId: "grant-1" });
  });

  it("cancel returns to entry phase with no selection carry-over helpers", () => {
    expect(phaseAfterPickerCancel()).toBe("entry");
    expect(phaseAfterPickerSelected()).toBe("review");
  });

  it("fixture mode is explicit ?fixture=1 only", () => {
    expect(fixtureModeFromSearch("")).toBe(false);
    expect(fixtureModeFromSearch("foo=1")).toBe(false);
    expect(fixtureModeFromSearch("?fixture=1")).toBe(true);
    expect(fixtureModeFromSearch(new URLSearchParams("fixture=1"))).toBe(true);
    expect(pageSource).toContain("fixtureModeFromSearch");
  });

  it("shows folder name and permission copy helpers for review", () => {
    expect(folderNameFromPath("/Users/owner/projects/product-exploration")).toBe(
      "product-exploration",
    );
    expect(DEFAULT_PERMISSION_COPY).toMatch(/仅授权/);
    expect(pageSource).toContain("DEFAULT_PERMISSION_COPY");
    expect(pageSource).toContain("folder-selection-review");
    expect(pageSource).toContain("recent-connection");
  });

  it("fixture api: picker selection → connect; cancel path leaves no invent rootPath", async () => {
    const api = createMvpApi("contract-fixture");
    expect(await api.getRecentConnection()).toBeNull();

    const picked = await api.openFolderPicker();
    expect("cancelled" in picked && picked.cancelled).toBeFalsy();
    if ("cancelled" in picked && picked.cancelled) {
      throw new Error("fixture picker should select");
    }
    expect(picked.selectionId).toBeTruthy();
    expect(picked.folderName).toBe("product-exploration");

    const bootstrap = await api.connectConnection(
      connectPayloadForNewSelection(picked.selectionId),
    );
    expect(bootstrap.projectId).toBeTruthy();
    expect(bootstrap.grant.rootPath).toContain("product-exploration");
    expect(bootstrap.matter.id).toBeTruthy();
    expect(bootstrap.watchSet.includePathPrefixes.length).toBeGreaterThan(0);
  });
});
