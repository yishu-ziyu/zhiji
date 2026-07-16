/**
 * Live LLM acceptance — requires real LLM_BASE_URL + LLM_API_KEY.
 * Skips only when explicitly AGENT_RUN_MODE=deterministic.
 * Fails hard if model falls back to deterministic (Agent must use real LLM).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { complete, getLLMConfig } from "@/shared/llm/adapter";
import { runToolAugmentedAnalysis } from "./agent-runtime";
import { resetSharedProjectMemoryStoreForTests } from "./runtime";
import type { Matter } from "./types";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const forceDeterministic = process.env.AGENT_RUN_MODE === "deterministic";
// Live suite always wants model unless forced.
if (!forceDeterministic) {
  delete process.env.AGENT_RUN_MODE;
}

describe("ACCEPTANCE · live LLM Agent", () => {
  let tmp: string;
  let fixture: string;
  let store: ReturnType<
    typeof import("./runtime").getSharedProjectMemoryStore
  >;
  const projectId = "p-live-llm";
  const matterId = "m-live-llm";
  const grantId = "g-live-llm";

  beforeAll(async () => {
    if (forceDeterministic) return;
    const cfg = getLLMConfig();
    expect(cfg.apiKey?.length ?? 0).toBeGreaterThan(0);
    expect(cfg.baseUrl).toBeTruthy();
    const ping = await complete(
      "Reply with exactly: LLM_OK",
      "You are a connectivity probe. Output only LLM_OK.",
      { maxRetries: 1, timeout: 20_000 },
    );
    expect(ping).toMatch(/LLM_OK/i);
  }, 60_000);

  beforeEach(async () => {
    if (forceDeterministic) return;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pm-live-"));
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fx-live-"));
    fs.writeFileSync(
      path.join(fixture, "PRODUCT.md"),
      "# 持节 (Chijie)\n\nChrome 扩展：用户是主人，Agent 临时持节办事。\n目标：多步网页任务；不可逆外发前必须确认。\n",
    );
    fs.writeFileSync(
      path.join(fixture, "NOTES.md"),
      "# Notes\n当前重点：让 Agent 过程在页面可见。\nTODO: 确认闭环。\n",
    );
    fs.writeFileSync(
      path.join(fixture, "DECISIONS.md"),
      "# Decisions\n- 只在授权夹内读。\n- 结论必须带来源。\n",
    );

    resetSharedProjectMemoryStoreForTests(tmp);
    const { getSharedProjectMemoryStore } = await import("./runtime");
    store = getSharedProjectMemoryStore({ dataDir: tmp });

    store.upsertGrant({
      id: grantId,
      projectId,
      kind: "local_folder",
      rootPath: fixture,
      status: "active",
      createdAt: "2026-07-17T01:00:00.000Z",
      updatedAt: "2026-07-17T01:00:00.000Z",
    });
    const matter: Matter = {
      id: matterId,
      projectId,
      title: "真模型验收",
      goal: "有来源理解",
      status: "active",
      createdAt: "2026-07-17T01:00:00.000Z",
      updatedAt: "2026-07-17T01:00:00.000Z",
    };
    store.upsertMatter(matter);
    store.upsertWatchSet({
      id: "w-live",
      projectId,
      matterId,
      grantId,
      includePathPrefixes: ["PRODUCT.md", "NOTES.md", "DECISIONS.md"],
      excludePathPrefixes: [],
      status: "active",
      createdAt: "2026-07-17T01:00:00.000Z",
      updatedAt: "2026-07-17T01:00:00.000Z",
    });
    for (const name of ["PRODUCT.md", "NOTES.md", "DECISIONS.md"] as const) {
      await store.ingest({
        projectId,
        grantId,
        kind: "added",
        relativePath: name,
        content: new TextEncoder().encode(
          fs.readFileSync(path.join(fixture, name), "utf8"),
        ),
        observedAt: "2026-07-17T01:01:00.000Z",
      });
    }
  });

  afterEach(() => {
    if (forceDeterministic) return;
    resetSharedProjectMemoryStoreForTests();
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(fixture, { recursive: true, force: true });
    } catch {
      /* */
    }
  });

  it.skipIf(forceDeterministic)(
    "L1 · complete() hits live gateway",
    async () => {
      const text = await complete(
        "用中文一句话说明：授权文件夹内的 Agent 只能读边界内文件。",
        "只输出一句话中文。",
        { maxRetries: 1, timeout: 25_000 },
      );
      expect(text.trim().length).toBeGreaterThan(4);
      expect(text).not.toMatch(/AI 服务暂时不可用/);
    },
    40_000,
  );

  it.skipIf(forceDeterministic)(
    "L2 · tool-loop + real model produces candidate without deterministic fallback",
    async () => {
      const result = await runToolAugmentedAnalysis(
        { projectId, matterId, trigger: "source_change" },
        {
          modelMode: "model",
          toolsEnabled: true,
          allowDeterministicFallback: false,
        },
      );

      expect(result.toolReceipts.length).toBeGreaterThanOrEqual(3);
      const tools = result.toolReceipts.map((r) => r.tool);
      expect(tools).toContain("project_map");
      expect(tools).toContain("search_text");
      expect(
        tools.includes("read_revision") || tools.includes("read_path"),
      ).toBe(true);

      expect(result.candidate).toBeTruthy();
      expect(result.run.status).toBe("awaiting_owner");

      const receipt = result.run.modelReceipt;
      expect(receipt).toBeTruthy();
      // HARD: real model path — no silent deterministic finish
      expect(receipt!.fallback.used).toBe(false);

      const now = result.candidate!.body.now.text;
      expect(now.trim().length).toBeGreaterThan(8);
      // Should not be pure English empty filler
      expect(now).not.toMatch(/^No events/i);
    },
    180_000,
  );

  it.skipIf(forceDeterministic)(
    "L3 · live candidate carries usable in-grant evidence",
    async () => {
      const { collectUsableEvidence, evidencePathsInGrant } = await import(
        "./agent-evidence"
      );
      const result = await runToolAugmentedAnalysis(
        { projectId, matterId, trigger: "source_change" },
        {
          modelMode: "model",
          toolsEnabled: true,
          allowDeterministicFallback: false,
        },
      );
      expect(result.run.status).toBe("awaiting_owner");
      expect(result.candidate).toBeTruthy();
      const evidence = collectUsableEvidence(result.candidate!.body);
      expect(evidence.length).toBeGreaterThanOrEqual(1);
      expect(evidence[0]!.quote.trim().length).toBeGreaterThan(0);
      expect(
        evidencePathsInGrant(evidence, [
          "PRODUCT.md",
          "NOTES.md",
          "DECISIONS.md",
        ]),
      ).toBe(true);
    },
    180_000,
  );
});
