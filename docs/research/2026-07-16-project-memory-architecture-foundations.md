# Project Memory Architecture Foundations

Date: 2026-07-16

Status: source-level research and falsifiable spike design only. This report does not adopt a dependency, change a production schema, or authorize T-22 implementation.

## Executive decision

The product should keep Project Memory as a custom domain, not turn an agent framework, file watcher, Git history, search engine, graph database, cache, or conversation checkpoint into the source of truth.

The smallest credible local-first shape is:

1. an application-owned append-only event ledger plus versioned domain records;
2. immutable original bytes in a SHA-256 content-addressed store;
3. versioned understanding organized around a concrete matter;
4. an observation and reconciliation layer for explicitly authorized folders, Git repositories, and later source adapters;
5. disposable search, semantic, graph-navigation, backlink, and current-state projections;
6. a separate conversation or run-memory boundary.

For a future spike, SQLite plus a filesystem content-addressed store is the best-fit baseline. A single local companion process should own writes. The Next.js application should talk through explicit domain ports rather than let arbitrary route handlers write a shared database. SQLite metadata does not replace immutable original bytes, and the filesystem store does not replace the event ledger.

The strongest observation candidate is Parcel Watcher 2.5.6, because it exposes native recursive watching and snapshot reconciliation. Chokidar 5.0.0 is the simpler comparator. Neither can establish a complete or exactly-once history. Their output is evidence that triggers a stable read and reconciliation pass.

The system Git executable is the best first Git adapter for a spike: read-only porcelain v2 and raw, NUL-delimited output for worktree state, plus cat-file for object bytes. Isomorphic-git is a later portability option, not a default dependency.

MiniSearch 7.2.0 remains the leading local keyword projection candidate. LangGraph checkpoints may later hold resumable agent-run state, Graphiti may later be evaluated as a temporal graph projection, and Letta is not a fit for Project Memory truth.

### MVP recommendation at a glance

| Concern | MVP decision | Replaceable boundary |
| --- | --- | --- |
| Independent memory framework | No | Custom Project Memory domain; optional RunCheckpointStore only for future resumable runs |
| Vector database | No | Projection interface; add only after measured corpus and retrieval failure |
| Durable metadata and audit | SQLite candidate in one local writer, pending S1 | ChangeLog, SourceRepository, MatterRepository |
| Immutable originals | Filesystem SHA-256 content-addressed store | OriginalStore |
| Folder observation | Parcel Watcher 2.5.6 versus Chokidar 5.0.0 spike | ObservationAdapter plus mandatory reconciliation |
| Git observation | User-installed Git, read-only stable formats | ObservationAdapter |
| Keyword retrieval | MiniSearch 7.2.0 rebuildable projection | Projection |
| Semantic and temporal graph retrieval | Defer | Projection; never source of truth |

## Scope and product truth

This report treats the following decisions as requirements rather than questions:

- Project Memory retains authorized originals and their versions, including deletion or tombstone history.
- accepted changes form an append-only event history;
- current and historical understanding is versioned around one concrete matter;
- indexes are rebuildable;
- the main Agent observes authorized folder, Git, and source changes, then identifies affected matters, gaps, conflicts, and stale understanding;
- an Agent result is a candidate until an Owner accepts, edits, or rejects it;
- orchestration of coding agents is outside this product's core.

These requirements come from the repository's product context and decision ledger: [CONTEXT.md](../../CONTEXT.md), [D-24, D-35, D-36, and D-39](../../.ship/tasks/first-user-real-entry-015/control/PRODUCT_DEV_TASKS.md). The T-16 evidence already establishes an important seam: the current material hash can detect drift, and a citation can preserve the hash seen at citation time, but that is not a prior-byte archive or a complete event log. See [T-16 production ledger](../../.ship/handoffs/G2-T16-production-ledger.md), [T-16 gap recheck](../../.ship/handoffs/G4-T16-red-gap-recheck-DONE.md), and [T-16 owner scenario](../../.ship/handoffs/G6-T16-three-red-gaps-owner-scenario-DONE.md).

The T-22 preparation converges on the same invariants without authorizing a schema or library: [local and Git observation](../../.ship/research/grok-followups/G1-T22-local-git-observation.md), [versioned originals and event log](../../.ship/research/grok-followups/G3B-T22-versioned-original-event-log.md), [revision and analysis interface](../../.ship/research/grok-followups/G3-T22-memory-revision-analysis-interface.md), [failure gates](../../.ship/research/grok-followups/G4-T22-project-memory-fail-gates.md), and [red preparation](../../.ship/research/grok-followups/G5-T22-project-memory-red-prep.md).

