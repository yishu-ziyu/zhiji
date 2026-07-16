/**
 * ProjectMemoryStore: SQLite metadata + CAS originals.
 * Write order: CAS temp→fsync→rename, then SQLite transaction for revision/event/outbox.
 * Orphan blobs OK; events must never reference missing blobs.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ContentAddressedStore, sha256Hex } from "./cas";
import {
  applyOwnerResolution,
  ensureHonestWhy,
  markReviewNeededForEvidenceChange,
} from "./reducer";
import type {
  AnalysisRun,
  ChangeEvent,
  ChangeKind,
  Matter,
  MatterState,
  ObservationSignal,
  OriginalRevision,
  OwnerResolution,
  ProjectMemoryStore,
  SourceGrant,
  UnderstandingBody,
  UnderstandingRevision,
} from "./types";
import { revisionIdFromSha256, sha256FromRevisionId } from "./types";

export type SqliteProjectMemoryOptions = {
  /** Directory holding project-memory.sqlite and cas/ */
  dataDir: string;
  /** Optional CAS root override (default dataDir/cas). */
  casDir?: string;
  /** Test hook: replace CAS put to simulate write failure after call site. */
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
  previous_revision_id: string | null;
  body_json: string;
  based_on_event_ids_json: string;
  status: string;
  proposed_by: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
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

export function defaultDedupeKey(signal: ObservationSignal, tipSha?: string): string {
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
    tipSha ??
    (signal.content ? sha256Hex(signal.content) : "empty");
  return [
    signal.projectId,
    signal.grantId,
    signal.kind,
    pathKey,
    sha,
    signal.previousPath ?? "",
  ].join("|");
}

export class SqliteProjectMemoryStore implements ProjectMemoryStore {
  readonly dbPath: string;
  readonly cas: ContentAddressedStore;
  private readonly db: DatabaseSync;

  constructor(options: SqliteProjectMemoryOptions) {
    fs.mkdirSync(options.dataDir, { recursive: true });
    this.dbPath = path.join(options.dataDir, "project-memory.sqlite");
    this.cas =
      options.cas ??
      new ContentAddressedStore(options.casDir ?? path.join(options.dataDir, "cas"));
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

      CREATE TABLE IF NOT EXISTS understanding_revisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        matter_id TEXT NOT NULL,
        previous_revision_id TEXT,
        body_json TEXT NOT NULL,
        based_on_event_ids_json TEXT NOT NULL,
        status TEXT NOT NULL,
        proposed_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      );

      CREATE TABLE IF NOT EXISTS owner_resolutions (
        id TEXT PRIMARY KEY,
        understanding_revision_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        edited_body_json TEXT,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL
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

  /** Test / grant helper — not on ProjectMemoryStore port. */
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

  /** Test helper. */
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
      previousRevisionId: row.previous_revision_id ?? undefined,
      body: JSON.parse(row.body_json) as UnderstandingBody,
      basedOnEventIds: JSON.parse(row.based_on_event_ids_json) as string[],
      status: row.status as UnderstandingRevision["status"],
      proposedBy: row.proposed_by as "agent" | "owner",
      createdAt: row.created_at,
      resolvedAt: row.resolved_at ?? undefined,
      resolvedBy: (row.resolved_by as "owner" | undefined) ?? undefined,
    };
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

  private markReviewNeededInTx(
    projectId: string,
    replacedRevisionIds: string[],
  ): void {
    if (replacedRevisionIds.length === 0) return;
    const accepted = (
      this.db
        .prepare(
          `SELECT * FROM understanding_revisions
           WHERE project_id = ? AND status = 'accepted'`,
        )
        .all(projectId) as UnderstandingRow[]
    ).map((r) => this.mapUnderstanding(r));

    const toMark = markReviewNeededForEvidenceChange({
      accepted,
      replacedRevisionIds,
    });
    for (const u of toMark) {
      this.db
        .prepare(
          `UPDATE understanding_revisions SET status = 'review_needed' WHERE id = ?`,
        )
        .run(u.id);
      this.insertOutbox(
        "understanding_review_needed",
        u.id,
        { replacedRevisionIds },
        new Date().toISOString(),
      );
    }
  }

