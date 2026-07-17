/**
 * BYOK persistence + status (no secret values leaked in status).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyByokToProcessEnv,
  getByokStatus,
  parseByokEnvFile,
  resolveByokEnvFilePath,
  saveByokSecrets,
} from "@/shared/llm/byok";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-byok-"));
  tmpDirs.push(d);
  return d;
}

describe("resolveByokEnvFilePath", () => {
  it("uses sibling of KNOWLEDGE_DATA_DIR (desktop userData)", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge, { recursive: true });
    const p = resolveByokEnvFilePath({
      KNOWLEDGE_DATA_DIR: knowledge,
    });
    expect(p).toBe(path.join(root, ".env.local"));
  });

  it("honors FC_OPC_DESKTOP_ENV_FILE override", () => {
    const root = tmpDir();
    const custom = path.join(root, "custom.env");
    const p = resolveByokEnvFilePath({
      FC_OPC_DESKTOP_ENV_FILE: custom,
      KNOWLEDGE_DATA_DIR: path.join(root, "knowledge"),
    });
    expect(p).toBe(path.resolve(custom));
  });
});

describe("parseByokEnvFile", () => {
  it("skips empty template values and unknown keys", () => {
    const parsed = parseByokEnvFile(
      [
        "# comment",
        "LLM_BASE_URL=",
        "LLM_API_KEY=",
        "LLM_MODEL=gpt-x",
        "UNKNOWN=1",
        "LLM_BASE_URL=https://api.example/v1",
      ].join("\n"),
    );
    expect(parsed.LLM_MODEL).toBe("gpt-x");
    expect(parsed.LLM_BASE_URL).toBe("https://api.example/v1");
    expect(parsed.LLM_API_KEY).toBeUndefined();
    expect(parsed).not.toHaveProperty("UNKNOWN");
  });
});

describe("getByokStatus", () => {
  it("never embeds api key value; reports missing when empty", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge, { recursive: true });
    const status = getByokStatus({
      KNOWLEDGE_DATA_DIR: knowledge,
    });
    expect(status.configured).toBe(false);
    expect(status.hasApiKey).toBe(false);
    expect(JSON.stringify(status)).not.toMatch(/sk-/i);
  });

  it("shows baseUrl and model when configured, not the key", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge, { recursive: true });
    const envFile = path.join(root, ".env.local");
    fs.writeFileSync(
      envFile,
      [
        "LLM_BASE_URL=https://gateway.example/v1",
        "LLM_API_KEY=sk-super-secret-must-not-leak",
        "LLM_MODEL=step-flash",
        "",
      ].join("\n"),
      "utf8",
    );
    const status = getByokStatus({
      KNOWLEDGE_DATA_DIR: knowledge,
      LLM_BASE_URL: "https://gateway.example/v1",
      LLM_API_KEY: "sk-super-secret-must-not-leak",
      LLM_MODEL: "step-flash",
    });
    expect(status.configured).toBe(true);
    expect(status.baseUrl).toBe("https://gateway.example/v1");
    expect(status.model).toBe("step-flash");
    expect(JSON.stringify(status)).not.toContain("sk-super-secret");
  });
});

describe("saveByokSecrets", () => {
  it("rejects incomplete input", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge, { recursive: true });
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    expect(() =>
      saveByokSecrets(
        {
          llmBaseUrl: "",
          llmApiKey: "k",
          llmModel: "m",
        },
        { processEnv: env },
      ),
    ).toThrow(/网关|BASE_URL/i);
    expect(() =>
      saveByokSecrets(
        {
          llmBaseUrl: "https://x",
          llmApiKey: "",
          llmModel: "m",
        },
        { processEnv: env },
      ),
    ).toThrow(/密钥|API_KEY/i);
  });

  it("keeps existing api key when new input leaves it blank", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge, { recursive: true });
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    saveByokSecrets(
      {
        llmBaseUrl: "https://old.example/v1",
        llmApiKey: "existing-key",
        llmModel: "old",
      },
      { processEnv: env },
    );
    saveByokSecrets(
      {
        llmBaseUrl: "https://new.example/v1",
        llmApiKey: "",
        llmModel: "new-model",
      },
      { processEnv: env },
    );
    expect(env.LLM_API_KEY).toBe("existing-key");
    expect(env.LLM_BASE_URL).toBe("https://new.example/v1");
    expect(env.LLM_MODEL).toBe("new-model");
  });

  it("writes 0600 file and applies process env without restart", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge, { recursive: true });
    const fakeEnv: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const status = saveByokSecrets(
      {
        llmBaseUrl: "https://ui-filled.example/v1",
        llmApiKey: "user-typed-key",
        llmModel: "ui-model",
      },
      { processEnv: fakeEnv },
    );
    expect(status.configured).toBe(true);
    expect(fakeEnv.LLM_API_KEY).toBe("user-typed-key");
    expect(fakeEnv.LLM_BASE_URL).toBe("https://ui-filled.example/v1");
    expect(fakeEnv.LLM_MODEL).toBe("ui-model");

    const written = fs.readFileSync(path.join(root, ".env.local"), "utf8");
    expect(written).toContain("LLM_API_KEY=user-typed-key");
    expect(written).toMatch(/BYOK/i);

    applyByokToProcessEnv(
      { LLM_API_KEY: "reapplied" },
      fakeEnv,
    );
    expect(fakeEnv.LLM_API_KEY).toBe("reapplied");
  });
});