The earlier OSS matrix is still directionally correct: [open-source foundations matrix](./2026-07-16-open-source-foundations-matrix.md). This report narrows its memory lane with exact pins, source-level behavior, ownership boundaries, and failure-oriented spikes.

## Two memories that must not be conflated

### Project or domain memory

Project Memory answers durable product questions:

- What authorized original existed?
- What did it contain at a particular version?
- What changed, when was the change observed, and what transition did the product accept?
- What was understood about matter M at time T?
- Which evidence supported that understanding?
- What became stale, conflicting, unresolved, superseded, rejected, or deleted?
- Can the current view and every disposable index be reconstructed?

Its truth must survive a process restart, agent replacement, model replacement, projection deletion, conversation deletion, and framework replacement.

### Conversation or run memory

Conversation memory answers runtime questions:

- Which message or tool step is next?
- What intermediate state should a graph resume?
- Which pending writes or human interrupt belong to one run?
- What short-lived preferences and context should an agent load?

It may be useful and durable, but it is not authoritative evidence about the project. Deleting every run checkpoint must not delete an original revision, a matter revision, an Owner decision, or a source-change event. Conversely, replaying Project Memory must not pretend to recreate every token or nondeterministic model thought.

This separation is the decisive test for agent-memory frameworks. A framework can own execution state behind a port; it cannot define the product's domain history.

## Domain kernel to preserve

Names are illustrative. A spike should validate semantics before production naming.

### AuthorizationGrant

Defines an authorized source boundary, principal, scope, capabilities, creation time, revocation time, and adapter configuration. No observer may silently widen it. Revocation stops new reads and emits an auditable domain event; it does not retroactively erase retained history unless a separate explicit retention action requires that.

### SourceObject

A durable product identity independent of path and content digest. It records the adapter, authorization grant, provider-native identity when available, and current locator.

Path is mutable metadata, not identity. A content digest identifies bytes, not a logical source. Two files may share bytes, and one file may return to earlier bytes.

### OriginalRevision

An immutable record tying a SourceObject to:

- a revision identifier;
- a typed digest such as sha256 plus its value;
- byte length and media type;
- the content-addressed blob locator;
- source and observed times;
- provenance such as provider version, Git object identity, or stable-read metadata;
- an explicit present or tombstone state.

Deletion is a revision or transition, not a destructive erase. A restore creates another revision even when its digest matches an older one.

### ChangeEvent

An append-only accepted transition with:

- globally unique event identifier;
- project and source identity;
- monotonically assigned project sequence;
- event kind;
- before and after revision identifiers;
- raw observation reference;
- adapter cursor or reconciliation run;
- observed and recorded time;
- actor or adapter;
- idempotency key;
- event schema version;
- optional causation and correlation identifiers.

The ledger is the replay spine. Current tables may be maintained transactionally for fast reads, but they are not a substitute for replayable events.

### Matter

The stable identity for one concrete question, judgment, decision, or goal. It owns purpose, status, and relationships but not a single overwritten answer.

### UnderstandingRevision

An immutable revision of current understanding for a Matter:

- claims and unresolved questions;
- evidence references down to OriginalRevision and stable locator where possible;
- conflicts, gaps, impact, and staleness;
- originating analysis candidate;
- Owner resolution state;
- superseded revision;
- valid and recorded times where those differ.

An Agent may append an AnalysisFinding or candidate revision. Only an explicit OwnerResolution can accept or edit it into confirmed understanding. Rejection remains visible.

### EvidenceReference

Must point to an immutable original revision, never merely the latest path. Preserve the hash observed at citation time. A locator such as page, heading, line range, Git path, or byte range is evidence metadata and may itself need a version.

Lifecycle states should distinguish at least current, stale because source advanced, source deleted, inaccessible because grant revoked, ambiguous, and contradicted. Stale does not mean false; deleted does not mean erased.

### Relationships

Matters, evidence, actions, decisions, and results may have domain relationships. The relationship record itself can be truth when it expresses an accepted product fact. Adjacency lists, path caches, backlink counts, communities, and embeddings are projections.

## Six invariant queries

The domain ports should be judged by six queries, not by a framework demo:

1. now: What is the current accepted understanding of matter M?
2. then: What was the accepted understanding of M at time T or sequence S?
3. changed: Which originals, claims, evidence references, status, and relations changed between two points?
4. why: Which events, candidates, and Owner resolutions produced the current understanding?
5. depends: Which matters and claims depend on source or revision X, directly and transitively?
6. evidence: Can every displayed claim resolve to the exact retained bytes and locator that supported it?