  async ingest(
    signal: ObservationSignal,
  ): Promise<{ event?: ChangeEvent; revision?: OriginalRevision }> {
    const relativePath = signal.relativePath.replace(/\\/g, "/");
    if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..")) {
      throw new Error("relativePath invalid");
    }

    const tip = this.latestTip(signal.projectId, signal.grantId, relativePath);

    if (signal.kind === "deleted") {
      return this.ingestDelete(signal, relativePath, tip);
    }

    if (!signal.content) {
      throw new Error("content required for non-delete observation");
    }

    // CAS first — if this throws, SQLite must not gain revision/event.
    const casResult = this.cas.put(signal.content);
    const revId = revisionIdFromSha256(casResult.sha256);

    // Integrity: blob must exist before SQL.
    if (!this.cas.has(casResult.sha256)) {
      throw new Error("CAS write missing after put");
    }

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

    // Same tip sha (non-tombstone) → treat as idempotent no-op even if kind differs.
    if (
      tip &&
      !tip.tombstone &&
      tip.sha256 === casResult.sha256
    ) {
      return { revision: tip };
    }

    const beforeId = tip && !tip.tombstone ? tip.id : tip?.tombstone ? tip.previousRevisionId : undefined;
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
        this.markReviewNeededInTx(signal.projectId, [beforeId]);
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
      // Nothing to delete / already deleted — idempotent empty.
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

    // Keep last blob; tombstone revision reuses last sha for addressing history.
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

    // Tombstone revision id is distinct: sha256 of "tombstone:" + lastSha + path + time
    const tombstoneMaterial = new TextEncoder().encode(
      `tombstone:${lastSha}:${relativePath}:${signal.observedAt}`,
    );
    // Do NOT put tombstone material as content blob for file bytes — tombstone points at last live sha for read of prior content.
    // Store a meta-only revision row with same sha256 as last live (content still readable) and tombstone=1.
    // UNIQUE(project, grant, path, sha256, tombstone) allows same sha with tombstone 0 and 1.
    const tombstoneId = revisionIdFromSha256(
      sha256Hex(tombstoneMaterial),
    );
    // Ensure tombstone id blob can exist as empty marker? PRD: event must not point missing blob.
    // afterRevisionId for delete = tombstone revision; readRevision should return last live bytes.
    // Put empty marker under tombstone hash so has() is true for tombstone id's sha, OR use lastSha as id.
    // Spec: OriginalRevision.id = sha256:<hex> of content. Tombstone is not content — use synthetic id and store lastSha field.
    this.cas.put(tombstoneMaterial);

    const revision: OriginalRevision = {
      id: tombstoneId,
      projectId: signal.projectId,
      grantId: signal.grantId,
      relativePath,
      sha256: lastSha, // content address of last live bytes
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

      this.markReviewNeededInTx(signal.projectId, [lastLiveId]);
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
    // For tombstone, return last live content by sha256 field (preserved blob).
    const bytes = this.cas.read(rev.sha256);
    if (bytes) return bytes;
    // Fallback: if id itself is content hash
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

    const urows = this.db
      .prepare(
        `SELECT * FROM understanding_revisions
         WHERE project_id = ? AND matter_id = ?
         ORDER BY created_at DESC, rowid DESC`,
      )
      .all(projectId, matterId) as UnderstandingRow[];
    const understandings = urows.map((r) => this.mapUnderstanding(r));

    const accepted = understandings.find((u) => u.status === "accepted");
    const candidate = understandings.find((u) => u.status === "candidate");
    const reviewNeeded = understandings.filter(
      (u) => u.status === "review_needed",
    );
    const recentEvents = (await this.listEvents(projectId)).slice(-50);

    return {
      matter,
      accepted,
      candidate,
      recentEvents,
      reviewNeeded,
    };
  }

