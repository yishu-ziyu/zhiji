#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";

const EVENT_VERSION = 1;
const DEFAULT_LOCK_TIMEOUT_MS = 5000;
const DEFAULT_STALE_LOCK_MS = 30_000;

class CliError extends Error {}

function usage() {
  return `Usage:
  collab-events.mjs publish --agent NAME --session ID --summary TEXT
  collab-events.mjs status [--json]
  collab-events.mjs follow [--json]

COLLAB_AGENT and COLLAB_SESSION may replace the matching publish flags.`;
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`${name} must be a positive integer`);
  }
  return parsed;
}

function git(cwd, ...args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString().trim();
    throw new CliError(stderr || `git ${args.join(" ")} failed`);
  }
}

function repositoryContext(cwd = process.cwd()) {
  let branch;
  try {
    branch = git(cwd, "symbolic-ref", "--quiet", "--short", "HEAD");
  } catch {
    branch = "DETACHED";
  }
  return {
    commonDir: git(
      cwd,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ),
    worktree: git(cwd, "rev-parse", "--show-toplevel"),
    branch,
    sha: git(cwd, "rev-parse", "HEAD"),
  };
}

function storePaths(commonDir) {
  const directory = join(commonDir, "collab");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return {
    directory,
    log: join(directory, "events.jsonl"),
    lock: join(directory, "events.lock"),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(paths) {
  const timeoutMs = positiveInteger(
    process.env.COLLAB_LOCK_TIMEOUT_MS,
    DEFAULT_LOCK_TIMEOUT_MS,
    "COLLAB_LOCK_TIMEOUT_MS",
  );
  const staleMs = positiveInteger(
    process.env.COLLAB_STALE_LOCK_MS,
    DEFAULT_STALE_LOCK_MS,
    "COLLAB_STALE_LOCK_MS",
  );
  const startedAt = Date.now();
  const token = randomUUID();

  while (true) {
    try {
      mkdirSync(paths.lock, { mode: 0o700 });
      try {
        writeFileSync(
          join(paths.lock, "owner.json"),
          `${JSON.stringify({ token, pid: process.pid, createdAt: new Date().toISOString() })}\n`,
          { encoding: "utf8", mode: 0o600 },
        );
      } catch (error) {
        rmSync(paths.lock, { recursive: true, force: true });
        throw error;
      }
      return () => {
        try {
          const owner = JSON.parse(
            readFileSync(join(paths.lock, "owner.json"), "utf8"),
          );
          if (owner.token === token) {
            rmSync(paths.lock, { recursive: true, force: true });
          }
        } catch {
          // A stale-lock recovery may already have removed this lock.
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(paths.lock).mtimeMs > staleMs) {
          rmSync(paths.lock, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError?.code !== "ENOENT") throw statError;
        continue;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new CliError(`timed out waiting for ${paths.lock}`);
      }
      await delay(20);
    }
  }
}

async function withLock(paths, operation) {
  const release = await acquireLock(paths);
  try {
    return operation();
  } finally {
    release();
  }
}

function appendJsonLine(path, value) {
  const buffer = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  const fd = openSync(path, "a", 0o600);
  try {
    let offset = 0;
    while (offset < buffer.length) {
      offset += writeSync(fd, buffer, offset, buffer.length - offset);
    }
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function readEventsUnlocked(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new CliError(`invalid JSON in collaboration log line ${index + 1}`);
      }
    });
}

function parseOptions(args, definitions) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const kind = definitions[flag];
    if (!kind) throw new CliError(`unknown option: ${flag}`);
    if (kind === "boolean") {
      options[flag.slice(2)] = true;
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new CliError(`${flag} requires a value`);
    }
    options[flag.slice(2)] = value;
    index += 1;
  }
  return options;
}

async function publish(args) {
  const options = parseOptions(args, {
    "--agent": "string",
    "--session": "string",
    "--summary": "string",
  });
  const agent = options.agent || process.env.COLLAB_AGENT;
  const session = options.session || process.env.COLLAB_SESSION;
  const summary = options.summary;
  if (!agent?.trim()) throw new CliError("publish requires --agent or COLLAB_AGENT");
  if (!session?.trim()) {
    throw new CliError("publish requires --session or COLLAB_SESSION");
  }
  if (!summary?.trim()) throw new CliError("publish requires --summary");

  const context = repositoryContext();
  const paths = storePaths(context.commonDir);
  const event = {
    version: EVENT_VERSION,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    agent: agent.trim(),
    session: session.trim(),
    worktree: context.worktree,
    branch: context.branch,
    sha: context.sha,
    summary: summary.trim(),
  };
  await withLock(paths, () => appendJsonLine(paths.log, event));
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function latestPerSession(events) {
  const latest = new Map();
  for (const [index, event] of events.entries()) {
    latest.set(`${event.agent}\u0000${event.session}`, { event, index });
  }
  return [...latest.values()]
    .sort((left, right) => left.index - right.index)
    .map(({ event }) => event);
}

function formatEvent(event) {
  return `${event.timestamp} ${event.agent}/${event.session} ${event.branch}@${event.sha.slice(0, 8)} ${event.summary}\n  ${event.worktree}`;
}

async function status(args) {
  const options = parseOptions(args, { "--json": "boolean" });
  const context = repositoryContext();
  const paths = storePaths(context.commonDir);
  const events = await withLock(paths, () => readEventsUnlocked(paths.log));
  const latest = latestPerSession(events);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(latest, null, 2)}\n`);
    return;
  }
  if (latest.length === 0) {
    process.stdout.write("No collaboration events.\n");
    return;
  }
  process.stdout.write(`${latest.map(formatEvent).join("\n")}\n`);
}

async function follow(args) {
  const options = parseOptions(args, { "--json": "boolean" });
  const pollMs = positiveInteger(
    process.env.COLLAB_POLL_MS,
    250,
    "COLLAB_POLL_MS",
  );
  const context = repositoryContext();
  const paths = storePaths(context.commonDir);
  let offset = await withLock(paths, () =>
    existsSync(paths.log) ? statSync(paths.log).size : 0,
  );
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.stderr.write(`following ${paths.log}\n`);

  while (!stopped) {
    await delay(pollMs);
    const chunk = await withLock(paths, () => {
      if (!existsSync(paths.log)) return Buffer.alloc(0);
      const data = readFileSync(paths.log);
      if (data.length < offset) {
        throw new CliError("collaboration log was truncated");
      }
      const appended = data.subarray(offset);
      offset = data.length;
      return appended;
    });
    if (chunk.length === 0) continue;
    const text = chunk.toString("utf8");
    if (!text.endsWith("\n")) {
      throw new CliError("collaboration log ended with an incomplete record");
    }
    for (const line of text.split("\n").filter(Boolean)) {
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        throw new CliError("invalid JSON appended to collaboration log");
      }
      process.stdout.write(
        options.json ? `${JSON.stringify(event)}\n` : `${formatEvent(event)}\n`,
      );
    }
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command === "publish") return publish(args);
  if (command === "status") return status(args);
  if (command === "follow") return follow(args);
  throw new CliError(`unknown command: ${command}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n${usage()}\n`);
  process.exitCode = error instanceof CliError ? 2 : 1;
});
