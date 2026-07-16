import { describe, expect, it } from "vitest";
import {
  buildAgentTaskDrafts,
  numberedTaskTitle,
  stripTaskNumberPrefix,
} from "@/shared/knowledge/agent-task-cards";

describe("agent task cards · 01/02 titles", () => {
  it("numbers titles Canvasight-style", () => {
    expect(numberedTaskTitle(1, "核对理解")).toBe("01 核对理解");
    expect(numberedTaskTitle(12, "01 已有前缀")).toBe("12 已有前缀");
  });

  it("strips old number prefixes", () => {
    expect(stripTaskNumberPrefix("01 核对理解")).toBe("核对理解");
    expect(stripTaskNumberPrefix("3、推进检索")).toBe("推进检索");
  });

  it("always builds primary understanding draft", () => {
    const drafts = buildAgentTaskDrafts({
      nowText: "项目是授权夹内有来源理解",
      nextDecisionText: "确认这段理解是否准确",
    });
    expect(drafts[0]!.key).toBe("understanding");
    expect(drafts[0]!.title).toMatch(/核对/);
  });

  it("adds file-followup drafts from tool summaries", () => {
    const drafts = buildAgentTaskDrafts({
      nowText: "已读材料",
      nextDecisionText: "确认理解",
      toolSummaries: ["已读 PRODUCT.md L1-20", "已读 NOTES.md L1-8"],
    });
    expect(drafts.some((d) => d.title.includes("PRODUCT.md"))).toBe(true);
  });
});
