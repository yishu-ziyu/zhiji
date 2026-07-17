import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PERMISSION_COPY,
  FIRST_USE_PROGRESS_LABELS,
  FIRST_USE_PROGRESS_STEPS,
  ONBOARDING_FORBIDDEN_FIELD_LABELS,
  agentSessionNeedsHydration,
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
  shouldRunInitialAnalysis,
} from "@/app/track/knowledge/lib/onboarding-folder-choice";
import { createMvpApi } from "@/app/track/knowledge/lib/folder-connection-api";
import fs from "node:fs";
import path from "node:path";

// Product merge: business entry lives on the knowledge workbench, not /mvp.
const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/track/knowledge/components/LocalFolderEntry.tsx"),
  "utf8",
);
const agentChatSource = fs.readFileSync(
  path.join(process.cwd(), "app/track/knowledge/components/AgentChatPanel.tsx"),
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

  it("builds connect payload from selectionId + preflight confirmToken", () => {
    expect(connectPayloadForNewSelection("sel-abc", "pfc_token")).toEqual({
      mode: "connect",
      selectionId: "sel-abc",
      confirmToken: "pfc_token",
    });
    expect(() => connectPayloadForNewSelection("  ", "pfc_token")).toThrow(
      /文件夹选择/,
    );
    expect(() => connectPayloadForNewSelection("sel-abc", "  ")).toThrow(
      /预检/,
    );
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
    expect(DEFAULT_PERMISSION_COPY).toMatch(/文件夹/);
    expect(pageSource).toContain("DEFAULT_PERMISSION_COPY");
    expect(pageSource).toContain("folder-selection-review");
    expect(pageSource).toContain("recent-connection");
  });

  it("restores a persisted folder grant when a project opens", () => {
    expect(agentSessionNeedsHydration("project-1", null)).toBe(true);
    expect(
      agentSessionNeedsHydration("project-1", {
        projectId: "project-1",
        matterId: "matter-1",
      }),
    ).toBe(false);
    expect(
      agentSessionNeedsHydration("project-2", {
        projectId: "project-1",
        matterId: "matter-1",
      }),
    ).toBe(true);
  });

  it("gives an ungranted project a direct authorization action", () => {
    expect(agentChatSource).toContain("选择并授权文件夹");
    expect(agentChatSource).toContain('data-testid="agent-chat-authorize"');
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

    const preflight = await api.preflightSelection(picked.selectionId);
    expect(preflight.preflight.eligibleFiles).toBeGreaterThan(0);
    const confirmed = await api.confirmPreflightSelection(picked.selectionId);
    const bootstrap = await api.connectConnection(
      connectPayloadForNewSelection(picked.selectionId, confirmed.confirmToken),
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
    expect(FIRST_USE_PROGRESS_LABELS.authorize).toMatch(/文件夹/);
    expect(FIRST_USE_PROGRESS_LABELS.reconcile).toMatch(/浏览|内容/);
    expect(FIRST_USE_PROGRESS_LABELS.reconstruct).toMatch(/理解/);
    expect(isProgressStepDone("reconcile", "authorize")).toBe(true);
    expect(isProgressStepDone("reconcile", "reconcile")).toBe(false);
    expect(pageSource).toContain("runPipeline");
    expect(pageSource).toContain("setPipelinePhase");
    expect(pageSource).toContain("AgentProcessPanel");
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
        eventIds: ["alias-1", "alias-2"],
      }),
    ).toEqual(["alias-1", "alias-2"]);

    expect(
      matchedEventIdsFromBootstrap({
        relevantEvents: [{ event: { id: "rel-1" } }, { id: "rel-2" }],
      }),
    ).toEqual(["rel-1", "rel-2"]);
  });

  it("skips initial analysis when accepted/candidate already exists (Continue)", () => {
    expect(
      shouldRunInitialAnalysis({
        candidate: { body: { now: "x" } },
      }),
    ).toBe(false);
    expect(
      shouldRunInitialAnalysis({
        accepted: { body: { now: "x" } },
      }),
    ).toBe(false);
    expect(shouldRunInitialAnalysis({})).toBe(true);
    expect(memoryNeedsReconstruction({})).toBe(true);
    expect(
      memoryNeedsReconstruction({
        accepted: { body: { now: "x" } },
        head: { reviewState: "review_needed" },
      }),
    ).toBe(false);
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
    const leadSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/track/knowledge/components/InitialUnderstandingLead.tsx",
      ),
      "utf8",
    );
    expect(leadSource).toContain("explicit-unknowns");
  });

  it("fixture first-use: bootstrap matched ids → analysis only when empty → candidate + Owner resolve", async () => {
    const api = createMvpApi("contract-fixture");
    const preflight = await api.preflightSelection(
      "selection-fixture-product-exploration",
    );
    expect(preflight.preflight.eligibleFiles).toBeGreaterThan(0);
    const confirmed = await api.confirmPreflightSelection(
      "selection-fixture-product-exploration",
    );
    const bootstrap = await api.connectConnection(
      connectPayloadForNewSelection(
        "selection-fixture-product-exploration",
        confirmed.confirmToken,
      ),
    );
    const matchedIds = matchedEventIdsFromBootstrap(bootstrap);
    expect(matchedIds.length).toBeGreaterThan(0);
    expect(matchedIds).not.toContain("event-old-plan-deleted");
    expect(bootstrap.eventIds).toEqual(matchedIds);

    const before = await api.getMemory(bootstrap.projectId, bootstrap.matter.id);
    expect(shouldRunInitialAnalysis(before)).toBe(true);
    expect(before.candidate).toBeUndefined();
    expect(before.accepted).toBeUndefined();

    const analysisSpy = vi.spyOn(api, "runAnalysis");
    const analysis = await api.runAnalysis(
      bootstrap.projectId,
      bootstrap.matter.id,
      matchedIds,
    );
    expect(analysisSpy).toHaveBeenCalledWith(
      bootstrap.projectId,
      bootstrap.matter.id,
      matchedIds,
    );
    const candidate = analysis.candidate;
    expect(candidate).toBeTruthy();
    if (!candidate) throw new Error("expected candidate");
    expect(candidate.kind).toBe("candidate");
    expect(candidate.body.now.evidence.length).toBeGreaterThan(0);
    expect(
      candidate.body.why.some(
        (item) => item.status === "unknown" || item.status === "conflicted",
      ),
    ).toBe(true);
    expect(analysis.toolReceipts.length).toBeGreaterThanOrEqual(3);
    expect(analysis.toolReceipts.map((r) => r.tool)).toEqual(
      expect.arrayContaining(["project_map", "search_text", "read_revision"]),
    );

    const memory = await api.getMemory(bootstrap.projectId, bootstrap.matter.id);
    expect(shouldRunInitialAnalysis(memory)).toBe(false);
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

  it("Continue with existing understanding does not require analysis", async () => {
    const api = createMvpApi("contract-fixture");
    // Seed ready state via continue identity
    await api.connectConnection(
      connectPayloadForContinue({
        projectId: "project-mvp-fixture",
        grantId: "grant-local-fixture",
      }),
    );
    const memory = await api.getMemory(
      "project-mvp-fixture",
      "matter-product-exploration",
    );
    expect(shouldRunInitialAnalysis(memory)).toBe(false);
    expect(memory.candidate || memory.accepted).toBeTruthy();
  });
});
