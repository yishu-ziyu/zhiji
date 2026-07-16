/**
 * Project Memory store: SQLite metadata + CAS originals.
 * Split ports: Reader / ObservationWriter / CandidateWriter / OwnerDecisionWriter.
 * Understanding revisions are immutable; head pointer moves.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ContentAddressedStore, sha256Hex } from "./cas";
import {
  ensureHonestWhy,
  planHeadReviewNeeded,
  planOwnerResolution,
} from "./reducer";
import type {
  AgentMemoryService,
  AnalysisRun,
  CandidateWriter,
  ChangeEvent,
  ChangeKind,
  Matter,
  MatterState,
  MatterUnderstandingHead,
  MatterWatchSet,
  ObservationSignal,
  ObservationWriter,
  OriginalRevision,
  OwnerDecisionWriter,
  OwnerResolution,
  ProjectMemoryReader,
  SourceGrant,
  UnderstandingBody,
  UnderstandingRevision,
} from "./types";
import { revisionIdFromSha256, sha256FromRevisionId } from "./types";

export type SqliteProjectMemoryOptions = {
  dataDir: string;
  casDir?: string;
  cas?: ContentAddressedStore;
};

type RevisionRow = {
  id: string;
  project_id: string;
  grant_id: string;
  relative_path: string;
  sha256: string;
  size_bytes: number;
  observed_at: string;
  previous_revision_id: string | null;
  tombstone: number;
};

type EventRow = {
  id: string;
  project_id: string;
  grant_id: string;
  kind: string;
  relative_path: string;
  previous_path: string | null;
  before_revision_id: string | null;
  after_revision_id: string | null;
  observed_at: string;
  dedupe_key: string;
};

type UnderstandingRow = {
  id: string;
  project_id: string;
  matter_id: string;
  kind: string;
  previous_accepted_revision_id: string | null;
  body_json: string;
  based_on_event_ids_json: string;
  proposed_by: string;
  created_at: string;
};

type HeadRow = {
  matter_id: string;
  accepted_revision_id: string | null;
  review_state: string;
  review_reason_event_ids_json: string;
  updated_at: string;
};

function payloadHash(kind: string, aggregateId: string, payload: unknown): string {
  return createHash("sha256")
    .update(kind)
    .update("\0")
    .update(aggregateId)
    .update("\0")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function defaultDedupeKey(
  signal: ObservationSignal,
  tipSha?: string,
): string {
  if (signal.dedupeKey?.trim()) return signal.dedupeKey.trim();
  const pathKey = signal.relativePath.replace(/\\/g, "/");
  if (signal.kind === "deleted") {
    return [
      signal.projectId,
      signal.grantId,
      "deleted",
      pathKey,
      tipSha ?? "none",
    ].join("|");
  }
  const sha =
    tipSha ?? (signal.content ? sha256Hex(signal.content) : "empty");
  return [
    signal.projectId,
    signal.grantId,
    signal.kind,
    pathKey,
    sha,
    signal.previousPath ?? "",
  ].join("|");
}

/**
 * Full store implementing all ports. Use asAgentMemoryService() for agent surface.
 */
