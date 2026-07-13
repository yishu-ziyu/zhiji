import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/efficiency/changes/[token]/route";

function clientPost(body: string) {
  return POST(
    new Request("http://localhost:3000/api/efficiency/changes/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    { params: Promise.resolve({ token: "token" }) },
  );
}

describe("客户确认接口", () => {
  it("把不合法的 JSON 作为请求错误返回", async () => {
    const response = await clientPost("{");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "请求内容不是合法的 JSON",
    });
  });

  it("拒绝非对象 JSON", async () => {
    const response = await clientPost("[]");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "请求内容必须是 JSON 对象",
    });
  });
});
