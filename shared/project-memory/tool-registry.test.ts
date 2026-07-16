import { describe, expect, it } from "vitest";
import {
  TOOL_REGISTRY,
  getToolRegistryEntry,
  isToolExecutable,
  isToolRegistered,
  listExecutableTools,
  listToolNames,
  validateToolCall,
} from "./tool-registry";

/** Names that agent-tools.ts currently executes (not not_implemented). */
const IMPLEMENTED_NAMES = [
  "project_map",
  "read_revision",
  "read_path",
  "search_text",
  "set_canvas_view",
  "query_project_memory",
  "git_status",
  "git_log",
  "git_diff",
  "git_show",
  "git_blame",
] as const;

const NOT_IMPLEMENTED_NAMES = [
  "search_symbols",
  "search_relations",
  "compare_history",
] as const;

describe("tool-registry (PR-09)", () => {
  it("registers unique names with version and inputSchema", () => {
    const names = listToolNames();
    expect(new Set(names).size).toBe(names.length);
    for (const entry of TOOL_REGISTRY) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.inputSchema.type).toBe("object");
      expect(["implemented", "not_implemented"]).toContain(entry.status);
    }
  });

  it("marks only implemented tools as executable", () => {
    for (const name of IMPLEMENTED_NAMES) {
      expect(isToolRegistered(name)).toBe(true);
      expect(isToolExecutable(name)).toBe(true);
      expect(getToolRegistryEntry(name)?.status).toBe("implemented");
    }
    for (const name of NOT_IMPLEMENTED_NAMES) {
      expect(isToolRegistered(name)).toBe(true);
      expect(isToolExecutable(name)).toBe(false);
      expect(getToolRegistryEntry(name)?.status).toBe("not_implemented");
    }
    expect(listExecutableTools().map((t) => t.name).sort()).toEqual(
      [...IMPLEMENTED_NAMES].sort(),
    );
  });

  it("rejects unknown tools", () => {
    const result = validateToolCall("delete_everything", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unknown tool/);
    }
  });

  it("rejects not_implemented tools even with valid-shaped input", () => {
    const result = validateToolCall("search_symbols", { query: "foo" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not_implemented/);
      expect(result.tool?.name).toBe("search_symbols");
    }
  });

  it("validates implemented tool inputs", () => {
    expect(validateToolCall("project_map", { scope: "initial_root" }).ok).toBe(
      true,
    );
    expect(validateToolCall("project_map", {}).ok).toBe(false);
    expect(
      validateToolCall("project_map", {
        scope: "initial_root",
        extra: true,
      }).ok,
    ).toBe(false);
    expect(
      validateToolCall("read_path", {
        relativePath: "README.md",
        startLine: 1,
      }).ok,
    ).toBe(true);
    expect(validateToolCall("git_status", {}).ok).toBe(true);
    expect(
      validateToolCall("set_canvas_view", {
        view: "now",
        focus: { kind: "material", id: "m1" },
      }).ok,
    ).toBe(true);
  });

  it("exposes version on registry entry for receipt tagging", () => {
    const map = getToolRegistryEntry("project_map");
    expect(map?.version).toBe("1.0.0");
  });
});
