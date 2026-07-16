import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PERMISSION_COPY,
  FIRST_USE_PROGRESS_LABELS,
  FIRST_USE_PROGRESS_STEPS,
  ONBOARDING_FORBIDDEN_FIELD_LABELS,
  connectPayloadForContinue,
  connectPayloadForNewSelection,
  extractUnderstandingLead,
  fixtureModeFromSearch,
  folderNameFromPath,
  isProgressStepDone,
  matchedEventIdsFromBootstrap,
  memoryNeedsReconstruction,
  onboardingExposesInternalFields,
  phaseAfterPickerCancel,
  phaseAfterPickerSelected,
} from "@/app/track/knowledge/mvp/lib/onboarding-folder-choice";
import { createMvpApi } from "@/app/track/knowledge/mvp/lib/api";
import fs from "node:fs";
import path from "node:path";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/track/knowledge/mvp/page.tsx"),
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
      mode: "connect",
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
    ).toEqual({ mode: "continue", projectId: "proj-1", grantId: "grant-1" });
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
    expect(matchedEventIdsFromBootstrap(bootstrap).length).toBeGreaterThan(0);
  });
});

describe("D-50 first-use progress and understanding", () => {
  it("defines real progress steps authorize → reconcile → reconstruct", () => {
    expect(FIRST_USE_PROGRESS_STEPS).toEqual([
      "authorize",
      "reconcile",
      "reconstruct",
    ]);
    expect(FIRST_USE_PROGRESS_LABELS.authorize).toMatch(/授权/);
    expect(FIRST_USE_PROGRESS_LABELS.reconcile).toMatch(/对账/);
    expect(FIRST_USE_PROGRESS_LABELS.reconstruct).toMatch(/重建/);
    expect(isProgressStepDone("reconcile", "authorize")).toBe(true);
    expect(isProgressStepDone("reconcile", "reconcile")).toBe(false);
    expect(pageSource).toContain("runFirstUsePipeline");
    expect(pageSource).toContain("setProgressStep(\"authorize\")");
    expect(pageSource).toContain("setProgressStep(\"reconcile\")");
    expect(pageSource).toContain("setProgressStep(\"reconstruct\")");
    expect(pageSource).toContain("FirstUseProgress");
    expect(pageSource).toContain("InitialUnderstandingLead");
  });

  it("feeds only matched reconciled event ids into analysis helpers", () => {
    expect(
      matchedEventIdsFromBootstrap({
        events: [
          { id: "matched-1", matched: true },
          { id: "noise-1", matched: false },
          { id: "matched-2", matched: true },
        ],
      }),
    ).toEqual(["matched-1", "matched-2"]);

    expect(
      matchedEventIdsFromBootstrap({
        matchedEventIds: ["e1", "e2"],
        events: [{ id: "ignored", matched: true }],
      }),
    ).toEqual(["e1", "e2"]);

    expect(
      matchedEventIdsFromBootstrap({
        relevantEvents: [{ event: { id: "rel-1" } }, { id: "rel-2" }],
      }),
    ).toEqual(["rel-1", "rel-2"]);
  });

  it("Continue skips reconstruction when persisted understanding is current", () => {
    expect(
      memoryNeedsReconstruction({
        candidate: { body: { now: "x" } },
      }),
    ).toBe(false);
    expect(
      memoryNeedsReconstruction({
        accepted: { body: { now: "x" } },
        head: { reviewState: "current" },
      }),
    ).toBe(false);
    expect(
      memoryNeedsReconstruction({
        accepted: { body: { now: "x" } },
        head: { reviewState: "review_needed" },
      }),
    ).toBe(true);
    expect(memoryNeedsReconstruction({})).toBe(true);
  });

  it("first meaningful output is source-backed now + explicit unknowns", () => {
    const lead = extractUnderstandingLead({
      now: {
        text: "客户已改口：先验证需求再 Demo。",
        gaps: ["未确认交付日期"],
        conflicts: [],
        evidence: [{ revisionId: "r1" }],
      },
      then: { gaps: [], conflicts: ["旧计划仍写先 Demo"] },
      why: [
        { status: "supported", text: "有会议纪要" },
        { status: "unknown", text: "预算是否同步变更未知" },
        { status: "conflicted", text: "范围描述冲突" },
      ],
    });
    expect(lead.nowText).toMatch(/客户已改口/);
    expect(lead.hasEvidence).toBe(true);
    expect(lead.unknowns).toEqual(
      expect.arrayContaining([
        "未确认交付日期",
        "旧计划仍写先 Demo",
        "预算是否同步变更未知",
        "范围描述冲突",
      ]),
    );
    expect(pageSource).toContain("InitialUnderstandingLead");
    const leadSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/track/knowledge/mvp/components/InitialUnderstandingLead.tsx",
      ),
      "utf8",
    );
    expect(leadSource).toContain("explicit-unknowns");
  });

  it("fixture first-use: reconcile + matched ids + real candidate for Owner review", async () => {
    const api = createMvpApi("contract-fixture");
    const bootstrap = await api.connectConnection(
      connectPayloadForNewSelection("selection-fixture-product-exploration"),
    );
    const matchedIds = matchedEventIdsFromBootstrap(bootstrap);
    expect(matchedIds.length).toBeGreaterThan(0);
    expect(matchedIds).not.toContain("event-old-plan-deleted");

    const reconciled = await api.reconcileGrant(
      bootstrap.projectId,
      bootstrap.grant.id,
    );
    expect(reconciled.matchedEventIds?.length).toBeGreaterThan(0);

    const analysisSpy = vi.spyOn(api, "runAnalysis");
    const candidate = await api.runAnalysis(
      bootstrap.projectId,
      bootstrap.matter.id,
      matchedIds,
    );
    expect(analysisSpy).toHaveBeenCalledWith(
      bootstrap.projectId,
      bootstrap.matter.id,
      matchedIds,
    );
    expect(candidate.kind).toBe("candidate");
    expect(candidate.body.now.evidence.length).toBeGreaterThan(0);
    expect(
      candidate.body.why.some(
        (item) => item.status === "unknown" || item.status === "conflicted",
      ),
    ).toBe(true);

    const memory = await api.getMemory(bootstrap.projectId, bootstrap.matter.id);
    expect(memory.candidate || memory.accepted).toBeTruthy();

    const resolved = await api.resolveCandidate(
      bootstrap.projectId,
      bootstrap.matter.id,
      candidate.id,
      "accept",
    );
    expect(resolved.accepted?.kind).toBe("accepted");
    expect(resolved.resolution.decision).toBe("accept");
  });
});
