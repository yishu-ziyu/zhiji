import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetChangeStore } from "@/shared/delivery/change";

vi.mock("@/shared/llm/adapter", () => ({
  complete: vi.fn(async () =>
    JSON.stringify({
      scopeChange: "增加一个英文版本",
      scopeQuote: "增加一个英文版本",
      deliveryQuote: "",
      priceQuote: "",
    }),
  ),
  extractJson: (text: string) => JSON.parse(text) as Record<string, unknown>,
}));

import { POST } from "@/app/api/efficiency/changes/route";

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost:3000/api/efficiency/changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("客户变化接口", () => {
  beforeEach(resetChangeStore);

  it("把不合法的 JSON 作为请求错误返回", async () => {
    const request = new Request(
      "http://localhost:3000/api/efficiency/changes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
    );

    const providerResponse = await POST(request);
    expect(providerResponse.status).toBe(400);
    await expect(providerResponse.json()).resolves.toEqual({
      error: "请求内容不是合法的 JSON",
    });
  });

  it("拒绝非对象 JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/efficiency/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "null",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "请求内容必须是 JSON 对象",
    });
  });

  it("普通消息只返回有原文依据的变化", async () => {
    const seeded = await post({ action: "seed" });
    const seed = (await seeded.json()) as {
      project: { id: string };
      providerSecret: string;
    };
    const response = await post({
      action: "analyze",
      projectId: seed.project.id,
      providerSecret: seed.providerSecret,
      sourceText: "客户：请再增加一个英文版本。",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      impacts: [{ kind: "scope", proposedValue: "增加一个英文版本" }],
    });
  });
});
