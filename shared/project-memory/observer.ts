import fs from "node:fs";
import path from "node:path";
import { subscribe as parcelSubscribe } from "@parcel/watcher";
import { sha256Hex } from "./cas";
import type {
  ObservationAdapter,
  ObservationSignal,
  SourceGrant,
  StopHandle,
} from "./types";

export type ParcelWatchEvent = {
  type: "create" | "update" | "delete";
  path: string;
};

export type ParcelWatchSubscription = {
  unsubscribe(): Promise<void> | void;
};

export type ParcelWatcher = {
  subscribe(
    rootPath: string,
    callback: (
      events: ParcelWatchEvent[],
      error?: Error,
    ) => Promise<void> | void,
  ): Promise<ParcelWatchSubscription>;
};

export type LocalObservationAdapterOptions = {
  watcher?: ParcelWatcher;
  clock?: () => string;
  maxReadAttempts?: number;
  onReconcile?: (signals: ObservationSignal[]) => Promise<void> | void;
};

export class GrantBoundaryError extends Error {
  constructor(message = "path is outside the authorized grant root") {
    super(message);
    this.name = "GrantBoundaryError";
  }
}

const defaultWatcher: ParcelWatcher = {
  subscribe(rootPath, callback) {
    return parcelSubscribe(rootPath, (error, events) => {
      if (error) return callback([], error);
      return callback(
        events.map((event) => ({
          type: event.type as ParcelWatchEvent["type"],
          path: event.path,
        })),
      );
    });
  },
};

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

/**
 * Lexical grant boundary check used before any filesystem read. A grant root
 * itself is not a source file, so the returned path must be non-empty.
 */
export function relativePathWithinGrantRoot(
  rootPath: string,
  candidatePath: string,
): string {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  if (!isWithinRoot(root, candidate)) {
    throw new GrantBoundaryError(
      `path is outside the authorized grant root: ${candidatePath}`,
    );
  }
  const relative = path.relative(root, candidate);
  if (!relative || relative === ".") {
    throw new GrantBoundaryError("grant root is not a source file");
  }
  return relative.split(path.sep).join("/");
}

function relativeSignalPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized === "." ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new GrantBoundaryError(`invalid relative observation path: ${relativePath}`);
  }
  return normalized;
}

async function realpathInsideRoot(
  rootPath: string,
  candidatePath: string,
): Promise<{ relativePath: string; realPath: string; exists: boolean }> {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const realRoot = await fs.promises.realpath(root);

  let probe = candidate;
  const missingSuffix: string[] = [];
  while (true) {
    try {
      const realProbe = await fs.promises.realpath(probe);
      if (!isWithinRoot(realRoot, realProbe)) {
        throw new GrantBoundaryError(
          `resolved path is outside the authorized grant root: ${candidatePath}`,
        );
      }
      return {
        relativePath: path
          .relative(
            realRoot,
            missingSuffix.length
              ? path.join(realProbe, ...missingSuffix)
              : realProbe,
          )
          .split(path.sep)
          .join("/"),
        realPath: missingSuffix.length
          ? path.join(realProbe, ...missingSuffix)
          : realProbe,
        exists: missingSuffix.length === 0,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(probe);
      if (parent === probe) throw error;
      missingSuffix.unshift(path.basename(probe));
      probe = parent;
    }
  }
}

async function readStableFile(
  rootPath: string,
  candidatePath: string,
  maxReadAttempts: number,
): Promise<Uint8Array | null> {
  const safe = await realpathInsideRoot(rootPath, candidatePath);
  if (!safe.exists) return null;

  for (let attempt = 0; attempt < maxReadAttempts; attempt += 1) {
    const before = await fs.promises.stat(safe.realPath);
    if (!before.isFile()) return null;
    const content = new Uint8Array(await fs.promises.readFile(safe.realPath));
    const after = await fs.promises.stat(safe.realPath);
    if (
      before.size === after.size &&
      before.mtimeMs === after.mtimeMs &&
      before.ctimeMs === after.ctimeMs
    ) {
      return content;
    }
  }
  throw new Error(`file changed while being read: ${candidatePath}`);
}

async function collectFiles(
  rootPath: string,
  directory: string,
  output: Array<{ relativePath: string; content: Uint8Array }>,
  visitedDirectories: Set<string>,
  maxReadAttempts: number,
): Promise<void> {
  const realDirectory = await fs.promises.realpath(directory);
  if (!isWithinRoot(rootPath, realDirectory)) {
    return;
  }
  if (visitedDirectories.has(realDirectory)) return;
  visitedDirectories.add(realDirectory);

  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.lstat(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }

    if (stat.isSymbolicLink()) {
      let resolved: Awaited<ReturnType<typeof realpathInsideRoot>>;
      try {
        resolved = await realpathInsideRoot(rootPath, candidate);
      } catch (error) {
        if (error instanceof GrantBoundaryError) continue;
        throw error;
      }
      if (!resolved.exists) continue;
      const targetStat = await fs.promises.stat(resolved.realPath);
      if (targetStat.isDirectory()) continue;
      if (!targetStat.isFile()) continue;
      const content = await readStableFile(rootPath, candidate, maxReadAttempts);
      if (content) {
        output.push({ relativePath: resolved.relativePath, content });
      }
      continue;
    }

    if (stat.isDirectory()) {
      await collectFiles(
        rootPath,
        candidate,
        output,
        visitedDirectories,
        maxReadAttempts,
      );
      continue;
    }
    if (!stat.isFile()) continue;

    const content = await readStableFile(rootPath, candidate, maxReadAttempts);
    if (content) {
      output.push({
        relativePath: relativePathWithinGrantRoot(rootPath, candidate),
        content,
      });
    }
  }
}

