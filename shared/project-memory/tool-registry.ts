/**
 * Project Agent tool registry (PR-09 start).
 * Single inventory of tool name / version / input schema / implementation status.
 * Runtime wiring (dispatcher) stays outside this file until a later PR.
 */

export type ToolImplementationStatus = "implemented" | "not_implemented";

/** Capability class for future policy / receipt tagging. */
export type ToolCapability =
  | "grant_fs_read"
  | "grant_git_read"
  | "project_memory_read"
  | "ui_canvas"
  | "index_search";

/**
 * Minimal JSON-Schema-like shape (no external dependency).
 * Enough for unit validation and model tool listing.
 */
export type JsonSchemaLike = {
  type: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
};

export type JsonSchemaProperty =
  | {
      type: "string" | "number" | "integer" | "boolean";
      enum?: string[];
      minimum?: number;
      maximum?: number;
      description?: string;
    }
  | {
      type: "object";
      properties?: Record<string, JsonSchemaProperty>;
      required?: string[];
      additionalProperties?: boolean;
      description?: string;
    }
  | {
      type: "array";
      items?: JsonSchemaProperty;
      description?: string;
    };

export type ToolRegistryEntry = {
  name: string;
  version: string;
  status: ToolImplementationStatus;
  capability: ToolCapability;
  description: string;
  inputSchema: JsonSchemaLike;
};

const V1 = "1.0.0";

/**
 * Canonical tool list aligned with `ProjectAgentToolCall` in types.ts
 * and `executeProjectAgentTool` in agent-tools.ts (read-only inventory).
 *
 * Input field docs live on each property's `description` (model + humans).
 * Conventions:
 * - relativePath: path under grant root only (no absolute / `..` escape)
 * - startLine/endLine: 1-based inclusive line window when present
 * - limit: hard caps are schema maximums; runtime may clamp further
 * - git refs (base/head/commit): must be validated by Safe Git Reader (PR-05)
 */
