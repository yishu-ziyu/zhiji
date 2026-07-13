import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeFixtureChange,
  confirmClientChange,
  createChangeDraft,
  createDemoProject,
  createEvidenceSpan,
  getClientChange,
  getProviderChange,
  requestClientChange,
  resetChangeStore,
  sendChangeToClient,
} from "./change";

const sourceText =
  "客户：再加一组 A/B 测试，还是周五上，价格先按之前的。";

describe("客户提出变化后的处理", () => {
  beforeEach(resetChangeStore);

  it("保留原文依据，并在确认后同时更新交付日期和尾款", () => {
    const created = createDemoProject();
    const draft = analyzeFixtureChange(
      created.project.id,
      created.providerSecret,
      sourceText,
    );

    expect(draft.impacts.map((impact) => impact.kind)).toEqual([
      "scope",
      "delivery_date",
      "total_price",
    ]);
    for (const impact of draft.impacts) {
      expect(
        sourceText.slice(impact.evidence.start, impact.evidence.end),
      ).toBe(impact.evidence.quote);
    }
    expect(draft.impacts[1].proposedValue).toBeNull();
    expect(draft.impacts[2].proposedValue).toBeNull();

    const sent = sendChangeToClient({
      proposalId: draft.id,
      providerSecret: created.providerSecret,
      scope: "单版本落地页，增加一组 A/B 测试",
      deliveryDate: "2026-07-20",
      totalPriceMinor: 1_000_000,
    });
    const client = getClientChange(sent.clientToken);

    expect(client.identityAssurance).toBe("guest_link");
    expect(client.oldVersion.totalPriceMinor).toBe(800_000);
    expect(client.newVersion.totalPriceMinor).toBe(1_000_000);
    expect(client.newVersion.finalPaymentMinor).toBe(600_000);

    const confirmed = confirmClientChange(sent.clientToken);
    expect(confirmed.project.version).toBe(2);
    expect(confirmed.project.deliveryMilestone.date).toBe("2026-07-20");
    expect(confirmed.project.paymentMilestone.amountMinor).toBe(600_000);
    expect(confirmed.project.history.at(-1)).toMatchObject({
      proposalId: draft.id,
      identityAssurance: "guest_link",
    });
    expect(() => confirmClientChange(sent.clientToken)).toThrow(
      "客户链接已使用或已失效",
    );
  });

  it("客户要求修改后生成新链接，旧链接不能再操作", () => {
    const created = createDemoProject();
    const draft = analyzeFixtureChange(
      created.project.id,
      created.providerSecret,
      sourceText,
    );
    const first = sendChangeToClient({
      proposalId: draft.id,
      providerSecret: created.providerSecret,
      scope: "单版本落地页，增加一组 A/B 测试",
      deliveryDate: "2026-07-20",
      totalPriceMinor: 1_000_000,
    });

    expect(() => requestClientChange(first.clientToken, " ")).toThrow(
      "请填写修改说明",
    );
    requestClientChange(first.clientToken, "交付日期改成 7 月 21 日");

    const second = sendChangeToClient({
      proposalId: draft.id,
      providerSecret: created.providerSecret,
      scope: "单版本落地页，增加一组 A/B 测试",
      deliveryDate: "2026-07-21",
      totalPriceMinor: 1_000_000,
    });

    expect(second.revision).toBe(2);
    expect(second.clientToken).not.toBe(first.clientToken);
    expect(() => getClientChange(first.clientToken)).toThrow(
      "客户链接已使用或已失效",
    );
  });

  it("服务方主动修改方案后生成新链接，旧链接立即失效", () => {
    const created = createDemoProject();
    const draft = analyzeFixtureChange(
      created.project.id,
      created.providerSecret,
      sourceText,
    );
    const first = sendChangeToClient({
      proposalId: draft.id,
      providerSecret: created.providerSecret,
      scope: "单版本落地页，增加一组 A/B 测试",
      deliveryDate: "2026-07-20",
      totalPriceMinor: 1_000_000,
    });
    const second = sendChangeToClient({
      proposalId: draft.id,
      providerSecret: created.providerSecret,
      scope: "单版本落地页，增加一组 A/B 测试",
      deliveryDate: "2026-07-21",
      totalPriceMinor: 1_000_000,
    });

    expect(second.revision).toBe(2);
    expect(() => getClientChange(first.clientToken)).toThrow(
      "客户链接已使用或已失效",
    );
    expect(getClientChange(second.clientToken).newVersion.deliveryDate).toBe(
      "2026-07-21",
    );
  });

  it("拒绝错误的服务方凭据和过期项目版本", () => {
    const first = createDemoProject();
    expect(() => getProviderChange(first.project.id, "wrong-secret")).toThrow(
      "服务方凭据无效",
    );

    const draftA = analyzeFixtureChange(
      first.project.id,
      first.providerSecret,
      sourceText,
    );
    const sentA = sendChangeToClient({
      proposalId: draftA.id,
      providerSecret: first.providerSecret,
      scope: "方案 A",
      deliveryDate: "2026-07-20",
      totalPriceMinor: 1_000_000,
    });
    const draftB = analyzeFixtureChange(
      first.project.id,
      first.providerSecret,
      sourceText,
    );
    const sentB = sendChangeToClient({
      proposalId: draftB.id,
      providerSecret: first.providerSecret,
      scope: "方案 B",
      deliveryDate: "2026-07-21",
      totalPriceMinor: 1_100_000,
    });

    confirmClientChange(sentB.clientToken);
    expect(() => getClientChange(sentA.clientToken)).toThrow(
      "客户链接已使用或已失效",
    );
    expect(() => requestClientChange(sentA.clientToken, "仍用方案 A")).toThrow(
      "客户链接已使用或已失效",
    );
    expect(() => confirmClientChange(sentA.clientToken)).toThrow(
      "客户链接已使用或已失效",
    );
    expect(getProviderChange(first.project.id, first.providerSecret).project)
      .toMatchObject({
        version: 2,
        scope: "方案 B",
      });
  });

  it("拒绝不存在于原消息中的证据", () => {
    expect(() => createEvidenceSpan(sourceText, "客户已经同意加价")).toThrow(
      "分析结果引用了原消息中不存在的文字",
    );
  });

  it("只返回客户原话确实涉及的变化", () => {
    const created = createDemoProject();
    const draft = createChangeDraft({
      projectId: created.project.id,
      providerSecret: created.providerSecret,
      sourceText: "客户：请再增加一个英文版本。",
      scopeChange: "增加一个英文版本",
      scopeQuote: "增加一个英文版本",
      deliveryQuote: "",
      priceQuote: "",
    });

    expect(draft.impacts.map((impact) => impact.kind)).toEqual(["scope"]);
  });

  it("同一时刻创建多个方案时返回最后创建的方案", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00.000Z"));
    try {
      const created = createDemoProject();
      createChangeDraft({
        projectId: created.project.id,
        providerSecret: created.providerSecret,
        sourceText: "客户：增加中文版本。",
        scopeChange: "增加中文版本",
        scopeQuote: "增加中文版本",
        deliveryQuote: "",
        priceQuote: "",
      });
      const latest = createChangeDraft({
        projectId: created.project.id,
        providerSecret: created.providerSecret,
        sourceText: "客户：增加英文版本。",
        scopeChange: "增加英文版本",
        scopeQuote: "增加英文版本",
        deliveryQuote: "",
        priceQuote: "",
      });

      expect(
        getProviderChange(created.project.id, created.providerSecret).proposal?.id,
      ).toBe(latest.id);
    } finally {
      vi.useRealTimers();
    }
  });
});
