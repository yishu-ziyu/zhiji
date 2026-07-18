/**
 * BYOK profile: server fingerprint, no key echo, legacy migration.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAndActivate } from "@/shared/llm/activate";
import {
  getByokStatus,
  toPublicByokStatus,
} from "@/shared/llm/byok";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-byok2-"));
  tmpDirs.push(d);
  return d;
}

describe("server activate profile", () => {
  it("status never embeds api key", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ content: [{ type: "text", text: "ok" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const result = await verifyAndActivate(
      {
        provider: "stepfun_step_plan",
        model: "step-3.7-flash",
        apiKey: "sk-super-secret-must-not-leak",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(toPublicByokStatus(result.status))).not.toContain(
        "sk-super-secret",
      );
      expect(result.status.connected).toBe(true);
    }
  });

  it("same provider empty key reuses stored key", async () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const env: Record<string, string | undefined> = {
      KNOWLEDGE_DATA_DIR: knowledge,
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ content: [{ type: "text", text: "ok" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "gpt-5.6-sol",
        apiKey: "px-key-shared",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    // Switch alias only — empty key
    const second = await verifyAndActivate(
      {
        provider: "px_proxy",
        model: "grok-4.5",
        apiKey: "",
      },
      { processEnv: env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.status.model).toBe("grok-4.5");
      expect(env.LLM_API_KEY).toBe("px-key-shared");
    }
  });
});

describe("legacy migration", () => {
  it("file remains on disk; status needs reverify", () => {
    const root = tmpDir();
    const knowledge = path.join(root, "knowledge");
    fs.mkdirSync(knowledge);
    const envPath = path.join(root, ".env.local");
    fs.writeFileSync(
      envPath,
      "LLM_BASE_URL=http://127.0.0.1:15721\nLLM_API_KEY=keep\nLLM_MODEL=step-3.7-flash\n",
    );
    const status = getByokStatus({ KNOWLEDGE_DATA_DIR: knowledge });
    expect(status.connected).toBe(false);
    expect(fs.readFileSync(envPath, "utf8")).toContain("LLM_API_KEY=keep");
  });
});
