/**
 * Event archive planner + ledger.
 * Archives old ChangeEvent-shaped rows without deleting CAS / understanding.
 * Ledger is JSON under knowledge data dir (does not require SQLite migration).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { EventArchivePlan, EventArchiveRecord } from "./types";

export type ArchiveableEvent = {
  id: string;
  projectId: string;
  observedAt: string;
  relativePath: string;
  kind?: string;
  [key: string]: unknown;
};

function dataDir(): string {
  if (process.env.KNOWLEDGE_DATA_DIR) {
    return path.resolve(process.env.KNOWLEDGE_DATA_DIR);
  }
  return path.join(process.cwd(), "data", "knowledge");
}

function archivePath(): string {
  return path.join(dataDir(), "event-archives.json");
}

function readArchives(): Map<string, EventArchiveRecord> {
  try {
    if (!fs.existsSync(archivePath())) return new Map();
    const raw = JSON.parse(fs.readFileSync(archivePath(), "utf8")) as Record<
      string,
      EventArchiveRecord
    >;
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

function writeArchives(map: Map<string, EventArchiveRecord>): void {
  fs.mkdirSync(path.dirname(archivePath()), { recursive: true });
  const obj: Record<string, EventArchiveRecord> = {};
  for (const [k, v] of map) obj[k] = v;
  fs.writeFileSync(archivePath(), JSON.stringify(obj, null, 2), "utf8");
}

/**
 * Keep the newest `retainCount` events; older ones are archive candidates.
 * Optional maxAgeMs: only archive if older than that relative to `nowIso`.
 */
export function planEventArchive(
  events: ArchiveableEvent[],
  options: {
    retainCount?: number;
    maxAgeMs?: number;
    nowIso?: string;
  } = {},
): EventArchivePlan {
  const retainCount = Math.max(0, options.retainCount ?? 50);
  const nowMs = Date.parse(options.nowIso ?? new Date().toISOString());
  const sorted = [...events].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt),
  );

  const retainTail = sorted.slice(-retainCount);
  const retainIds = new Set(retainTail.map((e) => e.id));
  const archive: EventArchivePlan["archive"] = [];

  for (const e of sorted) {
    if (retainIds.has(e.id)) continue;
    if (options.maxAgeMs != null) {
      const age = nowMs - Date.parse(e.observedAt);
      if (!Number.isFinite(age) || age < options.maxAgeMs) continue;
    }
    archive.push({
      id: e.id,
      observedAt: e.observedAt,
      relativePath: e.relativePath,
    });
  }

  const paths = [...new Set(archive.map((a) => a.relativePath))].slice(0, 12);
  const fromObservedAt = archive[0]?.observedAt ?? null;
  const toObservedAt = archive[archive.length - 1]?.observedAt ?? null;
  const text =
    archive.length === 0
      ? "无需归档"
      : `已归档 ${archive.length} 条较早变更（涉及 ${paths.length} 个路径），证据 id 仍可查。`;

  return {
    retain: retainTail.map((e) => ({ id: e.id, observedAt: e.observedAt })),
    archive,
    summary: {
      archivedEventIds: archive.map((a) => a.id),
      relativePaths: paths,
      fromObservedAt,
      toObservedAt,
      text,
    },
  };
}

export function applyEventArchive(input: {
  projectId: string;
  matterId?: string;
  events: ArchiveableEvent[];
  plan: EventArchivePlan;
}): EventArchiveRecord | null {
  if (input.plan.archive.length === 0) return null;
  const idSet = new Set(input.plan.archive.map((a) => a.id));
  const payloads = input.events.filter((e) => idSet.has(e.id));
  const record: EventArchiveRecord = {
    id: randomUUID(),
    projectId: input.projectId,
    matterId: input.matterId,
    archivedAt: new Date().toISOString(),
    eventIds: input.plan.summary.archivedEventIds,
    eventsJson: JSON.stringify(payloads),
    summaryText: input.plan.summary.text,
    fromObservedAt: input.plan.summary.fromObservedAt,
    toObservedAt: input.plan.summary.toObservedAt,
  };
  const map = readArchives();
  map.set(record.id, record);
  writeArchives(map);
  return { ...record };
}

export function listEventArchives(projectId: string): EventArchiveRecord[] {
  const id = projectId?.trim();
  if (!id) return [];
  return [...readArchives().values()]
    .filter((r) => r.projectId === id)
    .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

/** Event ids that should be hidden from the default recent feed. */
export function archivedEventIdSet(projectId: string): Set<string> {
  const set = new Set<string>();
  for (const r of listEventArchives(projectId)) {
    for (const id of r.eventIds) set.add(id);
  }
  return set;
}

export function filterActiveEvents<T extends { id: string }>(
  projectId: string,
  events: T[],
): T[] {
  const archived = archivedEventIdSet(projectId);
  if (archived.size === 0) return events;
  return events.filter((e) => !archived.has(e.id));
}

/** Evidence chain: recover archived event payloads by id. */
export function findArchivedEventPayload(
  projectId: string,
  eventId: string,
): ArchiveableEvent | null {
  for (const r of listEventArchives(projectId)) {
    if (!r.eventIds.includes(eventId)) continue;
    try {
      const list = JSON.parse(r.eventsJson) as ArchiveableEvent[];
      const hit = list.find((e) => e.id === eventId);
      if (hit) return hit;
    } catch {
      // continue
    }
  }
  return null;
}

export function resetEventArchivesForTests(): void {
  try {
    if (fs.existsSync(archivePath())) fs.unlinkSync(archivePath());
  } catch {
    // ignore
  }
}
