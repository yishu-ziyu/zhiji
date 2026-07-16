import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

export type WorkspaceBinding = {
  id: string;
  projectId: string;
  displayName: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type StoredWorkspaceBinding = WorkspaceBinding & {
  rootRealPath: string;
  capabilityHash: string;
};

export type AgentRequestOption = {
  id: string;
  label: string;
};

export type AgentRequest = {
  id: string;
  projectId: string;
  bindingId: string;
  bindingRevision: number;
  sessionId: string;
  turnId: string;
  clientRequestId: string;
  status: "pending" | "answered" | "delivered" | "cancelled" | "expired" | "stale";
  relativePath: string;
  fileExcerpt: string;
  fileHash: string;
  question: string;
  options: AgentRequestOption[];
  editableDraft?: string;
  requestHash: string;
  response?: {
    selectedOptionId?: string;
    editedDraft?: string;
    note?: string;
    respondedAt: string;
  };
  deliveredAt?: string;
  staleReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentRequestForAgent = AgentRequest & {
  /** One-time server proof, exposed only by the capability-protected single GET. */
  deliveryChallenge?: string;
};

type AgentDeliverySecret = {
  requestId: string;
  requestHash: string;
  bindingRevision: number;
  sessionId: string;
  turnId: string;
  challenge: string;
};

export class AgentBridgeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentBridgeConflictError";
  }
}

export class AgentBridgeStaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentBridgeStaleError";
  }
}

export type AgentBridgeLockErrorCode =
  | "AGENT_BRIDGE_LOCK_BUSY"
  | "AGENT_BRIDGE_RECOVERY_REQUIRED";

export type AgentBridgeLockErrorReason =
  | "claim-live-or-ambiguous"
  | "claim-release-failed"
  | "lost-race"
  | "owner-io-unknown"
  | "owner-live-or-ambiguous";

export class AgentBridgeLockError extends AgentBridgeConflictError {
  readonly code: AgentBridgeLockErrorCode;
  readonly reason: AgentBridgeLockErrorReason;
  readonly retryable: boolean;

  constructor(input: {
    code: AgentBridgeLockErrorCode;
    reason: AgentBridgeLockErrorReason;
    retryable: boolean;
  }) {
    super(
      input.code === "AGENT_BRIDGE_LOCK_BUSY"
        ? "Agent Bridge 锁正在使用"
        : "Agent Bridge 锁需要手动恢复",
    );
    this.name = "AgentBridgeLockError";
    this.code = input.code;
    this.reason = input.reason;
    this.retryable = input.retryable;
  }
}

function recoveryRequired(
  reason: Exclude<AgentBridgeLockErrorReason, "owner-live-or-ambiguous">,
): AgentBridgeLockError {
  return new AgentBridgeLockError({
    code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
    reason,
    retryable: false,
  });
}

function lockBusy(): AgentBridgeLockError {
  return new AgentBridgeLockError({
    code: "AGENT_BRIDGE_LOCK_BUSY",
    reason: "owner-live-or-ambiguous",
    retryable: true,
  });
}

function resolveBridgeDir(): string {
  const knowledgeDir = process.env.KNOWLEDGE_DATA_DIR
    ? path.resolve(process.env.KNOWLEDGE_DATA_DIR)
    : path.join(process.cwd(), "data", "knowledge");
  return path.join(knowledgeDir, "agent-bridge");
}

function bindingsDir(): string {
  return path.join(resolveBridgeDir(), "bindings");
}

function capabilitiesDir(): string {
  return path.join(resolveBridgeDir(), "capabilities");
}

function bindingFile(projectId: string): string {
  return path.join(bindingsDir(), `${encodeURIComponent(projectId)}.json`);
}

function assertSafeIdentifier(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
    throw new Error(`${label}标识无效`);
  }
  return value;
}

function capabilityFile(bindingId: string): string {
  return path.join(
    capabilitiesDir(),
    `${assertSafeIdentifier(bindingId, "Agent 目录授权")}.token`,
  );
}

function requestsDir(): string {
  return path.join(resolveBridgeDir(), "requests");
}

function requestFile(requestId: string): string {
  return path.join(
    requestsDir(),
    `${assertSafeIdentifier(requestId, "Agent 请求")}.json`,
  );
}

function deliverySecretFile(requestId: string): string {
  return path.join(
    requestsDir(),
    `${assertSafeIdentifier(requestId, "Agent 请求")}.delivery-secret`,
  );
}

function readDeliverySecret(requestId: string): AgentDeliverySecret | null {
  try {
    return JSON.parse(
      fs.readFileSync(deliverySecretFile(requestId), "utf8"),
    ) as AgentDeliverySecret;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("无法读取 Agent 交付凭据", { cause: error });
  }
}

function cleanupDeliverySecretBestEffort(requestId: string): void {
  try {
    fs.rmSync(deliverySecretFile(requestId), { force: true });
  } catch {
    // Request JSON is authoritative; cleanup must not replace its domain result.
  }
}