function reconcileDedupeKey(grant: SourceGrant, relativePath: string, content: Uint8Array): string {
  return `reconcile:${grant.id}:${relativePath}:${sha256Hex(content)}`;
}

export class LocalObservationAdapter implements ObservationAdapter {
  private readonly watcher: ParcelWatcher;
  private readonly clock: () => string;
  private readonly maxReadAttempts: number;
  private readonly onReconcile?: LocalObservationAdapterOptions["onReconcile"];

  constructor(options: LocalObservationAdapterOptions = {}) {
    this.watcher = options.watcher ?? defaultWatcher;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.maxReadAttempts = Math.max(1, options.maxReadAttempts ?? 3);
    this.onReconcile = options.onReconcile;
  }

  async reconcile(grant: SourceGrant): Promise<ObservationSignal[]> {
    if (grant.status !== "active") {
      return [];
    }
    const root = await fs.promises.realpath(grant.rootPath);
    const rootStat = await fs.promises.stat(root);
    if (!rootStat.isDirectory()) {
      throw new Error("grant root must be a directory");
    }

    const files: Array<{ relativePath: string; content: Uint8Array }> = [];
    await collectFiles(
      root,
      root,
      files,
      new Set<string>(),
      this.maxReadAttempts,
    );
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const signals = files.map<ObservationSignal>((file) => ({
      projectId: grant.projectId,
      grantId: grant.id,
      kind: "reconciled",
      relativePath: file.relativePath,
      content: file.content,
      observedAt: this.clock(),
      dedupeKey: reconcileDedupeKey(grant, file.relativePath, file.content),
    }));
    await this.onReconcile?.(signals);
    return signals;
  }

  private async eventToSignal(
    grant: SourceGrant,
    event: ParcelWatchEvent,
  ): Promise<ObservationSignal | null> {
    const safe = await realpathInsideRoot(grant.rootPath, event.path);
    const relativePath = safe.relativePath;
    if (!relativePath || relativePath === ".") {
      throw new GrantBoundaryError("grant root is not a source file");
    }
    const observedAt = this.clock();
    if (event.type === "delete") {
      return {
        projectId: grant.projectId,
        grantId: grant.id,
        kind: "deleted",
        relativePath,
        observedAt,
      };
    }

    const content = await readStableFile(
      grant.rootPath,
      event.path,
      this.maxReadAttempts,
    );
    if (!content) return null;
    const kind = event.type === "create" ? "added" : "modified";
    return {
      projectId: grant.projectId,
      grantId: grant.id,
      kind,
      relativePath,
      content,
      observedAt,
      dedupeKey: `watch:${grant.id}:${kind}:${relativePath}:${sha256Hex(content)}`,
    };
  }

  async start(
    grant: SourceGrant,
    emit: (signal: ObservationSignal) => Promise<void>,
  ): Promise<StopHandle> {
    if (grant.status !== "active") {
      throw new Error(`cannot observe grant in status ${grant.status}`);
    }
    const root = await fs.promises.realpath(grant.rootPath);
    const rootStat = await fs.promises.stat(root);
    if (!rootStat.isDirectory()) {
      throw new Error("grant root must be a directory");
    }

    let stopped = false;
    let queue = Promise.resolve();
    const fullReconcile = async (): Promise<void> => {
      if (stopped) return;
      const signals = await this.reconcile(grant);
      for (const signal of signals) await emit(signal);
    };
    const callback = (
      events: ParcelWatchEvent[],
      error?: Error,
    ): Promise<void> => {
      const work = queue.then(async () => {
        if (stopped) return;
        try {
          if (error) throw error;
          for (const event of events) {
            const signal = await this.eventToSignal(grant, event);
            if (signal) await emit(signal);
          }
        } catch (caught) {
          if (caught instanceof GrantBoundaryError) throw caught;
          // Provider errors and overflows converge on a fresh authorized-root
          // read before processing resumes; boundary violations are rejected.
          await fullReconcile();
        }
      });
      // Keep later provider callbacks processable after a boundary rejection,
      // while returning the rejection to the caller immediately.
      queue = work.catch(() => undefined);
      return work;
    };

    let subscription: ParcelWatchSubscription;
    try {
      subscription = await this.watcher.subscribe(root, callback);
    } catch (error) {
      await fullReconcile();
      throw error;
    }

    try {
      await fullReconcile();
    } catch (error) {
      await subscription.unsubscribe();
      throw error;
    }

    return {
      stop: async () => {
        if (stopped) return;
        stopped = true;
        await queue;
        await subscription.unsubscribe();
      },
    };
  }
}

export function createLocalObservationAdapter(
  options: LocalObservationAdapterOptions = {},
): ObservationAdapter {
  return new LocalObservationAdapter(options);
}

export function validateObservationRelativePath(relativePath: string): string {
  return relativeSignalPath(relativePath);
}
