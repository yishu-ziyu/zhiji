/**
 * Optional perf smoke against owner machine data dir.
 * Skips when KNOWLEDGE_DATA_DIR is unset or cards.json is tiny/missing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

const ownerKnowledge = path.join(
  os.homedir(),
  "Library/Application Support/知几/knowledge",
);
const cardsFile = path.join(ownerKnowledge, "cards.json");
const hasHeavyStore =
  fs.existsSync(cardsFile) && fs.statSync(cardsFile).size > 1_000_000;

describe.runIf(hasHeavyStore)("cards cache perf (owner knowledge dir)", () => {
  it("warm project listCards and canvas beat cold parse", async () => {
    process.env.SEED_DEMO = "0";
    process.env.KNOWLEDGE_DATA_DIR = ownerKnowledge;
    // Never call resetKnowledgeStoreForTests here — that would wipe owner data.
    const repo = await import("@/shared/knowledge/repository");
    const pid = "165a2828-d55f-22a6-e02f-6676e8b70378";
    const bb = "e4c1dc9a-3d01-405e-81c5-63cfd28920cd";

    const t0 = performance.now();
    const a = repo.listCards({ projectId: pid });
    const t1 = performance.now();
    const b = repo.listCards({ projectId: pid });
    const t2 = performance.now();
    const c = repo.listCards({ projectId: bb });
    const t3 = performance.now();
    const d = repo.listCards({ projectId: bb });
    const t4 = performance.now();
    const snap1 = repo.getProjectCanvasSnapshot(pid);
    const t5 = performance.now();
    repo.getProjectCanvasSnapshot(pid);
    const t6 = performance.now();

    const report = {
      红鲱鱼_count: a.length,
      红鲱鱼_cold_ms: +(t1 - t0).toFixed(1),
      红鲱鱼_warm_ms: +(t2 - t1).toFixed(1),
      bb_count: c.length,
      bb_indexed_ms: +(t3 - t2).toFixed(1),
      bb_warm_ms: +(t4 - t3).toFixed(1),
      canvas_first_ms: +(t5 - t4).toFixed(1),
      canvas_warm_ms: +(t6 - t5).toFixed(1),
    };
    // eslint-disable-next-line no-console
    console.log("PERF_REPORT", JSON.stringify(report));

    expect(a.length).toBe(b.length);
    expect(c.length).toBe(d.length);
    expect(c.length).toBeGreaterThan(1000);
    expect(snap1.project.id).toBe(pid);
    if (report.红鲱鱼_cold_ms >= 80) {
      expect(report.红鲱鱼_warm_ms).toBeLessThan(report.红鲱鱼_cold_ms / 3);
    }
    expect(report.bb_warm_ms).toBeLessThan(200);
  });
});