function readRequest(file: string): AgentRequest {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as AgentRequest;
  } catch (error) {
    throw new Error("无法读取 Agent 请求记录", { cause: error });
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    // EPERM and unknown inspection failures are fail-closed.
    return true;
  }
}

const PROJECT_GENERATION_LOCK_WAIT_MS = 30_000;

type LockOwner = {
  pid: number;
  token?: string;
  raw: string;
};

function newLockOwner(): LockOwner {
  const token = randomBytes(32).toString("hex");
  return {
    pid: process.pid,
    token,
    raw: `${JSON.stringify({ pid: process.pid, token })}\n`,
  };
}

function parseLockOwner(raw: string): LockOwner | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as { pid?: unknown; token?: unknown };
    if (
      Number.isInteger(parsed.pid)
      && (parsed.pid as number) > 0
      && typeof parsed.token === "string"
      && /^[a-f0-9]{64}$/.test(parsed.token)
    ) {
      return { pid: parsed.pid as number, token: parsed.token, raw };
    }
  } catch {
    // Fall through to the legacy pid-only format.
  }
  const legacyPid = Number(trimmed);
  return Number.isInteger(legacyPid) && legacyPid > 0
    ? { pid: legacyPid, raw }
    : null;
}

function readLockOwner(ownerFile: string): LockOwner | null {
  try {
    return parseLockOwner(fs.readFileSync(ownerFile, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function lockOwnerMatches(actual: LockOwner | null, expected: LockOwner): boolean {
  if (!actual) return false;
  if (expected.token) {
    return actual.pid === expected.pid && actual.token === expected.token;
  }
  return actual.raw === expected.raw;
}

function lockOwnerExactlyMatches(
  actual: LockOwner | null,
  expected: LockOwner,
): boolean {
  return lockOwnerMatches(actual, expected) && actual?.raw === expected.raw;
}

function publishLockOwner(lockPath: string, owner: LockOwner): boolean {
  const stagingFile = `${lockPath}.${owner.token}.tmp`;
  fs.writeFileSync(stagingFile, owner.raw, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  try {
    fs.linkSync(stagingFile, lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    fs.rmSync(stagingFile, { force: true });
  }
}

function readProjectLockOwner(lockPath: string): LockOwner | null {
  try {
    return readLockOwner(
      fs.lstatSync(lockPath).isDirectory()
        ? path.join(lockPath, "owner")
        : lockPath,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

type LockRecoveryResult = "recovered" | "active" | "blocked";
type RecoveryAttempt = { used: boolean };

type RecoveryClaim = {
  file: string;
  owner: LockOwner;
};

type RecoveryClaimEvent = {
  operation: "acquire" | "release";
  pid: number;
  token: string;
};

function appendRecoveryClaimEvent(
  file: string,
  event: RecoveryClaimEvent,
): void {
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    flag: "a",
    mode: 0o600,
  });
}

function readActiveRecoveryClaim(file: string): RecoveryClaimEvent | null {
  const released = new Set<string>();
  const acquired: RecoveryClaimEvent[] = [];
  const acquiredByToken = new Map<string, RecoveryClaimEvent>();
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw recoveryRequired("claim-live-or-ambiguous");
  }
  if (raw && !raw.endsWith("\n")) {
    throw recoveryRequired("claim-live-or-ambiguous");
  }
  for (const line of raw.split("\n")) {
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw recoveryRequired("claim-live-or-ambiguous");
    }
    if (!parsed || typeof parsed !== "object") {
      throw recoveryRequired("claim-live-or-ambiguous");
    }
    const event = parsed as RecoveryClaimEvent;
    if (
      (event.operation !== "acquire" && event.operation !== "release")
      || !Number.isInteger(event.pid)
      || event.pid <= 0
      || typeof event.token !== "string"
      || !/^[a-f0-9]{64}$/.test(event.token)
    ) {
      throw recoveryRequired("claim-live-or-ambiguous");
    }
    if (event.operation === "acquire") {
      if (acquiredByToken.has(event.token)) {
        throw recoveryRequired("claim-live-or-ambiguous");
      }
      acquiredByToken.set(event.token, event);
      acquired.push(event);
      continue;
    }
    const acquire = acquiredByToken.get(event.token);
    if (!acquire || acquire.pid !== event.pid || released.has(event.token)) {
      throw recoveryRequired("claim-live-or-ambiguous");
    }
    released.add(event.token);
  }
  return acquired.find(
    (event) => !released.has(event.token) && isProcessAlive(event.pid),
  ) ?? null;
}

/**
 * O_APPEND record order is the recovery mutex. One business call checks once
 * before appending and makes at most one acquire/release attempt.
 */
function tryAcquireRecoveryClaim(lockPath: string): RecoveryClaim {
  const file = `${lockPath}.recovery`;
  if (readActiveRecoveryClaim(file)) {
    throw recoveryRequired("claim-live-or-ambiguous");
  }
  const owner = newLockOwner();
  try {
    appendRecoveryClaimEvent(file, {
      operation: "acquire",
      pid: owner.pid,
      token: owner.token!,
    });
  } catch {
    throw recoveryRequired("claim-live-or-ambiguous");
  }
  const active = readActiveRecoveryClaim(file);
  if (active?.pid === owner.pid && active.token === owner.token) {
    return { file, owner };
  }
  try {
    appendRecoveryClaimEvent(file, {
      operation: "release",
      pid: owner.pid,
      token: owner.token!,
    });
  } catch {
    throw recoveryRequired("claim-release-failed");
  }
  throw recoveryRequired("lost-race");
}

function releaseRecoveryClaim(claim: RecoveryClaim): void {
  try {
    appendRecoveryClaimEvent(claim.file, {
      operation: "release",
      pid: claim.owner.pid,
      token: claim.owner.token!,
    });
  } catch {
    throw recoveryRequired("claim-release-failed");
  }
}

function releaseOwnedRequestLock(lockFile: string, owner: LockOwner): void {
  try {
    if (lockOwnerMatches(readLockOwner(lockFile), owner)) {
      fs.rmSync(lockFile, { force: true });
    }
  } catch {
    // The lock was concurrently recovered or already released.
  }
}

function recoverAbandonedRequestLock(
  lockFile: string,
  attempt: RecoveryAttempt,
): LockRecoveryResult {
  let observed: LockOwner | null;
  try {
    observed = readLockOwner(lockFile);
    if (!observed) return "active";
    if (observed && isProcessAlive(observed.pid)) return "active";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "recovered"
      : "active";
  }
  if (attempt.used) return "blocked";
  attempt.used = true;
  const claim = tryAcquireRecoveryClaim(lockFile);
  try {
    let current: LockOwner | null;
    try {
      current = readLockOwner(lockFile);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "recovered"
        : "blocked";
    }
    if (!lockOwnerExactlyMatches(current, observed)) return "blocked";
    if (isProcessAlive(current!.pid)) return "blocked";
    try {
      fs.rmSync(lockFile, { force: true });
    } catch {
      throw recoveryRequired("owner-io-unknown");
    }
    return "recovered";
  } finally {
    releaseRecoveryClaim(claim);
  }
}

function withRequestLock<T>(requestId: string, operation: () => T): T {
  fs.mkdirSync(requestsDir(), { recursive: true });
  const lockFile = `${requestFile(requestId)}.lock`;
  const owner = newLockOwner();
  const recoveryAttempt: RecoveryAttempt = { used: false };
  while (true) {
    if (publishLockOwner(lockFile, owner)) break;
    const recovery = recoverAbandonedRequestLock(lockFile, recoveryAttempt);
    if (recovery === "recovered") continue;
    throw lockBusy();
  }
  try {
    return operation();
  } finally {
    releaseOwnedRequestLock(lockFile, owner);
  }
}

function releaseOwnedProjectLock(lockPath: string, owner: LockOwner): void {
  try {
    if (lockOwnerMatches(readProjectLockOwner(lockPath), owner)) {
      fs.rmSync(lockPath, { recursive: true, force: true });
    }
  } catch {
    // The lock was concurrently recovered or already released.
  }
}

function recoverAbandonedProjectLock(
  lockPath: string,
  attempt: RecoveryAttempt,
): LockRecoveryResult {
  let observed: LockOwner | null;
  try {
    observed = readProjectLockOwner(lockPath);
    if (!observed) return "active";
    if (observed && isProcessAlive(observed.pid)) return "active";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "recovered"
      : "active";
  }
  if (attempt.used) return "blocked";
  attempt.used = true;
  const claim = tryAcquireRecoveryClaim(lockPath);
  try {
    let current: LockOwner | null;
    try {
      current = readProjectLockOwner(lockPath);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "recovered"
        : "blocked";
    }
    if (!lockOwnerExactlyMatches(current, observed)) return "blocked";
    if (isProcessAlive(current!.pid)) return "blocked";
    try {
      fs.rmSync(lockPath, { recursive: true, force: true });
    } catch {
      throw recoveryRequired("owner-io-unknown");
    }
    return "recovered";
  } finally {
    releaseRecoveryClaim(claim);
  }
}

/**
 * Serialize binding generation and every request operation for one project.
 * A fully written owner is linked into the fixed path in one atomic publication.
 * Legacy directory/pid locks remain recoverable.
 */
function withProjectGenerationLock<T>(projectId: string, operation: () => T): T {
  fs.mkdirSync(bindingsDir(), { recursive: true });
  const lockPath = `${bindingFile(projectId)}.lockdir`;
  const deadline = Date.now() + PROJECT_GENERATION_LOCK_WAIT_MS;
  const owner = newLockOwner();
  const recoveryAttempt: RecoveryAttempt = { used: false };
  while (true) {
    if (publishLockOwner(lockPath, owner)) break;
    if (Date.now() >= deadline) {
      throw lockBusy();
    }
    const recovery = recoverAbandonedProjectLock(lockPath, recoveryAttempt);
    if (recovery === "recovered") continue;
    if (recovery === "blocked") throw lockBusy();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
  try {
    return operation();
  } finally {
    releaseOwnedProjectLock(lockPath, owner);
  }
}

function findRequestByClientKey(input: {
  projectId: string;
  sessionId: string;
  turnId: string;
  clientRequestId: string;
}): AgentRequest | null {
  let files: string[];
  try {
    files = fs.readdirSync(requestsDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const request = readRequest(path.join(requestsDir(), file));
    if (
      request.projectId === input.projectId &&
      request.sessionId === input.sessionId &&
      request.turnId === input.turnId &&
      request.clientRequestId === input.clientRequestId
    ) {
      return request;
    }
  }
  return null;
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function writeJsonExclusiveAtomic(file: string, value: unknown): boolean {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    try {
      fs.linkSync(temporary, file);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function publicBinding(binding: StoredWorkspaceBinding): WorkspaceBinding {
  const {
    id,
    projectId,
    displayName,
    revision,
    createdAt,
    updatedAt,
  } = binding;
  return { id, projectId, displayName, revision, createdAt, updatedAt };
}

function writeCapability(bindingId: string, capability: string): void {
  fs.mkdirSync(capabilitiesDir(), { recursive: true });
  const file = capabilityFile(bindingId);
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, capability, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function readStoredBinding(projectId: string): StoredWorkspaceBinding | null {
  try {
    return JSON.parse(
      fs.readFileSync(bindingFile(projectId), "utf8"),
    ) as StoredWorkspaceBinding;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("无法读取项目目录授权", { cause: error });
  }
}

function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertCapability(
  binding: StoredWorkspaceBinding,
  capability: string,
): void {
  const actual = Buffer.from(hash(capability));
  const expected = Buffer.from(binding.capabilityHash);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Agent capability 无效");
  }
}

function requiredText(value: string, label: string, maxBytes: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label}不能为空`);
  if (Buffer.byteLength(trimmed, "utf8") > maxBytes) {
    throw new Error(`${label}过长`);
  }
  return trimmed;
}

function requiredExactIdentity(
  value: unknown,
  label: string,
  maxBytes: number,
): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || Buffer.byteLength(value, "utf8") > maxBytes
  ) {
    throw new Error(`${label} 无效`);
  }
  return value;
}

function requiredDeliveryChallenge(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value)) {
    throw new Error("deliveryChallenge 无效");
  }
  return value;
}

function deliverySecretMatchesRequest(
  secret: AgentDeliverySecret,
  request: AgentRequest,
): boolean {
  return secret.requestId === request.id
    && secret.requestHash === request.requestHash
    && secret.bindingRevision === request.bindingRevision
    && secret.sessionId === request.sessionId
    && secret.turnId === request.turnId
    && /^[a-f0-9]{32}$/.test(secret.challenge);
}

function readMarkdownContext(
  binding: StoredWorkspaceBinding,
  relativePathInput: string,
): { relativePath: string; fileExcerpt: string; fileHash: string } {
  if (path.isAbsolute(relativePathInput)) {
    throw new Error("文件路径必须相对于已授权目录");
  }
  const relativePath = path.normalize(relativePathInput).replaceAll("\\", "/");
  if (
    !relativePath ||
    relativePath === "." ||
    relativePath.startsWith("../") ||
    path.extname(relativePath).toLowerCase() !== ".md"
  ) {
    throw new Error("只能读取已授权目录下的 Markdown 文件");
  }

  const candidate = fs.realpathSync(path.join(binding.rootRealPath, relativePath));
  const rootPrefix = `${binding.rootRealPath}${path.sep}`;
  if (candidate !== binding.rootRealPath && !candidate.startsWith(rootPrefix)) {
    throw new Error("文件超出已授权目录");
  }
  const stat = fs.statSync(candidate);
  if (!stat.isFile()) throw new Error("请求上下文必须是文件");
  if (stat.size > 1024 * 1024) throw new Error("Markdown 文件超过 1 MiB");
  const contentBytes = fs.readFileSync(candidate);
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(contentBytes);
  } catch (error) {
    throw new Error("Markdown 文件必须是有效 UTF-8", { cause: error });
  }
  let excerptEnd = Math.min(contentBytes.length, 20 * 1024);
  let fileExcerpt = "";
  while (excerptEnd >= 0) {
    try {
      fileExcerpt = new TextDecoder("utf-8", { fatal: true }).decode(
        contentBytes.subarray(0, excerptEnd),
      );
      break;
    } catch {
      excerptEnd -= 1;
    }
  }
  return {
    relativePath,
    fileExcerpt,
    fileHash: hash(contentBytes),
  };
}

export function bindWorkspace(input: {
  projectId: string;
  rootPath: string;
  now?: string;
}): WorkspaceBinding {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("项目不能为空");
  const rootRealPath = fs.realpathSync(input.rootPath);
  if (!fs.statSync(rootRealPath).isDirectory()) {
    throw new Error("授权对象必须是目录");
  }

  const now = input.now ?? new Date().toISOString();

  // Same-project rebind is process-serialized so revision is unique + strictly increasing,
  // and capability token / binding hash stay the same generation.
  return withProjectGenerationLock(projectId, () => {
    const existing = readStoredBinding(projectId);
    const id = existing?.id ?? `workspace_${randomUUID()}`;
    const capability = randomBytes(32).toString("hex");
    const capabilityHash = createHash("sha256").update(capability).digest("hex");
    const binding: StoredWorkspaceBinding = {
      id,
      projectId,
      displayName: path.basename(rootRealPath),
      revision: (existing?.revision ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      rootRealPath,
      capabilityHash,
    };

    // Under lock: binding first (new hash), then capability token of the same generation.
    // Concurrent project-generation operations are excluded, so revision is unique + increasing.
    writeJsonAtomic(bindingFile(projectId), binding);
    writeCapability(id, capability);

    const published = readStoredBinding(projectId);
    if (
      !published
      || published.revision !== binding.revision
      || published.capabilityHash !== capabilityHash
      || published.id !== id
    ) {
      throw new Error("项目目录授权写入后状态不一致");
    }
    const publishedCapability = fs
      .readFileSync(capabilityFile(id), "utf8")
      .trim();
    if (hash(publishedCapability) !== capabilityHash) {
      throw new Error("项目目录授权与 capability 不是同一代");
    }

    if (existing) {
      invalidateUndeliveredRequestsForProject(projectId, {
        reason: "项目目录授权已变更",
        now,
      });
    }
    return publicBinding(binding);
  });
}

function isUndeliveredStatus(status: AgentRequest["status"]): boolean {
  return status === "pending" || status === "answered";
}

/** Mark pending/answered requests stale (rebind, file drift, or agent access after invalidation). */
function invalidateUndeliveredRequestsForProject(
  projectId: string,
  options: { reason: string; now?: string },
): void {
  let files: string[];
  try {
    files = fs.readdirSync(requestsDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const now = options.now ?? new Date().toISOString();
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const requestId = file.slice(0, -".json".length);
    const full = path.join(requestsDir(), file);
    if (readRequest(full).projectId !== projectId) continue;
    withRequestLock(requestId, () => {
      const request = readRequest(full);
      if (request.projectId !== projectId) return;
      if (!isUndeliveredStatus(request.status)) {
        cleanupDeliverySecretBestEffort(request.id);
        return;
      }
      request.status = "stale";
      request.staleReason = options.reason;
      request.updatedAt = now;
      writeJsonAtomic(full, request);
      cleanupDeliverySecretBestEffort(request.id);
    });
  }
}

/**
 * For undelivered requests: ensure binding revision still matches and source file unchanged.
 * Marks stale and throws when invalid. Concurrent-safe when called under withRequestLock.
 */
function assertUndeliveredRequestStillValid(
  request: AgentRequest,
  binding: StoredWorkspaceBinding,
  now?: string,
): void {
  if (!isUndeliveredStatus(request.status)) return;

  if (
    binding.id !== request.bindingId ||
    binding.revision !== request.bindingRevision
  ) {
    request.status = "stale";
    request.staleReason = "项目目录授权已变更";
    request.updatedAt = now ?? new Date().toISOString();
    writeJsonAtomic(requestFile(request.id), request);
    cleanupDeliverySecretBestEffort(request.id);
    throw new AgentBridgeStaleError(request.staleReason);
  }

  let context: ReturnType<typeof readMarkdownContext>;
  try {
    context = readMarkdownContext(binding, request.relativePath);
  } catch {
    request.status = "stale";
    request.staleReason = "来源文件已删除或越界";
    request.updatedAt = now ?? new Date().toISOString();
    writeJsonAtomic(requestFile(request.id), request);
    cleanupDeliverySecretBestEffort(request.id);
    throw new AgentBridgeStaleError(request.staleReason);
  }
  if (context.fileHash !== request.fileHash) {
    request.status = "stale";
    request.staleReason = "来源文件已变更";
    request.updatedAt = now ?? new Date().toISOString();
    writeJsonAtomic(requestFile(request.id), request);
    cleanupDeliverySecretBestEffort(request.id);
    throw new AgentBridgeStaleError(request.staleReason);
  }
}

export function getWorkspaceBinding(projectId: string): WorkspaceBinding | null {
  const binding = readStoredBinding(projectId);
  return binding ? publicBinding(binding) : null;
}

export function readAgentCapability(bindingId: string): string {
  return fs.readFileSync(capabilityFile(bindingId), "utf8").trim();
}

function createAgentRequestUnderProjectLock(input: {
  projectId: string;
  bindingId: string;
  capability: string;
  sessionId: string;
  turnId: string;
  clientRequestId: string;
  relativePath: string;
  question: string;
  options: AgentRequestOption[];
  editableDraft?: string;
  now?: string;
}): AgentRequest {
  const binding = readStoredBinding(input.projectId);
  if (!binding || binding.id !== input.bindingId) {
    throw new Error("项目没有匹配的目录授权");
  }
  assertCapability(binding, input.capability);
  const sessionId = requiredText(input.sessionId, "Agent sessionId", 500);
  const turnId = requiredText(input.turnId, "Agent turnId", 500);
  const clientRequestId = requiredText(
    input.clientRequestId,
    "clientRequestId",
    500,
  );
  const question = requiredText(input.question, "问题", 2 * 1024);
  if (input.options.length < 2 || input.options.length > 8) {
    throw new Error("选项数量必须在 2 到 8 之间");
  }
  const options = input.options.map((option) => ({
    id: requiredText(option.id, "选项 id", 200),
    label: requiredText(option.label, "选项", 500),
  }));
  if (new Set(options.map((option) => option.id)).size !== options.length) {
    throw new Error("选项 id 不能重复");
  }
  const editableDraft = input.editableDraft?.trim();
  if (editableDraft && Buffer.byteLength(editableDraft, "utf8") > 10 * 1024) {
    throw new Error("可编辑草稿过长");
  }
  const context = readMarkdownContext(binding, input.relativePath);
  const requestHash = hash(
    JSON.stringify({
      bindingRevision: binding.revision,
      relativePath: context.relativePath,
      fileHash: context.fileHash,
      question,
      options,
      editableDraft,
    }),
  );
  const existing = findRequestByClientKey({
    projectId: input.projectId,
    sessionId,
    turnId,
    clientRequestId,
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AgentBridgeConflictError(
        "clientRequestId 已用于不同的 Agent 请求",
      );
    }
    return structuredClone(existing);
  }
  const now = input.now ?? new Date().toISOString();
  const idempotencyKey = JSON.stringify({
    projectId: input.projectId,
    sessionId,
    turnId,
    clientRequestId,
  });
  const request: AgentRequest = {
    id: `request_${hash(idempotencyKey)}`,
    projectId: input.projectId,
    bindingId: binding.id,
    bindingRevision: binding.revision,
    sessionId,
    turnId,
    clientRequestId,
    status: "pending",
    ...context,
    question,
    options,
    editableDraft,
    requestHash,
    createdAt: now,
    updatedAt: now,
  };
  const file = requestFile(request.id);
  if (!writeJsonExclusiveAtomic(file, request)) {
    const concurrent = readRequest(file);
    if (
      concurrent.projectId === input.projectId &&
      concurrent.sessionId === sessionId &&
      concurrent.turnId === turnId &&
      concurrent.clientRequestId === clientRequestId &&
      concurrent.requestHash === requestHash
    ) {
      return structuredClone(concurrent);
    }
    throw new AgentBridgeConflictError(
      "clientRequestId 已用于不同的 Agent 请求",
    );
  }
  return structuredClone(request);
}

export function createAgentRequest(
  input: Parameters<typeof createAgentRequestUnderProjectLock>[0],
): AgentRequest {
  return withProjectGenerationLock(input.projectId, () =>
    createAgentRequestUnderProjectLock(input));
}

export function getAgentRequest(
  projectId: string,
  requestId: string,
): AgentRequest | null {
  try {
    const request = readRequest(requestFile(requestId));
    if (request.projectId !== projectId) return null;
    if (!isUndeliveredStatus(request.status)) {
      cleanupDeliverySecretBestEffort(request.id);
    }
    return structuredClone(request);
  } catch (error) {
    if ((error as Error).cause &&
      ((error as Error).cause as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function listAgentRequests(projectId: string): AgentRequest[] {
  let files: string[];
  try {
    files = fs.readdirSync(requestsDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const requests = files
    .filter((file) => file.endsWith(".json"))
    .map((file) => readRequest(path.join(requestsDir(), file)))
    .filter((request) => request.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const request of requests) {
    if (!isUndeliveredStatus(request.status)) {
      cleanupDeliverySecretBestEffort(request.id);
    }
  }
  return requests.map((request) => structuredClone(request));
}

function getAgentRequestForAgentUnderProjectLock(input: {
  projectId: string;
  requestId: string;
  bindingId: string;
  capability: string;
}): AgentRequestForAgent {
  return withRequestLock(input.requestId, () => {
    const binding = readStoredBinding(input.projectId);
    if (!binding || binding.id !== input.bindingId) {
      throw new Error("项目没有匹配的目录授权");
    }
    assertCapability(binding, input.capability);
    let request: AgentRequest;
    try {
      request = readRequest(requestFile(input.requestId));
    } catch (error) {
      if (
        (error as Error).cause &&
        ((error as Error).cause as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        throw new Error("Agent 请求不存在");
      }
      throw error;
    }
    if (request.projectId !== input.projectId || request.bindingId !== binding.id) {
      throw new Error("Agent 请求不存在");
    }
    if (request.status !== "answered") {
      cleanupDeliverySecretBestEffort(request.id);
    }
    if (request.status === "stale") {
      throw new AgentBridgeStaleError(
        request.staleReason || "Agent 请求已失效",
      );
    }
    assertUndeliveredRequestStillValid(request, binding);
    const agentRequest: AgentRequestForAgent = structuredClone(request);
    if (request.status === "answered") {
      const secret = readDeliverySecret(request.id);
      if (!secret || !deliverySecretMatchesRequest(secret, request)) {
        throw new AgentBridgeConflictError("Agent 交付凭据不可用");
      }
      agentRequest.deliveryChallenge = secret.challenge;
    }
    return agentRequest;
  });
}

export function getAgentRequestForAgent(
  input: Parameters<typeof getAgentRequestForAgentUnderProjectLock>[0],
): AgentRequestForAgent {
  return withProjectGenerationLock(input.projectId, () =>
    getAgentRequestForAgentUnderProjectLock(input));
}

function respondToAgentRequestUnderProjectLock(input: {
  projectId: string;
  requestId: string;
  requestHash: string;
  selectedOptionId?: string;
  editedDraft?: string;
  note?: string;
  now?: string;
}): AgentRequest {
  return withRequestLock(input.requestId, () => {
    const request = readRequest(requestFile(input.requestId));
    if (request.projectId !== input.projectId) {
      throw new Error("Agent 请求不属于当前项目");
    }
    if (request.requestHash !== input.requestHash) {
      throw new AgentBridgeConflictError("Agent 请求版本已变更");
    }
    if (request.status !== "pending") {
      throw new AgentBridgeConflictError("Agent 请求已经回应或结束");
    }
    // A failed answer publication can leave a sidecar beside authoritative pending JSON.
    cleanupDeliverySecretBestEffort(request.id);
    const binding = readStoredBinding(input.projectId);
    if (
      !binding ||
      binding.id !== request.bindingId ||
      binding.revision !== request.bindingRevision
    ) {
      request.status = "stale";
      request.staleReason = "项目目录授权已变更";
      request.updatedAt = input.now ?? new Date().toISOString();
      writeJsonAtomic(requestFile(request.id), request);
      cleanupDeliverySecretBestEffort(request.id);
      throw new AgentBridgeStaleError(request.staleReason);
    }
    let context: ReturnType<typeof readMarkdownContext>;
    try {
      context = readMarkdownContext(binding, request.relativePath);
    } catch {
      request.status = "stale";
      request.staleReason = "来源文件已删除或越界";
      request.updatedAt = input.now ?? new Date().toISOString();
      writeJsonAtomic(requestFile(request.id), request);
      cleanupDeliverySecretBestEffort(request.id);
      throw new AgentBridgeStaleError(request.staleReason);
    }
    if (context.fileHash !== request.fileHash) {
      request.status = "stale";
      request.staleReason = "来源文件已变更";
      request.updatedAt = input.now ?? new Date().toISOString();
      writeJsonAtomic(requestFile(request.id), request);
      cleanupDeliverySecretBestEffort(request.id);
      throw new AgentBridgeStaleError(request.staleReason);
    }
    const selectedOptionId = input.selectedOptionId?.trim();
    if (
      selectedOptionId &&
      !request.options.some((option) => option.id === selectedOptionId)
    ) {
      throw new Error("选择的选项不存在");
    }
    const editedDraft = input.editedDraft?.trim();
    if (editedDraft && Buffer.byteLength(editedDraft, "utf8") > 10 * 1024) {
      throw new Error("可编辑草稿过长");
    }
    const note = input.note?.trim();
    if (note && Buffer.byteLength(note, "utf8") > 2 * 1024) {
      throw new Error("补充说明过长");
    }
    if (!selectedOptionId && !editedDraft) {
      throw new Error("请选择一项或写明回应");
    }
    const now = input.now ?? new Date().toISOString();
    request.status = "answered";
    request.response = {
      selectedOptionId,
      editedDraft,
      note,
      respondedAt: now,
    };
    request.updatedAt = now;
    const secret: AgentDeliverySecret = {
      requestId: request.id,
      requestHash: request.requestHash,
      bindingRevision: request.bindingRevision,
      sessionId: request.sessionId,
      turnId: request.turnId,
      challenge: randomBytes(16).toString("hex"),
    };
    writeJsonAtomic(deliverySecretFile(request.id), secret);
    try {
      writeJsonAtomic(requestFile(request.id), request);
    } catch (error) {
      cleanupDeliverySecretBestEffort(request.id);
      throw error;
    }
    return structuredClone(request);
  });
}

export function respondToAgentRequest(
  input: Parameters<typeof respondToAgentRequestUnderProjectLock>[0],
): AgentRequest {
  return withProjectGenerationLock(input.projectId, () =>
    respondToAgentRequestUnderProjectLock(input));
}

function acknowledgeAgentRequestUnderProjectLock(input: {
  projectId: string;
  requestId: string;
  bindingId: string;
  capability: string;
  requestHash: string;
  /** Session identifier carried by the matching protocol ACK tuple. */
  sessionId: unknown;
  /** Turn identifier carried by the matching protocol ACK tuple. */
  turnId: unknown;
  /** Binding revision captured on the request at create time. */
  bindingRevision: unknown;
  /** One-time proof returned by the capability-protected single request GET. */
  deliveryChallenge: unknown;
  now?: string;
}): AgentRequest {
  return withRequestLock(input.requestId, () => {
    const binding = readStoredBinding(input.projectId);
    if (!binding || binding.id !== input.bindingId) {
      throw new Error("项目没有匹配的目录授权");
    }
    assertCapability(binding, input.capability);
    const request = readRequest(requestFile(input.requestId));
    if (request.projectId !== input.projectId) {
      throw new Error("Agent 请求不存在");
    }
    if (request.status === "delivered") {
      cleanupDeliverySecretBestEffort(request.id);
      throw new AgentBridgeConflictError("Agent 回应已经交付");
    }
    if (request.status === "stale") {
      cleanupDeliverySecretBestEffort(request.id);
      throw new AgentBridgeStaleError(
        request.staleReason || "Agent 请求已失效",
      );
    }
    if (request.status !== "answered") {
      cleanupDeliverySecretBestEffort(request.id);
      throw new AgentBridgeConflictError("Agent 请求尚未得到回应");
    }
    const now = input.now ?? new Date().toISOString();
    // Drift wins over proof errors because authoritative answered JSON is now stale.
    assertUndeliveredRequestStillValid(request, binding, now);
    if (request.bindingId !== input.bindingId) {
      throw new Error("Agent 请求不存在");
    }
    if (request.requestHash !== input.requestHash) {
      throw new AgentBridgeConflictError("Agent 请求版本已变更");
    }
    const sessionId = requiredExactIdentity(
      input.sessionId,
      "Agent sessionId",
      500,
    );
    const turnId = requiredExactIdentity(input.turnId, "Agent turnId", 500);
    if (
      typeof input.bindingRevision !== "number"
      || !Number.isSafeInteger(input.bindingRevision)
      || input.bindingRevision <= 0
    ) {
      throw new Error("bindingRevision 无效");
    }
    // Delivery requires an exact matching protocol ACK tuple, not capability alone.
    if (
      request.sessionId !== sessionId
      || request.turnId !== turnId
      || request.bindingRevision !== input.bindingRevision
    ) {
      throw new AgentBridgeConflictError(
        "Agent 请求不属于当前 session/turn 或绑定版本",
      );
    }
    const challenge = requiredDeliveryChallenge(input.deliveryChallenge);
    const secret = readDeliverySecret(request.id);
    if (!secret || !deliverySecretMatchesRequest(secret, request)) {
      throw new AgentBridgeConflictError("Agent 交付凭据不可用");
    }
    const actual = Buffer.from(challenge, "utf8");
    const expected = Buffer.from(secret.challenge, "utf8");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new AgentBridgeConflictError("deliveryChallenge 不匹配");
    }
    request.status = "delivered";
    request.deliveredAt = now;
    request.updatedAt = now;
    writeJsonAtomic(requestFile(request.id), request);
    cleanupDeliverySecretBestEffort(request.id);
    return structuredClone(request);
  });
}

export function acknowledgeAgentRequest(
  input: Parameters<typeof acknowledgeAgentRequestUnderProjectLock>[0],
): AgentRequest {
  return withProjectGenerationLock(input.projectId, () =>
    acknowledgeAgentRequestUnderProjectLock(input));
}

function cancelAgentRequestUnderProjectLock(input: {
  projectId: string;
  requestId: string;
  bindingId: string;
  capability: string;
  requestHash: string;
  outcome: "cancelled" | "expired";
  now?: string;
}): AgentRequest {
  return withRequestLock(input.requestId, () => {
    if (input.outcome !== "cancelled" && input.outcome !== "expired") {
      throw new Error("Agent 请求结束状态无效");
    }
    const binding = readStoredBinding(input.projectId);
    if (!binding || binding.id !== input.bindingId) {
      throw new Error("项目没有匹配的目录授权");
    }
    assertCapability(binding, input.capability);
    const request = readRequest(requestFile(input.requestId));
    if (
      request.projectId !== input.projectId ||
      request.bindingId !== input.bindingId
    ) {
      throw new Error("Agent 请求不存在");
    }
    if (request.requestHash !== input.requestHash) {
      throw new AgentBridgeConflictError("Agent 请求版本已变更");
    }
    if (request.status === "stale") {
      cleanupDeliverySecretBestEffort(request.id);
      throw new AgentBridgeStaleError(
        request.staleReason || "Agent 请求已失效",
      );
    }
    if (request.status !== "pending") {
      if (request.status !== "answered") {
        cleanupDeliverySecretBestEffort(request.id);
      }
      throw new AgentBridgeConflictError("Agent 请求已经回应或结束");
    }
    cleanupDeliverySecretBestEffort(request.id);
    const now = input.now ?? new Date().toISOString();
    // Do not cancel into cancelled/expired after rebind or source drift.
    assertUndeliveredRequestStillValid(request, binding, now);
    request.status = input.outcome;
    request.updatedAt = now;
    writeJsonAtomic(requestFile(request.id), request);
    cleanupDeliverySecretBestEffort(request.id);
    return structuredClone(request);
  });
}

export function cancelAgentRequest(
  input: Parameters<typeof cancelAgentRequestUnderProjectLock>[0],
): AgentRequest {
  return withProjectGenerationLock(input.projectId, () =>
    cancelAgentRequestUnderProjectLock(input));
}