A clean rebuild from the ledger and immutable blobs must return the same answers and deterministic projection digests. If a candidate technology cannot preserve this contract, it is an adapter or projection at most.

## Recommended ownership and durability boundary

### Single local writer

Use one local companion process as the only writer to the Project Memory store. It owns:

- watcher subscriptions;
- periodic reconciliation;
- stable reads and hashing;
- content-addressed blob installation;
- SQLite transactions and sequence assignment;
- outbox or notification publication;
- projection rebuild coordination.

The Next.js process reads and sends commands through a narrow transport. It should not open the database from Edge runtime, multiple serverless instances, or arbitrary request handlers. This preserves a clear single-writer failure model and keeps native modules out of unsupported runtimes.

### SQLite metadata and event ledger

For a bounded local-first, single-user system, SQLite gives transactions, constraints, indexes, and migration mechanics without introducing a service. WAL permits readers alongside a writer, but SQLite explicitly documents WAL constraints and checkpoint behavior. Transactions are serializable except when shared-cache read-uncommitted behavior is deliberately enabled. Sources: [SQLite WAL](https://www.sqlite.org/wal.html) and [SQLite transactions](https://www.sqlite.org/lang_transaction.html).

Recommended spike posture:

- one writer connection;
- foreign keys enabled;
- WAL mode only after power-loss and checkpoint tests;
- explicit busy timeout and bounded retry;
- explicit transaction around blob reference, event append, current pointer, and outbox;
- synchronous FULL for the durability spike, even if performance later motivates a measured alternative;
- integrity check and application-level digest verification on startup or repair;
- SQLite user_version only as the database schema migration cursor, not the event schema version.

SQLite documents that FULL in WAL mode adds a sync after each transaction, while NORMAL may lose durability after power loss even though the database remains consistent. [PRAGMA synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous) and [PRAGMA user_version](https://www.sqlite.org/pragma.html#pragma_user_version) are the authoritative references.

### Filesystem content-addressed store

Store immutable bytes by a typed cryptographic digest. A suitable layout is algorithm/digest-prefix/digest, with a manifest record in SQLite. The write order should be:

1. stream to a temporary file in the same filesystem while calculating SHA-256 and length;
2. flush the file and verify digest and length;
3. atomically rename or link it to its final digest path, tolerating an already-present identical blob;
4. fsync the containing directory where the target platform supports it;
5. append the revision and event in one SQLite transaction.

This order prefers a harmless orphan blob after a crash over a committed event whose blob never existed. A sweeper may remove unreferenced blobs only after a conservative grace period and audit. It must never infer that an unreferenced file is safe to remove during an incomplete migration or import.

The store needs collision defense: if the digest path already exists, verify length and, in test or suspicious cases, bytes. Represent hashes as a pair of algorithm and digest so an algorithm migration is possible.

### Atomicity is cross-store, not magical

SQLite and the filesystem do not provide one transaction. The protocol must therefore state recoverable intermediate states:

- final blob exists, transaction absent: orphan; safe to retain, later sweepable;
- transaction exists, blob missing: integrity failure; never silently present a current revision;
- temporary file exists: incomplete observation; safe to retry after age threshold;
- committed event exists, projection absent: rebuild or resume projection;
- projection exists beyond event cursor: discard and rebuild.

An outbox row committed with each event lets UI notifications be retried without making notification delivery part of domain truth.

## Observation is not history

### Required pipeline

The observer pipeline should be:

authorized watch set → raw signal → debounce or stability check → enumerate and stable-read → digest → compare with recorded manifest → candidate transitions → idempotent accepted events → impact and staleness analysis.

Raw signals are retained as diagnostic evidence for a bounded period, but only accepted transitions enter Project Memory. A terminal reconciliation manifest is mandatory after startup, watcher error, overflow, reconnect, authorization change, and periodic interval.

Stable-read means stat, open and stream, then stat again; if size, modification identity, or provider version changed, retry with a bound. No event is accepted for bytes that were never read completely.

### Exactly-once language

Do not promise exactly-once watcher delivery. The defensible product invariant is:

For one accepted stable source transition and one idempotency identity, the ledger appends at most one event; after successful reconciliation it eventually represents the terminal authorized state or records a gap or conflict.

The idempotency identity cannot be only before-digest plus after-digest. A sequence A→B→A→B contains two legitimate A→B transitions. Include a stable provider event identity where available, or a parent project sequence plus adapter observation or reconciliation identity. Reusing one key with different payload bytes is a conflict and must stop that source lane.

Out-of-order provider events must be ordered by provider version or reconciled against provider truth. Timestamps alone are insufficient.

### Rename semantics

A rename is confirmed only when the provider supplies a stable object identity or explicit rename operation. Parcel Watcher reports renames as delete plus create. Git rename similarity is a diff heuristic. A matching digest within a time window is a candidate that the Agent or Owner may resolve; it is not truth. Without proof, preserve delete plus create as two SourceObjects or an unresolved identity candidate.

### Deletion and tombstones

On deletion, the observer must not delete the last blob or source record. It appends a tombstone revision and a change event whose before revision remains resolvable. Reappearance appends a new present revision. If access is revoked rather than the source deleted, record revocation or inaccessibility instead of fabricating deletion.

## File watcher evaluation

### Parcel Watcher 2.5.6

Pin:

- npm: @parcel/watcher 2.5.6
- source commit: 8926bb8b281733bbfcaf69bb4e62ab7a1431c42a
- license: MIT
- direct package dependencies: node-addon-api 7.1.0, node-gyp-build 4.8.4, detect-libc 2.0.3, and is-glob 4.0.3
- optional native packages: thirteen platform packages at 2.5.6

Why it leads the spike:

- native recursive backends on macOS, Windows, Linux, and Watchman;
- create, update, and delete events;
- snapshot writing and getEventsSince reconciliation;
- batching and backend selection.

Its documented coalescing proves why it cannot be the ledger: create followed by update may become create; create followed by delete may disappear; rename becomes delete plus create. Snapshot behavior also varies by backend. These are useful observation semantics, not a durable audit contract. See the pinned [README](https://github.com/parcel-bundler/watcher/blob/8926bb8b281733bbfcaf69bb4e62ab7a1431c42a/README.md), [package manifest](https://github.com/parcel-bundler/watcher/blob/8926bb8b281733bbfcaf69bb4e62ab7a1431c42a/package.json), and [license](https://github.com/parcel-bundler/watcher/blob/8926bb8b281733bbfcaf69bb4e62ab7a1431c42a/LICENSE).

Risks:

- native packages complicate Electron or packaged-app signing and architecture coverage;
- snapshot support does not remove the need for an application manifest and full rescan;
- platform overflow, symlink, permission, and network-volume behavior still require the actual target machine;
- the optional native packages and detect-libc expand license and SBOM review even though their observed licenses are permissive.

### Chokidar 5.0.0

Pin:

- npm: chokidar 5.0.0
- source commit: c0c8d20e49d337491891078d1081bf91bd178de6
- license: MIT
- runtime dependency: readdirp 5.0.0, MIT
- ESM and Node at least 20.19

Chokidar provides normalized file events, atomic-write filtering, awaitWriteFinish, and recursive watching with a small JavaScript dependency surface. It does not expose a durable snapshot cursor. It is therefore the best comparator for implementation simplicity, not the leading recovery mechanism. The atomic and chunked-write options also deliberately delay or collapse signals; the application still must read stable bytes and reconcile. Sources: pinned [README](https://github.com/paulmillr/chokidar/blob/c0c8d20e49d337491891078d1081bf91bd178de6/README.md), [package manifest](https://github.com/paulmillr/chokidar/blob/c0c8d20e49d337491891078d1081bf91bd178de6/package.json), and [license](https://github.com/paulmillr/chokidar/blob/c0c8d20e49d337491891078d1081bf91bd178de6/LICENSE).

### File watcher verdict

Spike Parcel Watcher against Chokidar. Do not choose from README features alone. Parcel wins only if snapshot recovery and measured reliability outweigh native packaging cost. Regardless of winner, retain the same ObservationAdapter port and terminal manifest reconciliation.

## Git observation

Git has at least four distinct states that the product must not flatten:

- committed history and the currently resolved HEAD;
- branch or detached-HEAD identity;
- index or staged state;
- worktree modifications and untracked files.

For the first spike, call the installed Git executable read-only:

- status with porcelain v2, NUL-delimited output;
- diff and diff-tree raw formats with NUL delimiters and explicit similarity settings;
- rev-parse or symbolic-ref for HEAD identity;
- log with an explicit format and ordering;
- cat-file for exact blob or tree bytes.

Git documents porcelain v2 as a stable script-facing format and recommends NUL termination where path parsing must be unambiguous. Raw diff exposes old and new modes, object IDs, status, and optional similarity scores. cat-file reads object contents and metadata. Sources: [git-status porcelain format](https://git-scm.com/docs/git-status#_porcelain_format_version_2), [git-diff raw format](https://git-scm.com/docs/diff-format#_raw_output_format), and [git-cat-file](https://git-scm.com/docs/git-cat-file).

The adapter must never fetch, pull, reset, checkout, clean, commit, or mutate repository configuration. It copies observed bytes into Project Memory's content-addressed store. A Git object ID is provenance, not the only retention guarantee: force-push, reflog expiry, garbage collection, shallow clones, alternates, and repository deletion can make Git objects unavailable.

Rename detection remains a candidate because Git derives similarity. Preserve the raw old and new object IDs and paths, but do not silently merge SourceObjects based only on an R score.

The local research environment had Apple Git 2.39.5, Node 22.23.1, macOS 15.5, and arm64. Those values are a test baseline, not a product minimum. Git source is GPLv2; invoking a user-installed binary is materially different from bundling it. Any bundled Git distribution needs a separate legal and packaging review. The upstream source and license are available at [Git v2.50.0](https://github.com/git/git/tree/v2.50.0).

### Isomorphic-git 1.38.7

Pin:

- npm: isomorphic-git 1.38.7
- source commit: e5dbec689fab148fd5b518f3d4958c9d728886f9
- license: MIT

It exposes statusMatrix, walk, readBlob, log, resolveRef, and other programmatic APIs. It has eleven direct runtime dependencies at this pin. It is appropriate only if the product later requires environments without a Git executable or tighter in-process portability. It does not remove the need to model index, worktree, refs, object retention, and custom domain events. Sources: pinned [README](https://github.com/isomorphic-git/isomorphic-git/blob/e5dbec689fab148fd5b518f3d4958c9d728886f9/README.md), [package manifest](https://github.com/isomorphic-git/isomorphic-git/blob/e5dbec689fab148fd5b518f3d4958c9d728886f9/package.json), and [license](https://github.com/isomorphic-git/isomorphic-git/blob/e5dbec689fab148fd5b518f3d4958c9d728886f9/LICENSE.md).

## Storage library evaluation

### better-sqlite3 12.11.1

Pin:

- npm: better-sqlite3 12.11.1
- source commit: 4cbc39ca582fecb6b51dd920dfdd338ba4b72230
- license: MIT
- declared Node support in this release line: Node 20 through 26
- bundled SQLite in the pinned source: 3.53.2

The synchronous API fits a single local writer and makes transaction ownership explicit. It is a native addon and uses prebuilt binaries or compilation. The package has direct dependencies on bindings and prebuild-install; an isolated install without lifecycle scripts produced 38 transitive packages. Observed license expressions were permissive, but prebuild-install is deprecated and the native artifact chain still requires SBOM, provenance, architecture, signing, and offline-install checks.

Most importantly, the pinned build defines SQLITE_DEFAULT_WAL_SYNCHRONOUS=1, which is NORMAL. The product's durability spike must explicitly set and verify FULL instead of assuming the wrapper's default meets the audit requirement. Sources: pinned [README](https://github.com/WiseLibs/better-sqlite3/blob/4cbc39ca582fecb6b51dd920dfdd338ba4b72230/README.md), [package manifest](https://github.com/WiseLibs/better-sqlite3/blob/4cbc39ca582fecb6b51dd920dfdd338ba4b72230/package.json), [SQLite download and compile definition](https://github.com/WiseLibs/better-sqlite3/blob/4cbc39ca582fecb6b51dd920dfdd338ba4b72230/deps/download.sh), and [license](https://github.com/WiseLibs/better-sqlite3/blob/4cbc39ca582fecb6b51dd920dfdd338ba4b72230/LICENSE).

Verdict: best candidate for a falsifiable local spike, conditional on native packaging, explicit durability pragmas, backup and restore, and a maintained repository abstraction. Not adopted.

### cacache 20.0.3

Pin:

- npm: cacache 20.0.3
- source commit: 12ca70cc3553c670031998e9f23ff3713cac2195
- license: ISC
- eleven direct runtime dependencies

cacache offers integrity-checked content-addressed data, deduplication, streaming writes, concurrent access behavior, verification, and cleanup. Those mechanisms are useful references. Its public abstraction is a cache: entries can be removed and garbage collected. Therefore it cannot be the sole retention boundary for versioned originals. A custom thin immutable blob store is smaller and makes deletion policy explicit; cacache is worth a comparator only if its battle-tested streaming and verification materially reduce risk. Sources: pinned [README](https://github.com/npm/cacache/blob/12ca70cc3553c670031998e9f23ff3713cac2195/README.md), [package manifest](https://github.com/npm/cacache/blob/12ca70cc3553c670031998e9f23ff3713cac2195/package.json), and [license](https://github.com/npm/cacache/blob/12ca70cc3553c670031998e9f23ff3713cac2195/LICENSE.md).

## Retrieval and graph projections

### MiniSearch 7.2.0

Pin:

- npm: minisearch 7.2.0
- source commit: 3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5
- license: MIT
- no runtime dependencies

MiniSearch remains the best first keyword projection for the TypeScript and local-first stack. It supports fielded indexing, prefix and fuzzy search, filtering, and serialization without a service. Its index must contain stable domain identifiers and event or revision cursors, never become the only copy of text or relationships. Rebuild from the domain store is mandatory. Sources: pinned [README](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/README.md), [package manifest](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/package.json), and [license](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/LICENSE.txt).

### Semantic indexes

Embeddings are disposable derived data. Persist:

- embedding model identity and exact revision;
- chunking and normalization version;
- source OriginalRevision or UnderstandingRevision;
- projection build cursor;
- vector dimension and distance metric.

Model or chunker changes create a new projection version. A semantic index outage or deletion must degrade retrieval quality, not erase truth. No vector database is justified until a corpus-size and latency spike shows MiniSearch plus deterministic domain filters is insufficient.

### Graph navigation

Accepted relationships belong to the custom domain. A graph engine may project them for traversal. The projection must be wipeable and reconstructable, and every returned edge must map back to its domain relationship and supporting evidence. Temporal graph inference must never auto-confirm a matter revision.

## Agent framework evaluation

### LangGraph JS checkpoints

Pins examined:

- @langchain/langgraph 1.4.8, source commit 3dccad1391e173eead64f9e2d6dd977fdc345f7d
- @langchain/langgraph-checkpoint 1.1.3, source commit 86389fa3a64ec89e0cb26d97379efcc90c7a211f
- @langchain/langgraph-checkpoint-sqlite 1.0.3, source commit 39df14b11ffbd7c28cf0db98c74d7173213e4f65
- licenses: MIT

LangGraph's BaseCheckpointSaver models graph channel values, versions, pending writes, checkpoint listing, and thread deletion. Its BaseStore provides namespace key/value operations and optional search. These are good abstractions for a resumable run and human-in-the-loop interrupts. They do not model immutable originals, source transitions, evidence citations, matter revisions, Owner resolution, or the six domain queries. Source: pinned [checkpoint base](https://github.com/langchain-ai/langgraphjs/blob/86389fa3a64ec89e0cb26d97379efcc90c7a211f/libs/checkpoint/src/base.ts) and [store base](https://github.com/langchain-ai/langgraphjs/blob/86389fa3a64ec89e0cb26d97379efcc90c7a211f/libs/checkpoint/src/store/base.ts).

Verdict: no Project Memory role. Later spike only if the Agent truly needs multi-step durable execution and interrupts. Put it behind RunCheckpointStore. Domain commands may be called from graph nodes, but graph state stores only returned domain identifiers. Wiping all LangGraph checkpoints must preserve all six Project Memory queries.

### Graphiti 0.29.2

Pin:

- PyPI: graphiti-core 0.29.2
- source commit: ff7e29ccd127d8d9721b5cbb2163a6407ef915fe
- license: Apache-2.0
- Python at least 3.10

Graphiti models episodic ingestion and entity edges with temporal fields such as valid_at, invalid_at, expired_at, and episode provenance. That makes it a useful reference and a possible future graph projection. It also brings a Python sidecar, a graph database, LLM providers, embeddings, Neo4j client, NumPy, telemetry, and extraction behavior that does not match the Owner-confirmation boundary by default. The pinned tag's uv.lock still declared the project package as 0.29.1, so the tag is not a clean dependency-lock artifact for a strict adoption gate. Sources: pinned [README](https://github.com/getzep/graphiti/blob/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe/README.md), [project manifest](https://github.com/getzep/graphiti/blob/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe/pyproject.toml), [edge model](https://github.com/getzep/graphiti/blob/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe/graphiti_core/edges.py), and [license](https://github.com/getzep/graphiti/blob/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe/LICENSE).

Verdict: no near-term dependency. If graph traversal later becomes a measured bottleneck, feed accepted custom domain events into a disposable Graphiti projection and test provenance round-trips. Never ingest raw project bytes and treat extracted edges as confirmed truth.

### Letta 0.16.8

Pin:

- PyPI: letta 0.16.8
- source commit: b76da9092518cbaa2d09042e52fdcbde69243e18
- license: Apache-2.0
- Python at least 3.11 and below 3.14

Letta's AgentState and memory blocks are designed around persistent agent state and conversation behavior. The dependency and operational surface is much larger than this TypeScript product needs. The pinned repository describes itself as the legacy server and directs active server development elsewhere, which raises replacement and ownership risk for a new foundational dependency. Sources: pinned [README](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/README.md), [project manifest](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/pyproject.toml), [AgentState](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/schemas/agent.py), [memory model](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/letta/schemas/memory.py), and [license](https://github.com/letta-ai/letta/blob/b76da9092518cbaa2d09042e52fdcbde69243e18/LICENSE).

Verdict: reject for Project Memory and do not schedule a spike. Its design can be studied for agent UX, but it neither reduces the custom domain work nor fits the deployment surface.

## Why not event infrastructure or versioned-data platforms now

Kafka log compaction is explicitly subtractive: it retains at least the latest value per key, may retain delete markers only for a configured period, and does not give a complete chronological history by itself. That is the opposite of the required immutable audit ledger. [Kafka log compaction](https://kafka.apache.org/documentation/#compaction) is a useful warning against equating a compacted stream with domain memory.

EventStoreDB, Kafka, lakeFS, and a graph database may solve scale or operations that the first local, single-user, single-writer product does not yet have. They do not supply the missing domain concepts of authorized source, exact original revision, matter, evidence lifecycle, candidate understanding, and Owner resolution. Introducing a service now would expand installation, upgrade, backup, security, and recovery surface without removing the custom kernel. Revisit only from measured concurrency, corpus, remote-sync, or traversal evidence.

## Ports and replacement boundary

Keep the domain layer independent of SQLite, watchers, Git, search, and agent frameworks:

- AuthorizationRepository: grant, enumerate, revoke, and audit authorized scopes.
- ObservationAdapter: subscribe, snapshot, enumerate, read stable bytes, expose provider identity and cursors.
- OriginalStore: install and verify immutable bytes, fetch by typed digest, report integrity.
- SourceRepository: resolve SourceObject identity and revisions.
- ChangeLog: append idempotently, read by project sequence, stream for rebuild.
- MatterRepository: load matter and understanding history, append candidate and Owner resolution.
- DependencyQuery: answer source-to-matter and matter-to-matter dependency queries from truth or a verified projection.
- Projection: reset, apply event, expose build cursor and digest.
- RunCheckpointStore: optional and explicitly outside domain truth.

No external library type should cross these ports. Store the adapter kind and version in provenance, but keep product identifiers and event schemas application-owned.

## Migration, export, and replay

### Database migrations

Use forward-only, transactional SQLite migrations identified by user_version. Before a destructive migration, make a verified backup. Each migration should be restart-safe or have a recorded recovery procedure. Schema migration changes storage shape; it must not rewrite historical event meaning silently.

### Event evolution

Every event records schemaVersion. Readers use pure, deterministic upcasters from older shapes to the current in-memory form. Preserve original serialized payloads or an export that does. A semantic correction is a new compensating event, not an in-place rewrite.

Golden replay fixtures should include every historical event version. CI verifies:

- sequence and idempotency invariants;
- identical current-state digest;
- identical six-query results;
- no projection dependency during truth replay;
- unknown event versions fail closed.

### Export

A portable export should contain:

- a versioned manifest;
- project and authorization metadata with secrets omitted;
- ordered NDJSON domain events;
- typed current and historical domain records if needed for inspection;
- immutable blobs addressed by algorithm and digest;
- checksums for every export file;
- projection definitions and cursors, but projections need not be exported.

Import first verifies the whole manifest and blobs, stages into a new store, replays, checks digests and six-query answers, then atomically switches the active store. Never merge an unverified partial import into live truth.

### Replacement test

A storage or framework replacement is acceptable only if the export can be imported into an in-memory reference reducer or a second adapter without the original library and produce identical answers. This is the practical defense against lock-in.

## Failure-oriented spikes

No spike below authorizes production adoption. Each should have a tiny fixture, explicit failure injection, and a written verdict.

### S1: SQLite plus immutable blob protocol

Build the smallest vertical reducer for one project, two sources, one matter, and Owner decisions.

Exercise:

- create, edit, delete, restore same bytes, and restore changed bytes;
- duplicate delivery;
- repeated A→B→A→B;
- same idempotency key with different payload;
- out-of-order observation;
- crash after temporary write, after final rename, before commit, after commit, and before projection;
- missing and corrupt blob;
- WAL restart, checkpoint, backup, restore, and disk-full paths;
- synchronous FULL verification on the actual connection;
- replay into an empty database.

Pass:

- no duplicate accepted event for one idempotency key;
- conflict is explicit;
- no committed revision is presented as healthy without verified bytes;
- every tombstoned prior version remains retrievable;
- replay and restored backup return identical sequence, state digest, and six-query answers.

### S2: Watcher and reconciliation matrix

Compare Parcel Watcher 2.5.6 and Chokidar 5.0.0 in a temporary authorized directory on every target OS and packaged runtime.

Exercise:

- normal write, atomic-save rename, chunked write, rapid overwrite, copy, move, delete and recreate;
- same-content replacement and content return;
- nested directory move and deletion;
- watcher stopped during changes, then restarted;
- simulated overflow or forced full rescan;
- symlink inside and outside scope;
- permission revoke and restore;
- ignored temp files;
- large tree and burst latency.

Pass:

- terminal manifest equals an independent full enumeration;
- every accepted event maps to verified bytes or a tombstone;
- lost or coalesced intermediate OS signals never create fabricated history;
- downtime and error always trigger reconciliation;
- no read escapes the authorization root;
- packaging, CPU, memory, and install evidence supports a clear winner.

### S3: Git state fixture

Use a tiny repository with commits, branches, detached HEAD, staged and unstaged edits, untracked files, rename candidates, merge conflict, reset, force-ref movement, object pruning, and repository deletion.

Pass:

- parser handles spaces, tabs, newlines, non-ASCII, and leading dashes through NUL-delimited formats;
- committed, index, worktree, and untracked state stay distinct;
- no command mutates the repository or network;
- copied CAS bytes remain retrievable after Git no longer can resolve the object;
- rename remains a candidate unless stable identity proves it;
- replay answers now, then, changed, and evidence.

### S4: Matter revision and Owner boundary

Use a pure deterministic reducer with no LLM.

Exercise:

- source change marks dependent evidence stale;
- Agent proposes impact, conflict, and revised understanding;
- unauthorized Agent self-confirm attempt;
- Owner accepts, edits, rejects, and later supersedes;
- contradictory evidence and deleted evidence;
- analysis rerun with a newer algorithm version.

Pass:

- Agent output never becomes accepted understanding without Owner resolution;
- rejected and superseded candidates remain auditable;
- then and why queries distinguish valid time, recorded time, and acceptance;
- a new analysis does not rewrite the old result.

### S5: Projection wipe and deterministic rebuild

Build keyword, dependency, backlink, current-state, and a semantic stub projection from one event stream.

Pass:

- deleting all projection files loses no truth;
- rebuild resumes or restarts safely;
- two clean rebuilds produce the same cursor and deterministic digest, excluding explicitly versioned nondeterministic artifacts;
- every result maps to domain identifiers and evidence;
- projection lag is visible;
- all six queries remain correct when optional projections are unavailable.

### S6: Conversation boundary, only if needed

Only after a real durable multi-step Agent flow exists, compare a minimal custom RunCheckpointStore with LangGraph.

Pass:

- process restart resumes a pending run and human interrupt;
- checkpoint deletion affects only the run;
- domain commands are idempotent when a node retries;
- checkpoints contain domain IDs, not authoritative duplicate originals or matter history;
- framework replacement needs no Project Memory migration.

## Adoption gates

A future decision must include all of:

- exact package version and source commit;
- license files and generated transitive SBOM;
- native binary provenance, supported architectures, signing, and offline behavior;
- ownership of files, processes, migrations, backups, and recovery;
- crash and power-loss results on target hardware;
- explicit source-of-truth and deletion semantics;
- deterministic replay and projection rebuild evidence;
- export and replacement proof;
- authorization and path-escape tests;
- a measured reason the dependency is better than the simpler custom boundary.

Until those gates pass:

- do not add a memory framework;
- do not make a watcher or Git the event log;
- do not let a cache or search index retain the only copy;
- do not auto-confirm extracted understanding;
- do not claim exactly-once delivery;
- do not promote T-22 preparation into a production schema.

## Final recommendation

Keep Project Memory application-owned. Preserve immutable original bytes and an append-only accepted transition history; model versioned, source-backed understanding around matters; and make Owner resolution explicit. Use watchers and Git only to observe authorized sources, then reconcile and copy stable bytes into product custody. Treat keyword, semantic, graph, backlinks, and current summaries as rebuildable projections. Keep conversation checkpoints outside domain truth.

The next valid action is not a production integration. It is S1 through S5 in order of information value, with Parcel Watcher versus Chokidar and better-sqlite3 evaluated under failure. LangGraph earns S6 only when a concrete resumable run requires it. Graphiti remains a projection candidate, and Letta remains out of scope.
