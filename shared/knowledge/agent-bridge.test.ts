import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  acknowledgeAgentRequest,
  AgentBridgeConflictError,
  AgentBridgeStaleError,
  bindWorkspace,
  cancelAgentRequest,
  createAgentRequest,
  getAgentRequest,
  getAgentRequestForAgent,
  listAgentRequests,
  readAgentCapability,
  respondToAgentRequest,
} from "./agent-bridge";

const NOW = "2026-07-15T12:00:00.000Z";
const execFileAsync = promisify(execFile);

type TestWorker = {
  child: ReturnType<typeof execFile>;
  result: Promise<{ stdout: string; stderr: string }>;
};

function startTestWorker(script: string, env: NodeJS.ProcessEnv): TestWorker {
  let resolveResult!: (value: { stdout: string; stderr: string }) => void;
  let rejectResult!: (error: Error) => void;
  const result = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const child = execFile(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "--eval", script],
    { env, encoding: "utf8" },
    (error, stdout, stderr) => {
      if (error) {
        rejectResult(new Error(`${error.message}\n${stderr}`));
      } else {
        resolveResult({ stdout, stderr });
      }
    },
  );
  return { child, result };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${label}`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function waitForWorkerExit(worker: TestWorker, timeoutMs: number): Promise<boolean> {
  if (worker.child.exitCode !== null || worker.child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      worker.child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    worker.child.once("exit", onExit);
  });
}

async function settleTestWorkers(workers: TestWorker[]): Promise<void> {
  let exited = await Promise.all(
    workers.map((worker) => waitForWorkerExit(worker, 1_000)),
  );
  workers.forEach((worker, index) => {
    if (!exited[index]) worker.child.kill("SIGTERM");
  });
  exited = await Promise.all(
    workers.map((worker) => waitForWorkerExit(worker, 1_000)),
  );
  workers.forEach((worker, index) => {
    if (!exited[index]) worker.child.kill("SIGKILL");
  });
  await Promise.allSettled(workers.map((worker) => worker.result));
}

function waitForAnyMarker(
  markerFiles: string[],
  timeoutMs = 10_000,
): Promise<string> {
  const existing = markerFiles.find((file) => fs.existsSync(file));
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const directory = path.dirname(markerFiles[0]);
    let settled = false;
    const finish = (marker?: string, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      watcher.close();
      if (error) reject(error);
      else resolve(marker as string);
    };
    const inspect = () => {
      const marker = markerFiles.find((file) => fs.existsSync(file));
      if (marker) finish(marker);
    };
    const watcher = fs.watch(directory, inspect);
    const timeout = setTimeout(
      () => finish(undefined, new Error(`Timed out waiting for ${markerFiles.join(", ")}`)),
      timeoutMs,
    );
    inspect();
  });
}

function waitForAllMarkers(
  markerFiles: string[],
  timeoutMs = 10_000,
): Promise<void> {
  if (markerFiles.every((file) => fs.existsSync(file))) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const directory = path.dirname(markerFiles[0]);
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      watcher.close();
      if (error) reject(error);
      else resolve();
    };
    const inspect = () => {
      if (markerFiles.every((file) => fs.existsSync(file))) finish();
    };
    const watcher = fs.watch(directory, inspect);
    const timeout = setTimeout(
      () => finish(new Error(`Timed out waiting for ${markerFiles.join(", ")}`)),
      timeoutMs,
    );
    inspect();
  });
}

async function runRequestOperationAgainstPausedRebind(input: {
  dataDir: string;
  workspaceDir: string;
  projectId: string;
  requestId: string;
  operationExport: "acknowledgeAgentRequest" | "respondToAgentRequest";
  operationInput: Record<string, unknown>;
}): Promise<{
  operationSucceeded: boolean;
  finalStatus: string | undefined;
  deliveredAt: string | null;
  bindingRevision: number;
}> {
  const controlDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "fc-opc-bridge-race-control-"),
  );
  const bridgeModuleUrl = new URL("./agent-bridge.ts", import.meta.url).href;
  const bindingPath = path.join(
    input.dataDir,
    "agent-bridge",
    "bindings",
    `${encodeURIComponent(input.projectId)}.json`,
  );
  const projectLockDir = `${bindingPath}.lockdir`;
  const requestPath = path.join(
    input.dataDir,
    "agent-bridge",
    "requests",
    `${input.requestId}.json`,
  );
  const requestLockPath = `${requestPath}.lock`;
  const markerPrefix = input.operationExport === "acknowledgeAgentRequest"
    ? "ack"
    : "respond";
  const rebindReady = path.join(controlDir, `${markerPrefix}-rebind-ready`);
  const releaseRebind = path.join(controlDir, `${markerPrefix}-release-rebind`);
  const projectLockAttempt = path.join(
    controlDir,
    `${markerPrefix}-project-lock-attempt`,
  );
  const requestLockHeld = path.join(
    controlDir,
    `${markerPrefix}-request-lock-held`,
  );
  const releaseRequestLockPause = path.join(
    controlDir,
    `${markerPrefix}-release-request-lock`,
  );
  const operationCommitReady = path.join(
    controlDir,
    `${markerPrefix}-commit-ready`,
  );
  const releaseOperationCommit = path.join(
    controlDir,
    `${markerPrefix}-release-commit`,
  );

  const rebindWorker = `
    import fs from "node:fs";
    const originalRenameSync = fs.renameSync;
    const waitForRelease = (file) => {
      while (!fs.existsSync(file)) {
        try {
          process.kill(Number(process.env.TEST_PARENT_PID), 0);
        } catch {
          process.exit(124);
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      }
    };
    let paused = false;
    fs.renameSync = function(source, target) {
      if (!paused && String(target) === process.env.TARGET_BINDING_PATH) {
        paused = true;
        fs.writeFileSync(process.env.REBIND_READY, "ready");
        waitForRelease(process.env.RELEASE_REBIND);
      }
      return originalRenameSync.call(fs, source, target);
    };
    const { bindWorkspace } = await import(process.env.BRIDGE_MODULE_URL);
    const result = bindWorkspace({
      projectId: process.env.PROJECT_ID,
      rootPath: process.env.WORKSPACE_DIR,
      now: "2026-07-15T12:03:00.000Z",
    });
    process.stdout.write(JSON.stringify(result));
  `;
  const operationWorker = `
    import fs from "node:fs";
    const originalMkdirSync = fs.mkdirSync;
    const originalLinkSync = fs.linkSync;
    const originalWriteFileSync = fs.writeFileSync;
    const originalRenameSync = fs.renameSync;
    const waitForRelease = (file) => {
      while (!fs.existsSync(file)) {
        try {
          process.kill(Number(process.env.TEST_PARENT_PID), 0);
        } catch {
          process.exit(124);
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      }
    };
    fs.mkdirSync = function(target, options) {
      if (String(target) === process.env.PROJECT_LOCK_DIR) {
        originalWriteFileSync(process.env.PROJECT_LOCK_ATTEMPT, "attempt");
      }
      return originalMkdirSync.call(fs, target, options);
    };
    fs.linkSync = function(source, target) {
      if (String(target) === process.env.PROJECT_LOCK_DIR) {
        originalWriteFileSync(process.env.PROJECT_LOCK_ATTEMPT, "attempt");
      }
      return originalLinkSync.call(fs, source, target);
    };
    fs.writeFileSync = function(target, data, options) {
      const result = originalWriteFileSync.call(fs, target, data, options);
      if (String(target) === process.env.REQUEST_LOCK_PATH) {
        originalWriteFileSync(process.env.REQUEST_LOCK_HELD, "held");
        waitForRelease(process.env.RELEASE_REQUEST_LOCK_PAUSE);
      }
      return result;
    };
    fs.renameSync = function(source, target) {
      if (String(target) === process.env.REQUEST_PATH) {
        originalWriteFileSync(process.env.OPERATION_COMMIT_READY, "ready");
        waitForRelease(process.env.RELEASE_OPERATION_COMMIT);
      }
      return originalRenameSync.call(fs, source, target);
    };
    const bridge = await import(process.env.BRIDGE_MODULE_URL);
    try {
      const result = bridge[process.env.OPERATION_EXPORT](
        JSON.parse(process.env.OPERATION_INPUT),
      );
      process.stdout.write(JSON.stringify({ ok: true, status: result.status }));
    } catch (error) {
      process.stdout.write(JSON.stringify({
        ok: false,
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  `;

  const childEnvironment = {
    ...process.env,
    BRIDGE_MODULE_URL: bridgeModuleUrl,
    KNOWLEDGE_DATA_DIR: input.dataDir,
    PROJECT_ID: input.projectId,
    TEST_PARENT_PID: String(process.pid),
  };
  const rebind = startTestWorker(rebindWorker, {
    ...childEnvironment,
    TARGET_BINDING_PATH: bindingPath,
    REBIND_READY: rebindReady,
    RELEASE_REBIND: releaseRebind,
    WORKSPACE_DIR: input.workspaceDir,
  });
  let operation: TestWorker | undefined;

  try {
    await waitForAnyMarker([rebindReady], 5_000);
    operation = startTestWorker(operationWorker, {
      ...childEnvironment,
      PROJECT_LOCK_DIR: projectLockDir,
      PROJECT_LOCK_ATTEMPT: projectLockAttempt,
      REQUEST_PATH: requestPath,
      REQUEST_LOCK_PATH: requestLockPath,
      REQUEST_LOCK_HELD: requestLockHeld,
      RELEASE_REQUEST_LOCK_PAUSE: releaseRequestLockPause,
      OPERATION_COMMIT_READY: operationCommitReady,
      RELEASE_OPERATION_COMMIT: releaseOperationCommit,
      OPERATION_EXPORT: input.operationExport,
      OPERATION_INPUT: JSON.stringify(input.operationInput),
    });

    const firstBoundary = await waitForAnyMarker(
      [projectLockAttempt, requestLockHeld],
      5_000,
    );
    if (firstBoundary === requestLockHeld) {
      fs.writeFileSync(releaseRequestLockPause, "release");
      await waitForAnyMarker([operationCommitReady], 5_000);
      fs.writeFileSync(releaseRebind, "release");
      await withTimeout(rebind.result, 5_000, "rebind worker");
      fs.writeFileSync(releaseOperationCommit, "release");
    } else {
      fs.writeFileSync(releaseRequestLockPause, "release");
      fs.writeFileSync(releaseRebind, "release");
      await withTimeout(rebind.result, 5_000, "rebind worker");
    }

    const { stdout } = await withTimeout(
      operation.result,
      5_000,
      `${input.operationExport} worker`,
    );
    const operationResult = JSON.parse(stdout) as { ok: boolean };
    const stored = getAgentRequest(input.projectId, input.requestId);
    const publishedBinding = JSON.parse(
      fs.readFileSync(bindingPath, "utf8"),
    ) as { revision: number };
    return {
      operationSucceeded: operationResult.ok,
      finalStatus: stored?.status,
      deliveredAt: stored?.deliveredAt ?? null,
      bindingRevision: publishedBinding.revision,
    };
  } finally {
    for (const release of [
      releaseRequestLockPause,
      releaseRebind,
      releaseOperationCommit,
    ]) {
      fs.writeFileSync(release, "release");
    }
    await settleTestWorkers(operation ? [rebind, operation] : [rebind]);
    fs.rmSync(controlDir, { recursive: true, force: true });
  }
}

describe("agent bridge", () => {
  let dataDir: string;
  let workspaceDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-bridge-data-"));
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-workspace-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.KNOWLEDGE_DATA_DIR;
    } else {
      process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it("binds an authorized local directory without exposing its absolute path", () => {
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });

    expect(binding).toEqual({
      id: expect.stringMatching(/^workspace_/),
      projectId: "project-1",
      displayName: path.basename(workspaceDir),
      revision: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(JSON.stringify(binding)).not.toContain(workspaceDir);

    const capability = readAgentCapability(binding.id);
    expect(capability).toMatch(/^[a-f0-9]{64}$/);
    const capabilityFile = path.join(
      dataDir,
      "agent-bridge",
      "capabilities",
      `${binding.id}.token`,
    );
    expect(fs.statSync(capabilityFile).mode & 0o777).toBe(0o600);
  });

  it("increments the binding revision and rotates the capability on rebind", () => {
    const first = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const firstCapability = readAgentCapability(first.id);
    const otherWorkspace = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-workspace-rebound-"),
    );
    try {
      const rebound = bindWorkspace({
        projectId: "project-1",
        rootPath: otherWorkspace,
        now: "2026-07-15T12:01:00.000Z",
      });

      expect(rebound.id).toBe(first.id);
      expect(rebound.revision).toBe(2);
      expect(rebound.createdAt).toBe(NOW);
      expect(rebound.updatedAt).toBe("2026-07-15T12:01:00.000Z");
      expect(readAgentCapability(rebound.id)).not.toBe(firstCapability);
    } finally {
      fs.rmSync(otherWorkspace, { recursive: true, force: true });
    }
  });

  it("creates a pending request from one exact Markdown file", () => {
    fs.writeFileSync(
      path.join(workspaceDir, "CONTEXT.md"),
      "# 当前目标\n\n先验证网页回应的交付协议。\n",
      "utf8",
    );
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });

    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability: readAgentCapability(binding.id),
      sessionId: "session-1",
      turnId: "turn-1",
      clientRequestId: "client-1",
      relativePath: "CONTEXT.md",
      question: "第一片应该先证明什么？",
      options: [
        { id: "bridge", label: "验证交付协议" },
        { id: "runner", label: "网页启动新 Agent" },
      ],
      editableDraft: "先证明双向通道。",
      now: NOW,
    });

    expect(request).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^request_/),
        projectId: "project-1",
        bindingId: binding.id,
        bindingRevision: 1,
        sessionId: "session-1",
        turnId: "turn-1",
        clientRequestId: "client-1",
        status: "pending",
        relativePath: "CONTEXT.md",
        fileExcerpt: "# 当前目标\n\n先验证网页回应的交付协议。\n",
        fileHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        createdAt: NOW,
      }),
    );
    expect(JSON.stringify(request)).not.toContain(workspaceDir);
  });

  it("stores binding and request records with owner-only permissions", () => {
    fs.writeFileSync(path.join(workspaceDir, "CONTEXT.md"), "# 当前目标\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability: readAgentCapability(binding.id),
      sessionId: "session-private",
      turnId: "turn-private",
      clientRequestId: "client-private",
      relativePath: "CONTEXT.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });

    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent("project-1")}.json`,
    );
    const requestPath = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.json`,
    );
    expect(fs.statSync(bindingPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(requestPath).mode & 0o777).toBe(0o600);
  });

  it("rejects Markdown that is not valid UTF-8", () => {
    fs.writeFileSync(
      path.join(workspaceDir, "BROKEN.md"),
      Buffer.from([0x23, 0x20, 0xc3, 0x28]),
    );
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });

    expect(() =>
      createAgentRequest({
        projectId: "project-1",
        bindingId: binding.id,
        capability: readAgentCapability(binding.id),
        sessionId: "session-invalid-utf8",
        turnId: "turn-invalid-utf8",
        clientRequestId: "client-invalid-utf8",
        relativePath: "BROKEN.md",
        question: "是否继续？",
        options: [
          { id: "yes", label: "继续" },
          { id: "no", label: "停止" },
        ],
        now: NOW,
      }),
    ).toThrow(/UTF-8/);
  });

  it("rejects a Markdown symlink that escapes the authorized directory", () => {
    const outside = path.join(dataDir, "outside.md");
    fs.writeFileSync(outside, "# 未授权\n", "utf8");
    fs.symlinkSync(outside, path.join(workspaceDir, "outside.md"));
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });

    expect(() =>
      createAgentRequest({
        projectId: "project-1",
        bindingId: binding.id,
        capability: readAgentCapability(binding.id),
        sessionId: "session-1",
        turnId: "turn-1",
        clientRequestId: "client-escape",
        relativePath: "outside.md",
        question: "是否读取？",
        options: [
          { id: "yes", label: "读取" },
          { id: "no", label: "拒绝" },
        ],
        now: NOW,
      }),
    ).toThrow(/超出已授权目录/);
  });

  it("returns the existing request when the same Agent delivery is retried", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const input = {
      projectId: "project-1",
      bindingId: binding.id,
      capability: readAgentCapability(binding.id),
      sessionId: "session-1",
      turnId: "turn-1",
      clientRequestId: "client-retry",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    };

    const first = createAgentRequest(input);
    const retried = createAgentRequest(input);

    expect(retried.id).toBe(first.id);
    expect(retried.requestHash).toBe(first.requestHash);
  });

  it(
    "deduplicates simultaneous creates across independent processes",
    async () => {
      fs.writeFileSync(
        path.join(workspaceDir, "DECISION.md"),
        "# 决定\n",
        "utf8",
      );
      const binding = bindWorkspace({
        projectId: "project-1",
        rootPath: workspaceDir,
        now: NOW,
      });
      const input = {
        projectId: "project-1",
        bindingId: binding.id,
        capability: readAgentCapability(binding.id),
        sessionId: "session-concurrent",
        turnId: "turn-concurrent",
        clientRequestId: "client-concurrent",
        relativePath: "DECISION.md",
        question: "是否继续？",
        options: [
          { id: "yes", label: "继续" },
          { id: "no", label: "停止" },
        ],
        now: NOW,
      };
      const worker = `
        const { createAgentRequest } = await import(process.env.BRIDGE_MODULE_URL);
        const remaining = Number(process.env.START_AT) - Date.now();
        if (remaining > 0) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, remaining);
        }
        const request = createAgentRequest(JSON.parse(process.env.REQUEST_INPUT));
        process.stdout.write(request.id);
      `;
      const startAt = Date.now() + 1_500;
      const attempts = Array.from({ length: 24 }, () =>
        execFileAsync(
          process.execPath,
          [
            "--experimental-strip-types",
            "--input-type=module",
            "--eval",
            worker,
          ],
          {
            env: {
              ...process.env,
              BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
              KNOWLEDGE_DATA_DIR: dataDir,
              REQUEST_INPUT: JSON.stringify(input),
              START_AT: String(startAt),
            },
          },
        ),
      );

      const results = await Promise.all(attempts);
      expect(new Set(results.map(({ stdout }) => stdout)).size).toBe(1);
      expect(
        fs
          .readdirSync(path.join(dataDir, "agent-bridge", "requests"))
          .filter((file) => file.endsWith(".json")),
      ).toHaveLength(1);
    },
    20_000,
  );

  it("rejects a reused clientRequestId when its payload changed", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const base = {
      projectId: "project-1",
      bindingId: binding.id,
      capability: readAgentCapability(binding.id),
      sessionId: "session-1",
      turnId: "turn-1",
      clientRequestId: "client-conflict",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    };
    createAgentRequest(base);

    expect(() =>
      createAgentRequest({ ...base, question: "是否立即继续？" }),
    ).toThrowError(AgentBridgeConflictError);
  });

  it("records the user's answer without marking it delivered", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability: readAgentCapability(binding.id),
      sessionId: "session-1",
      turnId: "turn-1",
      clientRequestId: "client-answer",
      relativePath: "DECISION.md",
      question: "第一片做什么？",
      options: [
        { id: "bridge", label: "先做双向桥" },
        { id: "runner", label: "先做新执行器" },
      ],
      editableDraft: "先做双向桥。",
      now: NOW,
    });

    const answered = respondToAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "bridge",
      editedDraft: "先验证协议回应可以安全交付。",
      note: "不要启动第二 Agent。",
      now: "2026-07-15T12:01:00.000Z",
    });

    expect(answered.status).toBe("answered");
    expect(answered.response).toEqual({
      selectedOptionId: "bridge",
      editedDraft: "先验证协议回应可以安全交付。",
      note: "不要启动第二 Agent。",
      respondedAt: "2026-07-15T12:01:00.000Z",
    });
    expect(answered.deliveredAt).toBeUndefined();
  });

  it("accepts only the first answer for a request", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability: readAgentCapability(binding.id),
      sessionId: "session-1",
      turnId: "turn-1",
      clientRequestId: "client-double-answer",
      relativePath: "DECISION.md",
      question: "选哪一个？",
      options: [
        { id: "first", label: "第一个" },
        { id: "second", label: "第二个" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "first",
    });

    expect(() =>
      respondToAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        requestHash: request.requestHash,
        selectedOptionId: "second",
      }),
    ).toThrowError(AgentBridgeConflictError);
    expect(getAgentRequest("project-1", request.id)?.response?.selectedOptionId)
      .toBe("first");
  });

  it("marks the request stale when its source file changed before the answer", () => {
    const source = path.join(workspaceDir, "DECISION.md");
    fs.writeFileSync(source, "# 原决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability: readAgentCapability(binding.id),
      sessionId: "session-1",
      turnId: "turn-1",
      clientRequestId: "client-stale",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });
    fs.writeFileSync(source, "# 新决定\n", "utf8");

    expect(() =>
      respondToAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        requestHash: request.requestHash,
        selectedOptionId: "yes",
      }),
    ).toThrowError(AgentBridgeStaleError);
    expect(getAgentRequest("project-1", request.id)?.status).toBe("stale");
  });

  it("marks an answer delivered only after a matching protocol ACK tuple", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability,
      sessionId: "session-1",
      turnId: "turn-1",
      clientRequestId: "client-ack",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
      now: "2026-07-15T12:01:00.000Z",
    });

    const agentView = getAgentRequestForAgent({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
    });
    expect(agentView.status).toBe("answered");
    expect(agentView.deliveryChallenge).toMatch(/^[a-f0-9]{32}$/);
    const delivered = acknowledgeAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
      requestHash: request.requestHash,
      sessionId: "session-1",
      turnId: "turn-1",
      bindingRevision: request.bindingRevision,
      deliveryChallenge: agentView.deliveryChallenge!,
      now: "2026-07-15T12:02:00.000Z",
    });
    expect(delivered.status).toBe("delivered");
    expect(delivered.deliveredAt).toBe("2026-07-15T12:02:00.000Z");
  });

  it("keeps the server delivery secret private, one-time, and tuple-bound", async () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability,
      sessionId: "session-secret",
      turnId: "turn-secret",
      clientRequestId: "client-secret",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });
    const publicResponse = respondToAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
      now: "2026-07-15T12:01:00.000Z",
    });

    expect(publicResponse).not.toHaveProperty("deliveryChallenge");
    expect(getAgentRequest("project-1", request.id)).not.toHaveProperty(
      "deliveryChallenge",
    );
    expect(listAgentRequests("project-1")[0]).not.toHaveProperty(
      "deliveryChallenge",
    );

    const requestsDirectory = path.join(dataDir, "agent-bridge", "requests");
    const requestDirectoryFiles = fs.readdirSync(requestsDirectory);
    const secretNames = requestDirectoryFiles.filter(
      (file) => !file.endsWith(".json") && !file.endsWith(".lock"),
    );
    expect(secretNames).toHaveLength(1);
    const secretFile = path.join(requestsDirectory, secretNames[0]);
    expect(fs.existsSync(secretFile)).toBe(true);
    expect(fs.statSync(secretFile).mode & 0o777).toBe(0o600);
    expect(requestDirectoryFiles.filter((file) => file.endsWith(".json")))
      .toEqual([`${request.id}.json`]);
    const storedSecret = JSON.parse(fs.readFileSync(secretFile, "utf8")) as {
      requestId: string;
      requestHash: string;
      bindingRevision: number;
      sessionId: string;
      turnId: string;
      challenge: string;
    };
    expect(storedSecret).toEqual({
      requestId: request.id,
      requestHash: request.requestHash,
      bindingRevision: request.bindingRevision,
      sessionId: "session-secret",
      turnId: "turn-secret",
      challenge: expect.stringMatching(/^[a-f0-9]{32}$/),
    });

    const agentView = getAgentRequestForAgent({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
    });
    expect(agentView.deliveryChallenge).toBe(storedSecret.challenge);
    const bridgeModuleUrl = new URL("./agent-bridge.ts", import.meta.url).href;
    const { stdout: childRead } = await execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        `
          const bridge = await import(process.env.BRIDGE_MODULE_URL);
          const request = bridge.getAgentRequestForAgent(
            JSON.parse(process.env.AGENT_READ_INPUT),
          );
          process.stdout.write(JSON.stringify({
            deliveryChallenge: request.deliveryChallenge,
          }));
        `,
      ],
      {
        env: {
          ...process.env,
          BRIDGE_MODULE_URL: bridgeModuleUrl,
          KNOWLEDGE_DATA_DIR: dataDir,
          AGENT_READ_INPUT: JSON.stringify({
            projectId: "project-1",
            requestId: request.id,
            bindingId: binding.id,
            capability,
          }),
        },
      },
    );
    expect(JSON.parse(childRead).deliveryChallenge).toBe(storedSecret.challenge);

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
        requestHash: request.requestHash,
        sessionId: "session-secret",
        turnId: "turn-secret",
        bindingRevision: request.bindingRevision,
        deliveryChallenge: "0".repeat(32),
      }),
    ).toThrowError(AgentBridgeConflictError);
    expect(getAgentRequest("project-1", request.id)?.status).toBe("answered");

    const delivered = acknowledgeAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
      requestHash: request.requestHash,
      sessionId: "session-secret",
      turnId: "turn-secret",
      bindingRevision: request.bindingRevision,
      deliveryChallenge: storedSecret.challenge,
    });
    expect(delivered.status).toBe("delivered");
    expect(fs.existsSync(secretFile)).toBe(false);
    expect(
      getAgentRequestForAgent({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
      }).deliveryChallenge,
    ).toBeUndefined();

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
        requestHash: request.requestHash,
        sessionId: "session-secret",
        turnId: "turn-secret",
        bindingRevision: request.bindingRevision,
        deliveryChallenge: storedSecret.challenge,
      }),
    ).toThrowError(AgentBridgeConflictError);
    expect(getAgentRequest("project-1", request.id)?.status).toBe("delivered");
  });

  it("rejects every incomplete or cross-request proof without consuming either answer", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const createAnswered = (suffix: string) => {
      const request = createAgentRequest({
        projectId: "project-1",
        bindingId: binding.id,
        capability,
        sessionId: `session-${suffix}`,
        turnId: `turn-${suffix}`,
        clientRequestId: `client-${suffix}`,
        relativePath: "DECISION.md",
        question: `是否继续 ${suffix}？`,
        options: [
          { id: "yes", label: "继续" },
          { id: "no", label: "停止" },
        ],
        now: NOW,
      });
      respondToAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        requestHash: request.requestHash,
        selectedOptionId: "yes",
        now: "2026-07-15T12:01:00.000Z",
      });
      const challenge = getAgentRequestForAgent({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
      }).deliveryChallenge!;
      return { request, challenge };
    };
    const a = createAnswered("a");
    const b = createAnswered("b");
    const proofFor = (target: typeof a, overrides: Record<string, unknown> = {}) => ({
      projectId: "project-1",
      requestId: target.request.id,
      bindingId: binding.id,
      capability,
      requestHash: target.request.requestHash,
      sessionId: target.request.sessionId,
      turnId: target.request.turnId,
      bindingRevision: target.request.bindingRevision,
      deliveryChallenge: target.challenge,
      ...overrides,
    });
    const rejectedProofs = [
      proofFor(a, { deliveryChallenge: "" }),
      proofFor(a, { deliveryChallenge: "0".repeat(32) }),
      proofFor(a, { requestHash: "wrong-request-hash" }),
      proofFor(a, { bindingRevision: a.request.bindingRevision + 1 }),
      proofFor(a, { sessionId: "wrong-session" }),
      proofFor(a, { turnId: "wrong-turn" }),
      proofFor(b, { deliveryChallenge: a.challenge }),
    ];

    for (const proof of rejectedProofs) {
      expect(() => acknowledgeAgentRequest(proof)).toThrow();
      expect(getAgentRequest("project-1", a.request.id)?.status).toBe("answered");
      expect(getAgentRequest("project-1", a.request.id)?.deliveredAt)
        .toBeUndefined();
      expect(getAgentRequest("project-1", b.request.id)?.status).toBe("answered");
      expect(getAgentRequest("project-1", b.request.id)?.deliveredAt)
        .toBeUndefined();
      expect(
        getAgentRequestForAgent({
          projectId: "project-1",
          requestId: a.request.id,
          bindingId: binding.id,
          capability,
        }).deliveryChallenge,
      ).toBe(a.challenge);
      expect(
        getAgentRequestForAgent({
          projectId: "project-1",
          requestId: b.request.id,
          bindingId: binding.id,
          capability,
        }).deliveryChallenge,
      ).toBe(b.challenge);
    }

    expect(acknowledgeAgentRequest(proofFor(a)).status).toBe("delivered");
    expect(acknowledgeAgentRequest(proofFor(b)).status).toBe("delivered");
  });

  it(
    "allows exactly one of two processes to deliver the same complete proof",
    async () => {
      fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
      const binding = bindWorkspace({
        projectId: "project-concurrent-proof",
        rootPath: workspaceDir,
        now: NOW,
      });
      const capability = readAgentCapability(binding.id);
      const request = createAgentRequest({
        projectId: "project-concurrent-proof",
        bindingId: binding.id,
        capability,
        sessionId: "session-concurrent-proof",
        turnId: "turn-concurrent-proof",
        clientRequestId: "client-concurrent-proof",
        relativePath: "DECISION.md",
        question: "是否交付？",
        options: [
          { id: "yes", label: "交付" },
          { id: "no", label: "不交付" },
        ],
        now: NOW,
      });
      respondToAgentRequest({
        projectId: "project-concurrent-proof",
        requestId: request.id,
        requestHash: request.requestHash,
        selectedOptionId: "yes",
        now: "2026-07-15T12:01:00.000Z",
      });
      const deliveryChallenge = getAgentRequestForAgent({
        projectId: "project-concurrent-proof",
        requestId: request.id,
        bindingId: binding.id,
        capability,
      }).deliveryChallenge!;
      const proof = {
        projectId: "project-concurrent-proof",
        requestId: request.id,
        bindingId: binding.id,
        capability,
        requestHash: request.requestHash,
        sessionId: request.sessionId,
        turnId: request.turnId,
        bindingRevision: request.bindingRevision,
        deliveryChallenge,
        now: "2026-07-15T12:02:00.000Z",
      };
      const controlDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "fc-opc-proof-race-control-"),
      );
      const readyFiles = [
        path.join(controlDir, "ready-1"),
        path.join(controlDir, "ready-2"),
      ];
      const releaseFile = path.join(controlDir, "release");
      const workerScript = `
        import fs from "node:fs";
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        fs.writeFileSync(process.env.READY_FILE, "ready");
        while (!fs.existsSync(process.env.RELEASE_FILE)) {
          try {
            process.kill(Number(process.env.TEST_PARENT_PID), 0);
          } catch {
            process.exit(124);
          }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        }
        try {
          const result = bridge.acknowledgeAgentRequest(
            JSON.parse(process.env.ACK_PROOF),
          );
          process.stdout.write(JSON.stringify({
            ok: true,
            status: result.status,
            deliveredAt: result.deliveredAt,
          }));
        } catch (error) {
          process.stdout.write(JSON.stringify({
            ok: false,
            name: error instanceof Error ? error.name : "unknown",
            message: error instanceof Error ? error.message : String(error),
          }));
        }
      `;
      const commonEnvironment = {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        RELEASE_FILE: releaseFile,
        TEST_PARENT_PID: String(process.pid),
        ACK_PROOF: JSON.stringify(proof),
      };
      const workers = readyFiles.map((readyFile) =>
        startTestWorker(workerScript, {
          ...commonEnvironment,
          READY_FILE: readyFile,
        }));

      try {
        await waitForAllMarkers(readyFiles, 5_000);
        fs.writeFileSync(releaseFile, "release");
        const results = await Promise.all(
          workers.map(async (worker) => {
            const { stdout } = await withTimeout(worker.result, 5_000, "ACK worker");
            return JSON.parse(stdout) as {
              ok: boolean;
              status?: string;
              deliveredAt?: string;
              name?: string;
            };
          }),
        );
        expect(results.filter((result) => result.ok)).toEqual([
          {
            ok: true,
            status: "delivered",
            deliveredAt: "2026-07-15T12:02:00.000Z",
          },
        ]);
        expect(results.filter((result) => !result.ok)).toHaveLength(1);
        expect(results.find((result) => !result.ok)?.name).toBe(
          "AgentBridgeConflictError",
        );
        expect(getAgentRequest("project-concurrent-proof", request.id)).toEqual(
          expect.objectContaining({
            status: "delivered",
            deliveredAt: "2026-07-15T12:02:00.000Z",
          }),
        );
        expect(
          getAgentRequestForAgent({
            projectId: "project-concurrent-proof",
            requestId: request.id,
            bindingId: binding.id,
            capability,
          }).deliveryChallenge,
        ).toBeUndefined();
        expect(() => acknowledgeAgentRequest(proof)).toThrowError(
          AgentBridgeConflictError,
        );
      } finally {
        fs.writeFileSync(releaseFile, "release");
        await settleTestWorkers(workers);
        fs.rmSync(controlDir, { recursive: true, force: true });
      }
    },
    15_000,
  );

  it("rejects ACK when session, turn, or binding revision does not match the original request", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability,
      sessionId: "session-origin",
      turnId: "turn-origin",
      clientRequestId: "client-ack-identity",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
      now: "2026-07-15T12:01:00.000Z",
    });
    const deliveryChallenge = getAgentRequestForAgent({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
    }).deliveryChallenge!;

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
        requestHash: request.requestHash,
        sessionId: "session-other",
        turnId: "turn-origin",
        bindingRevision: request.bindingRevision,
        deliveryChallenge,
      }),
    ).toThrowError(AgentBridgeConflictError);

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
        requestHash: request.requestHash,
        sessionId: "session-origin",
        turnId: "turn-other",
        bindingRevision: request.bindingRevision,
        deliveryChallenge,
      }),
    ).toThrowError(AgentBridgeConflictError);

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
        requestHash: request.requestHash,
        sessionId: "session-origin",
        turnId: "turn-origin",
        bindingRevision: request.bindingRevision + 1,
        deliveryChallenge,
      }),
    ).toThrowError(AgentBridgeConflictError);

    expect(getAgentRequest("project-1", request.id)?.status).toBe("answered");
    expect(getAgentRequest("project-1", request.id)?.deliveredAt).toBeUndefined();
  });

  it("allows a capability-protected cancel for a pending request", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability,
      sessionId: "session-cancel",
      turnId: "turn-cancel",
      clientRequestId: "client-cancel",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });

    const cancelled = cancelAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
      requestHash: request.requestHash,
      outcome: "cancelled",
      now: "2026-07-15T12:03:00.000Z",
    });

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.updatedAt).toBe("2026-07-15T12:03:00.000Z");
    expect(getAgentRequest("project-1", request.id)?.status).toBe("cancelled");
  });

  it("marks a timed-out pending request expired", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability,
      sessionId: "session-expire",
      turnId: "turn-expire",
      clientRequestId: "client-expire",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });

    const expired = cancelAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
      requestHash: request.requestHash,
      outcome: "expired",
      now: "2026-07-15T12:04:00.000Z",
    });

    expect(expired.status).toBe("expired");
    expect(getAgentRequest("project-1", request.id)?.status).toBe("expired");
  });

  it("rejects request identifiers that could escape the request directory", () => {
    bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });

    expect(() =>
      getAgentRequest("project-1", "../bindings/project-1"),
    ).toThrow(/Agent 请求标识无效/);
  });

  it("rejects binding identifiers that could escape the capability directory", () => {
    const escapedDirectory = path.join(dataDir, "agent-bridge", "escaped");
    fs.mkdirSync(escapedDirectory, { recursive: true });
    fs.writeFileSync(path.join(escapedDirectory, "secret.token"), "leaked", {
      mode: 0o600,
    });

    expect(() =>
      readAgentCapability("../escaped/secret"),
    ).toThrow(/Agent 目录授权标识无效/);
  });

  // --- B-01-FIX-01: undelivered must go stale; no get/ACK after rebind or file change ---

  it("marks answered request stale on rebind; new capability cannot get response or ACK delivered", () => {
    const source = path.join(workspaceDir, "DECISION.md");
    fs.writeFileSync(source, "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const oldCapability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability: oldCapability,
      sessionId: "session-rebind-ack",
      turnId: "turn-rebind-ack",
      clientRequestId: "client-rebind-ack",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
      now: "2026-07-15T12:10:00.000Z",
    });
    const deliveryChallenge = getAgentRequestForAgent({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability: oldCapability,
    }).deliveryChallenge!;
    const deliverySecret = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.delivery-secret`,
    );
    expect(fs.existsSync(deliverySecret)).toBe(true);
    expect(getAgentRequest("project-1", request.id)?.status).toBe("answered");

    const rebound = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: "2026-07-15T12:11:00.000Z",
    });
    expect(rebound.revision).toBe(binding.revision + 1);
    const newCapability = readAgentCapability(rebound.id);

    expect(getAgentRequest("project-1", request.id)?.status).toBe("stale");
    expect(fs.existsSync(deliverySecret)).toBe(false);
    expect(getAgentRequest("project-1", request.id)?.staleReason).toMatch(
      /授权已变更/,
    );

    expect(() =>
      getAgentRequestForAgent({
        projectId: "project-1",
        requestId: request.id,
        bindingId: rebound.id,
        capability: newCapability,
      }),
    ).toThrowError(AgentBridgeStaleError);

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: rebound.id,
        capability: newCapability,
        requestHash: request.requestHash,
        sessionId: "session-rebind-ack",
        turnId: "turn-rebind-ack",
        bindingRevision: request.bindingRevision,
        deliveryChallenge,
      }),
    ).toThrowError(AgentBridgeStaleError);

    expect(getAgentRequest("project-1", request.id)?.status).toBe("stale");
    expect(getAgentRequest("project-1", request.id)?.deliveredAt).toBeUndefined();

    expect(() =>
      getAgentRequestForAgent({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability: oldCapability,
      }),
    ).toThrow(/capability|授权|无效|不匹配|不存在/i);
  });

  it("marks answered request stale when source file changes before ACK", () => {
    const source = path.join(workspaceDir, "DECISION.md");
    fs.writeFileSync(source, "# 原决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability,
      sessionId: "session-file-ack",
      turnId: "turn-file-ack",
      clientRequestId: "client-file-ack",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: "project-1",
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
      now: "2026-07-15T12:12:00.000Z",
    });
    const deliveryChallenge = getAgentRequestForAgent({
      projectId: "project-1",
      requestId: request.id,
      bindingId: binding.id,
      capability,
    }).deliveryChallenge!;
    const deliverySecret = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.delivery-secret`,
    );
    expect(fs.existsSync(deliverySecret)).toBe(true);
    expect(getAgentRequest("project-1", request.id)?.status).toBe("answered");

    fs.writeFileSync(source, "# 回应后才改的文件\n", "utf8");

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
        requestHash: request.requestHash,
        sessionId: "session-file-ack",
        turnId: "turn-file-ack",
        bindingRevision: request.bindingRevision,
        deliveryChallenge,
        now: "2026-07-15T12:13:00.000Z",
      }),
    ).toThrowError(AgentBridgeStaleError);

    const stored = getAgentRequest("project-1", request.id);
    expect(stored?.status).toBe("stale");
    expect(fs.existsSync(deliverySecret)).toBe(false);
    expect(stored?.staleReason).toMatch(/文件已变更|已删除|越界/);
    expect(stored?.deliveredAt).toBeUndefined();

    expect(() =>
      getAgentRequestForAgent({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability,
      }),
    ).toThrowError(AgentBridgeStaleError);
  });

  // --- B-01-FIX-03: concurrent rebind serial / CAS; same-generation capability ---

  it(
    "serializes ACK behind rebind so an old answer stays stale and never becomes delivered",
    async () => {
      fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
      const binding = bindWorkspace({
        projectId: "project-linear-ack",
        rootPath: workspaceDir,
        now: NOW,
      });
      const capability = readAgentCapability(binding.id);
      const request = createAgentRequest({
        projectId: "project-linear-ack",
        bindingId: binding.id,
        capability,
        sessionId: "session-linear-ack",
        turnId: "turn-linear-ack",
        clientRequestId: "client-linear-ack",
        relativePath: "DECISION.md",
        question: "是否继续？",
        options: [
          { id: "yes", label: "继续" },
          { id: "no", label: "停止" },
        ],
        now: NOW,
      });
      respondToAgentRequest({
        projectId: "project-linear-ack",
        requestId: request.id,
        requestHash: request.requestHash,
        selectedOptionId: "yes",
        now: "2026-07-15T12:01:00.000Z",
      });
      const deliveryChallenge = getAgentRequestForAgent({
        projectId: "project-linear-ack",
        requestId: request.id,
        bindingId: binding.id,
        capability,
      }).deliveryChallenge!;

      const actual = await runRequestOperationAgainstPausedRebind({
        dataDir,
        workspaceDir,
        projectId: "project-linear-ack",
        requestId: request.id,
        operationExport: "acknowledgeAgentRequest",
        operationInput: {
          projectId: "project-linear-ack",
          requestId: request.id,
          bindingId: binding.id,
          capability,
          requestHash: request.requestHash,
          sessionId: "session-linear-ack",
          turnId: "turn-linear-ack",
          bindingRevision: request.bindingRevision,
          deliveryChallenge,
          now: "2026-07-15T12:02:00.000Z",
        },
      });

      expect(actual).toEqual({
        operationSucceeded: false,
        finalStatus: "stale",
        deliveredAt: null,
        bindingRevision: 2,
      });
    },
    20_000,
  );

  it(
    "serializes response behind rebind so an old pending request stays stale",
    async () => {
      fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
      const binding = bindWorkspace({
        projectId: "project-linear-respond",
        rootPath: workspaceDir,
        now: NOW,
      });
      const capability = readAgentCapability(binding.id);
      const request = createAgentRequest({
        projectId: "project-linear-respond",
        bindingId: binding.id,
        capability,
        sessionId: "session-linear-respond",
        turnId: "turn-linear-respond",
        clientRequestId: "client-linear-respond",
        relativePath: "DECISION.md",
        question: "是否继续？",
        options: [
          { id: "yes", label: "继续" },
          { id: "no", label: "停止" },
        ],
        now: NOW,
      });

      const actual = await runRequestOperationAgainstPausedRebind({
        dataDir,
        workspaceDir,
        projectId: "project-linear-respond",
        requestId: request.id,
        operationExport: "respondToAgentRequest",
        operationInput: {
          projectId: "project-linear-respond",
          requestId: request.id,
          requestHash: request.requestHash,
          selectedOptionId: "yes",
          now: "2026-07-15T12:02:00.000Z",
        },
      });

      expect(actual).toEqual({
        operationSucceeded: false,
        finalStatus: "stale",
        deliveredAt: null,
        bindingRevision: 2,
      });
    },
    20_000,
  );

  it(
    "serializes 24 concurrent rebinds so revision is unique and strictly increasing",
    async () => {
      const initial = bindWorkspace({
        projectId: "project-rebind-race",
        rootPath: workspaceDir,
        now: NOW,
      });
      expect(initial.revision).toBe(1);

      const worker = `
        const { bindWorkspace } = await import(process.env.BRIDGE_MODULE_URL);
        const remaining = Number(process.env.START_AT) - Date.now();
        if (remaining > 0) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, remaining);
        }
        const binding = bindWorkspace({
          projectId: process.env.PROJECT_ID,
          rootPath: process.env.WORKSPACE_DIR,
          now: new Date().toISOString(),
        });
        process.stdout.write(JSON.stringify({
          revision: binding.revision,
          id: binding.id,
        }));
      `;
      const startAt = Date.now() + 1_500;
      const attempts = Array.from({ length: 24 }, () =>
        execFileAsync(
          process.execPath,
          [
            "--experimental-strip-types",
            "--input-type=module",
            "--eval",
            worker,
          ],
          {
            env: {
              ...process.env,
              BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
              KNOWLEDGE_DATA_DIR: dataDir,
              PROJECT_ID: "project-rebind-race",
              WORKSPACE_DIR: workspaceDir,
              START_AT: String(startAt),
            },
          },
        ),
      );

      const results = await Promise.all(attempts);
      const revisions = results.map(({ stdout }) => {
        const parsed = JSON.parse(stdout) as { revision: number; id: string };
        expect(parsed.id).toBe(initial.id);
        return parsed.revision;
      });

      expect(new Set(revisions).size).toBe(24);
      expect([...revisions].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 24 }, (_, index) => index + 2),
      );

      const bindingPath = path.join(
        dataDir,
        "agent-bridge",
        "bindings",
        `${encodeURIComponent("project-rebind-race")}.json`,
      );
      const stored = JSON.parse(fs.readFileSync(bindingPath, "utf8")) as {
        revision: number;
        id: string;
        capabilityHash: string;
      };
      expect(stored.revision).toBe(25);
      expect(stored.revision).toBe(initial.revision + 24);

      const capability = readAgentCapability(stored.id);
      const capabilityHash = createHash("sha256")
        .update(capability)
        .digest("hex");
      expect(capabilityHash).toBe(stored.capabilityHash);
    },
    30_000,
  );

  it("recovers from capability/binding generation split and still stales prior undelivered requests", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: NOW,
    });
    const oldCapability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-1",
      bindingId: binding.id,
      capability: oldCapability,
      sessionId: "session-split",
      turnId: "turn-split",
      clientRequestId: "client-split",
      relativePath: "DECISION.md",
      question: "是否继续？",
      options: [
        { id: "yes", label: "继续" },
        { id: "no", label: "停止" },
      ],
      now: NOW,
    });
    expect(request.status).toBe("pending");

    // Controllable fault: capability rotated without binding update (crash window).
    const orphanCapability = randomBytes(32).toString("hex");
    const capabilityPath = path.join(
      dataDir,
      "agent-bridge",
      "capabilities",
      `${binding.id}.token`,
    );
    fs.writeFileSync(capabilityPath, orphanCapability, { mode: 0o600 });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent("project-1")}.json`,
    );
    const midBinding = JSON.parse(fs.readFileSync(bindingPath, "utf8")) as {
      revision: number;
      capabilityHash: string;
    };
    expect(createHash("sha256").update(orphanCapability).digest("hex")).not.toBe(
      midBinding.capabilityHash,
    );
    expect(midBinding.revision).toBe(1);

    // Stale lockdir from a dead holder must not block recovery rebind.
    const staleLockDir = `${bindingPath}.lockdir`;
    fs.mkdirSync(staleLockDir, { recursive: true });
    fs.writeFileSync(path.join(staleLockDir, "owner"), "999999999\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    const staleTime = Date.now() - 120_000;
    fs.utimesSync(staleLockDir, staleTime / 1000, staleTime / 1000);

    const recovered = bindWorkspace({
      projectId: "project-1",
      rootPath: workspaceDir,
      now: "2026-07-15T12:20:00.000Z",
    });
    expect(recovered.revision).toBe(2);
    expect(fs.existsSync(staleLockDir)).toBe(false);

    const published = JSON.parse(fs.readFileSync(bindingPath, "utf8")) as {
      revision: number;
      capabilityHash: string;
      id: string;
    };
    const activeCapability = readAgentCapability(published.id);
    expect(createHash("sha256").update(activeCapability).digest("hex")).toBe(
      published.capabilityHash,
    );
    expect(activeCapability).not.toBe(oldCapability);
    expect(activeCapability).not.toBe(orphanCapability);

    expect(getAgentRequest("project-1", request.id)?.status).toBe("stale");

    expect(() =>
      getAgentRequestForAgent({
        projectId: "project-1",
        requestId: request.id,
        bindingId: binding.id,
        capability: oldCapability,
      }),
    ).toThrow(/capability|授权|无效|不匹配|不存在/i);

    expect(() =>
      getAgentRequestForAgent({
        projectId: "project-1",
        requestId: request.id,
        bindingId: recovered.id,
        capability: activeCapability,
      }),
    ).toThrowError(AgentBridgeStaleError);

    expect(() =>
      acknowledgeAgentRequest({
        projectId: "project-1",
        requestId: request.id,
        bindingId: recovered.id,
        capability: activeCapability,
        requestHash: request.requestHash,
        sessionId: "session-split",
        turnId: "turn-split",
        bindingRevision: request.bindingRevision,
        deliveryChallenge: "0".repeat(32),
      }),
    ).toThrowError(AgentBridgeStaleError);
  });

  it("F03 R1 recovers an answered request from a dead legacy request lock", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-dead-request-lock",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-dead-request-lock",
      bindingId: binding.id,
      capability,
      sessionId: "session-dead-request-lock",
      turnId: "turn-dead-request-lock",
      clientRequestId: "client-dead-request-lock",
      relativePath: "DECISION.md",
      question: "是否交付？",
      options: [
        { id: "yes", label: "交付" },
        { id: "no", label: "暂不交付" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: request.projectId,
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
    });
    const deliveryChallenge = getAgentRequestForAgent({
      projectId: request.projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
    }).deliveryChallenge!;
    const requestLock = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.json.lock`,
    );
    fs.writeFileSync(requestLock, "999999999\n", { mode: 0o600 });

    const delivered = acknowledgeAgentRequest({
      projectId: request.projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
      requestHash: request.requestHash,
      sessionId: request.sessionId,
      turnId: request.turnId,
      bindingRevision: request.bindingRevision,
      deliveryChallenge,
      now: "2026-07-15T12:02:00.000Z",
    });

    expect(delivered.status).toBe("delivered");
    expect(fs.existsSync(requestLock)).toBe(false);
  });

  it(
    "F03 R1 never steals an old project lock while its owner process is alive",
    async () => {
      const projectId = "project-live-old-lock";
      const initial = bindWorkspace({
        projectId,
        rootPath: workspaceDir,
        now: NOW,
      });
      const bindingPath = path.join(
        dataDir,
        "agent-bridge",
        "bindings",
        `${encodeURIComponent(projectId)}.json`,
      );
      const lockDir = `${bindingPath}.lockdir`;
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, "owner"), `${process.pid}\n`, {
        mode: 0o600,
      });
      const oldTime = Date.now() - 120_000;
      fs.utimesSync(lockDir, oldTime / 1000, oldTime / 1000);
      const controlDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "fc-opc-live-lock-control-"),
      );
      const started = path.join(controlDir, "started");
      const worker = startTestWorker(
        `
          import fs from "node:fs";
          const bridge = await import(process.env.BRIDGE_MODULE_URL);
          fs.writeFileSync(process.env.STARTED_FILE, "started");
          const result = bridge.bindWorkspace({
            projectId: process.env.PROJECT_ID,
            rootPath: process.env.WORKSPACE_DIR,
            now: "2026-07-15T12:03:00.000Z",
          });
          process.stdout.write(JSON.stringify(result));
        `,
        {
          ...process.env,
          BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
          KNOWLEDGE_DATA_DIR: dataDir,
          PROJECT_ID: projectId,
          WORKSPACE_DIR: workspaceDir,
          STARTED_FILE: started,
        },
      );

      try {
        await waitForAllMarkers([started], 5_000);
        expect(await waitForWorkerExit(worker, 300)).toBe(false);
        expect(fs.readFileSync(path.join(lockDir, "owner"), "utf8").trim())
          .toBe(String(process.pid));
        fs.rmSync(lockDir, { recursive: true, force: true });
        const { stdout } = await withTimeout(worker.result, 5_000, "live lock worker");
        expect(JSON.parse(stdout).revision).toBe(initial.revision + 1);
      } finally {
        fs.rmSync(lockDir, { recursive: true, force: true });
        await settleTestWorkers([worker]);
        fs.rmSync(controlDir, { recursive: true, force: true });
      }
    },
    10_000,
  );

  it("F03 R1 keeps delivered authoritative when delivery-secret cleanup fails", async () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-secret-cleanup",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-secret-cleanup",
      bindingId: binding.id,
      capability,
      sessionId: "session-secret-cleanup",
      turnId: "turn-secret-cleanup",
      clientRequestId: "client-secret-cleanup",
      relativePath: "DECISION.md",
      question: "是否交付？",
      options: [
        { id: "yes", label: "交付" },
        { id: "no", label: "暂不交付" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: request.projectId,
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
    });
    const deliveryChallenge = getAgentRequestForAgent({
      projectId: request.projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
    }).deliveryChallenge!;
    const secretFile = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.delivery-secret`,
    );
    const proof = {
      projectId: request.projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
      requestHash: request.requestHash,
      sessionId: request.sessionId,
      turnId: request.turnId,
      bindingRevision: request.bindingRevision,
      deliveryChallenge,
      now: "2026-07-15T12:04:00.000Z",
    };
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        `
          import fs from "node:fs";
          const bridge = await import(process.env.BRIDGE_MODULE_URL);
          const originalRmSync = fs.rmSync;
          fs.rmSync = (target, options) => {
            if (String(target) === process.env.SECRET_FILE) {
              throw new Error("injected secret unlink failure");
            }
            return originalRmSync(target, options);
          };
          let result;
          let error;
          try {
            result = bridge.acknowledgeAgentRequest(JSON.parse(process.env.ACK_PROOF));
          } catch (caught) {
            error = {
              name: caught instanceof Error ? caught.name : "unknown",
              message: caught instanceof Error ? caught.message : String(caught),
            };
          } finally {
            fs.rmSync = originalRmSync;
          }
          process.stdout.write(JSON.stringify({ result, error }));
        `,
      ],
      {
        env: {
          ...process.env,
          BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
          KNOWLEDGE_DATA_DIR: dataDir,
          SECRET_FILE: secretFile,
          ACK_PROOF: JSON.stringify(proof),
        },
      },
    );
    const observed = JSON.parse(stdout) as {
      result?: { status: string; deliveredAt?: string };
      error?: { name: string; message: string };
    };

    expect(observed.error).toBeUndefined();
    expect(observed.result).toEqual(expect.objectContaining({
      status: "delivered",
      deliveredAt: "2026-07-15T12:04:00.000Z",
    }));
    expect(fs.existsSync(secretFile)).toBe(true);
    expect(getAgentRequest(request.projectId, request.id)?.status).toBe("delivered");
    expect(fs.existsSync(secretFile)).toBe(false);
  });

  it("F03 R1 keeps stale authoritative when proof and secret cleanup are invalid", async () => {
    const source = path.join(workspaceDir, "DECISION.md");
    fs.writeFileSync(source, "# 原决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-stale-cleanup",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-stale-cleanup",
      bindingId: binding.id,
      capability,
      sessionId: "session-stale-cleanup",
      turnId: "turn-stale-cleanup",
      clientRequestId: "client-stale-cleanup",
      relativePath: "DECISION.md",
      question: "是否交付？",
      options: [
        { id: "yes", label: "交付" },
        { id: "no", label: "暂不交付" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: request.projectId,
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
    });
    const secretFile = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.delivery-secret`,
    );
    fs.writeFileSync(source, "# 已变更决定\n", "utf8");
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        `
          import fs from "node:fs";
          const bridge = await import(process.env.BRIDGE_MODULE_URL);
          const originalRmSync = fs.rmSync;
          fs.rmSync = (target, options) => {
            if (String(target) === process.env.SECRET_FILE) {
              throw new Error("injected secret unlink failure");
            }
            return originalRmSync(target, options);
          };
          let error;
          try {
            bridge.acknowledgeAgentRequest(JSON.parse(process.env.ACK_PROOF));
          } catch (caught) {
            error = {
              name: caught instanceof Error ? caught.name : "unknown",
              message: caught instanceof Error ? caught.message : String(caught),
            };
          } finally {
            fs.rmSync = originalRmSync;
          }
          process.stdout.write(JSON.stringify({ error }));
        `,
      ],
      {
        env: {
          ...process.env,
          BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
          KNOWLEDGE_DATA_DIR: dataDir,
          SECRET_FILE: secretFile,
          ACK_PROOF: JSON.stringify({
            projectId: request.projectId,
            requestId: request.id,
            bindingId: binding.id,
            capability,
            requestHash: "wrong-request-hash",
            sessionId: "wrong-session",
            turnId: request.turnId,
            bindingRevision: request.bindingRevision,
            deliveryChallenge: "0".repeat(32),
          }),
        },
      },
    );
    expect(JSON.parse(stdout).error.name).toBe("AgentBridgeStaleError");
    expect(fs.existsSync(secretFile)).toBe(true);
    expect(getAgentRequest(request.projectId, request.id)).toEqual(
      expect.objectContaining({ status: "stale" }),
    );
    expect(getAgentRequest(request.projectId, request.id)?.deliveredAt)
      .toBeUndefined();
    expect(fs.existsSync(secretFile)).toBe(false);
  });

  it("F03 R1 treats source or binding drift as stale before invalid proof fields", () => {
    const source = path.join(workspaceDir, "DECISION.md");
    fs.writeFileSync(source, "# 当前决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-stale-priority",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const createAnswered = (suffix: string) => {
      const request = createAgentRequest({
        projectId: "project-stale-priority",
        bindingId: binding.id,
        capability,
        sessionId: `session-${suffix}`,
        turnId: `turn-${suffix}`,
        clientRequestId: `client-${suffix}`,
        relativePath: "DECISION.md",
        question: `是否交付 ${suffix}？`,
        options: [
          { id: "yes", label: "交付" },
          { id: "no", label: "暂不交付" },
        ],
        now: NOW,
      });
      respondToAgentRequest({
        projectId: request.projectId,
        requestId: request.id,
        requestHash: request.requestHash,
        selectedOptionId: "yes",
      });
      return request;
    };
    const sourceDrift = createAnswered("source-drift");
    fs.writeFileSync(source, "# 来源已变化\n", "utf8");

    expect(() => acknowledgeAgentRequest({
      projectId: sourceDrift.projectId,
      requestId: sourceDrift.id,
      bindingId: binding.id,
      capability,
      requestHash: "wrong-request-hash",
      sessionId: "wrong-session",
      turnId: "wrong-turn",
      bindingRevision: sourceDrift.bindingRevision + 1,
      deliveryChallenge: "0".repeat(32),
    })).toThrowError(AgentBridgeStaleError);
    expect(getAgentRequest(sourceDrift.projectId, sourceDrift.id)).toEqual(
      expect.objectContaining({ status: "stale" }),
    );
    expect(getAgentRequest(sourceDrift.projectId, sourceDrift.id)?.deliveredAt)
      .toBeUndefined();

    fs.writeFileSync(source, "# 绑定变化前\n", "utf8");
    const bindingDrift = createAnswered("binding-drift");
    const rebound = bindWorkspace({
      projectId: "project-stale-priority",
      rootPath: workspaceDir,
      now: "2026-07-15T12:10:00.000Z",
    });
    const currentCapability = readAgentCapability(rebound.id);
    expect(() => acknowledgeAgentRequest({
      projectId: bindingDrift.projectId,
      requestId: bindingDrift.id,
      bindingId: rebound.id,
      capability: currentCapability,
      requestHash: "wrong-request-hash",
      sessionId: "wrong-session",
      turnId: "wrong-turn",
      bindingRevision: bindingDrift.bindingRevision + 1,
      deliveryChallenge: "0".repeat(32),
    })).toThrowError(AgentBridgeStaleError);
    expect(getAgentRequest(bindingDrift.projectId, bindingDrift.id)).toEqual(
      expect.objectContaining({ status: "stale" }),
    );
    expect(getAgentRequest(bindingDrift.projectId, bindingDrift.id)?.deliveredAt)
      .toBeUndefined();
  });

  it("F03 R1 removes inert pending and terminal sidecars on locked observation", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-orphan-sidecars",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const makePending = (suffix: string) => createAgentRequest({
      projectId: "project-orphan-sidecars",
      bindingId: binding.id,
      capability,
      sessionId: `session-${suffix}`,
      turnId: `turn-${suffix}`,
      clientRequestId: `client-${suffix}`,
      relativePath: "DECISION.md",
      question: `是否结束 ${suffix}？`,
      options: [
        { id: "yes", label: "是" },
        { id: "no", label: "否" },
      ],
      now: NOW,
    });
    const writeOrphan = (request: ReturnType<typeof makePending>) => {
      const secretFile = path.join(
        dataDir,
        "agent-bridge",
        "requests",
        `${request.id}.delivery-secret`,
      );
      fs.writeFileSync(secretFile, JSON.stringify({
        requestId: request.id,
        requestHash: request.requestHash,
        bindingRevision: request.bindingRevision,
        sessionId: request.sessionId,
        turnId: request.turnId,
        challenge: "c".repeat(32),
      }), { mode: 0o600 });
      return secretFile;
    };

    const pending = makePending("pending");
    const pendingSecret = writeOrphan(pending);
    expect(getAgentRequestForAgent({
      projectId: pending.projectId,
      requestId: pending.id,
      bindingId: binding.id,
      capability,
    })).not.toHaveProperty("deliveryChallenge");
    expect(fs.existsSync(pendingSecret)).toBe(false);

    for (const outcome of ["cancelled", "expired"] as const) {
      const terminal = makePending(outcome);
      const terminalSecret = writeOrphan(terminal);
      cancelAgentRequest({
        projectId: terminal.projectId,
        requestId: terminal.id,
        bindingId: binding.id,
        capability,
        requestHash: terminal.requestHash,
        outcome,
      });
      expect(getAgentRequestForAgent({
        projectId: terminal.projectId,
        requestId: terminal.id,
        bindingId: binding.id,
        capability,
      })).not.toHaveProperty("deliveryChallenge");
      expect(() => acknowledgeAgentRequest({
        projectId: terminal.projectId,
        requestId: terminal.id,
        bindingId: binding.id,
        capability,
        requestHash: terminal.requestHash,
        sessionId: terminal.sessionId,
        turnId: terminal.turnId,
        bindingRevision: terminal.bindingRevision,
        deliveryChallenge: "c".repeat(32),
      })).toThrowError(AgentBridgeConflictError);
      expect(getAgentRequest(terminal.projectId, terminal.id)?.deliveredAt)
        .toBeUndefined();
      expect(fs.existsSync(terminalSecret)).toBe(false);
    }
  });

  it("F03 R1 releases a project lock only while its ownership token still matches", async () => {
    const projectId = "project-token-release";
    bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockDir = `${bindingPath}.lockdir`;
    const controlDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-token-lock-control-"),
    );
    const ready = path.join(controlDir, "ready");
    const release = path.join(controlDir, "release");
    const worker = startTestWorker(
      `
        import fs from "node:fs";
        const originalRenameSync = fs.renameSync;
        let paused = false;
        fs.renameSync = (from, to) => {
          if (!paused && String(to) === process.env.BINDING_FILE) {
            paused = true;
            fs.writeFileSync(process.env.READY_FILE, "ready");
            while (!fs.existsSync(process.env.RELEASE_FILE)) {
              try {
                process.kill(Number(process.env.TEST_PARENT_PID), 0);
              } catch {
                process.exit(124);
              }
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
            }
          }
          return originalRenameSync(from, to);
        };
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        const result = bridge.bindWorkspace({
          projectId: process.env.PROJECT_ID,
          rootPath: process.env.WORKSPACE_DIR,
          now: "2026-07-15T12:20:00.000Z",
        });
        process.stdout.write(JSON.stringify(result));
      `,
      {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        PROJECT_ID: projectId,
        WORKSPACE_DIR: workspaceDir,
        BINDING_FILE: bindingPath,
        READY_FILE: ready,
        RELEASE_FILE: release,
        TEST_PARENT_PID: String(process.pid),
      },
    );

    try {
      await waitForAllMarkers([ready], 5_000);
      const ownerFile = fs.lstatSync(lockDir).isDirectory()
        ? path.join(lockDir, "owner")
        : lockDir;
      const originalOwner = JSON.parse(
        fs.readFileSync(ownerFile, "utf8"),
      ) as { pid: number; token: string };
      expect(originalOwner.token).toMatch(/^[a-f0-9]{64}$/);
      const replacementOwner = {
        pid: process.pid,
        token: "b".repeat(64),
      };
      fs.writeFileSync(
        ownerFile,
        `${JSON.stringify(replacementOwner)}\n`,
        { mode: 0o600 },
      );
      fs.writeFileSync(release, "release");
      await withTimeout(worker.result, 5_000, "token release worker");
      expect(fs.existsSync(lockDir)).toBe(true);
      expect(JSON.parse(fs.readFileSync(ownerFile, "utf8")))
        .toEqual(replacementOwner);
    } finally {
      fs.writeFileSync(release, "release");
      await settleTestWorkers([worker]);
      fs.rmSync(lockDir, { recursive: true, force: true });
      fs.rmSync(controlDir, { recursive: true, force: true });
    }
  }, 10_000);

  it("F03 R1 leaves a successor request lock when the prior owner token no longer matches", async () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const projectId = "project-request-token-release";
    const binding = bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId,
      bindingId: binding.id,
      capability,
      sessionId: "session-request-token-release",
      turnId: "turn-request-token-release",
      clientRequestId: "client-request-token-release",
      relativePath: "DECISION.md",
      question: "是否交付？",
      options: [
        { id: "yes", label: "交付" },
        { id: "no", label: "暂不交付" },
      ],
      now: NOW,
    });
    const requestPath = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.json`,
    );
    const requestLock = `${requestPath}.lock`;
    const controlDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-request-token-control-"),
    );
    const ready = path.join(controlDir, "ready");
    const release = path.join(controlDir, "release");
    const worker = startTestWorker(
      `
        import fs from "node:fs";
        const originalRenameSync = fs.renameSync;
        let paused = false;
        fs.renameSync = (from, to) => {
          if (!paused && String(to) === process.env.REQUEST_FILE) {
            paused = true;
            fs.writeFileSync(process.env.READY_FILE, "ready");
            while (!fs.existsSync(process.env.RELEASE_FILE)) {
              try {
                process.kill(Number(process.env.TEST_PARENT_PID), 0);
              } catch {
                process.exit(124);
              }
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
            }
          }
          return originalRenameSync(from, to);
        };
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        const result = bridge.respondToAgentRequest(
          JSON.parse(process.env.RESPONSE_INPUT),
        );
        process.stdout.write(JSON.stringify(result));
      `,
      {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        REQUEST_FILE: requestPath,
        READY_FILE: ready,
        RELEASE_FILE: release,
        TEST_PARENT_PID: String(process.pid),
        RESPONSE_INPUT: JSON.stringify({
          projectId,
          requestId: request.id,
          requestHash: request.requestHash,
          selectedOptionId: "yes",
          now: "2026-07-15T12:21:00.000Z",
        }),
      },
    );

    try {
      await waitForAllMarkers([ready], 5_000);
      const originalOwner = JSON.parse(fs.readFileSync(requestLock, "utf8")) as {
        pid: number;
        token: string;
      };
      expect(originalOwner.token).toMatch(/^[a-f0-9]{64}$/);
      const successorOwner = {
        pid: process.pid,
        token: "d".repeat(64),
      };
      fs.writeFileSync(requestLock, `${JSON.stringify(successorOwner)}\n`, {
        mode: 0o600,
      });
      fs.writeFileSync(release, "release");
      const { stdout } = await withTimeout(
        worker.result,
        5_000,
        "request token release worker",
      );
      expect(JSON.parse(stdout).status).toBe("answered");
      expect(fs.existsSync(requestLock)).toBe(true);
      expect(JSON.parse(fs.readFileSync(requestLock, "utf8")))
        .toEqual(successorOwner);
    } finally {
      fs.writeFileSync(release, "release");
      await settleTestWorkers([worker]);
      fs.rmSync(requestLock, { force: true });
      fs.rmSync(controlDir, { recursive: true, force: true });
    }
  }, 10_000);

  it("F03 R2 serializes two project recoverers after both observe one dead owner", async () => {
    const projectId = "project-double-recovery";
    const initial = bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockDir = `${bindingPath}.lockdir`;
    const recoveryDir = `${lockDir}.recovery`;
    fs.writeFileSync(
      lockDir,
      `${JSON.stringify({ pid: 999999999, token: "a".repeat(64) })}\n`,
      { mode: 0o600 },
    );
    const controlDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-project-double-recovery-"),
    );
    const marker = (name: string) => path.join(controlDir, name);
    const workerScript = `
      import fs from "node:fs";
      const marker = (name) => process.env.CONTROL_DIR + "/" + name;
      const wait = (name) => {
        while (!fs.existsSync(marker(name))) {
          try { process.kill(Number(process.env.TEST_PARENT_PID), 0); }
          catch { process.exit(124); }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        }
      };
      const originalReadFileSync = fs.readFileSync;
      fs.readFileSync = function(target, ...args) {
        const value = originalReadFileSync.call(fs, target, ...args);
        if (
          process.env.ROLE === "A"
          && String(target) === process.env.OWNER_FILE
          && String(value).includes("999999999")
        ) {
          fs.writeFileSync(marker("a-observed-dead"), "ready");
        }
        return value;
      };
      const originalAppendFileSync = fs.appendFileSync;
      fs.appendFileSync = function(target, ...args) {
        const result = originalAppendFileSync.call(fs, target, ...args);
        if (
          process.env.ROLE === "A"
          && String(target) === process.env.RECOVERY_DIR
        ) {
          fs.writeFileSync(marker("a-blocked-recovery"), "ready");
        }
        return result;
      };
      if (process.env.ROLE === "B") {
        const originalRmSync = fs.rmSync;
        let pausedRecoveryDelete = false;
        fs.rmSync = function(target, options) {
          if (!pausedRecoveryDelete && String(target) === process.env.LOCK_DIR) {
            pausedRecoveryDelete = true;
            fs.writeFileSync(marker("b-before-recovery-delete"), "ready");
            wait("allow-b-recovery-delete");
          }
          return originalRmSync.call(fs, target, options);
        };
      }
      const originalRenameSync = fs.renameSync;
      let pausedPublish = false;
      fs.renameSync = function(source, target) {
        if (!pausedPublish && String(target) === process.env.BINDING_FILE) {
          pausedPublish = true;
          fs.writeFileSync(marker(process.env.ROLE.toLowerCase() + "-before-publish"), "ready");
          wait("release-" + process.env.ROLE.toLowerCase() + "-publish");
        }
        return originalRenameSync.call(fs, source, target);
      };
      const bridge = await import(process.env.BRIDGE_MODULE_URL);
      let result;
      let error;
      try {
        result = bridge.bindWorkspace({
          projectId: process.env.PROJECT_ID,
          rootPath: process.env.WORKSPACE_DIR,
          now: process.env.ROLE === "A"
            ? "2026-07-16T00:00:01.000Z"
            : "2026-07-16T00:00:02.000Z",
        });
      } catch (caught) {
        error = {
          code: caught?.code ?? null,
          reason: caught?.reason ?? null,
          retryable: caught?.retryable ?? null,
        };
      }
      process.stdout.write(JSON.stringify({ result, error }));
    `;
    const commonEnvironment = {
      ...process.env,
      BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
      KNOWLEDGE_DATA_DIR: dataDir,
      CONTROL_DIR: controlDir,
      TEST_PARENT_PID: String(process.pid),
      PROJECT_ID: projectId,
      WORKSPACE_DIR: workspaceDir,
      BINDING_FILE: bindingPath,
      LOCK_DIR: lockDir,
      OWNER_FILE: lockDir,
      RECOVERY_DIR: recoveryDir,
    };
    const workerB = startTestWorker(workerScript, {
      ...commonEnvironment,
      ROLE: "B",
    });
    let workerA: TestWorker | undefined;

    try {
      await waitForAllMarkers([marker("b-before-recovery-delete")], 5_000);
      workerA = startTestWorker(workerScript, {
        ...commonEnvironment,
        ROLE: "A",
      });
      await waitForAllMarkers([marker("a-observed-dead")], 5_000);
      const aOutput = JSON.parse((await withTimeout(
        workerA.result,
        5_000,
        "blocked project recovery worker A",
      )).stdout) as {
        result?: { revision: number };
        error?: { code: string; reason: string; retryable: boolean };
      };
      expect(aOutput.result).toBeUndefined();
      expect(aOutput.error).toEqual({
        code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
        reason: "claim-live-or-ambiguous",
        retryable: false,
      });
      expect(fs.existsSync(marker("a-before-publish"))).toBe(false);
      expect(fs.existsSync(marker("a-blocked-recovery"))).toBe(false);
      fs.writeFileSync(marker("allow-b-recovery-delete"), "go");
      await waitForAllMarkers([marker("b-before-publish")], 5_000);
      fs.writeFileSync(marker("release-b-publish"), "go");
      const bOutput = JSON.parse((await withTimeout(
        workerB.result,
        5_000,
        "project recovery worker B",
      )).stdout) as {
        result?: { revision: number };
        error?: unknown;
      };
      expect(bOutput.error).toBeUndefined();
      expect(bOutput.result?.revision).toBe(initial.revision + 1);
      const later = bindWorkspace({
        projectId,
        rootPath: workspaceDir,
        now: "2026-07-16T00:00:03.000Z",
      });
      const finalBinding = JSON.parse(fs.readFileSync(bindingPath, "utf8")) as {
        revision: number;
      };
      expect(later.revision).toBe(initial.revision + 2);
      expect(finalBinding.revision).toBe(initial.revision + 2);
    } finally {
      for (const release of [
        "allow-b-recovery-delete",
        "release-a-publish",
        "release-b-publish",
      ]) {
        fs.writeFileSync(marker(release), "go");
      }
      await settleTestWorkers([workerB, ...(workerA ? [workerA] : [])]);
      fs.rmSync(lockDir, { recursive: true, force: true });
      fs.rmSync(recoveryDir, { recursive: true, force: true });
      fs.rmSync(controlDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("F03 R2 prevents a second request recoverer from deleting a live successor", async () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const ownerProject = "project-request-recovery-owner";
    const foreignProject = "project-request-recovery-foreign";
    const ownerBinding = bindWorkspace({
      projectId: ownerProject,
      rootPath: workspaceDir,
      now: NOW,
    });
    const foreignBinding = bindWorkspace({
      projectId: foreignProject,
      rootPath: workspaceDir,
      now: NOW,
    });
    const ownerCapability = readAgentCapability(ownerBinding.id);
    const foreignCapability = readAgentCapability(foreignBinding.id);
    const request = createAgentRequest({
      projectId: ownerProject,
      bindingId: ownerBinding.id,
      capability: ownerCapability,
      sessionId: "session-request-double-recovery",
      turnId: "turn-request-double-recovery",
      clientRequestId: "client-request-double-recovery",
      relativePath: "DECISION.md",
      question: "是否读取？",
      options: [
        { id: "yes", label: "读取" },
        { id: "no", label: "暂不读取" },
      ],
      now: NOW,
    });
    const requestPath = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.json`,
    );
    const requestLock = `${requestPath}.lock`;
    const recoveryDir = `${requestLock}.recovery`;
    fs.writeFileSync(
      requestLock,
      `${JSON.stringify({ pid: 999999999, token: "a".repeat(64) })}\n`,
      { mode: 0o600 },
    );
    const controlDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-request-double-recovery-"),
    );
    const marker = (name: string) => path.join(controlDir, name);
    const workerScript = `
      import fs from "node:fs";
      const marker = (name) => process.env.CONTROL_DIR + "/" + name;
      const wait = (name) => {
        while (!fs.existsSync(marker(name))) {
          try { process.kill(Number(process.env.TEST_PARENT_PID), 0); }
          catch { process.exit(124); }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        }
      };
      const originalReadFileSync = fs.readFileSync;
      let pausedInside = false;
      fs.readFileSync = function(target, ...args) {
        const value = originalReadFileSync.call(fs, target, ...args);
        if (
          process.env.ROLE === "A"
          && String(target) === process.env.REQUEST_LOCK
          && String(value).includes("999999999")
        ) {
          fs.writeFileSync(marker("a-observed-dead"), "ready");
        }
        if (!pausedInside && String(target) === process.env.REQUEST_FILE) {
          pausedInside = true;
          fs.writeFileSync(marker(process.env.ROLE.toLowerCase() + "-inside"), "ready");
          wait("release-" + process.env.ROLE.toLowerCase() + "-inside");
        }
        return value;
      };
      const originalAppendFileSync = fs.appendFileSync;
      fs.appendFileSync = function(target, ...args) {
        const result = originalAppendFileSync.call(fs, target, ...args);
        if (
          process.env.ROLE === "A"
          && String(target) === process.env.RECOVERY_DIR
        ) {
          fs.writeFileSync(marker("a-blocked-recovery"), "ready");
        }
        return result;
      };
      if (process.env.ROLE === "B") {
        const originalRmSync = fs.rmSync;
        let pausedRecoveryDelete = false;
        fs.rmSync = function(target, options) {
          if (!pausedRecoveryDelete && String(target) === process.env.REQUEST_LOCK) {
            pausedRecoveryDelete = true;
            fs.writeFileSync(marker("b-before-recovery-delete"), "ready");
            wait("allow-b-recovery-delete");
          }
          return originalRmSync.call(fs, target, options);
        };
      }
      const bridge = await import(process.env.BRIDGE_MODULE_URL);
      let result;
      let error;
      try {
        result = bridge.getAgentRequestForAgent({
          projectId: process.env.PROJECT_ID,
          requestId: process.env.REQUEST_ID,
          bindingId: process.env.BINDING_ID,
          capability: process.env.CAPABILITY,
        });
      } catch (caught) {
        error = {
          name: caught instanceof Error ? caught.name : "unknown",
          message: caught instanceof Error ? caught.message : String(caught),
          code: caught?.code ?? null,
          reason: caught?.reason ?? null,
          retryable: caught?.retryable ?? null,
        };
      }
      process.stdout.write(JSON.stringify({ result, error }));
    `;
    const commonEnvironment = {
      ...process.env,
      BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
      KNOWLEDGE_DATA_DIR: dataDir,
      CONTROL_DIR: controlDir,
      TEST_PARENT_PID: String(process.pid),
      REQUEST_ID: request.id,
      REQUEST_FILE: requestPath,
      REQUEST_LOCK: requestLock,
      RECOVERY_DIR: recoveryDir,
    };
    const workerB = startTestWorker(workerScript, {
      ...commonEnvironment,
      ROLE: "B",
      PROJECT_ID: foreignProject,
      BINDING_ID: foreignBinding.id,
      CAPABILITY: foreignCapability,
    });
    let workerA: TestWorker | undefined;

    try {
      await waitForAllMarkers([marker("b-before-recovery-delete")], 5_000);
      workerA = startTestWorker(workerScript, {
        ...commonEnvironment,
        ROLE: "A",
        PROJECT_ID: ownerProject,
        BINDING_ID: ownerBinding.id,
        CAPABILITY: ownerCapability,
      });
      await waitForAllMarkers([marker("a-observed-dead")], 5_000);
      const aOutput = JSON.parse((await withTimeout(
        workerA.result,
        5_000,
        "blocked request recovery worker A",
      )).stdout) as {
        result?: { status: string };
        error?: { code: string; reason: string; retryable: boolean };
      };
      expect(aOutput.result).toBeUndefined();
      expect(aOutput.error).toEqual(expect.objectContaining({
        code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
        reason: "claim-live-or-ambiguous",
        retryable: false,
      }));
      expect(fs.existsSync(marker("a-inside"))).toBe(false);
      expect(fs.existsSync(marker("a-blocked-recovery"))).toBe(false);
      fs.writeFileSync(marker("allow-b-recovery-delete"), "go");
      await waitForAllMarkers([marker("b-inside")], 5_000);
      expect(fs.existsSync(marker("a-inside"))).toBe(false);
      fs.writeFileSync(marker("release-b-inside"), "go");
      const bOutput = JSON.parse((await withTimeout(
        workerB.result,
        5_000,
        "request recovery worker B",
      )).stdout) as {
        result?: { status: string };
        error?: { name: string };
      };
      expect(bOutput.result).toBeUndefined();
      expect(bOutput.error?.name).toBe("Error");
      expect(getAgentRequestForAgent({
        projectId: ownerProject,
        requestId: request.id,
        bindingId: ownerBinding.id,
        capability: ownerCapability,
      }).status).toBe("pending");
    } finally {
      for (const release of [
        "allow-b-recovery-delete",
        "release-a-inside",
        "release-b-inside",
      ]) {
        fs.writeFileSync(marker(release), "go");
      }
      await settleTestWorkers([workerB, ...(workerA ? [workerA] : [])]);
      fs.rmSync(requestLock, { force: true });
      fs.rmSync(recoveryDir, { recursive: true, force: true });
      fs.rmSync(controlDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("F03 R3 keeps project critical sections disjoint across lock identity publication", async () => {
    const projectId = "project-publication-window";
    bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockPath = `${bindingPath}.lockdir`;
    const controlDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-project-publication-window-"),
    );
    const marker = (name: string) => path.join(controlDir, name);
    const workerScript = `
      import fs from "node:fs";
      const marker = (name) => process.env.CONTROL_DIR + "/" + name;
      const wait = (name) => {
        while (!fs.existsSync(marker(name))) {
          try { process.kill(Number(process.env.TEST_PARENT_PID), 0); }
          catch { process.exit(124); }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        }
      };
      const originalWriteFileSync = fs.writeFileSync;
      let pausedOwnerPublication = false;
      fs.writeFileSync = function(target, ...args) {
        if (
          process.env.ROLE === "CREATOR"
          && !pausedOwnerPublication
          && String(target) === process.env.OWNER_FILE
        ) {
          pausedOwnerPublication = true;
          originalWriteFileSync(marker("creator-before-publish"), "ready");
          wait("release-creator-publish");
        }
        return originalWriteFileSync.call(fs, target, ...args);
      };
      const originalLinkSync = fs.linkSync;
      let pausedAtomicPublication = false;
      fs.linkSync = function(source, target) {
        if (
          process.env.ROLE === "CREATOR"
          && !pausedAtomicPublication
          && String(target) === process.env.LOCK_PATH
        ) {
          pausedAtomicPublication = true;
          originalWriteFileSync(marker("creator-before-publish"), "ready");
          wait("release-creator-publish");
        }
        return originalLinkSync.call(fs, source, target);
      };
      if (process.env.ROLE === "RECOVERER") {
        const originalRmSync = fs.rmSync;
        let pausedRecoveryDelete = false;
        fs.rmSync = function(target, options) {
          if (!pausedRecoveryDelete && String(target) === process.env.LOCK_PATH) {
            pausedRecoveryDelete = true;
            originalWriteFileSync(marker("recoverer-before-delete"), "ready");
            wait("allow-recoverer-delete");
          }
          return originalRmSync.call(fs, target, options);
        };
      }
      const originalRenameSync = fs.renameSync;
      let pausedInside = false;
      fs.renameSync = function(source, target) {
        if (!pausedInside && String(target) === process.env.BINDING_FILE) {
          pausedInside = true;
          originalWriteFileSync(
            marker(process.env.ROLE.toLowerCase() + "-inside"),
            "ready",
          );
          wait("release-" + process.env.ROLE.toLowerCase() + "-inside");
        }
        return originalRenameSync.call(fs, source, target);
      };
      const bridge = await import(process.env.BRIDGE_MODULE_URL);
      let result;
      let error;
      try {
        result = bridge.bindWorkspace({
          projectId: process.env.PROJECT_ID,
          rootPath: process.env.WORKSPACE_DIR,
          now: process.env.ROLE === "CREATOR"
            ? "2026-07-16T01:00:01.000Z"
            : "2026-07-16T01:00:02.000Z",
        });
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      process.stdout.write(JSON.stringify({ result, error }));
    `;
    const commonEnvironment = {
      ...process.env,
      BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
      KNOWLEDGE_DATA_DIR: dataDir,
      CONTROL_DIR: controlDir,
      TEST_PARENT_PID: String(process.pid),
      PROJECT_ID: projectId,
      WORKSPACE_DIR: workspaceDir,
      BINDING_FILE: bindingPath,
      LOCK_PATH: lockPath,
      OWNER_FILE: path.join(lockPath, "owner"),
    };
    const creator = startTestWorker(workerScript, {
      ...commonEnvironment,
      ROLE: "CREATOR",
    });
    let recoverer: TestWorker | undefined;
    let overlapped = false;

    try {
      await waitForAllMarkers([marker("creator-before-publish")], 5_000);
      if (fs.existsSync(lockPath)) {
        const oldTime = Date.now() - 120_000;
        fs.utimesSync(lockPath, oldTime / 1000, oldTime / 1000);
      }
      recoverer = startTestWorker(workerScript, {
        ...commonEnvironment,
        ROLE: "RECOVERER",
      });
      const recovererState = await waitForAnyMarker([
        marker("recoverer-before-delete"),
        marker("recoverer-inside"),
      ], 5_000);

      if (recovererState === marker("recoverer-before-delete")) {
        fs.writeFileSync(marker("release-creator-publish"), "go");
        await waitForAllMarkers([marker("creator-inside")], 5_000);
        fs.writeFileSync(marker("allow-recoverer-delete"), "go");
        await waitForAllMarkers([marker("recoverer-inside")], 5_000);
        overlapped = true;
      } else {
        expect(fs.existsSync(marker("creator-inside"))).toBe(false);
        fs.writeFileSync(marker("release-creator-publish"), "go");
        expect(fs.existsSync(marker("creator-inside"))).toBe(false);
        fs.writeFileSync(marker("release-recoverer-inside"), "go");
      }

      expect(overlapped).toBe(false);
    } finally {
      for (const release of [
        "release-creator-publish",
        "allow-recoverer-delete",
        "release-creator-inside",
        "release-recoverer-inside",
      ]) {
        fs.writeFileSync(marker(release), "go");
      }
      await settleTestWorkers([creator, ...(recoverer ? [recoverer] : [])]);
      fs.rmSync(lockPath, { recursive: true, force: true });
      fs.rmSync(`${lockPath}.recovery`, { force: true });
      fs.rmSync(controlDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("F03 R3 keeps request critical sections disjoint across lock identity publication", async () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const projectId = "project-request-publication-window";
    const foreignProjectId = "project-request-publication-window-foreign";
    const binding = bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const foreignBinding = bindWorkspace({
      projectId: foreignProjectId,
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const foreignCapability = readAgentCapability(foreignBinding.id);
    const request = createAgentRequest({
      projectId,
      bindingId: binding.id,
      capability,
      sessionId: "session-request-publication-window",
      turnId: "turn-request-publication-window",
      clientRequestId: "client-request-publication-window",
      relativePath: "DECISION.md",
      question: "是否读取？",
      options: [
        { id: "yes", label: "读取" },
        { id: "no", label: "暂不读取" },
      ],
      now: NOW,
    });
    const requestPath = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.json`,
    );
    const lockPath = `${requestPath}.lock`;
    const controlDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-request-publication-window-"),
    );
    const marker = (name: string) => path.join(controlDir, name);
    const workerScript = `
      import fs from "node:fs";
      const marker = (name) => process.env.CONTROL_DIR + "/" + name;
      const wait = (name) => {
        while (!fs.existsSync(marker(name))) {
          try { process.kill(Number(process.env.TEST_PARENT_PID), 0); }
          catch { process.exit(124); }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        }
      };
      const originalWriteFileSync = fs.writeFileSync;
      let pausedLegacyPublication = false;
      fs.writeFileSync = function(target, data, options) {
        if (
          process.env.ROLE === "CREATOR"
          && !pausedLegacyPublication
          && String(target) === process.env.LOCK_PATH
        ) {
          pausedLegacyPublication = true;
          const descriptor = fs.openSync(target, "wx", 0o600);
          originalWriteFileSync(marker("creator-before-publish"), "ready");
          wait("release-creator-publish");
          try {
            return originalWriteFileSync.call(fs, descriptor, data, options);
          } finally {
            fs.closeSync(descriptor);
          }
        }
        return originalWriteFileSync.call(fs, target, data, options);
      };
      const originalLinkSync = fs.linkSync;
      let pausedAtomicPublication = false;
      fs.linkSync = function(source, target) {
        if (
          process.env.ROLE === "CREATOR"
          && !pausedAtomicPublication
          && String(target) === process.env.LOCK_PATH
        ) {
          pausedAtomicPublication = true;
          originalWriteFileSync(marker("creator-before-publish"), "ready");
          wait("release-creator-publish");
        }
        return originalLinkSync.call(fs, source, target);
      };
      if (process.env.ROLE === "RECOVERER") {
        const originalRmSync = fs.rmSync;
        let pausedRecoveryDelete = false;
        fs.rmSync = function(target, options) {
          if (!pausedRecoveryDelete && String(target) === process.env.LOCK_PATH) {
            pausedRecoveryDelete = true;
            originalWriteFileSync(marker("recoverer-before-delete"), "ready");
            wait("allow-recoverer-delete");
          }
          return originalRmSync.call(fs, target, options);
        };
      }
      const originalReadFileSync = fs.readFileSync;
      let pausedInside = false;
      fs.readFileSync = function(target, ...args) {
        if (!pausedInside && String(target) === process.env.REQUEST_FILE) {
          pausedInside = true;
          originalWriteFileSync(
            marker(process.env.ROLE.toLowerCase() + "-inside"),
            "ready",
          );
          wait("release-" + process.env.ROLE.toLowerCase() + "-inside");
        }
        return originalReadFileSync.call(fs, target, ...args);
      };
      const bridge = await import(process.env.BRIDGE_MODULE_URL);
      let result;
      let error;
      try {
        result = bridge.getAgentRequestForAgent({
          projectId: process.env.PROJECT_ID,
          requestId: process.env.REQUEST_ID,
          bindingId: process.env.BINDING_ID,
          capability: process.env.CAPABILITY,
        });
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      process.stdout.write(JSON.stringify({ result, error }));
    `;
    const commonEnvironment = {
      ...process.env,
      BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
      KNOWLEDGE_DATA_DIR: dataDir,
      CONTROL_DIR: controlDir,
      TEST_PARENT_PID: String(process.pid),
      REQUEST_ID: request.id,
      REQUEST_FILE: requestPath,
      LOCK_PATH: lockPath,
    };
    const creator = startTestWorker(workerScript, {
      ...commonEnvironment,
      ROLE: "CREATOR",
      PROJECT_ID: projectId,
      BINDING_ID: binding.id,
      CAPABILITY: capability,
    });
    let recoverer: TestWorker | undefined;
    let overlapped = false;

    try {
      await waitForAllMarkers([marker("creator-before-publish")], 5_000);
      if (fs.existsSync(lockPath)) {
        const oldTime = Date.now() - 120_000;
        fs.utimesSync(lockPath, oldTime / 1000, oldTime / 1000);
      }
      recoverer = startTestWorker(workerScript, {
        ...commonEnvironment,
        ROLE: "RECOVERER",
        PROJECT_ID: foreignProjectId,
        BINDING_ID: foreignBinding.id,
        CAPABILITY: foreignCapability,
      });
      const recovererState = await waitForAnyMarker([
        marker("recoverer-before-delete"),
        marker("recoverer-inside"),
      ], 5_000);

      if (recovererState === marker("recoverer-before-delete")) {
        fs.writeFileSync(marker("release-creator-publish"), "go");
        await waitForAllMarkers([marker("creator-inside")], 5_000);
        fs.writeFileSync(marker("allow-recoverer-delete"), "go");
        await waitForAllMarkers([marker("recoverer-inside")], 5_000);
        overlapped = true;
      } else {
        expect(fs.existsSync(marker("creator-inside"))).toBe(false);
        fs.writeFileSync(marker("release-creator-publish"), "go");
        expect(fs.existsSync(marker("creator-inside"))).toBe(false);
        fs.writeFileSync(marker("release-recoverer-inside"), "go");
      }

      expect(overlapped).toBe(false);
    } finally {
      for (const release of [
        "release-creator-publish",
        "allow-recoverer-delete",
        "release-creator-inside",
        "release-recoverer-inside",
      ]) {
        fs.writeFileSync(marker(release), "go");
      }
      await settleTestWorkers([creator, ...(recoverer ? [recoverer] : [])]);
      fs.rmSync(lockPath, { force: true });
      fs.rmSync(`${lockPath}.recovery`, { force: true });
      fs.rmSync(controlDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("B01 recovery RED1 requires manual recovery for one poisoned live-PID claim without mutation", async () => {
    const projectId = "project-recovery-poisoned-claim";
    bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockPath = `${bindingPath}.lockdir`;
    const recoveryFile = `${lockPath}.recovery`;
    fs.writeFileSync(
      lockPath,
      `${JSON.stringify({ pid: 999999999, token: "a".repeat(64) })}\n`,
      { mode: 0o600 },
    );
    const originalRecovery = `${JSON.stringify({
      operation: "acquire",
      pid: process.pid,
      token: "b".repeat(64),
    })}\n`;
    fs.writeFileSync(recoveryFile, originalRecovery, { mode: 0o600 });

    const worker = startTestWorker(
      `
        import fs from "node:fs";
        const originalReadFileSync = fs.readFileSync;
        const originalAppendFileSync = fs.appendFileSync;
        const originalRmSync = fs.rmSync;
        const calls = { scans: 0, appends: 0, lockRemovals: 0 };
        fs.readFileSync = function(target, ...args) {
          if (String(target) === process.env.RECOVERY_FILE) calls.scans += 1;
          return originalReadFileSync.call(fs, target, ...args);
        };
        fs.appendFileSync = function(target, ...args) {
          if (String(target) === process.env.RECOVERY_FILE) calls.appends += 1;
          return originalAppendFileSync.call(fs, target, ...args);
        };
        fs.rmSync = function(target, options) {
          if (String(target) === process.env.LOCK_PATH) calls.lockRemovals += 1;
          return originalRmSync.call(fs, target, options);
        };
        let clockReads = 0;
        Date.now = () => clockReads++ < 2 ? 0 : 30_001;
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        let error;
        try {
          bridge.bindWorkspace({
            projectId: process.env.PROJECT_ID,
            rootPath: process.env.WORKSPACE_DIR,
            now: "2026-07-16T03:20:00.000Z",
          });
        } catch (caught) {
          error = {
            name: caught instanceof Error ? caught.name : "unknown",
            code: caught?.code ?? null,
            reason: caught?.reason ?? null,
            retryable: caught?.retryable ?? null,
            message: caught instanceof Error ? caught.message : String(caught),
          };
        }
        process.stdout.write(JSON.stringify({ error, calls }));
      `,
      {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        PROJECT_ID: projectId,
        WORKSPACE_DIR: workspaceDir,
        LOCK_PATH: lockPath,
        RECOVERY_FILE: recoveryFile,
      },
    );

    const output = JSON.parse((await withTimeout(
      worker.result,
      2_000,
      "poisoned recovery claim worker",
    )).stdout) as {
      error: { code: string; reason: string; retryable: boolean; message: string };
      calls: { scans: number; appends: number; lockRemovals: number };
    };
    expect(output.error).toEqual(expect.objectContaining({
      code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
      reason: "claim-live-or-ambiguous",
      retryable: false,
    }));
    expect(output.calls).toEqual({ scans: 1, appends: 0, lockRemovals: 0 });
    expect(fs.readFileSync(recoveryFile, "utf8")).toBe(originalRecovery);
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("B01 recovery RED2 makes a lost release append explicit and poisons later same-PID recovery", async () => {
    const projectId = "project-recovery-release-eio";
    bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockPath = `${bindingPath}.lockdir`;
    const recoveryFile = `${lockPath}.recovery`;
    const deadOwner = `${JSON.stringify({
      pid: 999999999,
      token: "c".repeat(64),
    })}\n`;
    fs.writeFileSync(lockPath, deadOwner, { mode: 0o600 });

    const worker = startTestWorker(
      `
        import fs from "node:fs";
        const originalReadFileSync = fs.readFileSync;
        const originalAppendFileSync = fs.appendFileSync;
        const originalRmSync = fs.rmSync;
        let loseRelease = true;
        let phase = "first";
        const calls = {
          first: { scans: 0, appends: 0, lockRemovals: 0 },
          second: { scans: 0, appends: 0, lockRemovals: 0 },
        };
        fs.readFileSync = function(target, ...args) {
          if (String(target) === process.env.RECOVERY_FILE) calls[phase].scans += 1;
          return originalReadFileSync.call(fs, target, ...args);
        };
        fs.appendFileSync = function(target, data, ...args) {
          if (String(target) === process.env.RECOVERY_FILE) {
            calls[phase].appends += 1;
            const event = JSON.parse(String(data));
            if (loseRelease && event.operation === "release") {
              loseRelease = false;
              const error = new Error("simulated release EIO " + process.env.LOCK_PATH);
              error.code = "EIO";
              throw error;
            }
          }
          return originalAppendFileSync.call(fs, target, data, ...args);
        };
        fs.rmSync = function(target, options) {
          if (String(target) === process.env.LOCK_PATH) calls[phase].lockRemovals += 1;
          return originalRmSync.call(fs, target, options);
        };
        const describeError = (caught) => ({
          name: caught instanceof Error ? caught.name : "unknown",
          code: caught?.code ?? null,
          reason: caught?.reason ?? null,
          retryable: caught?.retryable ?? null,
          message: caught instanceof Error ? caught.message : String(caught),
        });
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        let firstError;
        try {
          bridge.bindWorkspace({
            projectId: process.env.PROJECT_ID,
            rootPath: process.env.WORKSPACE_DIR,
            now: "2026-07-16T03:21:00.000Z",
          });
        } catch (caught) {
          firstError = describeError(caught);
        }
        originalReadFileSync(process.env.BINDING_FILE, "utf8");
        fs.writeFileSync(process.env.LOCK_PATH, process.env.DEAD_OWNER, { mode: 0o600 });
        phase = "second";
        let clockReads = 0;
        Date.now = () => clockReads++ < 2 ? 0 : 30_001;
        let secondError;
        try {
          bridge.bindWorkspace({
            projectId: process.env.PROJECT_ID,
            rootPath: process.env.WORKSPACE_DIR,
            now: "2026-07-16T03:22:00.000Z",
          });
        } catch (caught) {
          secondError = describeError(caught);
        }
        process.stdout.write(JSON.stringify({ firstError, secondError, calls }));
      `,
      {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        PROJECT_ID: projectId,
        WORKSPACE_DIR: workspaceDir,
        BINDING_FILE: bindingPath,
        LOCK_PATH: lockPath,
        RECOVERY_FILE: recoveryFile,
        DEAD_OWNER: deadOwner,
      },
    );

    const output = JSON.parse((await withTimeout(
      worker.result,
      2_000,
      "release append failure worker",
    )).stdout) as {
      firstError: { code: string; reason: string; retryable: boolean; message: string };
      secondError: { code: string; reason: string; retryable: boolean; message: string };
      calls: Record<"first" | "second", {
        scans: number;
        appends: number;
        lockRemovals: number;
      }>;
    };
    expect(output.firstError).toEqual(expect.objectContaining({
      code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
      reason: "claim-release-failed",
      retryable: false,
    }));
    expect(output.secondError).toEqual(expect.objectContaining({
      code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
      reason: "claim-live-or-ambiguous",
      retryable: false,
    }));
    expect(output.firstError.message).not.toContain(lockPath);
    expect(output.secondError.message).not.toContain(lockPath);
    expect(output.calls.first.lockRemovals).toBe(1);
    expect(output.calls.second).toEqual({ scans: 1, appends: 0, lockRemovals: 0 });
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("B01 recovery RED3 exits one contender while a holder is paused and a later call succeeds", async () => {
    const projectId = "project-recovery-paused-holder";
    const initial = bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockPath = `${bindingPath}.lockdir`;
    const recoveryFile = `${lockPath}.recovery`;
    fs.writeFileSync(
      lockPath,
      `${JSON.stringify({ pid: 999999999, token: "d".repeat(64) })}\n`,
      { mode: 0o600 },
    );
    const controlDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "fc-opc-recovery-paused-holder-"),
    );
    const holderPaused = path.join(controlDir, "holder-paused");
    const releaseHolder = path.join(controlDir, "release-holder");
    const contenderInside = path.join(controlDir, "contender-inside");
    const holder = startTestWorker(
      `
        import fs from "node:fs";
        const originalRmSync = fs.rmSync;
        const originalWriteFileSync = fs.writeFileSync;
        let paused = false;
        fs.rmSync = function(target, options) {
          if (!paused && String(target) === process.env.LOCK_PATH) {
            paused = true;
            originalWriteFileSync(process.env.HOLDER_PAUSED, "ready");
            while (!fs.existsSync(process.env.RELEASE_HOLDER)) {
              try { process.kill(Number(process.env.TEST_PARENT_PID), 0); }
              catch { process.exit(124); }
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
            }
          }
          return originalRmSync.call(fs, target, options);
        };
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        const result = bridge.bindWorkspace({
          projectId: process.env.PROJECT_ID,
          rootPath: process.env.WORKSPACE_DIR,
          now: "2026-07-16T03:23:00.000Z",
        });
        process.stdout.write(JSON.stringify(result));
      `,
      {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        PROJECT_ID: projectId,
        WORKSPACE_DIR: workspaceDir,
        LOCK_PATH: lockPath,
        HOLDER_PAUSED: holderPaused,
        RELEASE_HOLDER: releaseHolder,
        TEST_PARENT_PID: String(process.pid),
      },
    );

    let contender: TestWorker | undefined;
    try {
      await waitForAllMarkers([holderPaused], 5_000);
      contender = startTestWorker(
        `
          import fs from "node:fs";
          const originalReadFileSync = fs.readFileSync;
          const originalAppendFileSync = fs.appendFileSync;
          const originalRmSync = fs.rmSync;
          const originalRenameSync = fs.renameSync;
          const calls = { scans: 0, appends: 0, lockRemovals: 0 };
          fs.readFileSync = function(target, ...args) {
            if (String(target) === process.env.RECOVERY_FILE) calls.scans += 1;
            return originalReadFileSync.call(fs, target, ...args);
          };
          fs.appendFileSync = function(target, ...args) {
            if (String(target) === process.env.RECOVERY_FILE) calls.appends += 1;
            return originalAppendFileSync.call(fs, target, ...args);
          };
          fs.rmSync = function(target, options) {
            if (String(target) === process.env.LOCK_PATH) calls.lockRemovals += 1;
            return originalRmSync.call(fs, target, options);
          };
          fs.renameSync = function(source, target) {
            if (String(target) === process.env.BINDING_FILE) {
              fs.writeFileSync(process.env.CONTENDER_INSIDE, "inside");
            }
            return originalRenameSync.call(fs, source, target);
          };
          let clockReads = 0;
          Date.now = () => clockReads++ < 2 ? 0 : 30_001;
          const bridge = await import(process.env.BRIDGE_MODULE_URL);
          let error;
          try {
            bridge.bindWorkspace({
              projectId: process.env.PROJECT_ID,
              rootPath: process.env.WORKSPACE_DIR,
              now: "2026-07-16T03:24:00.000Z",
            });
          } catch (caught) {
            error = {
              code: caught?.code ?? null,
              reason: caught?.reason ?? null,
              retryable: caught?.retryable ?? null,
              message: caught instanceof Error ? caught.message : String(caught),
            };
          }
          process.stdout.write(JSON.stringify({ error, calls }));
        `,
        {
          ...process.env,
          BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
          KNOWLEDGE_DATA_DIR: dataDir,
          PROJECT_ID: projectId,
          WORKSPACE_DIR: workspaceDir,
          BINDING_FILE: bindingPath,
          LOCK_PATH: lockPath,
          RECOVERY_FILE: recoveryFile,
          CONTENDER_INSIDE: contenderInside,
        },
      );
      const contenderOutput = JSON.parse((await withTimeout(
        contender.result,
        2_000,
        "paused-holder contender",
      )).stdout) as {
        error: { code: string; reason: string; retryable: boolean };
        calls: { scans: number; appends: number; lockRemovals: number };
      };
      expect(contenderOutput.error).toEqual(expect.objectContaining({
        code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
        reason: "claim-live-or-ambiguous",
        retryable: false,
      }));
      expect(contenderOutput.calls).toEqual({
        scans: 1,
        appends: 0,
        lockRemovals: 0,
      });
      expect(fs.existsSync(contenderInside)).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(fs.existsSync(contenderInside)).toBe(false);

      fs.writeFileSync(releaseHolder, "release");
      const holderResult = JSON.parse((await withTimeout(
        holder.result,
        5_000,
        "paused recovery holder",
      )).stdout) as { revision: number };
      expect(holderResult.revision).toBe(initial.revision + 1);
      const later = bindWorkspace({
        projectId,
        rootPath: workspaceDir,
        now: "2026-07-16T03:25:00.000Z",
      });
      expect(later.revision).toBe(initial.revision + 2);
    } finally {
      fs.writeFileSync(releaseHolder, "release");
      await settleTestWorkers([holder, ...(contender ? [contender] : [])]);
      fs.rmSync(controlDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("B01 recovery RED4 returns exact redacted lock errors and never unlinks unknown I/O", async () => {
    const projectId = "project-recovery-error-contract";
    bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockPath = `${bindingPath}.lockdir`;
    const recoveryFile = `${lockPath}.recovery`;
    const runCase = async (mode: "live-owner" | "claim-io") => {
      fs.rmSync(lockPath, { recursive: true, force: true });
      fs.rmSync(recoveryFile, { force: true });
      fs.writeFileSync(
        lockPath,
        `${JSON.stringify({
          pid: mode === "live-owner" ? process.pid : 999999999,
          token: "e".repeat(64),
        })}\n`,
        { mode: 0o600 },
      );
      if (mode === "claim-io") {
        fs.writeFileSync(recoveryFile, "injected-read-target\n", { mode: 0o600 });
      }
      const worker = startTestWorker(
        `
          import fs from "node:fs";
          const originalReadFileSync = fs.readFileSync;
          const originalRmSync = fs.rmSync;
          let lockRemovals = 0;
          fs.readFileSync = function(target, ...args) {
            if (
              process.env.MODE === "claim-io"
              && String(target) === process.env.RECOVERY_FILE
            ) {
              const error = new Error(
                "EIO " + process.env.LOCK_PATH + " " + process.env.SECRET_VALUE,
              );
              error.code = "EIO";
              throw error;
            }
            return originalReadFileSync.call(fs, target, ...args);
          };
          fs.rmSync = function(target, options) {
            if (String(target) === process.env.LOCK_PATH) lockRemovals += 1;
            return originalRmSync.call(fs, target, options);
          };
          let clockReads = 0;
          Date.now = () => clockReads++ < 2 ? 0 : 30_001;
          const bridge = await import(process.env.BRIDGE_MODULE_URL);
          let error;
          try {
            bridge.bindWorkspace({
              projectId: process.env.PROJECT_ID,
              rootPath: process.env.WORKSPACE_DIR,
              now: "2026-07-16T03:26:00.000Z",
            });
          } catch (caught) {
            error = {
              code: caught?.code ?? null,
              reason: caught?.reason ?? null,
              retryable: caught?.retryable ?? null,
              message: caught instanceof Error ? caught.message : String(caught),
            };
          }
          process.stdout.write(JSON.stringify({ error, lockRemovals }));
        `,
        {
          ...process.env,
          BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
          KNOWLEDGE_DATA_DIR: dataDir,
          PROJECT_ID: projectId,
          WORKSPACE_DIR: workspaceDir,
          LOCK_PATH: lockPath,
          RECOVERY_FILE: recoveryFile,
          MODE: mode,
          SECRET_VALUE: "capability-and-answer-must-stay-private",
        },
      );
      return JSON.parse((await withTimeout(
        worker.result,
        2_000,
        `${mode} recovery error worker`,
      )).stdout) as {
        error: { code: string; reason: string; retryable: boolean; message: string };
        lockRemovals: number;
      };
    };

    const liveOwner = await runCase("live-owner");
    expect(liveOwner.error).toEqual(expect.objectContaining({
      code: "AGENT_BRIDGE_LOCK_BUSY",
      retryable: true,
    }));
    expect(liveOwner.lockRemovals).toBe(0);

    const unknownClaim = await runCase("claim-io");
    expect(unknownClaim.error).toEqual(expect.objectContaining({
      code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
      reason: "claim-live-or-ambiguous",
      retryable: false,
    }));
    expect(unknownClaim.lockRemovals).toBe(0);
    for (const privateValue of [
      dataDir,
      workspaceDir,
      lockPath,
      "capability-and-answer-must-stay-private",
    ]) {
      expect(liveOwner.error.message).not.toContain(privateValue);
      expect(unknownClaim.error.message).not.toContain(privateValue);
    }
  });

  it("B01 recovery RED5 fails closed on ambiguous recovery records without mutation", async () => {
    const ambiguousRecords = [
      `{"operation":"acquire","pid":${process.pid}`,
      `${JSON.stringify({
        operation: "acquire",
        pid: "not-a-pid",
        token: "f".repeat(64),
      })}\n`,
      `${JSON.stringify({
        operation: "unknown",
        pid: process.pid,
        token: "f".repeat(64),
      })}\n`,
      `${JSON.stringify({
        operation: "release",
        pid: process.pid,
        token: "1".repeat(64),
      })}\n`,
      [
        { operation: "acquire", pid: process.pid, token: "2".repeat(64) },
        { operation: "release", pid: process.pid + 1, token: "2".repeat(64) },
      ].map((event) => `${JSON.stringify(event)}\n`).join(""),
      [
        { operation: "acquire", pid: 999999998, token: "3".repeat(64) },
        { operation: "acquire", pid: 999999998, token: "3".repeat(64) },
      ].map((event) => `${JSON.stringify(event)}\n`).join(""),
      [
        { operation: "acquire", pid: 999999997, token: "4".repeat(64) },
        { operation: "release", pid: 999999997, token: "4".repeat(64) },
        { operation: "release", pid: 999999997, token: "4".repeat(64) },
      ].map((event) => `${JSON.stringify(event)}\n`).join(""),
    ];

    for (const [index, ambiguousRecord] of ambiguousRecords.entries()) {
      const projectId = `project-recovery-ambiguous-record-${index}`;
      bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
      const bindingPath = path.join(
        dataDir,
        "agent-bridge",
        "bindings",
        `${encodeURIComponent(projectId)}.json`,
      );
      const lockPath = `${bindingPath}.lockdir`;
      const recoveryFile = `${lockPath}.recovery`;
      fs.writeFileSync(
        lockPath,
        `${JSON.stringify({ pid: 999999999, token: "f".repeat(64) })}\n`,
        { mode: 0o600 },
      );
      fs.writeFileSync(recoveryFile, ambiguousRecord, { mode: 0o600 });

      const worker = startTestWorker(
        `
          import fs from "node:fs";
          const originalReadFileSync = fs.readFileSync;
          const originalAppendFileSync = fs.appendFileSync;
          const originalRmSync = fs.rmSync;
          const calls = { scans: 0, appends: 0, unlinks: 0 };
          fs.readFileSync = function(target, ...args) {
            if (String(target) === process.env.RECOVERY_FILE) calls.scans += 1;
            return originalReadFileSync.call(fs, target, ...args);
          };
          fs.appendFileSync = function(target, ...args) {
            if (String(target) === process.env.RECOVERY_FILE) calls.appends += 1;
            return originalAppendFileSync.call(fs, target, ...args);
          };
          fs.rmSync = function(target, options) {
            if (String(target) === process.env.LOCK_PATH) calls.unlinks += 1;
            return originalRmSync.call(fs, target, options);
          };
          let clockReads = 0;
          Date.now = () => clockReads++ < 2 ? 0 : 30_001;
          const bridge = await import(process.env.BRIDGE_MODULE_URL);
          let result;
          let error;
          try {
            result = bridge.bindWorkspace({
              projectId: process.env.PROJECT_ID,
              rootPath: process.env.WORKSPACE_DIR,
              now: "2026-07-16T03:30:00.000Z",
            });
          } catch (caught) {
            error = {
              code: caught?.code ?? null,
              reason: caught?.reason ?? null,
              retryable: caught?.retryable ?? null,
              message: caught instanceof Error ? caught.message : String(caught),
            };
          }
          process.stdout.write(JSON.stringify({ result, error, calls }));
        `,
        {
          ...process.env,
          BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
          KNOWLEDGE_DATA_DIR: dataDir,
          PROJECT_ID: projectId,
          WORKSPACE_DIR: workspaceDir,
          LOCK_PATH: lockPath,
          RECOVERY_FILE: recoveryFile,
        },
      );

      const output = JSON.parse((await withTimeout(
        worker.result,
        2_000,
        `ambiguous recovery record worker ${index}`,
      )).stdout) as {
        result?: unknown;
        error?: { code: string; reason: string; retryable: boolean; message: string };
        calls: { scans: number; appends: number; unlinks: number };
      };
      expect(output.result).toBeUndefined();
      expect(output.error).toEqual(expect.objectContaining({
        code: "AGENT_BRIDGE_RECOVERY_REQUIRED",
        reason: "claim-live-or-ambiguous",
        retryable: false,
        message: "Agent Bridge 锁需要手动恢复",
      }));
      expect(output.calls).toEqual({ scans: 1, appends: 0, unlinks: 0 });
      expect(fs.readFileSync(recoveryFile)).toEqual(Buffer.from(ambiguousRecord));
      expect(fs.existsSync(lockPath)).toBe(true);
      expect(output.error?.message).not.toContain(dataDir);
      expect(output.error?.message).not.toContain(workspaceDir);
      expect(output.error?.message).not.toContain(lockPath);
      expect(output.error?.message).not.toContain("f".repeat(64));
      expect(output.error?.message).not.toContain(ambiguousRecord);
    }
  });

  it("B01 recovery RED5 preserves valid interleaved acquire and release records", () => {
    const projectId = "project-recovery-valid-interleaving";
    const initial = bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockPath = `${bindingPath}.lockdir`;
    const recoveryFile = `${lockPath}.recovery`;
    fs.writeFileSync(
      lockPath,
      `${JSON.stringify({ pid: 999999999, token: "5".repeat(64) })}\n`,
      { mode: 0o600 },
    );
    const interleaved = [
      { operation: "acquire", pid: 999999998, token: "6".repeat(64) },
      { operation: "acquire", pid: 999999997, token: "7".repeat(64) },
      { operation: "release", pid: 999999997, token: "7".repeat(64) },
      { operation: "release", pid: 999999998, token: "6".repeat(64) },
    ].map((event) => `${JSON.stringify(event)}\n`).join("");
    fs.writeFileSync(recoveryFile, interleaved, { mode: 0o600 });

    const recovered = bindWorkspace({
      projectId,
      rootPath: workspaceDir,
      now: "2026-07-16T03:31:00.000Z",
    });
    expect(recovered.revision).toBe(initial.revision + 1);
  });

  it("B01 recovery RED6 limits one project call to one recovery claim", async () => {
    const projectId = "project-recovery-one-claim-per-call";
    const initial = bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const bindingPath = path.join(
      dataDir,
      "agent-bridge",
      "bindings",
      `${encodeURIComponent(projectId)}.json`,
    );
    const lockPath = `${bindingPath}.lockdir`;
    const recoveryFile = `${lockPath}.recovery`;
    const deadL1 = `${JSON.stringify({
      pid: 999999999,
      token: "8".repeat(64),
    })}\n`;
    const deadL2 = `${JSON.stringify({
      pid: 999999998,
      token: "9".repeat(64),
    })}\n`;
    fs.writeFileSync(lockPath, deadL1, { mode: 0o600 });

    const worker = startTestWorker(
      `
        import fs from "node:fs";
        const originalAppendFileSync = fs.appendFileSync;
        const originalLinkSync = fs.linkSync;
        const originalRmSync = fs.rmSync;
        const originalRenameSync = fs.renameSync;
        const originalWriteFileSync = fs.writeFileSync;
        let recoveredL1 = false;
        let injectedL2 = false;
        let protectedEntry = false;
        let linkAttempts = 0;
        let unlinks = 0;
        fs.appendFileSync = function(target, ...args) {
          return originalAppendFileSync.call(fs, target, ...args);
        };
        fs.rmSync = function(target, options) {
          const result = originalRmSync.call(fs, target, options);
          if (String(target) === process.env.LOCK_PATH) {
            unlinks += 1;
            if (unlinks === 1) recoveredL1 = true;
          }
          return result;
        };
        fs.linkSync = function(source, target) {
          if (String(target) === process.env.LOCK_PATH) {
            linkAttempts += 1;
            if (recoveredL1 && !injectedL2) {
              injectedL2 = true;
              originalWriteFileSync(target, process.env.DEAD_L2, {
                encoding: "utf8",
                flag: "wx",
                mode: 0o600,
              });
            }
          }
          return originalLinkSync.call(fs, source, target);
        };
        fs.renameSync = function(source, target) {
          if (String(target) === process.env.BINDING_FILE) protectedEntry = true;
          return originalRenameSync.call(fs, source, target);
        };
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        let result;
        let error;
        try {
          result = bridge.bindWorkspace({
            projectId: process.env.PROJECT_ID,
            rootPath: process.env.WORKSPACE_DIR,
            now: "2026-07-16T03:40:00.000Z",
          });
        } catch (caught) {
          error = {
            code: caught?.code ?? null,
            reason: caught?.reason ?? null,
            retryable: caught?.retryable ?? null,
            message: caught instanceof Error ? caught.message : String(caught),
          };
        }
        const events = fs.readFileSync(process.env.RECOVERY_FILE, "utf8")
          .split("\\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line).operation);
        const lockRaw = fs.existsSync(process.env.LOCK_PATH)
          ? fs.readFileSync(process.env.LOCK_PATH, "utf8")
          : null;
        process.stdout.write(JSON.stringify({
          result,
          error,
          events,
          lockRaw,
          linkAttempts,
          protectedEntry,
          unlinks,
        }));
      `,
      {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        PROJECT_ID: projectId,
        WORKSPACE_DIR: workspaceDir,
        BINDING_FILE: bindingPath,
        LOCK_PATH: lockPath,
        RECOVERY_FILE: recoveryFile,
        DEAD_L2: deadL2,
      },
    );

    const output = JSON.parse((await withTimeout(
      worker.result,
      5_000,
      "one-claim project recovery worker",
    )).stdout) as {
      result?: { revision: number };
      error?: { code: string; reason: string; retryable: boolean; message: string };
      events: string[];
      lockRaw: string | null;
      linkAttempts: number;
      protectedEntry: boolean;
      unlinks: number;
    };
    expect(output.events).toEqual(["acquire", "release"]);
    expect(output.result).toBeUndefined();
    expect(output.error).toEqual({
      code: "AGENT_BRIDGE_LOCK_BUSY",
      reason: "owner-live-or-ambiguous",
      retryable: true,
      message: "Agent Bridge 锁正在使用",
    });
    expect(output.linkAttempts).toBe(2);
    expect(output.protectedEntry).toBe(false);
    expect(output.unlinks).toBe(1);
    expect(output.lockRaw).toBe(deadL2);
    for (const privateValue of [dataDir, workspaceDir, lockPath, deadL2]) {
      expect(output.error?.message).not.toContain(privateValue);
    }

    const later = bindWorkspace({
      projectId,
      rootPath: workspaceDir,
      now: "2026-07-16T03:41:00.000Z",
    });
    expect(later.revision).toBe(initial.revision + 1);
  });

  it("B01 recovery RED6 limits one request call to one recovery claim", async () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const projectId = "project-request-one-claim-per-call";
    const binding = bindWorkspace({ projectId, rootPath: workspaceDir, now: NOW });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId,
      bindingId: binding.id,
      capability,
      sessionId: "session-one-claim-per-call",
      turnId: "turn-one-claim-per-call",
      clientRequestId: "client-one-claim-per-call",
      relativePath: "DECISION.md",
      question: "是否读取？",
      options: [
        { id: "yes", label: "读取" },
        { id: "no", label: "暂不读取" },
      ],
      now: NOW,
    });
    const requestPath = path.join(
      dataDir,
      "agent-bridge",
      "requests",
      `${request.id}.json`,
    );
    const lockPath = `${requestPath}.lock`;
    const recoveryFile = `${lockPath}.recovery`;
    const deadL1 = `${JSON.stringify({
      pid: 999999999,
      token: "a".repeat(64),
    })}\n`;
    const deadL2 = `${JSON.stringify({
      pid: 999999998,
      token: "b".repeat(64),
    })}\n`;
    fs.writeFileSync(lockPath, deadL1, { mode: 0o600 });

    const worker = startTestWorker(
      `
        import fs from "node:fs";
        const originalLinkSync = fs.linkSync;
        const originalReadFileSync = fs.readFileSync;
        const originalRmSync = fs.rmSync;
        const originalWriteFileSync = fs.writeFileSync;
        let recoveredL1 = false;
        let injectedL2 = false;
        let protectedEntry = false;
        let linkAttempts = 0;
        let unlinks = 0;
        fs.rmSync = function(target, options) {
          const result = originalRmSync.call(fs, target, options);
          if (String(target) === process.env.LOCK_PATH) {
            unlinks += 1;
            if (unlinks === 1) recoveredL1 = true;
          }
          return result;
        };
        fs.linkSync = function(source, target) {
          if (String(target) === process.env.LOCK_PATH) {
            linkAttempts += 1;
            if (recoveredL1 && !injectedL2) {
              injectedL2 = true;
              originalWriteFileSync(target, process.env.DEAD_L2, {
                encoding: "utf8",
                flag: "wx",
                mode: 0o600,
              });
            }
          }
          return originalLinkSync.call(fs, source, target);
        };
        fs.readFileSync = function(target, ...args) {
          if (String(target) === process.env.REQUEST_FILE) protectedEntry = true;
          return originalReadFileSync.call(fs, target, ...args);
        };
        const bridge = await import(process.env.BRIDGE_MODULE_URL);
        let result;
        let error;
        try {
          result = bridge.getAgentRequestForAgent({
            projectId: process.env.PROJECT_ID,
            requestId: process.env.REQUEST_ID,
            bindingId: process.env.BINDING_ID,
            capability: process.env.CAPABILITY,
          });
        } catch (caught) {
          error = {
            code: caught?.code ?? null,
            reason: caught?.reason ?? null,
            retryable: caught?.retryable ?? null,
            message: caught instanceof Error ? caught.message : String(caught),
          };
        }
        const events = originalReadFileSync(process.env.RECOVERY_FILE, "utf8")
          .split("\\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line).operation);
        const lockRaw = fs.existsSync(process.env.LOCK_PATH)
          ? originalReadFileSync(process.env.LOCK_PATH, "utf8")
          : null;
        process.stdout.write(JSON.stringify({
          result,
          error,
          events,
          lockRaw,
          linkAttempts,
          protectedEntry,
          unlinks,
        }));
      `,
      {
        ...process.env,
        BRIDGE_MODULE_URL: new URL("./agent-bridge.ts", import.meta.url).href,
        KNOWLEDGE_DATA_DIR: dataDir,
        PROJECT_ID: projectId,
        REQUEST_ID: request.id,
        REQUEST_FILE: requestPath,
        BINDING_ID: binding.id,
        CAPABILITY: capability,
        LOCK_PATH: lockPath,
        RECOVERY_FILE: recoveryFile,
        DEAD_L2: deadL2,
      },
    );

    const output = JSON.parse((await withTimeout(
      worker.result,
      5_000,
      "one-claim request recovery worker",
    )).stdout) as {
      result?: { status: string };
      error?: { code: string; reason: string; retryable: boolean; message: string };
      events: string[];
      lockRaw: string | null;
      linkAttempts: number;
      protectedEntry: boolean;
      unlinks: number;
    };
    expect(output.events).toEqual(["acquire", "release"]);
    expect(output.result).toBeUndefined();
    expect(output.error).toEqual({
      code: "AGENT_BRIDGE_LOCK_BUSY",
      reason: "owner-live-or-ambiguous",
      retryable: true,
      message: "Agent Bridge 锁正在使用",
    });
    expect(output.linkAttempts).toBe(2);
    expect(output.protectedEntry).toBe(false);
    expect(output.unlinks).toBe(1);
    expect(output.lockRaw).toBe(deadL2);
    for (const privateValue of [
      dataDir,
      workspaceDir,
      lockPath,
      deadL2,
      capability,
    ]) {
      expect(output.error?.message).not.toContain(privateValue);
    }

    const later = getAgentRequestForAgent({
      projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
    });
    expect(later.status).toBe("pending");
  });

  it("F03 R2 rejects non-exact ACK identity without changing answered state", () => {
    fs.writeFileSync(path.join(workspaceDir, "DECISION.md"), "# 决定\n", "utf8");
    const binding = bindWorkspace({
      projectId: "project-exact-ack-identity",
      rootPath: workspaceDir,
      now: NOW,
    });
    const capability = readAgentCapability(binding.id);
    const request = createAgentRequest({
      projectId: "project-exact-ack-identity",
      bindingId: binding.id,
      capability,
      sessionId: "session-exact",
      turnId: "turn-exact",
      clientRequestId: "client-exact-ack-identity",
      relativePath: "DECISION.md",
      question: "是否交付？",
      options: [
        { id: "yes", label: "交付" },
        { id: "no", label: "暂不交付" },
      ],
      now: NOW,
    });
    respondToAgentRequest({
      projectId: request.projectId,
      requestId: request.id,
      requestHash: request.requestHash,
      selectedOptionId: "yes",
    });
    const deliveryChallenge = getAgentRequestForAgent({
      projectId: request.projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
    }).deliveryChallenge!;
    const validProof = {
      projectId: request.projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
      requestHash: request.requestHash,
      sessionId: request.sessionId,
      turnId: request.turnId,
      bindingRevision: request.bindingRevision,
      deliveryChallenge,
    };

    expect(() => acknowledgeAgentRequest({
      ...validProof,
      sessionId: ` ${request.sessionId} `,
      turnId: `\t${request.turnId}\n`,
    })).toThrowError(AgentBridgeConflictError);
    for (const invalidIdentity of [
      { sessionId: 123 },
      { turnId: true },
    ]) {
      expect(() => acknowledgeAgentRequest({
        ...validProof,
        ...invalidIdentity,
      } as unknown as Parameters<typeof acknowledgeAgentRequest>[0]))
        .toThrow(/Agent (sessionId|turnId) 无效/);
    }
    expect(getAgentRequest(request.projectId, request.id)).toEqual(
      expect.objectContaining({ status: "answered" }),
    );
    expect(getAgentRequest(request.projectId, request.id)?.deliveredAt)
      .toBeUndefined();
    expect(getAgentRequestForAgent({
      projectId: request.projectId,
      requestId: request.id,
      bindingId: binding.id,
      capability,
    }).deliveryChallenge).toBe(deliveryChallenge);
  });
});
