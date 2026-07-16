/**
 * Owner-stated project understanding — durable project facts from the person.
 *
 * vNext (PR-06): chat is never auto-promoted to project truth.
 * Levels:
 * - session only (dialogue store — not here)
 * - proposed candidate (explicit "记为项目背景")
 * - active fact (Owner confirm)
 * - legacy_unverified (migrated old auto-captures; not used as truth)
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type OwnerStatementStatus =
  | "proposed"
  | "active"
  | "superseded"
  | "withdrawn"
  | "legacy_unverified";

export type OwnerProjectStatement = {
  id: string;
  projectId: string;
  matterId?: string;
  text: string;
  source: "chat" | "manual" | "confirm";
  dialogueMessageId?: string;
  createdAt: string;
  status: OwnerStatementStatus;
  confirmedAt?: string;
};

function dataDir(): string {
  if (process.env.KNOWLEDGE_DATA_DIR) {
    return path.resolve(process.env.KNOWLEDGE_DATA_DIR);
  }
  return path.join(process.cwd(), "data", "knowledge");
}

function statementsPath(): string {
  return path.join(dataDir(), "owner-project-statements.json");
}

function normalizeStatus(raw: OwnerProjectStatement): OwnerProjectStatement {
  // Old auto-elevated chat rows: treat as legacy until Owner re-confirms.
  if (
    raw.source === "chat" &&
    raw.status === "active" &&
    !raw.confirmedAt
  ) {
    return { ...raw, status: "legacy_unverified" };
  }
  return raw;
}

function readMap(): Map<string, OwnerProjectStatement> {
  try {
    if (!fs.existsSync(statementsPath())) return new Map();
    const raw = JSON.parse(
      fs.readFileSync(statementsPath(), "utf8"),
    ) as Record<string, OwnerProjectStatement>;
    const map = new Map<string, OwnerProjectStatement>();
    for (const [k, v] of Object.entries(raw)) {
      map.set(k, normalizeStatus(v));
    }
    return map;
  } catch {
    // Fail closed for product path: caller should treat as unavailable, not empty success.
    // Tests still use reset; production diagnostics should surface corrupt store separately.
    throw new Error(
      `owner-project-statements.json unreadable or corrupt at ${statementsPath()}`,
    );
  }
}

function tryReadMap(): Map<string, OwnerProjectStatement> {
  try {
    return readMap();
  } catch {
    if (!fs.existsSync(statementsPath())) return new Map();
    // Corrupt file: do not silently return empty as if no statements exist.
    throw new Error(
      `owner-project-statements.json corrupt; refusing silent empty fallback`,
    );
  }
}

function writeMap(map: Map<string, OwnerProjectStatement>): void {
  fs.mkdirSync(path.dirname(statementsPath()), { recursive: true });
  const obj: Record<string, OwnerProjectStatement> = {};
  for (const [k, v] of map) obj[k] = v;
  fs.writeFileSync(statementsPath(), JSON.stringify(obj, null, 2), "utf8");
}

function copy(s: OwnerProjectStatement): OwnerProjectStatement {
  return { ...s };
}

/**
 * Heuristic retained only for UI hints ("this might be worth saving").
 * Must never alone write project truth.
 */
export function looksLikeProjectUnderstanding(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return false;
  if (/^(你好|在吗|谢谢|好的|ok|嗯|哈喽|hi|hello)[.!。！？\s]*$/i.test(t)) {
    return false;
  }
  if (
    t.length < 12 &&
    /^(什么|哪里|哪个|怎么|如何|为什么)\S{0,8}[?？]?$/.test(t)
  ) {
    return false;
  }
  return true;
}

/**
 * Propose a statement candidate. Does NOT become project truth.
 * Explicit API for "记为项目背景".
 */