  async saveCandidate(
    run: AnalysisRun,
    body: UnderstandingBody,
  ): Promise<UnderstandingRevision> {
    const safeBody = ensureHonestWhy(body);
    // Validate evidence revisions exist and belong to project.
    for (const rid of safeBody.evidenceRevisionIds) {
      const rev = this.getRevision(rid);
      if (!rev || rev.projectId !== run.projectId) {
        throw new Error(`evidence revision missing or foreign: ${rid}`);
      }
    }

    const now = new Date().toISOString();
    const understanding: UnderstandingRevision = {
      id: randomUUID(),
      projectId: run.projectId,
      matterId: run.matterId,
      body: safeBody,
      basedOnEventIds: [...run.eventIds],
      status: "candidate",
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

      this.db
        .prepare(
          `INSERT INTO understanding_revisions
           (id, project_id, matter_id, previous_revision_id, body_json, based_on_event_ids_json, status, proposed_by, created_at, resolved_at, resolved_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
        )
        .run(
          understanding.id,
          understanding.projectId,
          understanding.matterId,
          understanding.previousRevisionId ?? null,
          JSON.stringify(understanding.body),
          JSON.stringify(understanding.basedOnEventIds),
          understanding.status,
          understanding.proposedBy,
          understanding.createdAt,
        );

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

  async resolve(input: OwnerResolution): Promise<UnderstandingRevision> {
    if (input.actor !== "owner") {
      throw new Error("only owner may resolve understanding");
    }

    const row = this.db
      .prepare(`SELECT * FROM understanding_revisions WHERE id = ?`)
      .get(input.understandingRevisionId) as UnderstandingRow | undefined;
    if (!row) throw new Error("understanding not found");
    const candidate = this.mapUnderstanding(row);

    const acceptedRows = this.db
      .prepare(
        `SELECT * FROM understanding_revisions
         WHERE project_id = ? AND matter_id = ? AND status = 'accepted'`,
      )
      .all(candidate.projectId, candidate.matterId) as UnderstandingRow[];
    const currentlyAccepted = acceptedRows.map((r) => this.mapUnderstanding(r));

    const transition = applyOwnerResolution({
      candidate,
      resolution: input,
      currentlyAccepted,
      nowIso: input.createdAt,
    });

    // Validate edited evidence if present.
    for (const rid of transition.resolved.body.evidenceRevisionIds) {
      const rev = this.getRevision(rid);
      if (!rev || rev.projectId !== candidate.projectId) {
        throw new Error(`evidence revision missing or foreign: ${rid}`);
      }
    }

    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const sid of transition.supersededIds) {
        this.db
          .prepare(
            `UPDATE understanding_revisions SET status = 'superseded' WHERE id = ?`,
          )
          .run(sid);
      }

      this.db
        .prepare(
          `UPDATE understanding_revisions
           SET body_json = ?, status = ?, resolved_at = ?, resolved_by = ?, previous_revision_id = ?
           WHERE id = ?`,
        )
        .run(
          JSON.stringify(transition.resolved.body),
          transition.resolved.status,
          transition.resolved.resolvedAt ?? null,
          transition.resolved.resolvedBy ?? null,
          transition.resolved.previousRevisionId ?? null,
          transition.resolved.id,
        );

      this.db
        .prepare(
          `INSERT INTO owner_resolutions
           (id, understanding_revision_id, decision, edited_body_json, actor, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.understandingRevisionId,
          input.decision,
          input.editedBody ? JSON.stringify(input.editedBody) : null,
          input.actor,
          input.createdAt,
        );

      this.insertOutbox(
        "understanding_resolved",
        transition.resolved.id,
        { decision: input.decision },
        input.createdAt,
      );

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return transition.resolved;
  }
}

export function openProjectMemoryStore(
  dataDir: string,
): SqliteProjectMemoryStore {
  return new SqliteProjectMemoryStore({ dataDir });
}
