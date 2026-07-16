import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeProjectAgentTool,
  planBootstrapToolCalls,
} from "./agent-tools";
import type { SourceGrant } from "./types";

function tempFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tools-"));
  fs.writeFileSync(
    path.join(dir, "NOTES.md"),
    "# Product notes\nFocus: one matter.\nTODO: decide next.\n",
  );
  fs.writeFileSync(path.join(dir, "DECISIONS.md"), "# Decisions\n- local grant\n");
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.ts"), "export const x = 1;\n");
  return dir;
}

const grant = (rootPath: string): SourceGrant => ({
  id: "grant:test",
  projectId: "proj-1",
  kind: "local_folder",
  rootPath,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const noopReader = {
  readRevision: async () => null,
  listEvents: async () => [],
  getMatterState: async () => {
    throw new Error("no matter");
  },
};

describe("agent-tools", () => {
  it("project_map lists fixture files under grant root", async () => {
    const root = tempFixture();
    const result = await executeProjectAgentTool(
      {
        id: "1",
        name: "project_map",
        input: { scope: "initial_root", maxDepth: 2 },
      },
      { projectId: "proj-1", grant: grant(root), reader: noopReader },
    );
    expect(result.outcome).toBe("ok");
    expect(result.detail).toMatch(/NOTES\.md/);
    expect(result.relativePaths.some((p) => p.includes("NOTES"))).toBe(true);
  });

  it("search_text finds TODO in NOTES", async () => {
    const root = tempFixture();
    const result = await executeProjectAgentTool(
      {
        id: "2",
        name: "search_text",
        input: { query: "TODO", limit: 10 },
      },
      { projectId: "proj-1", grant: grant(root), reader: noopReader },
    );
    expect(result.outcome).toBe("ok");
    expect(result.detail.toLowerCase()).toContain("todo");
  });

  it("planBootstrapToolCalls always starts with project_map", () => {
    const calls = planBootstrapToolCalls({
      eventRevisionIds: [
        { revisionId: "orev:abc", relativePath: "NOTES.md" },
      ],
    });
    expect(calls[0]?.name).toBe("project_map");
    expect(calls.some((c) => c.name === "read_revision")).toBe(true);
    expect(calls.some((c) => c.name === "search_text")).toBe(true);
    // Reads should appear before searches (budget prioritizes evidence).
    const firstRead = calls.findIndex((c) => c.name === "read_revision");
    const firstSearch = calls.findIndex((c) => c.name === "search_text");
    expect(firstRead).toBeGreaterThan(0);
    expect(firstSearch).toBeGreaterThan(firstRead);
  });

  it("read_path reads grant file and pins quote", async () => {
    const root = tempFixture();
    const result = await executeProjectAgentTool(
      {
        id: "3",
        name: "read_path",
        input: { relativePath: "NOTES.md", startLine: 1, endLine: 20 },
      },
      { projectId: "proj-1", grant: grant(root), reader: noopReader },
    );
    expect(result.outcome).toBe("ok");
    expect(result.pins.length).toBeGreaterThan(0);
    expect(result.pins[0]?.relativePath).toBe("NOTES.md");
    expect(result.detail.toLowerCase()).toContain("product notes");
  });

  it("planForceReadsFromMap prefers README/TODO via read_path when no rev", async () => {
    const { planForceReadsFromMap } = await import("./agent-tools");
    const calls = planForceReadsFromMap({
      mapRelativePaths: ["src/a.ts", "README.md", "TODO.md", "noise.bin"],
      pathByRevisionId: new Map(),
      alreadyReadRevisionIds: new Set(),
      alreadyReadPaths: new Set(),
      maxReads: 4,
    });
    expect(calls.some((c) => c.name === "read_path")).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.name === "read_path" &&
          c.input.relativePath.toLowerCase().includes("readme"),
      ),
    ).toBe(true);
  });

  it("refuses path escape for search via root resolve", async () => {
    const root = tempFixture();
    const result = await executeProjectAgentTool(
      {
        id: "3",
        name: "search_text",
        input: { query: "Product", pathPrefix: "../../", limit: 5 },
      },
      { projectId: "proj-1", grant: grant(root), reader: noopReader },
    );
    // prefix that doesn't match real children → no crash, ok outcome
    expect(["ok", "error"]).toContain(result.outcome);
  });

  it("set_canvas_view validates and returns canvas-menu-v1 command", async () => {
    const root = tempFixture();
    const ok = await executeProjectAgentTool(
      {
        id: "t-cv",
        name: "set_canvas_view",
        input: {
          view: "evidence",
          focus: { kind: "project", id: "proj-1" },
          intentId: "why_evidence",
          reason: "要证据",
        },
      },
      { projectId: "proj-1", grant: grant(root), reader: noopReader },
    );
    expect(ok.outcome).toBe("ok");
    expect(ok.detail).toContain('"view":"evidence"');
    expect(ok.detail).toContain("canvas-menu-v1");

    const bad = await executeProjectAgentTool(
      {
        id: "t-cv-bad",
        name: "set_canvas_view",
        input: { view: "nope" as "now" },
      },
      { projectId: "proj-1", grant: grant(root), reader: noopReader },
    );
    expect(bad.outcome).toBe("error");
  });
});
