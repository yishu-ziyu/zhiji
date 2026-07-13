import { describe, expect, it } from "vitest";
import {
  extractCommitmentsMock,
  getFixtureTranscript,
} from "./extract-mock";
import dialog01 from "../../tests/fixtures/delivery/dialog-01.json";

describe("extractCommitmentsMock", () => {
  it("returns gold hard commitments for dialog-01 fixture", () => {
    const result = extractCommitmentsMock("", "dialog-01");
    expect(result._mock).toBe(true);
    const hard = result.commitments.filter((c) => c.kind === "hard");
    expect(hard.length).toBeGreaterThanOrEqual(2);
    for (const expected of dialog01.expectedHard) {
      expect(hard.some((c) => c.text === expected)).toBe(true);
    }
  });

  it("includes clarification risk for soft asks", () => {
    const result = extractCommitmentsMock(getFixtureTranscript("dialog-01"));
    expect(result.commitments.some((c) => c.kind === "clarification")).toBe(
      true,
    );
    expect(result.risks.length).toBeGreaterThan(0);
  });

  it("falls back deterministically for unknown transcript", () => {
    const result = extractCommitmentsMock("请尽快帮我把合同初稿发过来谢谢");
    expect(result.commitments.length).toBeGreaterThanOrEqual(1);
    expect(result._mock).toBe(true);
  });
});
