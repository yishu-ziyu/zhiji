import { randomUUID } from "node:crypto";

export const CHANGE_FIXTURE_TEXT =
  "客户：再加一组 A/B 测试，还是周五上，价格先按之前的。";

export type ChangeImpactKind = "scope" | "delivery_date" | "total_price";
export type ChangeStatus =
  | "draft"
  | "pending_client"
  | "changes_requested"
  | "applied";

export interface EvidenceSpan {
  start: number;
  end: number;
  quote: string;
}

export interface ChangeImpact {
  kind: ChangeImpactKind;
  label: string;
  currentValue: string | number;
  proposedValue: string | number | null;
  explanation: string;
  evidence: EvidenceSpan;
}

export interface PublicChangeProject {
  id: string;
  title: string;
  clientName: string;
  version: number;
  scope: string;
  totalPriceMinor: number;
  paidMinor: number;
  deliveryMilestone: { id: string; date: string };
  paymentMilestone: { id: string; amountMinor: number; trigger: string };
  history: Array<{
    version: number;
    proposalId: string;
    identityAssurance: "guest_link";
    at: string;
  }>;
  updatedAt: string;
}

interface ChangeProject extends PublicChangeProject {
  providerSecret: string;
}

interface AgreementVersion {
  version: number;
  scope: string;
  deliveryDate: string;
  totalPriceMinor: number;
  paidMinor: number;
  finalPaymentMinor: number;
}

