import { beforeEach, describe, expect, it } from "vitest";
import {
  applyClientAction,
  applyProviderAction,
  createSlips,
  getSlipByToken,
  resetSlipStore,
  updateSlip,
} from "./repository";

describe("commitment slip repository", () => {
  beforeEach(() => resetSlipStore());

  it("issues a client token only when the provider sends a draft", () => {
    const [draft] = createSlips([{ title: "周五交付可分享预览" }]);
    expect(draft.status).toBe("draft");
    expect(draft.clientToken).toBeUndefined();

    const sent = applyProviderAction(draft.id, "send");
    expect(sent.status).toBe("pending_client_confirm");
    expect(sent.clientToken).toMatch(/^[a-f0-9-]{36}$/);
    expect(getSlipByToken(sent.clientToken!)).toMatchObject({ id: draft.id });
  });

  it("completes the bilateral confirm, deliver, and accept path", () => {
    const [draft] = createSlips([{ title: "交付落地页原型" }]);
    const sent = applyProviderAction(draft.id, "send");
    const confirmed = applyClientAction(sent.clientToken!, "confirm");
    const delivered = applyProviderAction(confirmed.id, "deliver");
    const accepted = applyClientAction(sent.clientToken!, "accept");

    expect(accepted.status).toBe("client_accepted");
    expect(accepted.history.map((entry) => entry.action)).toEqual([
      "create",
      "send",
      "confirm",
      "deliver",
      "accept",
    ]);
    expect(delivered.status).toBe("provider_delivered");
  });

  it("requires client notes for changes and rejection", () => {
    const [draft] = createSlips([{ title: "确认视觉稿" }]);
    const sent = applyProviderAction(draft.id, "send");
    expect(() =>
      applyClientAction(sent.clientToken!, "request_changes"),
    ).toThrow("请填写修改说明");

    const changed = applyClientAction(
      sent.clientToken!,
      "request_changes",
      "首屏标题需要更聚焦",
    );
    expect(changed.status).toBe("client_requested_changes");
  });

  it("preserves stored fields when a partial update omits them", () => {
    const [draft] = createSlips([
      {
        title: "完整承诺",
        description: "原描述",
        acceptanceCriteria: "原验收标准",
        dueAt: "2026-07-18",
        priority: "高",
      },
    ]);

    expect(
      updateSlip(draft.id, {
        title: "只更新标题",
        description: undefined,
        acceptanceCriteria: undefined,
        dueAt: undefined,
        priority: undefined,
      }),
    ).toMatchObject({
      title: "只更新标题",
      description: "原描述",
      acceptanceCriteria: "原验收标准",
      dueAt: "2026-07-18",
      priority: "高",
    });
  });
});
