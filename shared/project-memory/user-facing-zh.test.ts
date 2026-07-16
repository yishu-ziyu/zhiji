import { describe, expect, it } from "vitest";
import {
  humanizeUserFacingText,
  isEmptyEventUnderstandingBody,
  looksLikeEnglishOnly,
} from "./user-facing-zh";

describe("user-facing Chinese", () => {
  it("rewrites English empty-event filler", () => {
    const en =
      "No current state information is available because no events have been recorded for this project matter.";
    expect(humanizeUserFacingText(en)).toMatch(/目前还没有|无法判断|PDF/);
    expect(looksLikeEnglishOnly(en)).toBe(true);
  });

  it("keeps Chinese text", () => {
    expect(humanizeUserFacingText("客户已改口：先验证需求。")).toBe(
      "客户已改口：先验证需求。",
    );
  });

  it("PDF-aware empty message", () => {
    expect(humanizeUserFacingText("", { pdfCount: 3 })).toMatch(/3 个 PDF/);
    expect(
      humanizeUserFacingText(
        "No events have been recorded for this project matter.",
        { pdfCount: 2 },
      ),
    ).toMatch(/2 个 PDF/);
  });

  it("flags English empty body as non-decision", () => {
    expect(
      isEmptyEventUnderstandingBody({
        now: {
          text: "No current state information is available because no events have been recorded.",
          evidence: [],
          gaps: ["No events have been provided"],
        },
        then: { text: "No prior state", gaps: [] },
        nextDecision: "Cannot determine next action",
        changed: [],
        evidenceRevisionIds: [],
      }),
    ).toBe(true);
  });
});
