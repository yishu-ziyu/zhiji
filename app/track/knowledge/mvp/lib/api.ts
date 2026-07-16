export type GrantStatus = "active" | "disabled" | "revoked";
export type MatterStatus = "active" | "resolved" | "archived";
export type ChangeKind = "added" | "modified" | "renamed" | "deleted" | "reconciled";
export type ClaimStatus = "supported" | "unknown" | "conflicted";
export type ResolutionDecision = "accept" | "edit_accept" | "reject";

export type SourceGrant = {
  id: string;
  projectId: string;
  kind: "local_folder" | "local_git";
  rootPath: string;
  status: GrantStatus;
  createdAt: string;
  updatedAt: string;
};

export type MatterWatchSet = {
  id: string;
  projectId: string;
  matterId: string;
  grantId: string;
  includePathPrefixes: string[];
  excludePathPrefixes: string[];
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type EvidenceAnchor = {
  revisionId: string;
  relativePath: string;
  quote: string;
  lastVerifiedAt: string;
};

export type StateClaim = {
  text: string;
  evidence: EvidenceAnchor[];
  gaps: string[];
  conflicts: string[];
};

export type ChangeClaim = {
  before: string;
  after: string;
  eventIds: string[];
  evidence: EvidenceAnchor[];
};

export type WhyClaim = {
  text: string;
  status: ClaimStatus;
  evidence: EvidenceAnchor[];
};

export type UnderstandingBody = {
  now: StateClaim;
  then: StateClaim & { at: string };
  changed: ChangeClaim[];
  why: WhyClaim[];
  depends: Array<{ kind: "matter" | "action" | "evidence"; id: string; reason: string }>;
  evidenceRevisionIds: string[];
  nextDecision: string;
};

export type Matter = {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  status: MatterStatus;
  createdAt: string;
  updatedAt: string;
};

export type OriginalRevision = {
  id: string;
  projectId: string;
  grantId: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  observedAt: string;
  previousRevisionId?: string;
  tombstone: boolean;
};

export type UnderstandingRevision = {
  id: string;
  projectId: string;
  matterId: string;
  kind: "candidate" | "accepted";
  previousAcceptedRevisionId?: string;
  body: UnderstandingBody;
  basedOnEventIds: string[];
  proposedBy: "agent" | "owner";
  createdAt: string;
};

export type MatterUnderstandingHead = {
  matterId: string;
  acceptedRevisionId?: string;
  reviewState: "current" | "review_needed";
  reviewReasonEventIds: string[];
  updatedAt: string;
};

export type ChangeEventView = {
  id: string;
  projectId: string;
  grantId: string;
  kind: ChangeKind;
  relativePath: string;
  previousPath?: string;
  beforeRevisionId?: string;
  afterRevisionId?: string;
  observedAt: string;
  dedupeKey: string;
  matched: boolean;
  matchReason?: string;
};

export type MemoryResponse = {
  matter: Matter;
  watchSet: MatterWatchSet;
  head: MatterUnderstandingHead;
  accepted?: UnderstandingRevision;
  candidate?: UnderstandingRevision;
  events: ChangeEventView[];
  filteredEvents: ChangeEventView[];
};

export type RevisionResponse = {
  revision: OriginalRevision;
  content: string;
};

export type OwnerResolution = {
  id: string;
  candidateRevisionId: string;
  decision: ResolutionDecision;
  editedBody?: UnderstandingBody;
  actor: "owner";
  createdAt: string;
  acceptedRevisionId?: string;
};

export type ResolutionResponse = {
  resolution: OwnerResolution;
  accepted?: UnderstandingRevision;
  head: MatterUnderstandingHead;
};

export type WatchSetUpdate = Pick<
  MatterWatchSet,
  "grantId" | "includePathPrefixes" | "excludePathPrefixes" | "status"
>;

export type MvpBootstrap = {
  projectId: string;
  grant: SourceGrant;
  watchSet: MatterWatchSet;
  matter: Matter;
};

export type ContractApi = {
  bootstrapExisting(projectId?: string): Promise<MvpBootstrap | null>;
  connectGrant(projectId: string, rootPath: string, includePathPrefixes: string[]): Promise<{
    grant: SourceGrant;
    watchSet: MatterWatchSet;
    matter: Matter;
  }>;
  getMemory(projectId: string, matterId: string): Promise<MemoryResponse>;
  updateWatchSet(
    projectId: string,
    matterId: string,
    input: WatchSetUpdate,
  ): Promise<MatterWatchSet>;
  runAnalysis(projectId: string, matterId: string, eventIds: string[]): Promise<UnderstandingRevision>;
  resolveCandidate(
    projectId: string,
    matterId: string,
    candidateId: string,
    decision: ResolutionDecision,
    editedBody?: UnderstandingBody,
  ): Promise<ResolutionResponse>;
  getRevision(projectId: string, revisionId: string): Promise<RevisionResponse>;
};

const projectId = "project-mvp-fixture";
const matterId = "matter-product-exploration";
const grantId = "grant-local-fixture";
const watchSetId = "watch-matter-product-exploration";

const revisionMeetingCurrent = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
const revisionMeetingBefore = "sha256:2222222222222222222222222222222222222222222222222222222222222222";
const revisionScopeCurrent = "sha256:3333333333333333333333333333333333333333333333333333333333333333";
const revisionScopeBefore = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const revisionOldPlan = "sha256:5555555555555555555555555555555555555555555555555555555555555555";

const fixtureGrant: SourceGrant = {
  id: grantId,
  projectId,
  kind: "local_git",
  rootPath: "/Users/owner/projects/product-exploration",
  status: "active",
  createdAt: "2026-07-16T08:00:00.000Z",
  updatedAt: "2026-07-16T09:14:00.000Z",
};

let fixtureWatchSet: MatterWatchSet = {
  id: watchSetId,
  projectId,
  matterId,
  grantId,
  includePathPrefixes: ["materials/", "plans/"],
  excludePathPrefixes: ["archive/", "node_modules/"],
  status: "active",
  createdAt: "2026-07-16T08:05:00.000Z",
  updatedAt: "2026-07-16T09:14:00.000Z",
};

const fixtureMatter: Matter = {
  id: matterId,
  projectId,
  title: "产品探索",
  goal: "确认客户需求变化是否需要调整当前 Demo 行动。",
  status: "active",
  createdAt: "2026-07-14T08:30:00.000Z",
  updatedAt: "2026-07-16T09:14:00.000Z",
};

function evidence(
  revisionId: string,
  relativePath: string,
  quote: string,
): EvidenceAnchor {
  return {
    revisionId,
    relativePath,
    quote,
    lastVerifiedAt: "2026-07-16T09:14:00.000Z",
  };
}

const meetingEvidence = evidence(
  revisionMeetingCurrent,
  "materials/customer-meeting.md",
  "先回到原始访谈，再决定是否调整当前行动。",
);
const scopeEvidence = evidence(
  revisionScopeCurrent,
  "plans/demo-scope.md",
  "Demo 范围保持最小，先验证需求再扩展。",
);
const oldPlanEvidence = evidence(
  revisionOldPlan,
  "archive/old-plan.md",
  "先完成 Demo，再回头验证客户需求。",
);

function fixtureBody(): UnderstandingBody {
  return {
    now: {
      text: "当前项目仍在产品探索阶段；客户需求变化是下一次行动的主要判断入口。",
      evidence: [meetingEvidence, scopeEvidence],
      gaps: [],
      conflicts: [],
    },
    then: {
      at: "2026-07-14",
      text: "当时先以最小 Demo 验证方向，尚未有客户原文支持扩大范围。",
      evidence: [scopeEvidence],
      gaps: [],
      conflicts: [],
    },
    changed: [
      {
        before: "Demo 先行，客户需求在后续复核。",
        after: "客户原文需要先被复核，再决定是否调整 Demo 行动。",
        eventIds: ["event-meeting-modified", "event-scope-renamed"],
        evidence: [meetingEvidence, scopeEvidence],
      },
    ],
    why: [
      {
        text: "客户需求变化直接影响当前行动的优先级。",
        status: "supported",
        evidence: [meetingEvidence],
      },
      {
        text: "暂时无法确认 Demo 风险是否由预算约束造成。",
        status: "unknown",
        evidence: [],
      },
      {
        text: "旧材料仍建议先完成 Demo，与当前访谈顺序冲突。",
        status: "conflicted",
        evidence: [oldPlanEvidence],
      },
    ],
    depends: [
      { kind: "matter", id: matterId, reason: "当前事项的判断中心" },
      { kind: "action", id: "action-demo-scope", reason: "可能受影响的工作项" },
      { kind: "evidence", id: revisionMeetingCurrent, reason: "客户原文来源" },
    ],
    evidenceRevisionIds: [revisionMeetingCurrent, revisionScopeCurrent, revisionOldPlan],
    nextDecision: "Owner 复核客户会议原文后，决定是否调整 Demo 的 4 项行动。",
  };
}

const fixtureCandidate: UnderstandingRevision = {
  id: "understanding-candidate-2",
  projectId,
  matterId,
  kind: "candidate",
  body: fixtureBody(),
  basedOnEventIds: ["event-meeting-modified", "event-scope-renamed"],
  proposedBy: "agent",
  createdAt: "2026-07-16T09:15:00.000Z",
};

let fixtureAccepted: UnderstandingRevision = {
  id: "understanding-accepted-1",
  projectId,
  matterId,
  kind: "accepted",
  body: {
    ...fixtureBody(),
    now: {
      ...fixtureBody().now,
      text: "当前项目仍以最小 Demo 验证方向。",
    },
    changed: [],
    why: [fixtureBody().why[0]],
    nextDecision: "继续核对客户原文。",
  },
  basedOnEventIds: ["event-scope-renamed"],
  proposedBy: "owner",
  createdAt: "2026-07-15T11:28:00.000Z",
};

let fixtureHead: MatterUnderstandingHead = {
  matterId,
  acceptedRevisionId: fixtureAccepted.id,
  reviewState: "review_needed",
  reviewReasonEventIds: ["event-meeting-modified"],
  updatedAt: "2026-07-16T09:15:00.000Z",
};

const fixtureEvents: ChangeEventView[] = [
  {
    id: "event-meeting-modified",
    projectId,
    grantId,
    kind: "modified",
    relativePath: "materials/customer-meeting.md",
    beforeRevisionId: revisionMeetingBefore,
    afterRevisionId: revisionMeetingCurrent,
    observedAt: "2026-07-16T09:10:00.000Z",
    dedupeKey: "fixture:meeting:modified:v2",
    matched: true,
    matchReason: "匹配 watch set：materials/",
  },
  {
    id: "event-scope-renamed",
    projectId,
    grantId,
    kind: "renamed",
    relativePath: "plans/demo-scope.md",
    previousPath: "plans/demo.md",
    beforeRevisionId: revisionScopeBefore,
    afterRevisionId: revisionScopeCurrent,
    observedAt: "2026-07-16T08:55:00.000Z",
    dedupeKey: "fixture:scope:renamed:v2",
    matched: true,
    matchReason: "匹配 watch set：plans/",
  },
  {
    id: "event-old-plan-deleted",
    projectId,
    grantId,
    kind: "deleted",
    relativePath: "archive/old-plan.md",
    beforeRevisionId: revisionOldPlan,
    observedAt: "2026-07-16T08:30:00.000Z",
    dedupeKey: "fixture:old-plan:deleted:v1",
    matched: false,
    matchReason: "不匹配 watch set：archive/ 被排除；仅保留 trace",
  },
];

const fixtureRevisions: Record<string, RevisionResponse> = {
  [revisionMeetingCurrent]: {
    revision: {
      id: revisionMeetingCurrent,
      projectId,
      grantId,
      relativePath: "materials/customer-meeting.md",
      sha256: revisionMeetingCurrent,
      sizeBytes: 842,
      observedAt: "2026-07-16T09:10:00.000Z",
      previousRevisionId: revisionMeetingBefore,
      tombstone: false,
    },
    content: "# 客户会议原文\n\n先回到原始访谈，再决定是否调整当前行动。\n",
  },
  [revisionMeetingBefore]: {
    revision: {
      id: revisionMeetingBefore,
      projectId,
      grantId,
      relativePath: "materials/customer-meeting.md",
      sha256: revisionMeetingBefore,
      sizeBytes: 790,
      observedAt: "2026-07-14T10:21:00.000Z",
      tombstone: false,
    },
    content: "# 客户会议原文\n\n先完成 Demo，再回头验证客户需求。\n",
  },
  [revisionScopeCurrent]: {
    revision: {
      id: revisionScopeCurrent,
      projectId,
      grantId,
      relativePath: "plans/demo-scope.md",
      sha256: revisionScopeCurrent,
      sizeBytes: 560,
      observedAt: "2026-07-16T08:55:00.000Z",
      previousRevisionId: revisionScopeBefore,
      tombstone: false,
    },
    content: "# Demo 范围\n\nDemo 范围保持最小，先验证需求再扩展。\n",
  },
  [revisionScopeBefore]: {
    revision: {
      id: revisionScopeBefore,
      projectId,
      grantId,
      relativePath: "plans/demo.md",
      sha256: revisionScopeBefore,
      sizeBytes: 620,
      observedAt: "2026-07-14T12:00:00.000Z",
      tombstone: false,
    },
    content: "# Demo 范围\n\n先完成 Demo，再决定是否扩大范围。\n",
  },
  [revisionOldPlan]: {
    revision: {
      id: revisionOldPlan,
      projectId,
      grantId,
      relativePath: "archive/old-plan.md",
      sha256: revisionOldPlan,
      sizeBytes: 410,
      observedAt: "2026-07-13T17:00:00.000Z",
      tombstone: true,
    },
    content: "# 旧计划\n\n先完成 Demo，再回头验证客户需求。\n",
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixtureMemory(): MemoryResponse {
  return clone({
    matter: fixtureMatter,
    watchSet: fixtureWatchSet,
    head: fixtureHead,
    accepted: fixtureAccepted,
    candidate: fixtureCandidate,
    events: fixtureEvents.filter((event) => event.matched),
    filteredEvents: fixtureEvents.filter((event) => !event.matched),
  });
}

function createFixtureApi(): ContractApi {
  return {
    async bootstrapExisting() {
      return null;
    },
    async connectGrant() {
      return clone({ grant: fixtureGrant, watchSet: fixtureWatchSet, matter: fixtureMatter });
    },
    async getMemory() {
      return fixtureMemory();
    },
    async updateWatchSet(_projectId, _matterId, input) {
      fixtureWatchSet = {
        ...fixtureWatchSet,
        includePathPrefixes: input.includePathPrefixes.filter(Boolean),
        excludePathPrefixes: input.excludePathPrefixes.filter(Boolean),
        status: input.status,
        updatedAt: "2026-07-16T09:20:00.000Z",
      };
      return clone(fixtureWatchSet);
    },
    async runAnalysis() {
      return clone(fixtureCandidate);
    },
    async resolveCandidate(_projectId, _matterId, candidateId, decision, editedBody) {
      const resolution: OwnerResolution = {
        id: `resolution-${decision}-fixture`,
        candidateRevisionId: candidateId || fixtureCandidate.id,
        decision,
        editedBody,
        actor: "owner",
        createdAt: "2026-07-16T09:22:00.000Z",
      };
      if (decision === "reject") {
        return clone({ resolution, head: fixtureHead });
      }
      const accepted: UnderstandingRevision = {
        ...fixtureCandidate,
        id: decision === "accept" ? "understanding-accepted-2" : "understanding-accepted-3",
        kind: "accepted",
        body: editedBody || fixtureCandidate.body,
        previousAcceptedRevisionId: fixtureHead.acceptedRevisionId,
        proposedBy: "owner",
        createdAt: "2026-07-16T09:22:00.000Z",
      };
      fixtureAccepted = accepted;
      fixtureHead = {
        ...fixtureHead,
        acceptedRevisionId: accepted.id,
        reviewState: "current",
        reviewReasonEventIds: [],
        updatedAt: accepted.createdAt,
      };
      resolution.acceptedRevisionId = accepted.id;
      return clone({ resolution, accepted, head: fixtureHead });
    },
    async getRevision(_projectId, revisionId) {
      const revision = fixtureRevisions[revisionId];
      if (!revision) throw new Error("版本不存在或无权访问");
      return clone(revision);
    },
  };
}

async function httpJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

type GrantBootstrapResponse = {
  grant?: SourceGrant;
  matter?: Matter;
  watchSet?: MatterWatchSet;
  matterId?: string;
  defaultMatter?: Matter;
  defaultWatchSet?: MatterWatchSet;
  grants?: SourceGrant[];
  projectId?: string;
  bootstrap?: {
    projectId?: string;
    matter?: Matter;
    watchSet?: MatterWatchSet;
    matterId?: string;
  };
};

type BackendMemoryResponse = {
  matter: Matter;
  head: MatterUnderstandingHead;
  accepted: UnderstandingRevision | null;
  candidate: UnderstandingRevision | null;
  events: Omit<ChangeEventView, "matched" | "matchReason">[];
};

function pathMatchesPrefix(relativePath: string, prefix: string): boolean {
  const normalizedPrefix = prefix.replace(/\\/g, "/").replace(/\/+$/, "");
  return relativePath === normalizedPrefix || relativePath.startsWith(`${normalizedPrefix}/`);
}

function projectBackendEvents(
  events: BackendMemoryResponse["events"],
  watchSet: MatterWatchSet,
): Pick<MemoryResponse, "events" | "filteredEvents"> {
  const projected = events.map((event) => {
    const excluded = watchSet.excludePathPrefixes.some((prefix) =>
      pathMatchesPrefix(event.relativePath, prefix),
    );
    const matched = watchSet.status === "active" && !excluded && watchSet.includePathPrefixes.some((prefix) =>
      pathMatchesPrefix(event.relativePath, prefix),
    );
    return {
      ...event,
      matched,
      matchReason: matched ? "watch_path" : "outside watch set",
    } satisfies ChangeEventView;
  });
  return {
    events: projected.filter((event) => event.matched),
    filteredEvents: projected.filter((event) => !event.matched),
  };
}

function createHttpApi(): ContractApi {
  return {
    async bootstrapExisting(requestedProjectId) {
      let nextProjectId = requestedProjectId?.trim() || "";
      if (!nextProjectId) {
        const projects = await httpJson<{ projects: Array<{ id: string }> }>("/api/knowledge/projects");
        nextProjectId = projects.projects[0]?.id || "";
      }
      if (!nextProjectId) return null;

      const data = await httpJson<GrantBootstrapResponse>(
        `/api/knowledge/projects/${encodeURIComponent(nextProjectId)}/source-grants`,
      );
      const grant = data.grant ?? data.grants?.find((item) => item.status === "active");
      if (!grant) return null;
      const matter = data.matter ?? data.defaultMatter ?? data.bootstrap?.matter;
      const watchSet = data.watchSet ?? data.defaultWatchSet ?? data.bootstrap?.watchSet;
      const bootstrapMatterId = matter?.id ?? watchSet?.matterId ?? data.matterId ?? data.bootstrap?.matterId;
      if (!bootstrapMatterId) return null;
      const memory = await this.getMemory(nextProjectId, bootstrapMatterId);
      return {
        projectId: data.projectId ?? data.bootstrap?.projectId ?? nextProjectId,
        grant,
        matter: matter ?? memory.matter,
        watchSet: watchSet ?? memory.watchSet,
      };
    },
    async connectGrant(nextProjectId, rootPath, includePathPrefixes) {
      const data = await httpJson<GrantBootstrapResponse>(
        `/api/knowledge/projects/${encodeURIComponent(nextProjectId)}/source-grants`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "local_git", rootPath, includePathPrefixes }) },
      );
      if (!data.grant) throw new Error("source-grant API 未返回 grant");
      if (data.matter && data.watchSet) {
        return { grant: data.grant, watchSet: data.watchSet, matter: data.matter };
      }
      const bootstrapMatterId = data.matter?.id ?? data.watchSet?.matterId ?? data.matterId;
      if (!bootstrapMatterId) {
        throw new Error("source-grant API 未返回默认 matter/watch bootstrap");
      }
      const memory = await this.getMemory(nextProjectId, bootstrapMatterId);
      return { grant: data.grant, watchSet: memory.watchSet, matter: memory.matter };
    },
    async getMemory(nextProjectId, nextMatterId) {
      const encodedProjectId = encodeURIComponent(nextProjectId);
      const encodedMatterId = encodeURIComponent(nextMatterId);
      const [memory, watch] = await Promise.all([
        httpJson<BackendMemoryResponse>(
          `/api/knowledge/projects/${encodedProjectId}/memory?matterId=${encodedMatterId}`,
        ),
        httpJson<{ watchSet: MatterWatchSet }>(
          `/api/knowledge/projects/${encodedProjectId}/matters/${encodedMatterId}/watch-set`,
        ),
      ]);
      const projected = projectBackendEvents(memory.events, watch.watchSet);
      return {
        matter: memory.matter,
        watchSet: watch.watchSet,
        head: memory.head,
        accepted: memory.accepted ?? undefined,
        candidate: memory.candidate ?? undefined,
        ...projected,
      };
    },
    async updateWatchSet(nextProjectId, nextMatterId, input) {
      const data = await httpJson<{ watchSet: MatterWatchSet }>(
        `/api/knowledge/projects/${encodeURIComponent(nextProjectId)}/matters/${encodeURIComponent(nextMatterId)}/watch-set`,
        { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
      );
      return data.watchSet;
    },
    async runAnalysis(nextProjectId, nextMatterId, eventIds) {
      const data = await httpJson<{ candidate: UnderstandingRevision }>(
        `/api/knowledge/projects/${encodeURIComponent(nextProjectId)}/analysis-runs`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ matterId: nextMatterId, eventIds, trigger: "source_change" }) },
      );
      return data.candidate;
    },
    async resolveCandidate(nextProjectId, nextMatterId, candidateId, decision, editedBody) {
      return httpJson<ResolutionResponse>(
        `/api/knowledge/understanding/${encodeURIComponent(candidateId)}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: nextProjectId,
            matterId: nextMatterId,
            candidateId,
            decision,
            editedBody,
            actor: "owner",
          }),
        },
      );
    },
    async getRevision(nextProjectId, revisionId) {
      const data = await httpJson<{ revisionId: string; content: string }>(
        `/api/knowledge/revisions/${encodeURIComponent(revisionId)}?projectId=${encodeURIComponent(nextProjectId)}`,
      );
      return {
        revision: {
          id: data.revisionId,
          projectId: nextProjectId,
          grantId: "api",
          relativePath: "exact revision",
          sha256: data.revisionId,
          sizeBytes: new TextEncoder().encode(data.content).byteLength,
          observedAt: "from API response",
          tombstone: false,
        },
        content: data.content,
      };
    },
  };
}

export function createMvpApi(mode: "contract-fixture" | "http" = "http"): ContractApi {
  return mode === "http" ? createHttpApi() : createFixtureApi();
}

export const FIXTURE_PROJECT_ID = projectId;
export const FIXTURE_MATTER_ID = matterId;