export interface ProviderChangeProposal {
  id: string;
  projectId: string;
  revision: number;
  baseVersion: number;
  status: ChangeStatus;
  sourceText: string;
  impacts: ChangeImpact[];
  oldVersion: AgreementVersion;
  newVersion: AgreementVersion | null;
  clientNote?: string;
  clientUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredProposal extends ProviderChangeProposal {
  clientToken?: string;
}

interface ClientGrant {
  token: string;
  proposalId: string;
  revision: number;
  baseVersion: number;
  expiresAt: number;
  consumedAt?: string;
  revokedAt?: string;
}

export interface ClientChangeView {
  proposalId: string;
  projectTitle: string;
  clientName: string;
  revision: number;
  status: ChangeStatus;
  sourceText: string;
  impacts: ChangeImpact[];
  oldVersion: AgreementVersion;
  newVersion: AgreementVersion;
  identityAssurance: "guest_link";
  clientNote?: string;
}

export class ChangeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const globalStore = globalThis as typeof globalThis & {
  __fcOpcChangeStore?: {
    projects: Map<string, ChangeProject>;
    proposals: Map<string, StoredProposal>;
    grants: Map<string, ClientGrant>;
  };
};

const store =
  globalStore.__fcOpcChangeStore ??
  (globalStore.__fcOpcChangeStore = {
    projects: new Map<string, ChangeProject>(),
    proposals: new Map<string, StoredProposal>(),
    grants: new Map<string, ClientGrant>(),
  });

function fail(message: string, status = 400): never {
  throw new ChangeError(message, status);
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function publicProject(project: ChangeProject): PublicChangeProject {
  const { providerSecret, ...publicValue } = project;
  void providerSecret;
  return copy(publicValue);
}

function publicProposal(proposal: StoredProposal): ProviderChangeProposal {
  const { clientToken, ...publicValue } = proposal;
  void clientToken;
  return copy(publicValue);
}

function requireProject(id: string): ChangeProject {
  const project = store.projects.get(id);
  if (!project) fail("项目不存在", 404);
  return project;
}

function requireProvider(project: ChangeProject, providerSecret: string): void {
  if (!providerSecret || providerSecret !== project.providerSecret) {
    fail("服务方凭据无效", 403);
  }
}

function requireProposal(id: string): StoredProposal {
  const proposal = store.proposals.get(id);
  if (!proposal) fail("变化方案不存在", 404);
  return proposal;
}

function agreement(project: ChangeProject): AgreementVersion {
  return {
    version: project.version,
    scope: project.scope,
    deliveryDate: project.deliveryMilestone.date,
    totalPriceMinor: project.totalPriceMinor,
    paidMinor: project.paidMinor,
    finalPaymentMinor: project.paymentMilestone.amountMinor,
  };
}

function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function activeGrant(token: string, allowConsumed = false): ClientGrant {
  const grant = store.grants.get(token);
  if (
    !grant ||
    grant.revokedAt ||
    grant.expiresAt <= Date.now() ||
    (!allowConsumed && grant.consumedAt)
  ) {
    fail("客户链接已使用或已失效", 409);
  }
  return grant;
}

function revokeProposalGrants(proposalId: string, except?: string): void {
  const now = new Date().toISOString();
  for (const grant of store.grants.values()) {
    if (grant.proposalId === proposalId && grant.token !== except && !grant.revokedAt) {
      grant.revokedAt = now;
    }
  }
}

export function createEvidenceSpan(
  sourceText: string,
  exactQuote: string,
): EvidenceSpan {
  const start = sourceText.indexOf(exactQuote);
  if (start === -1) {
    fail("分析结果引用了原消息中不存在的文字", 422);
  }
  return { start, end: start + exactQuote.length, quote: exactQuote };
}

export function createDemoProject(): {
  project: PublicChangeProject;
  providerSecret: string;
} {
  const now = new Date().toISOString();
  const project: ChangeProject = {
    id: randomUUID(),
    providerSecret: randomUUID(),
    title: "落地页改版",
    clientName: "林先生",
    version: 1,
    scope: "单版本落地页",
    totalPriceMinor: 800_000,
    paidMinor: 400_000,
    deliveryMilestone: { id: randomUUID(), date: "2026-07-17" },
    paymentMilestone: {
      id: randomUUID(),
      amountMinor: 400_000,
      trigger: "客户验收后支付",
    },
    history: [],
    updatedAt: now,
  };
  store.projects.set(project.id, project);
  return { project: publicProject(project), providerSecret: project.providerSecret };
}

export function createChangeDraft(input: {
  projectId: string;
  providerSecret: string;
  sourceText: string;
  scopeChange: string;
  scopeQuote: string;
  deliveryQuote: string;
  priceQuote: string;
}): ProviderChangeProposal {
  const project = requireProject(input.projectId);
  requireProvider(project, input.providerSecret);
  const sourceText = input.sourceText.trim();
  if (!sourceText) fail("请提供客户消息");
  const now = new Date().toISOString();
  const oldVersion = agreement(project);
  const proposal: StoredProposal = {
    id: randomUUID(),
    projectId: project.id,
    revision: 1,
    baseVersion: project.version,
    status: "draft",
    sourceText,
    oldVersion,
    newVersion: null,
    impacts: [
      {
        kind: "scope",
        label: "工作范围",
        currentValue: project.scope,
        proposedValue: input.scopeChange.trim() || null,
        explanation: "客户提出了原约定以外的工作。",
        evidence: createEvidenceSpan(sourceText, input.scopeQuote),
      },
      {
        kind: "delivery_date",
        label: "交付日期",
        currentValue: project.deliveryMilestone.date,
        proposedValue: null,
        explanation: "工作增加，但客户仍要求原日期，需要服务方判断是否可行。",
        evidence: createEvidenceSpan(sourceText, input.deliveryQuote),
      },
      {
        kind: "total_price",
        label: "总价和尾款",
        currentValue: project.totalPriceMinor,
        proposedValue: null,
        explanation: "“按之前”无法确定是沿用单价还是总价，不能自动改价。",
        evidence: createEvidenceSpan(sourceText, input.priceQuote),
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  store.proposals.set(proposal.id, proposal);
  return publicProposal(proposal);
}

export function analyzeFixtureChange(
  projectId: string,
  providerSecret: string,
  sourceText = CHANGE_FIXTURE_TEXT,
): ProviderChangeProposal {
  return createChangeDraft({
    projectId,
    providerSecret,
    sourceText,
    scopeChange: "增加一组 A/B 测试",
    scopeQuote: "再加一组 A/B 测试",
    deliveryQuote: "还是周五上",
    priceQuote: "价格先按之前的",
  });
}

export function sendChangeToClient(input: {
  proposalId: string;
  providerSecret: string;
  scope: string;
  deliveryDate: string;
  totalPriceMinor: number;
}): { proposal: ProviderChangeProposal; clientToken: string; revision: number } {
  const proposal = requireProposal(input.proposalId);
  const project = requireProject(proposal.projectId);
  requireProvider(project, input.providerSecret);
  if (proposal.status !== "draft" && proposal.status !== "changes_requested") {
    fail("只有草稿或客户要求修改的方案可以发送");
  }
  const scope = input.scope.trim();
  if (!scope) fail("请填写新的工作范围");
  if (!validDate(input.deliveryDate)) fail("交付日期格式错误");
  if (
    !Number.isSafeInteger(input.totalPriceMinor) ||
    input.totalPriceMinor < project.paidMinor
  ) {
    fail("总价必须是不低于已付款的整数金额");
  }
  if (proposal.baseVersion !== project.version) {
    fail("项目已有更新，请重新分析客户消息", 409);
  }

  const revision = proposal.status === "changes_requested"
    ? proposal.revision + 1
    : proposal.revision;
  const token = randomUUID();
  const now = new Date().toISOString();
  const updated: StoredProposal = {
    ...proposal,
    revision,
    status: "pending_client",
    clientNote: undefined,
    clientToken: token,
    newVersion: {
      version: project.version + 1,
      scope,
      deliveryDate: input.deliveryDate,
      totalPriceMinor: input.totalPriceMinor,
      paidMinor: project.paidMinor,
      finalPaymentMinor: input.totalPriceMinor - project.paidMinor,
    },
    updatedAt: now,
  };
  revokeProposalGrants(proposal.id);
  store.grants.set(token, {
    token,
    proposalId: proposal.id,
    revision,
    baseVersion: project.version,
    expiresAt: Date.now() + 48 * 60 * 60 * 1000,
  });
  store.proposals.set(proposal.id, updated);
  return { proposal: publicProposal(updated), clientToken: token, revision };
}

export function getProviderChange(
  projectId: string,
  providerSecret: string,
): { project: PublicChangeProject; proposal: ProviderChangeProposal | null } {
  const project = requireProject(projectId);
  requireProvider(project, providerSecret);
  const proposal = [...store.proposals.values()]
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    project: publicProject(project),
    proposal: proposal ? publicProposal(proposal) : null,
  };
}

export function getClientChange(token: string): ClientChangeView {
  const grant = activeGrant(token, true);
  const proposal = requireProposal(grant.proposalId);
  const project = requireProject(proposal.projectId);
  if (proposal.revision !== grant.revision || !proposal.newVersion) {
    fail("客户链接已使用或已失效", 409);
  }
  return copy({
    proposalId: proposal.id,
    projectTitle: project.title,
    clientName: project.clientName,
    revision: proposal.revision,
    status: proposal.status,
    sourceText: proposal.sourceText,
    impacts: proposal.impacts,
    oldVersion: proposal.oldVersion,
    newVersion: proposal.newVersion,
    identityAssurance: "guest_link" as const,
    clientNote: proposal.clientNote,
  });
}

export function requestClientChange(
  token: string,
  note?: string,
): ClientChangeView {
  const grant = activeGrant(token);
  const cleanNote = note?.trim();
  if (!cleanNote) fail("请填写修改说明");
  const proposal = requireProposal(grant.proposalId);
  if (proposal.status !== "pending_client" || proposal.revision !== grant.revision) {
    fail("客户链接已使用或已失效", 409);
  }
  const now = new Date().toISOString();
  grant.consumedAt = now;
  proposal.status = "changes_requested";
  proposal.clientNote = cleanNote;
  proposal.updatedAt = now;
  return getClientChange(token);
}

export function confirmClientChange(token: string): {
  project: PublicChangeProject;
  proposal: ProviderChangeProposal;
} {
  const grant = activeGrant(token);
  const proposal = requireProposal(grant.proposalId);
  const project = requireProject(proposal.projectId);
  if (
    proposal.status !== "pending_client" ||
    proposal.revision !== grant.revision
  ) {
    fail("客户链接已使用或已失效", 409);
  }
  if (project.version !== grant.baseVersion || project.version !== proposal.baseVersion) {
    fail("项目已有更新，请服务方重新发送", 409);
  }
  if (!proposal.newVersion) fail("服务方尚未填写新方案");

  const now = new Date().toISOString();
  const nextProject: ChangeProject = {
    ...project,
    version: proposal.newVersion.version,
    scope: proposal.newVersion.scope,
    totalPriceMinor: proposal.newVersion.totalPriceMinor,
    deliveryMilestone: {
      ...project.deliveryMilestone,
      date: proposal.newVersion.deliveryDate,
    },
    paymentMilestone: {
      ...project.paymentMilestone,
      amountMinor: proposal.newVersion.finalPaymentMinor,
    },
    history: [
      ...project.history,
      {
        version: proposal.newVersion.version,
        proposalId: proposal.id,
        identityAssurance: "guest_link",
        at: now,
      },
    ],
    updatedAt: now,
  };
  const nextProposal: StoredProposal = {
    ...proposal,
    status: "applied",
    updatedAt: now,
  };

  // ponytail: single-process all-or-nothing update; use a database transaction before multi-instance deployment.
  store.projects.set(project.id, nextProject);
  store.proposals.set(proposal.id, nextProposal);
  grant.consumedAt = now;
  revokeProposalGrants(proposal.id, token);

  return {
    project: publicProject(nextProject),
    proposal: publicProposal(nextProposal),
  };
}

export function resetChangeStore(): void {
  store.projects.clear();
  store.proposals.clear();
  store.grants.clear();
}