export function proposeOwnerProjectStatement(input: {
  projectId: string;
  matterId?: string;
  text: string;
  source?: "chat" | "manual";
  dialogueMessageId?: string;
}): OwnerProjectStatement | null {
  const projectId = input.projectId?.trim();
  const text = input.text?.trim();
  if (!projectId || !text) return null;

  const map = tryReadMap();
  const recent = [...map.values()]
    .filter(
      (s) =>
        s.projectId === projectId &&
        (s.status === "proposed" || s.status === "active"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (recent[0]?.text === text) {
    return copy(recent[0]);
  }

  const row: OwnerProjectStatement = {
    id: randomUUID(),
    projectId,
    matterId: input.matterId?.trim() || undefined,
    text: text.slice(0, 2000),
    source: input.source ?? "manual",
    dialogueMessageId: input.dialogueMessageId,
    createdAt: new Date().toISOString(),
    status: "proposed",
  };
  map.set(row.id, row);
  writeMap(map);
  return copy(row);
}

/**
 * Confirm a proposed/legacy statement into active project truth.
 */
export function confirmOwnerProjectStatement(
  id: string,
): OwnerProjectStatement | null {
  const map = tryReadMap();
  const row = map.get(id);
  if (!row) return null;
  if (row.status === "withdrawn" || row.status === "superseded") return null;
  row.status = "active";
  row.confirmedAt = new Date().toISOString();
  row.source = "confirm";
  map.set(id, row);
  writeMap(map);
  return copy(row);
}

/**
 * Record a confirmed project fact in one step (manual confirm path only).
 * Chat path must not call this without explicit Owner confirm.
 */
export function recordOwnerProjectStatement(input: {
  projectId: string;
  matterId?: string;
  text: string;
  source?: "chat" | "manual" | "confirm";
  dialogueMessageId?: string;
  /** Required for elevation to active truth. Default false. */
  confirmed?: boolean;
}): OwnerProjectStatement | null {
  const projectId = input.projectId?.trim();
  const text = input.text?.trim();
  if (!projectId || !text) return null;

  // Default: never auto-elevate chat.
  if (!input.confirmed) {
    return proposeOwnerProjectStatement({
      projectId,
      matterId: input.matterId,
      text,
      source: input.source === "confirm" ? "manual" : input.source ?? "chat",
      dialogueMessageId: input.dialogueMessageId,
    });
  }

  const map = tryReadMap();
  const recent = [...map.values()]
    .filter((s) => s.projectId === projectId && s.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (recent[0]?.text === text) {
    return copy(recent[0]);
  }

  const row: OwnerProjectStatement = {
    id: randomUUID(),
    projectId,
    matterId: input.matterId?.trim() || undefined,
    text: text.slice(0, 2000),
    source: "confirm",
    dialogueMessageId: input.dialogueMessageId,
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    status: "active",
  };
  map.set(row.id, row);
  writeMap(map);
  return copy(row);
}

export function listOwnerProjectStatements(
  projectId: string,
  options?: {
    limit?: number;
    includeInactive?: boolean;
    /** When true, include proposed/legacy. Default: only active truth. */
    includeCandidates?: boolean;
  },
): OwnerProjectStatement[] {
  const id = projectId?.trim();
  if (!id) return [];
  const limit = Math.max(1, options?.limit ?? 24);
  return [...tryReadMap().values()]
    .filter((s) => s.projectId === id)
    .filter((s) => {
      if (options?.includeInactive) return true;
      if (options?.includeCandidates) {
        return (
          s.status === "active" ||
          s.status === "proposed" ||
          s.status === "legacy_unverified"
        );
      }
      return s.status === "active";
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit)
    .map(copy);
}

export function withdrawOwnerProjectStatement(
  id: string,
): OwnerProjectStatement | null {
  const map = tryReadMap();
  const row = map.get(id);
  if (!row) return null;
  row.status = "withdrawn";
  map.set(id, row);
  writeMap(map);
  return copy(row);
}

export function resetOwnerStatementsForTests(): void {
  try {
    if (fs.existsSync(statementsPath())) fs.unlinkSync(statementsPath());
  } catch {
    // ignore
  }
}

/**
 * Merge only *active/confirmed* Owner statements into understanding body.
 */
export function mergeOwnerStatementsIntoUnderstandingBody<
  T extends {
    now: {
      text: string;
      evidence: unknown[];
      gaps: string[];
      conflicts: string[];
    };
    depends: Array<{ kind: string; id: string; reason: string }>;
    why: Array<{ text: string; status: string; evidence: unknown[] }>;
  },
>(body: T, statements: OwnerProjectStatement[]): T {
  const active = statements.filter((s) => s.status === "active");
  if (active.length === 0) return body;

  const lines = active.map((s) => s.text.trim()).filter(Boolean);
  const block = `你对这个项目说过：\n- ${lines.join("\n- ")}`;
  const already = body.now.text.includes("你对这个项目说过");
  const nowText = already
    ? body.now.text
    : `${block}\n\n${body.now.text}`.trim();

  const depends: T["depends"] = [
    ...body.depends,
    ...active.map((s) => ({
      kind: "matter" as const,
      id: `owner-statement:${s.id}`,
      reason: `Owner 确认陈述：${s.text.slice(0, 120)}`,
    })),
  ];

  const ownerWhy = {
    text: `结合你已确认的说法：${lines[lines.length - 1]?.slice(0, 160) ?? ""}`,
    status: "unknown" as const,
    evidence: [] as unknown[],
  };
  const whyHasOwner = body.why.some((w) =>
    /你的说法|Owner 陈述|你对这个项目说过|已确认的说法/.test(w.text),
  );
  const why = whyHasOwner ? body.why : [ownerWhy, ...body.why];

  const gaps = already
    ? body.now.gaps
    : [
        ...body.now.gaps.filter((g) => !/Owner|你说过|已确认/.test(g)),
        "Owner 已确认说法已记入；文件原文仍须工具核对",
      ];

  return {
    ...body,
    now: {
      ...body.now,
      text: nowText,
      gaps,
    },
    depends,
    why,
  };
}