export const TOOL_REGISTRY: readonly ToolRegistryEntry[] = [
  {
    name: "project_map",
    version: V1,
    status: "implemented",
    capability: "grant_fs_read",
    description: "List grant-bounded directory tree (map before deep read).",
    inputSchema: {
      type: "object",
      properties: {
        // scope: which subtree to map under the active grant
        scope: {
          type: "string",
          enum: ["initial_root", "matter"],
          description:
            "Map scope under grant: initial_root = grant root; matter = current matter watch paths",
        },
        // maxDepth: optional BFS/DFS depth cap
        maxDepth: {
          type: "integer",
          minimum: 1,
          maximum: 32,
          description: "Optional max directory depth (1–32); omit for tool default",
        },
      },
      required: ["scope"],
      additionalProperties: false,
    },
  },
  {
    name: "read_revision",
    version: V1,
    status: "implemented",
    capability: "grant_fs_read",
    description: "Read a stored original revision by id (optional line range).",
    inputSchema: {
      type: "object",
      properties: {
        // revisionId: immutable OriginalRevision id from project-memory
        revisionId: {
          type: "string",
          description: "Original revision id already observed into project-memory",
        },
        // startLine: 1-based first line to return
        startLine: {
          type: "integer",
          minimum: 1,
          description: "Optional 1-based start line (inclusive)",
        },
        // endLine: 1-based last line to return
        endLine: {
          type: "integer",
          minimum: 1,
          description: "Optional 1-based end line (inclusive)",
        },
      },
      required: ["revisionId"],
      additionalProperties: false,
    },
  },
  {
    name: "read_path",
    version: V1,
    status: "implemented",
    capability: "grant_fs_read",
    description: "Read a file under grant root by relative path.",
    inputSchema: {
      type: "object",
      properties: {
        // relativePath: grant-relative path when revision id unknown
        relativePath: {
          type: "string",
          description: "File path relative to grant root (no absolute, no symlink escape)",
        },
        startLine: {
          type: "integer",
          minimum: 1,
          description: "Optional 1-based start line (inclusive)",
        },
        endLine: {
          type: "integer",
          minimum: 1,
          description: "Optional 1-based end line (inclusive)",
        },
      },
      required: ["relativePath"],
      additionalProperties: false,
    },
  },
  {
    name: "search_text",
    version: V1,
    status: "implemented",
    capability: "grant_fs_read",
    description: "Grant-bounded text search.",
    inputSchema: {
      type: "object",
      properties: {
        // query: substring / keyword to find in grant files
        query: {
          type: "string",
          description: "Text query to search within grant-bounded files",
        },
        // pathPrefix: optional subdirectory filter
        pathPrefix: {
          type: "string",
          description: "Optional relative path prefix to limit search scope",
        },
        // limit: max hit rows
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max number of hits to return (1–200)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "search_symbols",
    version: V1,
    status: "not_implemented",
    capability: "index_search",
    description: "Symbol search (schema reserved; not executable).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Symbol name or pattern (reserved)",
        },
        kind: {
          type: "string",
          description: "Optional symbol kind filter e.g. function/class (reserved)",
        },
        pathPrefix: {
          type: "string",
          description: "Optional relative path prefix (reserved)",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max hits (1–200, reserved)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "search_relations",
    version: V1,
    status: "not_implemented",
    capability: "index_search",
    description: "Relation search (schema reserved; not executable).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional free-text filter over relations (reserved)",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max relations to return (1–200, reserved)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "git_status",
    version: V1,
    status: "implemented",
    capability: "grant_git_read",
    description: "git status --short within grant root.",
    // input: empty object only
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "git_log",
    version: V1,
    status: "implemented",
    capability: "grant_git_read",
    description: "git log --oneline (limited).",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Max commits (1–100); default is runtime-defined",
        },
        relativePath: {
          type: "string",
          description: "Optional path filter (grant-relative) for log history",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "git_diff",
    version: V1,
    status: "implemented",
    capability: "grant_git_read",
    description: "git diff between refs (grant-bounded).",
    inputSchema: {
      type: "object",
      properties: {
        // base: left ref (required); must not start with '-' after PR-05
        base: {
          type: "string",
          description: "Base git ref / OID (required; Safe Git validates)",
        },
        // head: right ref; omit for worktree vs base
        head: {
          type: "string",
          description: "Optional head ref / OID; omit for worktree comparison",
        },
        relativePath: {
          type: "string",
          description: "Optional path filter (grant-relative)",
        },
      },
      required: ["base"],
      additionalProperties: false,
    },
  },
  {
    name: "git_show",
    version: V1,
    status: "implemented",
    capability: "grant_git_read",
    description: "git show --stat for a commit.",
    inputSchema: {
      type: "object",
      properties: {
        commit: {
          type: "string",
          description: "Commit ref / OID to show (Safe Git validates)",
        },
        relativePath: {
          type: "string",
          description: "Optional path within the commit (grant-relative)",
        },
      },
      required: ["commit"],
      additionalProperties: false,
    },
  },
  {
    name: "git_blame",
    version: V1,
    status: "implemented",
    capability: "grant_git_read",
    description: "git blame for a path (optional line range).",
    inputSchema: {
      type: "object",
      properties: {
        relativePath: {
          type: "string",
          description: "File path to blame (grant-relative, required)",
        },
        commit: {
          type: "string",
          description: "Optional commit pin for blame",
        },
        startLine: {
          type: "integer",
          minimum: 1,
          description: "Optional 1-based start line for blame window",
        },
        endLine: {
          type: "integer",
          minimum: 1,
          description: "Optional 1-based end line for blame window",
        },
      },
      required: ["relativePath"],
      additionalProperties: false,
    },
  },
  {
    name: "compare_history",
    version: V1,
    status: "not_implemented",
    capability: "project_memory_read",
    description: "Compare two revision ids (schema reserved; not executable).",
    inputSchema: {
      type: "object",
      properties: {
        leftRevisionId: {
          type: "string",
          description: "Left OriginalRevision id (reserved)",
        },
        rightRevisionId: {
          type: "string",
          description: "Right OriginalRevision id (reserved)",
        },
      },
      required: ["leftRevisionId", "rightRevisionId"],
      additionalProperties: false,
    },
  },
  {
    name: "query_project_memory",
    version: V1,
    status: "implemented",
    capability: "project_memory_read",
    description: "Query accepted understanding and/or events for a matter.",
    inputSchema: {
      type: "object",
      properties: {
        // include: which memory slices to return (matterId comes from runtime ctx)
        include: {
          type: "string",
          enum: ["accepted", "events", "both"],
          description:
            "Slice: accepted understanding, change events, or both (matterId is runtime context)",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max rows per included slice (1–200)",
        },
      },
      required: ["include"],
      additionalProperties: false,
    },
  },
  {
    name: "set_canvas_view",
    version: V1,
    status: "implemented",
    capability: "ui_canvas",
    description: "UI canvas presentation command (no disk I/O).",
    inputSchema: {
      type: "object",
      properties: {
        // view: canvas-menu-v1 presentation preset
        view: {
          type: "string",
          enum: ["now", "by_kind", "decision", "evidence"],
          description: "Canvas presentation preset (canvas-menu-v1)",
        },
        // focus: optional node to center / select
        focus: {
          type: "object",
          description: "Optional focus node { kind, id }",
          properties: {
            kind: {
              type: "string",
              description: "Node kind (project/material/work/…)",
            },
            id: {
              type: "string",
              description: "Node id within that kind",
            },
          },
          required: ["kind", "id"],
          additionalProperties: false,
        },
        highlightNodeKeys: {
          type: "array",
          items: { type: "string" },
          description: "Optional node keys to highlight",
        },
        fold: {
          type: "string",
          enum: ["1hop", "path"],
          description: "Optional fold mode: one hop neighborhood or path",
        },
        reason: {
          type: "string",
          description: "Human/model reason for the view change (audit/UI)",
        },
        intentId: {
          type: "string",
          description: "Optional canvas intent id from canvas-intent",
        },
        menuVersion: {
          type: "string",
          description: "Optional menu contract version string",
        },
      },
      required: ["view"],
      additionalProperties: false,
    },
  },
] as const;

const byName = new Map<string, ToolRegistryEntry>(
  TOOL_REGISTRY.map((entry) => [entry.name, entry]),
);

export function getToolRegistryEntry(
  name: string,
): ToolRegistryEntry | undefined {
  return byName.get(name);
}

/** Tools the runtime may execute (status === implemented). */
export function listExecutableTools(): ToolRegistryEntry[] {
  return TOOL_REGISTRY.filter((t) => t.status === "implemented");
}

export function listToolNames(): string[] {
  return TOOL_REGISTRY.map((t) => t.name);
}

export function isToolRegistered(name: string): boolean {
  return byName.has(name);
}

/**
 * Executable only when registered AND status is implemented.
 * not_implemented tools stay in registry for schema honesty but must not run.
 */
export function isToolExecutable(name: string): boolean {
  const entry = byName.get(name);
  return entry?.status === "implemented";
}

/** Runtime gate used by executeProjectAgentTool (name-only; input validated later). */
export function assertToolExecutable(
  name: string,
): { ok: true; tool: ToolRegistryEntry } | { ok: false; error: string } {
  const tool = byName.get(name);
  if (!tool) {
    return { ok: false, error: `tool not in registry: ${name}` };
  }
  if (tool.status !== "implemented") {
    return { ok: false, error: `tool not implemented: ${name}` };
  }
  return { ok: true, tool };
}

/** Alias for older call sites / PR-09 naming. */
export function getToolRegistration(
  name: string,
): ToolRegistryEntry | undefined {
  return getToolRegistryEntry(name);
}

export function listImplementedToolNames(): string[] {
  return listExecutableTools().map((t) => t.name);
}

export type ToolInputValidation =
  | { ok: true; tool: ToolRegistryEntry }
  | { ok: false; error: string; tool?: ToolRegistryEntry };

/**
 * Validate a proposed tool call against the registry.
 * Rejects unknown names, not_implemented tools, and schema mismatches.
 */
export function validateToolCall(
  name: string,
  input: unknown,
): ToolInputValidation {
  const tool = byName.get(name);
  if (!tool) {
    return { ok: false, error: `unknown tool: ${name}` };
  }
  if (tool.status !== "implemented") {
    return {
      ok: false,
      error: `tool not_implemented: ${name}`,
      tool,
    };
  }
  const schemaError = validateAgainstSchema(input, tool.inputSchema);
  if (schemaError) {
    return { ok: false, error: schemaError, tool };
  }
  return { ok: true, tool };
}

function validateAgainstSchema(
  value: unknown,
  schema: JsonSchemaLike,
): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "input must be an object";
  }
  const obj = value as Record<string, unknown>;
  const props = schema.properties ?? {};
  const required = schema.required ?? [];

  for (const key of required) {
    if (obj[key] === undefined) {
      return `missing required field: ${key}`;
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(obj)) {
      if (!(key in props)) {
        return `unexpected field: ${key}`;
      }
    }
  }

  for (const [key, prop] of Object.entries(props)) {
    if (obj[key] === undefined) continue;
    const err = validateProperty(obj[key], prop, key);
    if (err) return err;
  }
  return null;
}

