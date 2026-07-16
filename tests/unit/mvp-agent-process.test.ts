import { describe, expect, it } from "vitest";
import {
  AGENT_PROCESS_STEPS,
  resolveProcessStatuses,
} from "@/app/track/knowledge/lib/agent-process";

describe("Owner-visible Agent process (8 steps)", () => {
  it("lists the full architecture loop in order", () => {
    expect(AGENT_PROCESS_STEPS.map((s) => s.title)).toEqual([
      "看你授权的文件夹",
      "摸清项目结构",
      "打开相关文件",
      "对着原文想清楚",
      "够就说，不够就说不知道",
      "整理出一段待确认的理解",
      "请你确认",
      "记住，并继续留意变化",
    ]);
  });

  it("before connect shows full process starting at observe", () => {
    const view = resolveProcessStatuses({
      pipelinePhase: null,
      memory: null,
      connected: false,
    });
    expect(view.statuses.observe).toBe("active");
    expect(view.statuses.owner).toBe("pending");
    expect(view.caption).toMatch(/选好文件夹|步骤/);
  });

  it("during pipeline highlights the live phase", () => {
    const view = resolveProcessStatuses({
      pipelinePhase: "reason",
      memory: null,
      connected: false,
    });
    expect(view.statuses.observe).toBe("done");
    expect(view.statuses.map).toBe("done");
    expect(view.statuses.tools).toBe("done");
    expect(view.statuses.reason).toBe("active");
    expect(view.statuses.candidate).toBe("pending");
  });

  it("with candidate memory waits at owner confirm", () => {
    const view = resolveProcessStatuses({
      pipelinePhase: null,
      memory: {
        candidate: { body: { now: { text: "x" } } },
        accepted: null,
        events: [{ id: "e1" }],
        head: { reviewState: "current" },
      },
      connected: true,
    });
    expect(view.active).toBe("owner");
    expect(view.statuses.candidate).toBe("done");
    expect(view.statuses.owner).toBe("active");
    expect(view.caption).toMatch(/确认/);
  });

  it("with accepted understanding marks process complete", () => {
    const view = resolveProcessStatuses({
      pipelinePhase: null,
      memory: {
        candidate: null,
        accepted: { body: { now: { text: "ok" } } },
        events: [],
        head: { reviewState: "current", acceptedRevisionId: "a1" },
      },
      connected: true,
    });
    expect(view.active).toBe("persist");
    expect(view.statuses.persist).toBe("done");
    expect(view.statuses.observe).toBe("done");
  });
});
