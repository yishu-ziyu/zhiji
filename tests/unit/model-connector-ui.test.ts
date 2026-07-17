/**
 * UI contracts for competition model connector.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

describe("ModelConnector competition UI", () => {
  const src = fs.readFileSync(
    path.join(root, "app/track/knowledge/components/ModelConnector.tsx"),
    "utf8",
  );

  it("shows PX proxy badge and official badges", () => {
    expect(src).toMatch(/PX 代理/);
    expect(src).toMatch(/官方/);
    expect(src).toMatch(/px_proxy/);
    expect(src).toMatch(/minimax_token_plan/);
    expect(src).toMatch(/stepfun_step_plan/);
  });

  it("test pass is 测试通过 not 已连接; save needs server", () => {
    expect(src).toMatch(/测试通过/);
    expect(src).toMatch(/保存时服务端会再次验证/);
    expect(src).not.toMatch(/verifiedAt: testState/);
    expect(src).toMatch(/切换后需测试/);
    expect(src).toMatch(/isExactConnected/);
  });

  it("never sends client verifiedAt on save", () => {
    expect(src).toMatch(/Never send verifiedAt/);
    expect(src).toMatch(/llmApiKey: apiKey\.trim\(\)/);
  });

  it("does not list OpenAI/DeepSeek as primary competition rows", () => {
    // flatRows only competition providers
    expect(src).toMatch(/provider === "px_proxy"/);
    expect(src).not.toMatch(/provider: "openai"/);
  });
});

describe("local logos", () => {
  for (const name of [
    "px-proxy.svg",
    "openai.svg",
    "grok.svg",
    "gemini.svg",
    "minimax.svg",
    "stepfun.svg",
    "custom.svg",
  ]) {
    it(`has ${name}`, () => {
      expect(fs.existsSync(path.join(root, "public/llm-logos", name))).toBe(
        true,
      );
    });
  }
});