function validateProperty(
  value: unknown,
  prop: JsonSchemaProperty,
  path: string,
): string | null {
  if ("enum" in prop && prop.enum && typeof value === "string") {
    if (!prop.enum.includes(value)) {
      return `${path} must be one of: ${prop.enum.join(", ")}`;
    }
  }

  switch (prop.type) {
    case "string":
      if (typeof value !== "string") return `${path} must be string`;
      return null;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return `${path} must be number`;
      }
      if (prop.minimum !== undefined && value < prop.minimum) {
        return `${path} must be >= ${prop.minimum}`;
      }
      if (prop.maximum !== undefined && value > prop.maximum) {
        return `${path} must be <= ${prop.maximum}`;
      }
      return null;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `${path} must be integer`;
      }
      if (prop.minimum !== undefined && value < prop.minimum) {
        return `${path} must be >= ${prop.minimum}`;
      }
      if (prop.maximum !== undefined && value > prop.maximum) {
        return `${path} must be <= ${prop.maximum}`;
      }
      return null;
    case "boolean":
      if (typeof value !== "boolean") return `${path} must be boolean`;
      return null;
    case "array":
      if (!Array.isArray(value)) return `${path} must be array`;
      if (prop.items) {
        for (let i = 0; i < value.length; i++) {
          const err = validateProperty(value[i], prop.items, `${path}[${i}]`);
          if (err) return err;
        }
      }
      return null;
    case "object": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return `${path} must be object`;
      }
      const nested: JsonSchemaLike = {
        type: "object",
        properties: prop.properties,
        required: prop.required,
        additionalProperties: prop.additionalProperties,
      };
      const err = validateAgainstSchema(value, nested);
      return err ? `${path}: ${err}` : null;
    }
    default:
      return null;
  }
}
