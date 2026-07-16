import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Owner project statements (no auto-elevate)", () => {
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

  it("does not promote casual chat into active project truth", async () => {
    const m = await import("./owner-statements");
    m.resetOwnerStatementsForTests();

    const guess = m.recordOwnerProjectStatement({
      projectId: "p1",
      text: "我只是随便猜一下这个项目快完成了",
      source: "chat",
    });
    expect(guess?.status).toBe("proposed");
    expect(m.listOwnerProjectStatements("p1")).toHaveLength(0);
    expect(
      m.listOwnerProjectStatements("p1", { includeCandidates: true }),
    ).toHaveLength(1);
  });

  it("only merges confirmed/active statements into understanding body", async () => {
    const m = await import("./owner-statements");
    m.resetOwnerStatementsForTests();

    expect(m.looksLikeProjectUnderstanding("你好")).toBe(false);
    expect(
      m.looksLikeProjectUnderstanding("我们这个项目的目标是先把画布跑通"),
    ).toBe(true);

    const proposed = m.recordOwnerProjectStatement({
      projectId: "p1",
      text: "我们这个项目的目标是先把画布跑通，别做编辑器",
      source: "chat",
    }) as { id: string; status: string } | null;
    expect(proposed?.status).toBe("proposed");
    expect(proposed).toBeTruthy();
    if (!proposed) throw new Error("expected proposed statement");
    const confirmed = m.confirmOwnerProjectStatement(proposed.id);
    expect(confirmed?.status).toBe("active");
    expect(m.listOwnerProjectStatements("p1")).toHaveLength(1);

    const body = m.mergeOwnerStatementsIntoUnderstandingBody(
      {
        now: {
          text: "目前还没有可核对的文件变化。",
          evidence: [],
          gaps: [],
          conflicts: [],
        },
        depends: [] as Array<{ kind: string; id: string; reason: string }>,
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
    expect(
      body.depends.some((d: { id: string }) =>
        d.id.startsWith("owner-statement:"),
      ),
    ).toBe(true);
  });

  it("confirmed one-shot path writes active truth", async () => {
    const m = await import("./owner-statements");
    m.resetOwnerStatementsForTests();
    const row = m.recordOwnerProjectStatement({
      projectId: "p1",
      text: "北极星是项目理解工作台",
      confirmed: true,
    });
    expect(row?.status).toBe("active");
    expect(m.listOwnerProjectStatements("p1")[0]?.text).toMatch(/北极星/);
  });
});
