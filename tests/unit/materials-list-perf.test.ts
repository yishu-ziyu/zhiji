import fs from "node:fs";
import { performance } from "node:perf_hooks";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ownerKnowledge = path.join(
  os.homedir(),
  "Library/Application Support/知几/knowledge",
);
const bbFiles = path.join(
  ownerKnowledge,
  "files",
  "e4c1dc9a-3d01-405e-81c5-63cfd28920cd",
);
const hasOwnerBb = fs.existsSync(bbFiles);

describe.runIf(hasOwnerBb)("materials list perf owner data", () => {
  it("skips node_modules and finishes listing in seconds not minutes", async () => {
    process.env.KNOWLEDGE_DATA_DIR = ownerKnowledge;
    process.env.SEED_DEMO = "0";
    const { listProjectMaterials } = await import(
      "@/shared/knowledge/materials"
    );
    const bb = "e4c1dc9a-3d01-405e-81c5-63cfd28920cd";
    const red = "165a2828-d55f-22a6-e02f-6676e8b70378";
    const t0 = performance.now();
    const a = listProjectMaterials(red);
    const t1 = performance.now();
    const b = listProjectMaterials(bb);
    const t2 = performance.now();
    // eslint-disable-next-line no-console
    console.log(
      "MATERIALS_PERF",
      JSON.stringify({
        red_count: a.length,
        red_ms: +(t1 - t0).toFixed(1),
        bb_count: b.length,
        bb_ms: +(t2 - t1).toFixed(1),
        bb_has_nm: b.some((f) => f.relativePath.includes("node_modules")),
      }),
    );
    expect(b.some((f) => f.relativePath.includes("node_modules"))).toBe(false);
    expect(t2 - t1).toBeLessThan(5000);
  });
});