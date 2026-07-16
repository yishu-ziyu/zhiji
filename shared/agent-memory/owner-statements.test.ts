import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Owner project statements (elevated from chat)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "owner-stmt-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    const m = await import("./owner-statements");
    m.resetOwnerStatementsForTests();
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("records project understanding and merges into understanding body", async () => {
    const m = await import("./owner-statements");
    m.resetOwnerStatementsForTests();

    expect(m.looksLikeProjectUnderstanding("你好")).toBe(false);
    expect(
      m.looksLikeProjectUnderstanding("我们这个项目的目标是先把画布跑通"),
    ).toBe(true);

    const row = m.recordOwnerProjectStatement({
      projectId: "p1",
      text: "我们这个项目的目标是先把画布跑通，别做编辑器",
      source: "chat",
    });
    expect(row?.text).toMatch(/画布/);
    expect(m.listOwnerProjectStatements("p1")).toHaveLength(1);

    // Dedup identical consecutive
    const again = m.recordOwnerProjectStatement({
      projectId: "p1",
      text: "我们这个项目的目标是先把画布跑通，别做编辑器",
    });
    expect(again?.id).toBe(row?.id);
    expect(m.listOwnerProjectStatements("p1")).toHaveLength(1);

    const body = m.mergeOwnerStatementsIntoUnderstandingBody(
      {
        now: {
          text: "目前还没有可核对的文件变化。",
          evidence: [],
          gaps: [],
          conflicts: [],
        },
        depends: [],
        why: [
          {
            text: "未知",
            status: "unknown",
            evidence: [],
          },
        ],
      },
      m.listOwnerProjectStatements("p1"),
    );
    expect(body.now.text).toMatch(/你对这个项目说过/);
    expect(body.now.text).toMatch(/画布跑通/);
    expect(body.depends.some((d) => d.id.startsWith("owner-statement:"))).toBe(
      true,
    );
  });
});