export class SqliteProjectMemoryStore
  implements
    ProjectMemoryReader,
    ObservationWriter,
    CandidateWriter,
    OwnerDecisionWriter
{
  readonly dbPath: string;
  readonly cas: ContentAddressedStore;
  private readonly db: DatabaseSync;

  constructor(options: SqliteProjectMemoryOptions) {
    fs.mkdirSync(options.dataDir, { recursive: true });
    this.dbPath = path.join(options.dataDir, "project-memory.sqlite");
    this.cas =
      options.cas ??
      new ContentAddressedStore(
        options.casDir ?? path.join(options.dataDir, "cas"),
      );
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
    `);
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  /** Agent-facing: Reader + CandidateWriter only (no resolve). */
  asAgentMemoryService(): AgentMemoryService {
    const self = this;
    const agent: AgentMemoryService = {
      readRevision: (id) => self.readRevision(id),
      listEvents: (projectId, after) => self.listEvents(projectId, after),
      getMatterState: (projectId, matterId) =>
        self.getMatterState(projectId, matterId),
      saveCandidate: (run, body) => self.saveCandidate(run, body),
    };
    return agent;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS source_grants (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        root_path TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, root_path)
      );

      CREATE TABLE IF NOT EXISTS original_revisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        grant_id TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        observed_at TEXT NOT NULL,
        previous_revision_id TEXT,
        tombstone INTEGER NOT NULL DEFAULT 0,
        UNIQUE(project_id, grant_id, relative_path, sha256, tombstone)
      );

      CREATE TABLE IF NOT EXISTS change_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        grant_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        previous_path TEXT,
        before_revision_id TEXT,
        after_revision_id TEXT,
        observed_at TEXT NOT NULL,
        dedupe_key TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS matters (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matter_watch_sets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        matter_id TEXT NOT NULL,
        grant_id TEXT NOT NULL,
        include_path_prefixes_json TEXT NOT NULL,
        exclude_path_prefixes_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, matter_id, grant_id)
      );

      CREATE TABLE IF NOT EXISTS understanding_revisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        matter_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        previous_accepted_revision_id TEXT,
        body_json TEXT NOT NULL,
        based_on_event_ids_json TEXT NOT NULL,
        proposed_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matter_understanding_heads (
        matter_id TEXT PRIMARY KEY,
        accepted_revision_id TEXT,
        review_state TEXT NOT NULL,
        review_reason_event_ids_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS owner_resolutions (
        id TEXT PRIMARY KEY,
        candidate_revision_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        edited_body_json TEXT,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        accepted_revision_id TEXT
      );

      CREATE TABLE IF NOT EXISTS analysis_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        matter_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        event_ids_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(kind, aggregate_id, payload_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_revisions_path
        ON original_revisions(project_id, grant_id, relative_path, observed_at);
      CREATE INDEX IF NOT EXISTS idx_events_project
        ON change_events(project_id, observed_at);
      CREATE INDEX IF NOT EXISTS idx_understanding_matter
        ON understanding_revisions(project_id, matter_id, created_at);
    `);
  }

  upsertGrant(grant: SourceGrant): void {
    this.db
      .prepare(
        `INSERT INTO source_grants (id, project_id, kind, root_path, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status,
           updated_at=excluded.updated_at,
           root_path=excluded.root_path,
           kind=excluded.kind`,
      )
      .run(
        grant.id,
        grant.projectId,
        grant.kind,
        grant.rootPath,
        grant.status,
        grant.createdAt,
        grant.updatedAt,
      );
  }

  upsertMatter(matter: Matter): void {
    this.db
      .prepare(
        `INSERT INTO matters (id, project_id, title, goal, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title,
           goal=excluded.goal,
           status=excluded.status,
           updated_at=excluded.updated_at`,
      )
      .run(
        matter.id,
        matter.projectId,
        matter.title,
        matter.goal,
        matter.status,
        matter.createdAt,
        matter.updatedAt,
      );
    // Ensure head row exists
    const head = this.getHead(matter.id);
    if (!head) {
      this.putHead({
        matterId: matter.id,
        reviewState: "current",
        reviewReasonEventIds: [],
        updatedAt: matter.createdAt,
      });
    }
  }

  upsertWatchSet(watch: MatterWatchSet): void {
    if (!watch.includePathPrefixes.length) {
      throw new Error("MatterWatchSet requires at least one includePathPrefix");
    }
    this.db
      .prepare(
        `INSERT INTO matter_watch_sets
         (id, project_id, matter_id, grant_id, include_path_prefixes_json, exclude_path_prefixes_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, matter_id, grant_id) DO UPDATE SET
           include_path_prefixes_json=excluded.include_path_prefixes_json,
           exclude_path_prefixes_json=excluded.exclude_path_prefixes_json,
           status=excluded.status,
           updated_at=excluded.updated_at`,
      )
      .run(
        watch.id,
        watch.projectId,
        watch.matterId,
        watch.grantId,
        JSON.stringify(watch.includePathPrefixes),
        JSON.stringify(watch.excludePathPrefixes),
        watch.status,
        watch.createdAt,
        watch.updatedAt,
      );
  }

  private mapRevision(row: RevisionRow): OriginalRevision {
    return {
      id: row.id,
      projectId: row.project_id,
      grantId: row.grant_id,
      relativePath: row.relative_path,
      sha256: row.sha256,
      sizeBytes: row.size_bytes,
      observedAt: row.observed_at,
      previousRevisionId: row.previous_revision_id ?? undefined,
      tombstone: row.tombstone === 1,
    };
  }

  private mapEvent(row: EventRow): ChangeEvent {
    return {
      id: row.id,
      projectId: row.project_id,
      grantId: row.grant_id,
      kind: row.kind as ChangeKind,
      relativePath: row.relative_path,
      previousPath: row.previous_path ?? undefined,
      beforeRevisionId: row.before_revision_id ?? undefined,
      afterRevisionId: row.after_revision_id ?? undefined,
      observedAt: row.observed_at,
      dedupeKey: row.dedupe_key,
    };
  }

  private mapUnderstanding(row: UnderstandingRow): UnderstandingRevision {
    return {
      id: row.id,
      projectId: row.project_id,
      matterId: row.matter_id,
      kind: row.kind as "candidate" | "accepted",
      previousAcceptedRevisionId:
        row.previous_accepted_revision_id ?? undefined,
      body: JSON.parse(row.body_json) as UnderstandingBody,
      basedOnEventIds: JSON.parse(row.based_on_event_ids_json) as string[],
      proposedBy: row.proposed_by as "agent" | "owner",
      createdAt: row.created_at,
    };
  }

  private mapHead(row: HeadRow): MatterUnderstandingHead {
    return {
      matterId: row.matter_id,
      acceptedRevisionId: row.accepted_revision_id ?? undefined,
      reviewState: row.review_state as "current" | "review_needed",
      reviewReasonEventIds: JSON.parse(
        row.review_reason_event_ids_json,
      ) as string[],
      updatedAt: row.updated_at,
    };
  }

  private getHead(matterId: string): MatterUnderstandingHead | null {
    const row = this.db
      .prepare(`SELECT * FROM matter_understanding_heads WHERE matter_id = ?`)
      .get(matterId) as HeadRow | undefined;
    return row ? this.mapHead(row) : null;
  }

  private putHead(head: MatterUnderstandingHead): void {
    this.db
      .prepare(
        `INSERT INTO matter_understanding_heads
         (matter_id, accepted_revision_id, review_state, review_reason_event_ids_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(matter_id) DO UPDATE SET
           accepted_revision_id=excluded.accepted_revision_id,
           review_state=excluded.review_state,
           review_reason_event_ids_json=excluded.review_reason_event_ids_json,
           updated_at=excluded.updated_at`,
      )
      .run(
        head.matterId,
        head.acceptedRevisionId ?? null,
        head.reviewState,
        JSON.stringify(head.reviewReasonEventIds),
        head.updatedAt,
      );
  }

  private latestTip(
    projectId: string,
    grantId: string,
    relativePath: string,
  ): OriginalRevision | null {
    const row = this.db
      .prepare(
        `SELECT * FROM original_revisions
         WHERE project_id = ? AND grant_id = ? AND relative_path = ?
         ORDER BY observed_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(projectId, grantId, relativePath) as RevisionRow | undefined;
    return row ? this.mapRevision(row) : null;
  }

  private findEventByDedupe(dedupeKey: string): ChangeEvent | null {
    const row = this.db
      .prepare(`SELECT * FROM change_events WHERE dedupe_key = ?`)
      .get(dedupeKey) as EventRow | undefined;
    return row ? this.mapEvent(row) : null;
  }

  private getRevision(id: string): OriginalRevision | null {
    const row = this.db
      .prepare(`SELECT * FROM original_revisions WHERE id = ?`)
      .get(id) as RevisionRow | undefined;
    return row ? this.mapRevision(row) : null;
  }

  private getUnderstanding(id: string): UnderstandingRevision | null {
    const row = this.db
      .prepare(`SELECT * FROM understanding_revisions WHERE id = ?`)
      .get(id) as UnderstandingRow | undefined;
    return row ? this.mapUnderstanding(row) : null;
  }

  private insertOutbox(
    kind: string,
    aggregateId: string,
    payload: unknown,
    createdAt: string,
  ): void {
    const hash = payloadHash(kind, aggregateId, payload);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO outbox (id, kind, aggregate_id, payload_hash, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        kind,
        aggregateId,
        hash,
        JSON.stringify(payload),
        createdAt,
      );
  }

  private insertUnderstanding(u: UnderstandingRevision): void {
    this.db
      .prepare(
        `INSERT INTO understanding_revisions
         (id, project_id, matter_id, kind, previous_accepted_revision_id, body_json, based_on_event_ids_json, proposed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        u.id,
        u.projectId,
        u.matterId,
        u.kind,
        u.previousAcceptedRevisionId ?? null,
        JSON.stringify(u.body),
        JSON.stringify(u.basedOnEventIds),
        u.proposedBy,
        u.createdAt,
      );
  }

  private markHeadsReviewNeeded(
    projectId: string,
    replacedRevisionIds: string[],
    reasonEventId: string,
  ): void {
    if (!replacedRevisionIds.length) return;
    const heads = this.db
      .prepare(`SELECT * FROM matter_understanding_heads`)
      .all() as HeadRow[];
    for (const hrow of heads) {
      const head = this.mapHead(hrow);
      if (!head.acceptedRevisionId) continue;
      const accepted = this.getUnderstanding(head.acceptedRevisionId);
      if (!accepted || accepted.projectId !== projectId) continue;
      const next = planHeadReviewNeeded({
        head,
        accepted,
        replacedRevisionIds,
        reasonEventId,
      });
      if (next) {
        this.putHead(next);
        this.insertOutbox(
          "understanding_head_review_needed",
          head.matterId,
          { replacedRevisionIds, reasonEventId },
          next.updatedAt,
        );
      }
    }
  }

  private validateEvidence(body: UnderstandingBody, projectId: string): void {
    for (const rid of body.evidenceRevisionIds) {
      const rev = this.getRevision(rid);
      if (!rev || rev.projectId !== projectId) {
        throw new Error(`evidence revision missing or foreign: ${rid}`);
      }
    }
    for (const claim of [body.now, body.then, ...body.changed, ...body.why]) {
      const anchors =
        "evidence" in claim ? claim.evidence : ([] as { revisionId: string }[]);
      for (const a of anchors) {
        const rev = this.getRevision(a.revisionId);
        if (!rev || rev.projectId !== projectId) {
          throw new Error(`anchor revision missing or foreign: ${a.revisionId}`);
        }
      }
    }
  }

  async ingest(
    signal: ObservationSignal,
  ): Promise<{ event?: ChangeEvent; revision?: OriginalRevision }> {
    const relativePath = signal.relativePath.replace(/\\/g, "/");
    if (
      !relativePath ||
      relativePath.startsWith("/") ||
      relativePath.includes("..")
    ) {
      throw new Error("relativePath invalid");
    }

    const tip = this.latestTip(signal.projectId, signal.grantId, relativePath);

    if (signal.kind === "deleted") {
      return this.ingestDelete(signal, relativePath, tip);
    }

    if (!signal.content) {
      throw new Error("content required for non-delete observation");
    }

    const casResult = this.cas.put(signal.content);
    if (!this.cas.has(casResult.sha256)) {
      throw new Error("CAS write missing after put");
    }

    const revId = revisionIdFromSha256(casResult.sha256);
    const dedupeKey = defaultDedupeKey(
      { ...signal, relativePath },
      casResult.sha256,
    );
    const existing = this.findEventByDedupe(dedupeKey);
    if (existing) {
      const rev = existing.afterRevisionId
        ? this.getRevision(existing.afterRevisionId)
        : undefined;
      return { event: existing, revision: rev ?? undefined };
    }

    if (tip && !tip.tombstone && tip.sha256 === casResult.sha256) {
      return { revision: tip };
    }

    const beforeId =
      tip && !tip.tombstone
        ? tip.id
        : tip?.tombstone
          ? tip.previousRevisionId
          : undefined;

    const revision: OriginalRevision = {
      id: revId,
      projectId: signal.projectId,
      grantId: signal.grantId,
      relativePath,
      sha256: casResult.sha256,
      sizeBytes: casResult.sizeBytes,
      observedAt: signal.observedAt,
      previousRevisionId: beforeId,
      tombstone: false,
    };

    const kind: ChangeKind =
      signal.kind === "reconciled"
        ? "reconciled"
        : !tip || tip.tombstone
          ? signal.kind === "added"
            ? "added"
            : signal.kind
          : signal.kind === "renamed"
            ? "renamed"
            : "modified";

    const event: ChangeEvent = {
      id: randomUUID(),
      projectId: signal.projectId,
      grantId: signal.grantId,
      kind,
      relativePath,
      previousPath: signal.previousPath,
      beforeRevisionId: beforeId,
      afterRevisionId: revId,
      observedAt: signal.observedAt,
      dedupeKey,
    };

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO original_revisions
           (id, project_id, grant_id, relative_path, sha256, size_bytes, observed_at, previous_revision_id, tombstone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        )
        .run(
          revision.id,
          revision.projectId,
          revision.grantId,
          revision.relativePath,
          revision.sha256,
          revision.sizeBytes,
          revision.observedAt,
          revision.previousRevisionId ?? null,
        );

      this.db
        .prepare(
          `INSERT INTO change_events
           (id, project_id, grant_id, kind, relative_path, previous_path, before_revision_id, after_revision_id, observed_at, dedupe_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.projectId,
          event.grantId,
          event.kind,
          event.relativePath,
          event.previousPath ?? null,
          event.beforeRevisionId ?? null,
          event.afterRevisionId ?? null,
          event.observedAt,
          event.dedupeKey,
        );

      this.insertOutbox(
        "change_event",
        event.id,
        { eventId: event.id, revisionId: revision.id },
        signal.observedAt,
      );

      if (beforeId) {
        this.markHeadsReviewNeeded(signal.projectId, [beforeId], event.id);
      }

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return { event, revision };
  }

  private ingestDelete(
    signal: ObservationSignal,
    relativePath: string,
    tip: OriginalRevision | null,
  ): { event?: ChangeEvent; revision?: OriginalRevision } {
    if (!tip || tip.tombstone) {
      const dedupeKey = defaultDedupeKey(
        { ...signal, relativePath },
        tip?.sha256,
      );
      const existing = this.findEventByDedupe(dedupeKey);
      if (existing) {
        return {
          event: existing,
          revision: existing.afterRevisionId
            ? this.getRevision(existing.afterRevisionId) ?? undefined
            : undefined,
        };
      }
      return {};
    }

    const lastLiveId = tip.id;
    const lastSha = tip.sha256;
    if (!this.cas.has(lastSha)) {
      throw new Error("cannot tombstone: last blob missing");
    }

    const dedupeKey = defaultDedupeKey(
      { ...signal, relativePath },
      lastSha,
    );
    const existing = this.findEventByDedupe(dedupeKey);
    if (existing) {
      return {
        event: existing,
        revision: existing.afterRevisionId
          ? this.getRevision(existing.afterRevisionId) ?? undefined
          : undefined,
      };
    }

    const tombstoneMaterial = new TextEncoder().encode(
      `tombstone:${lastSha}:${relativePath}:${signal.observedAt}`,
    );
    this.cas.put(tombstoneMaterial);
    const tombstoneId = revisionIdFromSha256(sha256Hex(tombstoneMaterial));

    const revision: OriginalRevision = {
      id: tombstoneId,
      projectId: signal.projectId,
      grantId: signal.grantId,
      relativePath,
      sha256: lastSha,
      sizeBytes: tip.sizeBytes,
      observedAt: signal.observedAt,
      previousRevisionId: lastLiveId,
      tombstone: true,
    };

    const event: ChangeEvent = {
      id: randomUUID(),
      projectId: signal.projectId,
      grantId: signal.grantId,
      kind: "deleted",
      relativePath,
      previousPath: signal.previousPath,
      beforeRevisionId: lastLiveId,
      afterRevisionId: tombstoneId,
      observedAt: signal.observedAt,
      dedupeKey,
    };

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO original_revisions
           (id, project_id, grant_id, relative_path, sha256, size_bytes, observed_at, previous_revision_id, tombstone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        )
        .run(
          revision.id,
          revision.projectId,
          revision.grantId,
          revision.relativePath,
          revision.sha256,
          revision.sizeBytes,
          revision.observedAt,
          revision.previousRevisionId ?? null,
        );

      this.db
        .prepare(
          `INSERT INTO change_events
           (id, project_id, grant_id, kind, relative_path, previous_path, before_revision_id, after_revision_id, observed_at, dedupe_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.projectId,
          event.grantId,
          event.kind,
          event.relativePath,
          event.previousPath ?? null,
          event.beforeRevisionId ?? null,
          event.afterRevisionId ?? null,
          event.observedAt,
          event.dedupeKey,
        );

      this.insertOutbox(
        "change_event",
        event.id,
        { eventId: event.id, revisionId: revision.id, deleted: true },
        signal.observedAt,
      );

      this.markHeadsReviewNeeded(signal.projectId, [lastLiveId], event.id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return { event, revision };
  }

  async readRevision(id: string): Promise<Uint8Array | null> {
    const rev = this.getRevision(id);
    if (!rev) return null;
    const bytes = this.cas.read(rev.sha256);
    if (bytes) return bytes;
    return this.cas.read(sha256FromRevisionId(id));
  }

  async listEvents(projectId: string, after?: string): Promise<ChangeEvent[]> {
    if (after) {
      const rows = this.db
        .prepare(
          `SELECT * FROM change_events
           WHERE project_id = ? AND observed_at > ?
           ORDER BY observed_at ASC, rowid ASC`,
        )
        .all(projectId, after) as EventRow[];
      return rows.map((r) => this.mapEvent(r));
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM change_events
         WHERE project_id = ?
         ORDER BY observed_at ASC, rowid ASC`,
      )
      .all(projectId) as EventRow[];
    return rows.map((r) => this.mapEvent(r));
  }

  async getMatterState(
    projectId: string,
    matterId: string,
  ): Promise<MatterState> {
    const mrow = this.db
      .prepare(`SELECT * FROM matters WHERE id = ? AND project_id = ?`)
      .get(matterId, projectId) as
      | {
          id: string;
          project_id: string;
          title: string;
          goal: string;
          status: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!mrow) throw new Error("matter not found");

    const matter: Matter = {
      id: mrow.id,
      projectId: mrow.project_id,
      title: mrow.title,
      goal: mrow.goal,
      status: mrow.status as Matter["status"],
      createdAt: mrow.created_at,
      updatedAt: mrow.updated_at,
    };

    let head = this.getHead(matterId);
    if (!head) {
      head = {
        matterId,
        reviewState: "current",
        reviewReasonEventIds: [],
        updatedAt: matter.createdAt,
      };
      this.putHead(head);
    }

    const accepted = head.acceptedRevisionId
      ? this.getUnderstanding(head.acceptedRevisionId) ?? undefined
      : undefined;

    const candRow = this.db
      .prepare(
        `SELECT * FROM understanding_revisions
         WHERE project_id = ? AND matter_id = ? AND kind = 'candidate'
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(projectId, matterId) as UnderstandingRow | undefined;
    const candidate = candRow ? this.mapUnderstanding(candRow) : undefined;

    const wrow = this.db
      .prepare(
        `SELECT * FROM matter_watch_sets
         WHERE project_id = ? AND matter_id = ?
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(projectId, matterId) as
      | {
          id: string;
          project_id: string;
          matter_id: string;
          grant_id: string;
          include_path_prefixes_json: string;
          exclude_path_prefixes_json: string;
          status: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    const watchSet: MatterWatchSet | undefined = wrow
      ? {
          id: wrow.id,
          projectId: wrow.project_id,
          matterId: wrow.matter_id,
          grantId: wrow.grant_id,
          includePathPrefixes: JSON.parse(
            wrow.include_path_prefixes_json,
          ) as string[],
          excludePathPrefixes: JSON.parse(
            wrow.exclude_path_prefixes_json,
          ) as string[],
          status: wrow.status as "active" | "disabled",
          createdAt: wrow.created_at,
          updatedAt: wrow.updated_at,
        }
      : undefined;

    return {
      matter,
      head,
      accepted,
      candidate,
      recentEvents: (await this.listEvents(projectId)).slice(-50),
      watchSet,
    };
  }

  async saveCandidate(
    run: AnalysisRun,
    body: UnderstandingBody,
  ): Promise<UnderstandingRevision> {
    const safeBody = ensureHonestWhy(body);
    this.validateEvidence(safeBody, run.projectId);

    const now = new Date().toISOString();
    const understanding: UnderstandingRevision = {
      id: randomUUID(),
      projectId: run.projectId,
      matterId: run.matterId,
      kind: "candidate",
      body: safeBody,
      basedOnEventIds: [...run.eventIds],
      proposedBy: "agent",
      createdAt: now,
    };

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO analysis_runs
           (id, project_id, matter_id, trigger, event_ids_json, status, attempt, created_at, updated_at, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status=excluded.status,
             updated_at=excluded.updated_at,
             attempt=excluded.attempt,
             error=excluded.error`,
        )
        .run(
          run.id,
          run.projectId,
          run.matterId,
          run.trigger,
          JSON.stringify(run.eventIds),
          "awaiting_owner",
          run.attempt,
          run.createdAt,
          now,
          run.error ?? null,
        );

      this.insertUnderstanding(understanding);
      this.insertOutbox(
        "understanding_candidate",
        understanding.id,
        { runId: run.id },
        now,
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return understanding;
  }

  async resolveCandidate(input: OwnerResolution): Promise<{
    resolution: OwnerResolution;
    accepted?: UnderstandingRevision;
    head: MatterUnderstandingHead;
  }> {
    if (input.actor !== "owner") {
      throw new Error("only owner may resolve understanding");
    }

    const candidate = this.getUnderstanding(input.candidateRevisionId);
    if (!candidate) throw new Error("understanding not found");
    if (candidate.kind !== "candidate") {
      throw new Error("can only resolve a candidate revision");
    }

    let head = this.getHead(candidate.matterId);
    if (!head) {
      head = {
        matterId: candidate.matterId,
        reviewState: "current",
        reviewReasonEventIds: [],
        updatedAt: candidate.createdAt,
      };
    }

    const plan = planOwnerResolution({
      candidate,
      resolution: input,
      currentHead: head,
      nowIso: input.createdAt,
    });

    if (plan.acceptedToInsert) {
      this.validateEvidence(plan.acceptedToInsert.body, candidate.projectId);
    }

    // Snapshot candidate body before TX for immutability check after
    const candidateBodyBefore = JSON.stringify(candidate.body);

    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (plan.acceptedToInsert) {
        this.insertUnderstanding(plan.acceptedToInsert);
      }

      this.db
        .prepare(
          `INSERT INTO owner_resolutions
           (id, candidate_revision_id, decision, edited_body_json, actor, created_at, accepted_revision_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          plan.resolution.id,
          plan.resolution.candidateRevisionId,
          plan.resolution.decision,
          plan.resolution.editedBody
            ? JSON.stringify(plan.resolution.editedBody)
            : null,
          plan.resolution.actor,
          plan.resolution.createdAt,
          plan.resolution.acceptedRevisionId ?? null,
        );

      this.putHead(plan.nextHead);

      this.insertOutbox(
        "understanding_resolved",
        plan.resolution.id,
        {
          decision: plan.resolution.decision,
          acceptedRevisionId: plan.resolution.acceptedRevisionId,
        },
        plan.resolution.createdAt,
      );

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    // Candidate must remain byte-identical
    const candidateAfter = this.getUnderstanding(candidate.id);
    if (
      !candidateAfter ||
      JSON.stringify(candidateAfter.body) !== candidateBodyBefore ||
      candidateAfter.kind !== "candidate"
    ) {
      throw new Error("candidate revision was mutated (contract violation)");
    }

    return {
      resolution: plan.resolution,
      accepted: plan.acceptedToInsert,
      head: plan.nextHead,
    };
  }
}

export function openProjectMemoryStore(
  dataDir: string,
): SqliteProjectMemoryStore {
  return new SqliteProjectMemoryStore({ dataDir });
}
