/**
 * Owner-stated project understanding — durable project facts from the person.
 * Not mere chat noise: these elevate into Project Memory candidates / prompts.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type OwnerProjectStatement = {
  id: string;
  projectId: string;
  matterId?: string;
  text: string;
  source: "chat" | "manual";
  dialogueMessageId?: string;
  createdAt: string;
  status: "active" | "superseded" | "withdrawn";
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

function readMap(): Map<string, OwnerProjectStatement> {
  try {
    if (!fs.existsSync(statementsPath())) return new Map();
    const raw = JSON.parse(
      fs.readFileSync(statementsPath(), "utf8"),
    ) as Record<string, OwnerProjectStatement>;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
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

/** Skip pure UI/meta chatter so we do not pollute project truth. */
export function looksLikeProjectUnderstanding(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return false;
  if (/^(你好|在吗|谢谢|好的|ok|嗯|哈喽|hi|hello)[.!。！？\s]*$/i.test(t)) {
    return false;
  }
  // Questions still count if they reveal framing (目标/我们/应该…).
  // Short pure navigation questions without substance are weak:
  if (
    t.length < 12 &&
    /^(什么|哪里|哪个|怎么|如何|为什么)\S{0,8}[?？]?$/.test(t)
  ) {
    return false;
  }
  return true;
}

/**
 * Persist Owner speech about the project as durable statements.
 * Dedupes identical consecutive text on the same project.
 */
export function recordOwnerProjectStatement(input: {
  projectId: string;
  matterId?: string;
  text: string;
  source?: "chat" | "manual";
  dialogueMessageId?: string;
}): OwnerProjectStatement | null {
  const projectId = input.projectId?.trim();
  const text = input.text?.trim();
  if (!projectId || !text) return null;
  if (!looksLikeProjectUnderstanding(text)) return null;

  const map = readMap();
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
    source: input.source ?? "chat",
    dialogueMessageId: input.dialogueMessageId,
    createdAt: new Date().toISOString(),
    status: "active",
  };
  map.set(row.id, row);
  writeMap(map);
  return copy(row);
}

export function listOwnerProjectStatements(
  projectId: string,
  options?: { limit?: number; includeInactive?: boolean },
): OwnerProjectStatement[] {
  const id = projectId?.trim();
  if (!id) return [];
  const limit = Math.max(1, options?.limit ?? 24);
  return [...readMap().values()]
    .filter((s) => s.projectId === id)
    .filter((s) => options?.includeInactive || s.status === "active")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit)
    .map(copy);
}

export function withdrawOwnerProjectStatement(
  id: string,
): OwnerProjectStatement | null {
  const map = readMap();
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
 * Merge Owner statements into an understanding body so project truth
 * includes what the person said — not only agent file reads.
 */
export function mergeOwnerStatementsIntoUnderstandingBody<
  T extends {
    now: { text: string; evidence: unknown[]; gaps: string[]; conflicts: string[] };
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

  const depends = [
    ...body.depends,
    ...active.map((s) => ({
      kind: "matter" as const,
      id: `owner-statement:${s.id}`,
      reason: `Owner 陈述：${s.text.slice(0, 120)}`,
    })),
  ];

  // Keep a why claim that Owner speech is part of the story (not file-supported).
  const ownerWhy = {
    text: `结合你的说法：${lines[lines.length - 1]?.slice(0, 160) ?? ""}`,
    status: "unknown" as const,
    evidence: [] as unknown[],
  };
  const whyHasOwner = body.why.some((w) =>
    /你的说法|Owner 陈述|你对这个项目说过/.test(w.text),
  );
  const why = whyHasOwner ? body.why : [ownerWhy, ...body.why];

  const gaps = already
    ? body.now.gaps
    : [
        ...body.now.gaps.filter((g) => !/Owner|你说过/.test(g)),
        "Owner 说法已记入；文件原文仍须工具核对",
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
